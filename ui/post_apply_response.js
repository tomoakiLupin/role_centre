const { EmbedBuilder } = require('discord.js');

function createSuccessEmbed(role) {
    return new EmbedBuilder()
        .setTitle('✅ 申请成功')
        .setDescription(`恭喜！您已成功获得 **${role.name}** 身份组`)
        .setColor(0x2ECC71)
        .setTimestamp();
}

function createFailureEmbed(message) {
    return new EmbedBuilder()
        .setTitle('❌ 申请失败')
        .setDescription(message)
        .setColor(0xE74C3C)
        .setTimestamp();
}

module.exports = {
    createSuccessEmbed,
    createFailureEmbed,
};