const { SlashCommandBuilder, ChannelType } = require('discord.js');

module.exports = new SlashCommandBuilder()
    .setName('create_role_panel')
    .setDescription('Create a panel with buttons for users to get roles')
    .setNameLocalizations({
        'zh-CN': '创建自主获取面板',
        'zh-TW': '創建自主獲取面板'
    })
    .setDescriptionLocalizations({
        'zh-CN': '创建一个带按钮的面板，用户可以通过按钮获取身份组',
        'zh-TW': '創建一個帶按鈕的面板，用戶可以通過按鈕獲取身份組'
    })
    .addStringOption(option =>
        option
            .setName('role_id')
            .setDescription('The ID of the role to assign')
            .setDescriptionLocalizations({
                'zh-CN': '身份组ID',
                'zh-TW': '身份組ID'
            })
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('title')
            .setDescription('The title of the panel')
            .setDescriptionLocalizations({
                'zh-CN': '标题',
                'zh-TW': '標題'
            })
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('content')
            .setDescription('The content description of the panel')
            .setDescriptionLocalizations({
                'zh-CN': '内容',
                'zh-TW': '內容'
            })
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('image_url')
            .setDescription('The URL of the image to display in the panel')
            .setDescriptionLocalizations({
                'zh-CN': '图片URL',
                'zh-TW': '圖片URL'
            })
            .setRequired(false)
    )
    .addChannelOption(option =>
        option
            .setName('channel')
            .setDescription('The channel to send the panel to (defaults to the current channel)')
            .setDescriptionLocalizations({
                'zh-CN': '频道（默认为当前频道）',
                'zh-TW': '頻道（默認為當前頻道）'
            })
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
    )
    .toJSON();