const { SlashCommandBuilder, ChannelType, PermissionsBitField } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('manage_my_roles')
        .setDescription('Creates a panel for users to manage their own roles.')
        .setNameLocalizations({
            'zh-CN': '创建身份组管理面板',
            'zh-TW': '創建身份組管理面板'
        })
        .setDescriptionLocalizations({
            'zh-CN': '创建一个面板，让用户可以管理自己的身份组',
            'zh-TW': '創建一個面板，讓用戶可以管理自己的身份組'
        })
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addStringOption(option =>
            option.setName('title')
                .setDescription('The title of the panel.')
                .setRequired(false)
                .setNameLocalizations({
                    'zh-CN': '标题',
                    'zh-TW': '標題'
                })
                .setDescriptionLocalizations({
                    'zh-CN': '面板的标题',
                    'zh-TW': '面板的標題'
                })
        )
        .addStringOption(option =>
            option.setName('content')
                .setDescription('The content description of the panel.')
                .setRequired(false)
                .setNameLocalizations({
                    'zh-CN': '内容',
                    'zh-TW': '內容'
                })
                .setDescriptionLocalizations({
                    'zh-CN': '面板的内容描述',
                    'zh-TW': '面板的內容描述'
                })
        )
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send the panel to (defaults to the current channel).')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
                .setNameLocalizations({
                    'zh-CN': '频道',
                    'zh-TW': '頻道'
                })
                .setDescriptionLocalizations({
                    'zh-CN': '要发送面板的频道（默认为当前频道）',
                    'zh-TW': '要發送面板的頻道（默認為當前頻道）'
                })
        )
        .addStringOption(option =>
            option.setName('image_url')
                .setDescription('The URL of the image to display in the panel.')
                .setRequired(false)
                .setNameLocalizations({
                    'zh-CN': 'image_url',
                    'zh-TW': 'image_url'
                })
                .setDescriptionLocalizations({
                    'zh-CN': '要在面板中显示的图片的URL',
                    'zh-TW': '要在面板中顯示的圖片的URL'
                })
        ),
    async execute(interaction) {
        // Command execution logic will be handled by a dedicated handler.
    },
};