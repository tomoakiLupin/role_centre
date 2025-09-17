const CacheMatch = require('../../utils/cache_match');
const FileEditor = require('../../utils/file_editor');
const RoleLeavePanelUI = require('../../ui/role_leave_panel');
const { sendLog } = require('../../utils/logger');
const path = require('path');

class RoleLeaveButtonHandler {
    constructor() {
        this.cacheFilePath = path.join(process.cwd(), 'data/cache/role_leave.json');
        this.logFilePath = path.join(process.cwd(), 'data/log/role_leave_log.json');
        this.cacheEditor = new FileEditor(this.cacheFilePath);
        this.logEditor = new FileEditor(this.logFilePath);
    }

    async execute(interaction, cacheId) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const cacheData = await this.cacheEditor.read();
            const key = CacheMatch.formatCustomId('role_leave', cacheId);

            if (!cacheData || !cacheData[key]) {
                const errorMessage = RoleLeavePanelUI.createErrorMessage('cache_expired');
                return await interaction.editReply(errorMessage);
            }

            const panelData = cacheData[key];
            const { roleIds, roleNames, guildId } = panelData;

            if (interaction.guild.id !== guildId) {
                const errorMessage = RoleLeavePanelUI.createErrorMessage('permission_denied');
                return await interaction.editReply(errorMessage);
            }

            const member = await interaction.guild.members.fetch(interaction.user.id);
            const userRoles = member.roles.cache;

            const roleNamesToLeave = [];
            for (let i = 0; i < roleIds.length; i++) {
                if (userRoles.has(roleIds[i])) {
                    roleNamesToLeave.push(roleNames[i]);
                }
            }

            if (roleNamesToLeave.length === 0) {
                const errorMessage = RoleLeavePanelUI.createErrorMessage('no_roles');
                return await interaction.editReply(errorMessage);
            }

            const confirmationPrompt = RoleLeavePanelUI.createLeaveConfirmationPrompt(cacheId, roleNamesToLeave);
            await interaction.editReply(confirmationPrompt);

        } catch (error) {
            console.error('Error preparing role leave confirmation:', error);
            const errorMessage = RoleLeavePanelUI.createErrorMessage('general');
            await interaction.editReply(errorMessage).catch(() => {});
        }
    }

    async handleConfirm(interaction, cacheId) {
        await interaction.deferUpdate();

        try {
            const cacheData = await this.cacheEditor.read();
            const key = CacheMatch.formatCustomId('role_leave', cacheId);

            if (!cacheData || !cacheData[key]) {
                const errorMessage = RoleLeavePanelUI.createErrorMessage('cache_expired');
                return await interaction.editReply(errorMessage);
            }

            const panelData = cacheData[key];
            const { roleIds, roleNames, enableLogging, guildId } = panelData;

            if (interaction.guild.id !== guildId) {
                const errorMessage = RoleLeavePanelUI.createErrorMessage('permission_denied');
                return await interaction.editReply(errorMessage);
            }

            const member = await interaction.guild.members.fetch(interaction.user.id);
            const userRoles = member.roles.cache;

            const rolesToRemove = [];
            const roleNamesToRemove = [];

            for (let i = 0; i < roleIds.length; i++) {
                if (userRoles.has(roleIds[i])) {
                    rolesToRemove.push(roleIds[i]);
                    roleNamesToRemove.push(roleNames[i]);
                }
            }

            if (rolesToRemove.length === 0) {
                const errorMessage = RoleLeavePanelUI.createErrorMessage('no_roles');
                return await interaction.editReply(errorMessage);
            }

            try {
                await member.roles.remove(rolesToRemove);
            } catch (error) {
                console.error('Failed to remove roles:', error);
                const errorMessage = RoleLeavePanelUI.createErrorMessage('permission_denied');
                return await interaction.editReply(errorMessage);
            }

            if (enableLogging) {
                await this.logRoleLeave(cacheId, interaction.user, roleNamesToRemove);
            }

            const successMessage = RoleLeavePanelUI.createLeaveConfirmation(
                interaction.user,
                roleNamesToRemove
            );

            await interaction.editReply(successMessage);

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
            console.error('Error processing role leave:', error);
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

    async handleCancel(interaction) {
        const cancelMessage = RoleLeavePanelUI.createErrorMessage('cancelled');
        await interaction.update(cancelMessage);
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