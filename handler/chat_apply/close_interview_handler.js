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

        if (!channel.name.startsWith('ticket-')) {
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

        // Extract info from channel topic
        const topic = channel.topic || '';
        const roleIdMatch = topic.match(/身份组ID: (\d+)/);
        const configIdMatch = topic.match(/配置ID: (\d+)/);

        if (!roleIdMatch || !configIdMatch) {
            return interaction.reply({ content: '❌ 频道主题信息不完整，无法确定申请的身份组或配置。', ephemeral: true });
        }
        const roleId = roleIdMatch[1];
        const configId = configIdMatch[1];

        const guildConfig = config.get(`chat_Apply.${guildId}`);
        const giveRoleId = guildConfig?.data[configId]?.role_config?.give_role_id;

        if (!giveRoleId) {
            return interaction.reply({ content: '❌ 未能找到此面谈对应的 `give_role_id` 配置。', ephemeral: true });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`interview_pass:${applicantId}:${giveRoleId}`)
                .setLabel('通过并授予身份')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`interview_fail:${applicantId}:${roleId}:${configId}`)
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