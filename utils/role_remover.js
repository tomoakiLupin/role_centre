const { sendLog } = require('./logger');

/**
 * 从单个用户身上移除一个或多个身份组
 * @param {object} params
 * @param {string} params.userId - 用户ID
 * @param {string} params.guildId - 服务器ID
 * @param {string} params.roleIds - 身份组ID字符串，以逗号分隔
 * @param {string} params.reason - 移除原因
 * @param {string} params.operatorId - 操作者ID
 * @returns {Promise<{success: boolean, message: string, removedRoles: Array, failedRoles: Array}>}
 */
async function removeRolesFromUser({ userId, guildId, roleIds, reason, operatorId }) {
    if (!global.client) {
        console.error('[role_remover] global.client is not available.');
        return { success: false, message: 'Internal server error: client not available.', removedRoles: [], failedRoles: [] };
    }

    const roleIdArray = roleIds.split(',').map(id => id.trim()).filter(id => id);
    if (roleIdArray.length === 0) {
        return { success: false, message: 'No valid role IDs provided.', removedRoles: [], failedRoles: [] };
    }

    const removedRoles = [];
    const failedRoles = [];

    try {
        const guild = await global.client.guilds.fetch(guildId);
        if (!guild) {
            return { success: false, message: `Guild with ID ${guildId} not found.`, removedRoles, failedRoles: roleIdArray };
        }

        const member = await guild.members.fetch(userId);
        if (!member) {
            return { success: false, message: `User with ID ${userId} not found in guild ${guild.name}.`, removedRoles, failedRoles: roleIdArray };
        }

        const operator = await guild.members.fetch(operatorId);

        for (const roleId of roleIdArray) {
            try {
                const role = await guild.roles.fetch(roleId);
                if (role && member.roles.cache.has(roleId)) {
                    await member.roles.remove(role, reason);
                    removedRoles.push({ id: roleId, name: role.name });
                } else if (!role) {
                    failedRoles.push({ id: roleId, reason: 'Role not found' });
                } else {
                    failedRoles.push({ id: roleId, reason: 'User does not have this role' });
                }
            } catch (roleError) {
                console.error(`[role_remover] Error removing role ${roleId} from user ${userId}:`, roleError);
                failedRoles.push({ id: roleId, reason: roleError.message });
            }
        }

        const logMessage = `操作者 ${operator.user.tag} (${operatorId}) 从用户 ${member.user.tag} (${userId}) 身上移除了 ${removedRoles.length} 个身份组。原因: ${reason}`;
        await sendLog(global.client, 'info', {
            module: 'RoleRemove',
            operation: '移除身份组',
            message: logMessage,
            details: {
                guildId,
                userId,
                operatorId,
                reason,
                removedRoles,
                failedRoles,
            }
        });

        return {
            success: true,
            message: `Successfully processed role removals for user ${member.user.tag}.`,
            removedRoles,
            failedRoles,
        };

    } catch (error) {
        console.error('[role_remover] Error in removeRolesFromUser:', error);
        await sendLog(global.client, 'error', {
            module: 'RoleRemove',
            operation: '移除身份组',
            message: `为用户 ${userId} 移除身份组时失败: ${error.message}`,
            error: error.stack,
        });
        return { success: false, message: `An error occurred: ${error.message}`, removedRoles, failedRoles: roleIdArray };
    }
}

module.exports = {
    removeRolesFromUser,
};