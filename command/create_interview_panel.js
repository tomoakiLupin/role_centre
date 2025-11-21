const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { config } = require('../config/config');
const { PERMISSION_LEVELS } = require('../utils/auth');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('create_interview_panel')
        .setDescription('Create an interview application panel.')
        .setNameLocalizations({
            'zh-CN': '创建面谈通道',
        })
        .setDescriptionLocalizations({
            'zh-CN': '创建一个面谈申请面板',
        })
        .addStringOption(option =>
            option
                .setName('config_id')
                .setDescription('The configuration ID from chat_ApplyConfig.json')
                .setDescriptionLocalizations({
                    'zh-CN': '配置ID（来自面谈申请配置文件）',
                })
                .setRequired(true)
                .setAutocomplete(true)
        )
        .addStringOption(option =>
            option
                .setName('title')
                .setDescription('Custom title for the panel (optional)')
                .setDescriptionLocalizations({
                    'zh-CN': '面板标题（可选）',
                })
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('description')
                .setDescription('Custom description for the panel (optional)')
                .setDescriptionLocalizations({
                    'zh-CN': '面板描述（可选）',
                })
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('button_label')
                .setDescription('Custom label for the apply button (optional)')
                .setDescriptionLocalizations({
                    'zh-CN': '申请按钮文本（可选）',
                })
                .setRequired(false)
        )
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('The channel to send the panel to (defaults to the current channel)')
                .setDescriptionLocalizations({
                    'zh-CN': '发送面板的频道（默认为当前频道）',
                })
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        ),

    requiredPermission: PERMISSION_LEVELS.ADMIN,

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const applyConfig = config.get('chat_ApplyConfig', {});

        const choices = [];
        for (const [guildId, guildConfig] of Object.entries(applyConfig)) {
            if (guildId === interaction.guildId && guildConfig.data) {
                for (const [configId, configData] of Object.entries(guildConfig.data)) {
                    choices.push({
                        name: `${guildConfig.name} - ${configData.category_name} (${configId})`,
                        value: configId
                    });
                }
            }
        }

        const filtered = choices.filter(choice =>
            choice.name.toLowerCase().includes(focusedValue.toLowerCase()) ||
            choice.value.includes(focusedValue)
        );

        await interaction.respond(
            filtered.slice(0, 25)
        );
    }
};
