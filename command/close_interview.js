const { SlashCommandBuilder } = require('discord.js');
const { PERMISSION_LEVELS } = require('../utils/auth');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('close_interview')
        .setDescription('Close the current interview channel.')
        .setNameLocalizations({
            'zh-CN': '结束面谈',
        })
        .setDescriptionLocalizations({
            'zh-CN': '关闭当前的面谈频道。',
        }),
};