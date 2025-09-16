const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function createPostApplyEmbed(role, reactions, channel) {
    const description = `点击下方按钮，通过您在社区内发布的帖子来申请 **${role.name}** 身份组`;

    const embed = new EmbedBuilder()
        .setTitle(`身份组申请 - ${role.name}`)
        .setDescription(description)
        .setColor(0x5865F2)
        .addFields(
            { name: '目标身份组', value: `<@&${role.id}>`, inline: true },
            { name: '要求最高反应数', value: `\`${reactions}\` 个`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: '请确保您是帖子的作者' });

    if (channel) {
        embed.addFields({ name: '限定论坛', value: `<#${channel.id}>`, inline: false });
    } else {
        embed.addFields({ name: '限定论坛', value: '服务器内所有帖子', inline: false });
    }

    return embed;
}

function createPostApplyButton(customId) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(customId)
                .setLabel('立刻申请')
                .setStyle(ButtonStyle.Success)
        );
}

module.exports = {
    createPostApplyEmbed,
    createPostApplyButton,
};