const ManageMyRolesPanelUI = require('../ui/manage_my_roles_panel');

class ManageMyRolesHandler {
    constructor() {
        this.commandName = 'manage_my_roles';
    }

    async execute(interaction) {
        const title = interaction.options.getString('title') || '身份组管理';
        const content = interaction.options.getString('content') || '点击下方的按钮来管理您的身份组';
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const imageUrl = interaction.options.getString('image_url');

        try {
            const panel = ManageMyRolesPanelUI.createInitialPanel(title, content, imageUrl);
            await channel.send(panel);
            await interaction.reply({ content: '身份组管理面板已成功创建', flags: [64] }); // 64 = Ephemeral
        } catch (error) {
            console.error('Failed to create role management panel:', error);
            await interaction.reply({ content: '创建身份组管理面板时出错', flags: [64] });
        }
    }
}

module.exports = new ManageMyRolesHandler();