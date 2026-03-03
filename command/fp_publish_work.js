const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('发布作品')
        .setDescription('打开作品发布面板 (仅限卡区论坛帖内使用)'),

    // CommandRegistry 会将其视为通用处理注册
    commandName: '发布作品'
};
