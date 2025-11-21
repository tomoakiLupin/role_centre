const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { config } = require('../../config/config');
const { PERMISSION_LEVELS } = require('../../utils/auth');

class CreateInterviewPanelHandler {
    constructor() {
        this.commandName = 'create_interview_panel';
        this.requiredPermission = PERMISSION_LEVELS.ADMIN;
    }

    async execute(interaction) {
        const configId = interaction.options.getString('config_id');
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description');
        const buttonLabel = interaction.options.getString('button_label');
        const channel = interaction.options.getChannel('channel') || interaction.channel;

        const guildConfig = config.get(`chat_Apply.${interaction.guildId}`);
        if (!guildConfig || !guildConfig.data[configId]) {
            return interaction.reply({ content: '❌ 未找到指定的配置ID。', ephemeral: true });
        }

        const panelConfig = guildConfig.data[configId];

        const embed = new EmbedBuilder()
            .setTitle(title || panelConfig.category_name || '面谈申请')
            .setDescription(description || `点击下方的按钮开始申请流程。`)
            .setColor('#0099ff');

        const applyButton = new ButtonBuilder()
            .setCustomId(`interview_apply:${configId}`)
            .setLabel(buttonLabel || '申请面談')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(applyButton);

        try {
            await channel.send({ embeds: [embed], components: [row] });
            await interaction.reply({ content: `✅ 面谈申请面板已成功发送到 ${channel}。`, ephemeral: true });
        } catch (error) {
            console.error('发送面谈申请面板时出错:', error);
            await interaction.reply({ content: '❌ 发送面板时发生错误。', ephemeral: true });
        }
    }
}

module.exports = new CreateInterviewPanelHandler();