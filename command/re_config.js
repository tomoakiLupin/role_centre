const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('re_config')
        .setDescription('Reloads the bot\'s configuration files.')
        .setNameLocalizations({
            'zh-CN': '重载配置',
            'zh-TW': '重載配置'
        })
        .setDescriptionLocalizations({
            'zh-CN': '重新加载机器人的配置文件',
            'zh-TW': '重新加載機器人的配置文件'
        })
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    async execute(interaction) {
        // Command execution logic will be handled by a dedicated handler.
    },
};