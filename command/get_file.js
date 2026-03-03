const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('get_file')
        .setDescription('通过提取码获取共享文件')
        .setNameLocalizations({
            'zh-CN': '获取文件',
            'zh-TW': '獲取文件'
        })
        .setDescriptionLocalizations({
            'zh-CN': '通过提取码获取由于上传命令分享的文件',
            'zh-TW': '通過提取碼獲取由於上傳命令分享的文件'
        })
        .addStringOption(option =>
            option.setName('file_id')
                .setDescription('文件的唯一提取码')
                .setRequired(true)
        ),
    async execute(interaction) {
        // 命令注册所需，实际逻辑由 handler 处理
    }
};
