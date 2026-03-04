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
                .setNameLocalizations({ 'zh-CN': '作品文件', 'zh-TW': '作品文件' })
                .setDescription('要上传的文件')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('req_reaction')
                .setNameLocalizations({ 'zh-CN': '是否点赞', 'zh-TW': '是否點讚' })
                .setDescription('是否要求下载者在当前频道的首贴点赞?')
                .setRequired(false)
                .addChoices(
                    { name: '✅ 是', value: 'true' },
                    { name: '❌ 否', value: 'false' }
                )
        )
        .addStringOption(option =>
            option.setName('captcha_text')
                .setNameLocalizations({ 'zh-CN': '提取密码', 'zh-TW': '提取密碼' })
                .setDescription('是否要求输入提取码/口令？(如有,请在此输入您设定的口令)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('req_terms')
                .setNameLocalizations({ 'zh-CN': '是否阅读须知', 'zh-TW': '是否閱讀须知' })
                .setDescription('是否要求下载者阅读注意事项?')
                .setRequired(false)
                .addChoices(
                    { name: '✅ 是', value: 'true' },
                    { name: '❌ 否', value: 'false' }
                )
        ),
    async execute(interaction) {
        // 命令注册所需，实际逻辑由 handler 处理
    }
};
