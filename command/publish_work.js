const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('发布作品')
        .setDescription('打开作品发布面板（可视化配置上传条件）'),

    // CommandRegistry 会将其视为通用处理注册
    commandName: '发布作品'
};
