const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('关闭自动提示')
        .setDescription('关闭发帖时自动弹出发布作品提示面板'),

    commandName: '关闭自动提示'
};
