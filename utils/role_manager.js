const path = require('path');
const { sendLog } = require('./logger');
const FileEditor = require('./file_editor');

const USER_ROLES_PATH = path.join(__dirname, '../data/user_roles_by_guild.json');
const userRolesEditor = new FileEditor(USER_ROLES_PATH);

/**
 * 为单个用户分配身份组（无操作ID的场景）
 * @param {object} params
 * @param {string} params.userId - 用户ID
 * @param {string} params.guildId - 服务器ID
 * @param {string} params.roleId - 身份组ID
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function assignRoleToUser({ userId, guildId, roleId }) {
    if (!global.client) {
        console.error('[role_manager] global.client is not available.');
        return { success: false, message: 'Internal server error: client not available.' };
    }

    try {
        const guild = await global.client.guilds.fetch(guildId);
        if (!guild) {
            return { success: false, message: `Guild with ID ${guildId} not found.` };
        }

        const role = await guild.roles.fetch(roleId);
        if (!role) {
            return { success: false, message: `Role with ID ${roleId} not found in guild ${guild.name}.` };
        }

        const member = await guild.members.fetch(userId);
        if (!member) {
            return { success: false, message: `User with ID ${userId} not found in guild ${guild.name}.` };
        }

        // 实际为用户添加身份组
        await member.roles.add(role);

        // 更新 user_roles_by_guild.json
        await userRolesEditor.atomic_write(async (data) => {
            const currentData = data || {};
            if (!currentData[guildId]) {
                currentData[guildId] = {};
            }
            if (!currentData[guildId][userId]) {
                currentData[guildId][userId] = [];
            }

            const userRoles = new Set(currentData[guildId][userId]);
            userRoles.add(roleId);
            currentData[guildId][userId] = [...userRoles];

            return currentData;
        });

        // 记录日志
        await sendLog(global.client, 'info', {
            module: 'gRPC AssignRole',
            operation: '基础身份组分配',
            message: `成功为用户 ${member.user.tag} (${userId}) 分配身份组 ${role.name} (${roleId})。`,
            details: {
                guildId,
                userId,
                roleId,
            }
        });

        return { success: true, message: `Successfully assigned role ${role.name} to user ${member.user.tag}.` };

    } catch (error) {
        console.error('[role_manager] Error in assignRoleToUser:', error);
        await sendLog(global.client, 'error', {
            module: 'gRPC AssignRole',
            operation: '基础身份组分配',
            message: `为用户 ${userId} 分配身份组 ${roleId} 时失败: ${error.message}`,
            error: error.stack,
        });
        return { success: false, message: `An error occurred: ${error.message}` };
    }
}

module.exports = {
    assignRoleToUser,
};