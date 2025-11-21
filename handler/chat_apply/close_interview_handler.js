const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const { config } = require('../../config/config');
const { PERMISSION_LEVELS } = require('../../utils/auth');

class CloseInterviewHandler {
    constructor() {
        this.commandName = 'close_interview';
        this.requiredPermission = PERMISSION_LEVELS.ADMIN
    }

    async execute(interaction) {
        const { channel, guildId, user } = interaction;

        if (!channel.name.startsWith('面谈-')) {
            return interaction.reply({ content: '❌ 此命令只能在面谈频道中使用。', ephemeral: true });
        }

        const applicantPermission = channel.permissionOverwrites.cache.find(p =>
            p.type === 1 && // Member type
            p.allow.has(PermissionsBitField.Flags.SendMessages) &&
            p.id !== user.id
        );

        if (!applicantPermission) {
            return interaction.reply({ content: '❌ 无法在此频道中找到申请人。', ephemeral: true });
        }

        const applicantId = applicantPermission.id;
        const guildConfig = config.get(`chat_Apply.${guildId}`);
        let giveRoleId = null;

        if (guildConfig && guildConfig.data) {
            for (const cfg of Object.values(guildConfig.data)) {
                if (channel.parent && channel.parent.name === cfg.category_name) {
                    giveRoleId = cfg.role_config?.give_role_id;
                    break;
                }
            }
        }

        if (!giveRoleId) {
            return interaction.reply({ content: '❌ 未能找到此面谈对应的 `give_role_id` 配置。', ephemeral: true });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`interview_pass:${applicantId}:${giveRoleId}`)
                .setLabel('通过并授予身份')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`interview_fail:${applicantId}`)
                .setLabel('不授予身份')
                .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({
            content: '请选择面谈结果：',
            components: [row],
            ephemeral: true
        });
    }
}

module.exports = new CloseInterviewHandler();