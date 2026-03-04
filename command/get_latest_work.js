const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('获取作品')
        .setDescription('获取本帖发布的最新作品 (仅限卡区论坛帖内使用)'),

    commandName: '获取作品'
};
