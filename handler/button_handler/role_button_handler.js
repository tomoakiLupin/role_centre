const RolePanelUI = require('../../ui/role_panel');
const { sendLog } = require('../../utils/logger');

class RoleButtonHandler {
    constructor() {
        this.prefix = 'role_';
    }

    async execute(interaction) {
        const [action, roleId] = interaction.customId.substring(this.prefix.length).split(':');

        try {
            const guild = interaction.guild;
            const member = interaction.member;
            const role = await guild.roles.fetch(roleId);

            if (!role) {
                await interaction.reply(RolePanelUI.createRoleFeedback(action, '未知身份组', false));
                return;
            }

            let success = false;
            if (action === 'join') {
                if (!member.roles.cache.has(roleId)) {
                    await member.roles.add(role);
                }
                success = true;
            } else if (action === 'leave') {
                if (member.roles.cache.has(roleId)) {
                    await member.roles.remove(role);
                }
                success = true;
            }

            await interaction.reply(RolePanelUI.createRoleFeedback(action, role.name, success));

            if (success) {
                sendLog(interaction.client, 'info', {
                    module: 'Role Button',
                    operation: `Role ${action}`,
                    message: `User ${member.user.tag} ${action}ed role ${role.name}`,
                    details: {
                        userId: member.id,
                        roleId: role.id,
                        action: action
                    }
                });
            }

        } catch (error) {
            console.error(`Role button interaction failed for customId ${interaction.customId}:`, error);
            await interaction.reply(RolePanelUI.createRoleFeedback(action, '未知身份组', false)).catch(() => {});

            sendLog(interaction.client, 'error', {
                module: 'Role Button',
                operation: 'Interaction',
                message: `Failed to process role button interaction: ${error.message}`,
                error: error.stack
            });
        }
    }
}

const handler = new RoleButtonHandler();
module.exports = handler;