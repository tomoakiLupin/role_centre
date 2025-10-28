const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('close_vote')
        .setDescription('Force close a vote without approval or rejection.')
        .setNameLocalizations({
            'zh-CN': '关闭投票',
            'zh-TW': '關閉投票'
        })
        .setDescriptionLocalizations({
            'zh-CN': '强制关闭一个投票，不产生通过或拒绝结果',
            'zh-TW': '強制關閉一個投票，不產生通過或拒絕結果'
        })
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addStringOption(option =>
            option.setName('identifier')
                .setDescription('Vote ID or message ID')
                .setRequired(true)
                .setNameLocalizations({
                    'zh-CN': '投票标识',
                    'zh-TW': '投票標識'
                })
                .setDescriptionLocalizations({
                    'zh-CN': '投票ID或消息ID',
                    'zh-TW': '投票ID或消息ID'
                })
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for closing the vote')
                .setRequired(false)
                .setNameLocalizations({
                    'zh-CN': '原因',
                    'zh-TW': '原因'
                })
                .setDescriptionLocalizations({
                    'zh-CN': '关闭投票的原因',
                    'zh-TW': '關閉投票的原因'
                })
        )
        .addBooleanOption(option =>
            option.setName('anonymous')
                .setDescription('Close anonymously (display as bot operation)')
                .setRequired(false)
                .setNameLocalizations({
                    'zh-CN': '匿名',
                    'zh-TW': '匿名'
                })
                .setDescriptionLocalizations({
                    'zh-CN': '匿名关闭（显示为机器人操作）',
                    'zh-TW': '匿名關閉（顯示為機器人操作）'
                })
        )
        .addBooleanOption(option =>
            option.setName('ban_user')
                .setDescription('Ban user from applying again (30 days)')
                .setRequired(false)
                .setNameLocalizations({
                    'zh-CN': '封禁用户',
                    'zh-TW': '封禁用戶'
                })
                .setDescriptionLocalizations({
                    'zh-CN': '封禁用户再次申请（30天）',
                    'zh-TW': '封禁用戶再次申請（30天）'
                })
        ),
    async execute(interaction) {
        // Command execution logic will be handled by a dedicated handler.
    },
};
