const { SlashCommandBuilder } = require('discord.js');

module.exports = new SlashCommandBuilder()
    .setName('批量分发')
    .setDescription('批量分发身份组给用户')
    .setNameLocalizations({
        'zh-CN': '批量分发',
        'zh-TW': '批量分發'
    })
    .setDescriptionLocalizations({
        'zh-CN': '批量分发身份组给用户',
        'zh-TW': '批量分發身份組給用戶'
    })
    .addStringOption(option =>
        option
            .setName('role_id_1')
            .setDescription('第一个身份组ID')
            .setDescriptionLocalizations({
                'zh-CN': '第一个身份组ID',
                'zh-TW': '第一個身份組ID'
            })
            .setRequired(true)
    )
    .addStringOption(option =>
        option
            .setName('role_id_2')
            .setDescription('第二个身份组ID')
            .setDescriptionLocalizations({
                'zh-CN': '第二个身份组ID',
                'zh-TW': '第二個身份組ID'
            })
            .setRequired(false)
    )
    .addStringOption(option =>
        option
            .setName('user_ids')
            .setDescription('用户ID列表，使用逗号分隔')
            .setDescriptionLocalizations({
                'zh-CN': '用户ID列表，使用逗号分隔',
                'zh-TW': '用戶ID列表，使用逗號分隔'
            })
            .setRequired(false)
    )
    .addStringOption(option =>
        option
            .setName('message_link')
            .setDescription('消息链接，用于解析参与用户')
            .setDescriptionLocalizations({
                'zh-CN': '消息链接，用于解析参与用户',
                'zh-TW': '消息鏈接，用於解析參與用戶'
            })
            .setRequired(false)
    )
    .addStringOption(option =>
        option
            .setName('operation_id')
            .setDescription('操作ID，用于追加到现有操作')
            .setDescriptionLocalizations({
                'zh-CN': '操作ID，用于追加到现有操作',
                'zh-TW': '操作ID，用於追加到現有操作'
            })
            .setRequired(false)
    )
    .addIntegerOption(option =>
        option
            .setName('timeout')
            .setDescription('有效期时长（分钟），默认90分钟')
            .setDescriptionLocalizations({
                'zh-CN': '有效期时长（分钟），默认90分钟',
                'zh-TW': '有效期時長（分鐘），默認90分鐘'
            })
            .setRequired(false)
            .setMinValue(1)
    )
    .addBooleanOption(option =>
        option
            .setName('skip_auto_expire')
            .setDescription('是否跳过自动过期，默认false')
            .setDescriptionLocalizations({
                'zh-CN': '是否跳过自动过期，默认false',
                'zh-TW': '是否跳過自動過期，默認false'
            })
            .setRequired(false)
    )
    .toJSON();