const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('启用自动提示')
        .setDescription('启用发帖时自动弹出发布作品提示面板'),

    commandName: '启用自动提示'
};
