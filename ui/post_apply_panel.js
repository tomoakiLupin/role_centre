const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function createPostApplyEmbed(role, reactions, channel, grpcConfig) {
    let description = `点击下方按钮来申请 **${role.name}** 身份组`;

    if (grpcConfig) {
        description += `\n\n**申请方式：**\n• 通过帖子反应申请\n• 通过远程数据库查询申请`;
    } else {
        description += `\n\n通过您在社区内发布的帖子来申请此身份组`;
    }

    const embed = new EmbedBuilder()
        .setTitle(`身份组申请 - ${role.name}`)
        .setDescription(description)
        .setColor(0x5865F2)
        .addFields(
            { name: '目标身份组', value: `<@&${role.id}>`, inline: true },
            { name: '要求最高反应数', value: `\`${reactions}\` 个`, inline: true }
        )
        .setTimestamp();

    if (channel) {
        embed.addFields({ name: '限定论坛', value: `<#${channel.id}>`, inline: false });
    } else {
        embed.addFields({ name: '限定论坛', value: '服务器内所有帖子', inline: false });
    }

    if (grpcConfig) {
        embed.addFields({
            name: '远程查询配置',
            value: `\`${grpcConfig.name}\``,
            inline: false
        });
        embed.setFooter({ text: '您可以选择任一方式申请身份组' });
    } else {
        embed.setFooter({ text: '请确保您是帖子的作者' });
    }

    return embed;
}

function createPostApplyButton(customId, grpcConfigId, grpcButtonName) {
    const buttons = [
        new ButtonBuilder()
            .setCustomId(customId)
            .setLabel('立刻申请')
            .setStyle(ButtonStyle.Success)
    ];

    // 如果提供了 gRPC 配置，添加第二个按钮
    if (grpcConfigId) {
        const grpcCustomId = `grpc_apply:${grpcConfigId}`;
        buttons.push(
            new ButtonBuilder()
                .setCustomId(grpcCustomId)
                .setLabel(grpcButtonName)
                .setStyle(ButtonStyle.Primary)
        );
    }

    return [new ActionRowBuilder().addComponents(...buttons)];
}

module.exports = {
    createPostApplyEmbed,
    createPostApplyButton,
};