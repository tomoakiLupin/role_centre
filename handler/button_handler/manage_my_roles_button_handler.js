const fs = require('fs').promises;
const path = require('path');
const ManageMyRolesPanelUI = require('../../ui/manage_my_roles_panel');

const userRolesFilePath = path.join(__dirname, '..', '..', 'data', 'user_roles_by_guild.json');

class ManageMyRolesButtonHandler {
    constructor() {
        this.prefix = 'manage_my_roles:';
    }

    async execute(interaction) {
        if (interaction.isButton()) {
            await this.handleButton(interaction);
        } else if (interaction.isStringSelectMenu()) {
            await this.handleSelectMenu(interaction);
        }
    }

    async handleButton(interaction) {
        const [action, ...args] = interaction.customId.substring(this.prefix.length).split(':');

        if (action === 'wear_prompt') {
            await this.showRoleSelect(interaction, 'wear');
        } else if (action === 'remove_prompt') {
            await this.showRoleSelect(interaction, 'remove');
        } else if (action === 'view') {
            await this.viewUserRoles(interaction, parseInt(args[0], 10) || 0);
        }
    }

    async handleSelectMenu(interaction) {
        const [action] = interaction.customId.substring(this.prefix.length).split('_');
        const roleId = interaction.values[0];

        if (action === 'wear') {
            await this.updateRole(interaction, roleId, 'wear');
        } else if (action === 'remove') {
            await this.updateRole(interaction, roleId, 'remove');
        }
    }

    async getAssignableRoles(interaction, action) {
        const fileContent = await fs.readFile(userRolesFilePath, 'utf8');
        const userRolesByGuild = JSON.parse(fileContent);
        const guildRoles = userRolesByGuild[interaction.guildId];
        const userAssignableRolesIds = guildRoles ? (guildRoles[interaction.user.id] || []) : [];
        
        const memberRoles = interaction.member.roles.cache;

        let relevantRoleIds = [];
        if (action === 'wear') {
            // Filter out roles the user already has
            relevantRoleIds = userAssignableRolesIds.filter(roleId => !memberRoles.has(roleId));
        } else { // remove
            // Filter for roles the user has and is allowed to manage
            relevantRoleIds = userAssignableRolesIds.filter(roleId => memberRoles.has(roleId));
        }

        const roles = await Promise.all(relevantRoleIds.map(roleId => interaction.guild.roles.fetch(roleId)));
        return roles.filter(role => role); // Filter out any nulls if a role was deleted
    }

    async showRoleSelect(interaction, action) {
        try {
            const roles = await this.getAssignableRoles(interaction, action);
            const panel = ManageMyRolesPanelUI.createRoleSelectPanel(action, roles);
            await interaction.reply(panel);
        } catch (error) {
            console.error(`Failed to show ${action} role select:`, error);
            await interaction.reply({ content: '无法加载身份组列表', flags: [64] });
        }
    }

    async viewUserRoles(interaction, page) {
        try {
            const memberRoles = interaction.member.roles.cache;
            const fileContent = await fs.readFile(userRolesFilePath, 'utf8');
            const userRolesByGuild = JSON.parse(fileContent);
            const guildRoles = userRolesByGuild[interaction.guildId];
            const userAssignableRolesIds = guildRoles ? (guildRoles[interaction.user.id] || []) : [];

            const rolesToShow = userAssignableRolesIds.filter(id => memberRoles.has(id));
            
            const roles = await Promise.all(rolesToShow.map(roleId => interaction.guild.roles.fetch(roleId)));
            const validRoles = roles.filter(role => role);

            const panel = ManageMyRolesPanelUI.createViewRolesPanel(interaction.user, validRoles, page);
            await interaction.reply(panel);
        } catch (error) {
            console.error('Failed to show user roles:', error);
            await interaction.reply({ content: '无法加载您的身份组信息', flags: [64] });
        }
    }

    async updateRole(interaction, roleId, action) {
        try {
            const role = await interaction.guild.roles.fetch(roleId);
            if (!role) {
                const feedback = ManageMyRolesPanelUI.createFeedback(action, '未知身份组', false);
                await interaction.update(feedback);
                return;
            }

            if (action === 'wear') {
                await interaction.member.roles.add(role);
            } else {
                await interaction.member.roles.remove(role);
            }
            
            const feedback = ManageMyRolesPanelUI.createFeedback(action, role.name, true);
            await interaction.update(feedback);
        } catch (error) {
            console.error(`Failed to ${action} role ${roleId}:`, error);
            const feedback = ManageMyRolesPanelUI.createFeedback(action, '未知身份组', false);
            await interaction.update(feedback);
        }
    }
}

const handler = new ManageMyRolesButtonHandler();
module.exports = handler;