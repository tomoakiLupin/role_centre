const FileEditor = require('../utils/file_editor');
const path = require('path');
const botConfig = require('../config/bot_config.json');
const fs = require('fs').promises;

const assignmentsPath = path.join(__dirname, '../data/role_assignments.json');
const assignmentsEditor = new FileEditor(assignmentsPath);
const logDir = path.join(__dirname, '../data/log/auto-remove');

/**
 * Scans for expired role assignments and processes them.
 * @param {import('discord.js').Client} client - The Discord client.
 */
async function logOperation(opData, processedUsers) {
    await fs.mkdir(logDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const roleName = opData.data[0].role_names[0] || 'unknown_role';
    const logFileName = `${timestamp}-${roleName}.json`;
    const logFilePath = path.join(logDir, logFileName);

    const logData = {
        operation_id: opData.operation_id,
        timestamp: new Date().toISOString(),
        processed_users: processedUsers,
        original_roles: opData.data[0].role_ids,
        fade_role: botConfig.other.timeout_role_mapping[opData.data[0].guild_id]?.timeout_roleid,
    };

    await fs.writeFile(logFilePath, JSON.stringify(logData, null, 2));
}

async function scanAndProcess(client) {
    console.log('开始扫描过期的身份组...');

    const assignments = await assignmentsEditor.read();
    if (!assignments) {
        console.log('没有找到身份组分配文件，跳过扫描');
        return;
    }

    const now = Math.floor(Date.now() / 1000);
    const expiredOps = [];

    for (const [opId, opData] of assignments) {
        if (opData.fade && opData.outtime) {
            const expiryTime = opData.timestamp + (opData.outtime * 24 * 60 * 60);
            if (now > expiryTime) {
                expiredOps.push(opData);
            }
        }
    }

    if (expiredOps.length === 0) {
        console.log('没有发现过期的身份组');
        return;
    }

    for (const opData of expiredOps) {
        const processedUsers = [];
        for (const assignment of opData.data) {
            const guild = await client.guilds.fetch(assignment.guild_id.toString());
            if (!guild) continue;

            const timeoutRoleMapping = botConfig.other.timeout_role_mapping[guild.id];
            if (!timeoutRoleMapping) continue;

            const timeoutRole = await guild.roles.fetch(timeoutRoleMapping.timeout_roleid);
            if (!timeoutRole) continue;

            for (const userId of assignment.assigned_user_ids) {
                try {
                    const member = await guild.members.fetch(userId.toString());
                    if (member) {
                        const currentRoles = member.roles.cache.map(r => r.id);
                        const rolesToRemove = assignment.role_ids.map(id => id.toString());
                        
                        const newRoles = currentRoles.filter(roleId => !rolesToRemove.includes(roleId));
                        newRoles.push(timeoutRole.id);

                        await member.roles.set(newRoles);
                        processedUsers.push(userId.toString());
                        console.log(`用户 ${member.user.tag} 的身份组已更新`);
                    }
                } catch (error) {
                    console.error(`处理用户 ${userId} 时出错:`, error);
                }
            }
        }
        if (processedUsers.length > 0) {
            await logOperation(opData, processedUsers);
        }
    }

    const updatedAssignments = assignments.filter(
        ([opId, opData]) => !expiredOps.some(expiredOp => expiredOp.operation_id === opData.operation_id)
    );

    await assignmentsEditor.write(updatedAssignments);
    console.log('身份组分配文件已更新');
}

module.exports = {
    scanAndProcess,
};