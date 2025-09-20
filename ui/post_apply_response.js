const { EmbedBuilder } = require('discord.js');

function createSuccessEmbed(role, details) {
    const embed = new EmbedBuilder()
        .setTitle('✅ 申请成功')
        .setDescription(`恭喜！您已成功获得 **${role.name}** 身份组`)
        .setColor(0x2ECC71)
        .setTimestamp();

    if (details) {
        if (details.count !== undefined) {
            embed.addFields({ name: '有效安利数', value: `${details.count} 条`, inline: true });
        }
    }

    return embed;
}

function createFailureEmbed(message, details) {
    const embed = new EmbedBuilder()
        .setTitle('❌ 申请失败')
        .setDescription(message)
        .setColor(0xE74C3C)
        .setTimestamp();

    if (details) {
        if (details.count !== undefined && details.threshold !== undefined) {
            embed.addFields({ name: '当前有效安利', value: `${details.count} 条`, inline: true });
            embed.addFields({ name: '要求安利', value: `${details.threshold} 条`, inline: true });
        }
    }

    return embed;
}

module.exports = {
    createSuccessEmbed,
    createFailureEmbed,
};