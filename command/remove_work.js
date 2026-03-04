const { SlashCommandBuilder } = require('discord.js');
const forumCommandsHandler = require('../handler/forum_commands_handler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('移除作品')
        .setDescription('根据提取代码，彻底删除自己上传的某个文件（及其分享信息）。')
        .addStringOption(option =>
            option.setName('file_id')
                .setDescription('要删除的文件提取代码 (文件ID)')
                .setRequired(true)
        ),
    async execute(interaction) {
        await forumCommandsHandler.executeRemoveWork(interaction);
    }
};
