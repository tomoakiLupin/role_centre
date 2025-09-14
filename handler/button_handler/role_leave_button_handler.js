const CacheMatch = require('../utils/cache_match');
const FileEditor = require('../utils/file_editor');
const RoleLeavePanelUI = require('../ui/role_leave_panel');
const { sendLog } = require('../utils/logger');
const path = require('path');

class RoleLeaveButtonHandler {
    constructor() {
        this.cacheFilePath = path.join(__dirname, '../data/cache/role_leave.json');
        this.logFilePath = path.join(__dirname, '../data/log/role_leave_log.json');
        this.cacheEditor = new FileEditor(this.cacheFilePath);
        this.logEditor = new FileEditor(this.logFilePath);
    }

    async execute(interaction, cacheId) {
        await interaction.deferReply({ ephemeral: true });

        try {
            // 获取缓存数据
            const cacheData = await this.cacheEditor.read();
            const key = CacheMatch.formatCustomId('role_leave', cacheId);

            if (!cacheData || !cacheData[key]) {
                const errorMessage = RoleLeavePanelUI.createErrorMessage('cache_expired');
                return await interaction.editReply(errorMessage);
            }

            const panelData = cacheData[key];
            const { roleIds, roleNames, enableLogging, guildId } = panelData;

            // 验证服务器
            if (interaction.guild.id !== guildId) {
                const errorMessage = RoleLeavePanelUI.createErrorMessage('permission_denied');
                return await interaction.editReply(errorMessage);
            }

            // 获取用户当前拥有的身份组
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const userRoles = member.roles.cache;

            const rolesToRemove = [];
            const roleNamesToRemove = [];

            for (let i = 0; i < roleIds.length; i++) {
                const roleId = roleIds[i];
                const roleName = roleNames[i];

                if (userRoles.has(roleId)) {
                    rolesToRemove.push(roleId);
                    roleNamesToRemove.push(roleName);
                }
            }

            if (rolesToRemove.length === 0) {
                const errorMessage = RoleLeavePanelUI.createErrorMessage('no_roles');
                return await interaction.editReply(errorMessage);
            }

            // 移除身份组
            try {
                for (const roleId of rolesToRemove) {
                    await member.roles.remove(roleId);
                }
            } catch (error) {
                console.error('移除身份组失败:', error);
                const errorMessage = RoleLeavePanelUI.createErrorMessage('permission_denied');
                return await interaction.editReply(errorMessage);
            }

            // 记录日志（如果启用）
            if (enableLogging) {
                await this.logRoleLeave(cacheId, interaction.user, roleNamesToRemove);
            }

            // 创建成功消息
            const successMessage = RoleLeavePanelUI.createLeaveConfirmation(
                interaction.user,
                roleNamesToRemove
            );

            await interaction.editReply(successMessage);

            // 发送系统日志
            sendLog(interaction.client, 'info', {
                module: 'Role Leave Panel',
                operation: 'Role Removed',
                message: `User ${interaction.user.tag} left ${rolesToRemove.length} roles`,
                details: {
                    cacheId,
                    userId: interaction.user.id,
                    userTag: interaction.user.tag,
                    removedRoles: roleNamesToRemove,
                    guildId: interaction.guild.id
                }
            });

        } catch (error) {
            console.error('处理身份组退出时发生错误:', error);
            const errorMessage = RoleLeavePanelUI.createErrorMessage('general');
            await interaction.editReply(errorMessage).catch(() => {});

            sendLog(interaction.client, 'error', {
                module: 'Role Leave Panel',
                operation: 'Role Leave Error',
                message: `Error processing role leave for cache ID ${cacheId}: ${error.message}`,
                error: error.stack
            });
        }
    }

    async logRoleLeave(cacheId, user, roleNames) {
        await this.logEditor.atomic_write(async (logData) => {
            if (!logData) {
                logData = {};
            }

            if (!logData[cacheId]) {
                logData[cacheId] = [];
            }

            logData[cacheId].push({
                user_id: user.id,
                user_name: user.tag,
                left_roles: roleNames,
                timestamp: new Date().toISOString()
            });

            return logData;
        });
    }
}

module.exports = new RoleLeaveButtonHandler();