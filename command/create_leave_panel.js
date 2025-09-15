const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
    .setName('create_leave_panel')
    .setDescription('Create a panel with buttons for users to leave role groups')
    .setNameLocalizations({
        'zh-CN': '创建退出面板',
        'zh-TW': '創建退出面板'
    })
    .setDescriptionLocalizations({
        'zh-CN': '创建一个带按钮的面板，用户可以通过按钮退出身份组',
        'zh-TW': '創建一個帶按鈕的面板，用戶可以通過按鈕退出身份組'
    })
    .addStringOption(option =>
        option
            .setName('role_ids')
            .setDescription('Role IDs separated by commas')
            .setDescriptionLocalizations({
                'zh-CN': '身份组ID，使用逗号分隔',
                'zh-TW': '身份組ID，使用逗號分隔'
            })
            .setRequired(true)
    )
    .addBooleanOption(option =>
        option
            .setName('enable_logging')
            .setDescription('Whether to generate leave logs (default: false)')
            .setDescriptionLocalizations({
                'zh-CN': '是否生成退出日志（默认：否）',
                'zh-TW': '是否生成退出日誌（默認：否）'
            })
            .setRequired(false)
    )
    .addIntegerOption(option =>
        option
            .setName('auto_delete_minutes')
            .setDescription('Auto delete time in minutes, 0 means no auto delete (default: 0)')
            .setDescriptionLocalizations({
                'zh-CN': '自动删除时间（分钟），0表示不自动删除（默认：0）',
                'zh-TW': '自動刪除時間（分鐘），0表示不自動刪除（默認：0）'
            })
            .setRequired(false)
            .setMinValue(0)
    )
    ,
    async execute(interaction) {
        // Command execution logic goes here
    },
};