const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');

class RolePanelUI {
    static createRolePanel(title, content, imageUrl, role) {
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(content)
            .setColor(0x5865F2) // Discord Blurple
            .addFields({ name: '身份组', value: `<@&${role.id}>`, inline: false })
            .setTimestamp();

        if (imageUrl) {
            embed.setImage(imageUrl);
        }

        const joinButton = new ButtonBuilder()
            .setCustomId(`role_join:${role.id}`)
            .setLabel('加入')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅');

        const leaveButton = new ButtonBuilder()
            .setCustomId(`role_leave:${role.id}`)
            .setLabel('退出')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌');

        const row = new ActionRowBuilder().addComponents(joinButton, leaveButton);

        return {
            embeds: [embed],
            components: [row]
        };
    }

    static createRoleFeedback(action, roleName, success = true) {
        const embed = new EmbedBuilder()
            .setTitle(success ? `✅ 操作成功` : `❌ 操作失败`)
            .setDescription(success ? `您已成功 **${action === 'join' ? '加入' : '退出'}** \`${roleName}\` 身份组。` : `操作失败，请联系管理员。`)
            .setColor(success ? 0x00ff00 : 0xff0000)
            .setTimestamp();

        return { embeds: [embed], ephemeral: true };
    }
}

module.exports = RolePanelUI;