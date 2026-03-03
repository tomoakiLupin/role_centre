const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('upload_file')
        .setDescription('上传一个文件并获取分享ID')
        .setNameLocalizations({
            'zh-CN': '上传文件',
            'zh-TW': '上傳文件'
        })
        .setDescriptionLocalizations({
            'zh-CN': '上传一个私密文件，并获得以后可以用于下载的唯一提取码',
            'zh-TW': '上傳一個私密文件，並獲得以後可以用於下載的唯一提取碼'
        })
        .addAttachmentOption(option =>
            option.setName('file')
                .setDescription('要上传的文件')
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option.setName('req_reaction')
                .setDescription('是否要求下载者在当前频道的首贴点赞?')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('req_captcha')
                .setDescription('是否要求下载者输入验证码?')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('req_terms')
                .setDescription('是否要求下载者阅读注意事项?')
                .setRequired(false)
        ),
    async execute(interaction) {
        // 命令注册所需，实际逻辑由 handler 处理
    }
};
