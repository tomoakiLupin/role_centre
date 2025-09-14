const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { config } = require('../config/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('create_apply_panel')
        .setDescription('Create a role application panel based on configuration')
        .setNameLocalizations({
            'zh-CN': '创建身份组申请面板',
            'zh-TW': '創建身份組申請面板'
        })
        .setDescriptionLocalizations({
            'zh-CN': '基于配置创建身份组申请面板',
            'zh-TW': '基於配置創建身份組申請面板'
        })
        .addStringOption(option =>
            option
                .setName('config_id')
                .setDescription('The configuration ID from auto_applyrole_config.json')
                .setDescriptionLocalizations({
                    'zh-CN': '配置ID（来自自动申请配置文件）',
                    'zh-TW': '配置ID（來自自動申請配置檔案）'
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
                    'zh-TW': '面板標題（可選）'
                })
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('description')
                .setDescription('Custom description for the panel (optional)')
                .setDescriptionLocalizations({
                    'zh-CN': '面板描述（可选）',
                    'zh-TW': '面板描述（可選）'
                })
                .setRequired(false)
        )
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('The channel to send the panel to (defaults to the current channel)')
                .setDescriptionLocalizations({
                    'zh-CN': '发送面板的频道（默认为当前频道）',
                    'zh-TW': '發送面板的頻道（默認為當前頻道）'
                })
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        ),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        const autoApplyConfig = config.get('atuo_applyrole.autoApply_config', {});

        const choices = [];
        for (const [configId, configData] of Object.entries(autoApplyConfig)) {
            // 只显示当前服务器的配置
            if (configData.guild_id === interaction.guildId) {
                choices.push({
                    name: `${configId}: ${configData.name}`,
                    value: configId
                });
            }
        }

        const filtered = choices.filter(choice =>
            choice.name.toLowerCase().includes(focusedValue.toLowerCase()) ||
            choice.value.includes(focusedValue)
        );

        await interaction.respond(
            filtered.slice(0, 25) // Discord限制最多25个选项
        );
    }
};