const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('获取编号作品')
        .setDescription('通过指定的作品ID编号获取作品')
        .addStringOption(option =>
            option.setName('file_id')
                .setDescription('作品的唯一ID')
                .setRequired(true)),

    commandName: '获取编号作品'
};
