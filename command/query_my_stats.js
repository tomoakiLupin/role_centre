const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('query_my_stats')
        .setDescription('Query your statistics in the message database.')
        .setNameLocalizations({
            'zh-CN': '查询我的消息数据库',
            'zh-TW': '查詢我的訊息數據庫'
        })
        .setDescriptionLocalizations({
            'zh-CN': '查询您在消息数据库中的统计数据',
            'zh-TW': '查詢您在訊息數據庫中的統計數據'
        })
        .setDefaultMemberPermissions(PermissionsBitField.Flags.SendMessages)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to query stats for (admin only).')
                .setRequired(false)
                .setNameLocalizations({
                    'zh-CN': '用户',
                    'zh-TW': '用戶'
                })
                .setDescriptionLocalizations({
                    'zh-CN': '要查询统计数据的用户（仅限管理员）',
                    'zh-TW': '要查詢統計數據的用戶（僅限管理員）'
                })
        ),
    async execute(interaction) {
        // Command execution logic will be handled by a dedicated handler.
    },
};