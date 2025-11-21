const { ChannelType, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { config } = require('../../config/config');
const { addTemporaryRejection } = require('../../utils/rejection_manager');

class InterviewAdminHandler {
    async handleApprove(interaction) {
        const [, configId, userId, roleId] = interaction.customId.split(':');
        const applicant = await interaction.guild.members.fetch(userId).catch(() => null);

        if (!applicant) {
            return interaction.reply({ content: '❌ 无法找到申请人，可能已经离开服务器。', ephemeral: true });
        }

        const guildConfig = config.get(`chat_ApplyConfig.${interaction.guildId}`);
        const panelConfig = guildConfig?.data[configId];

        if (!panelConfig || !panelConfig.interview_category_id) {
            return interaction.reply({ content: '❌ 无法创建频道，未配置面谈分区ID (interview_category_id)。', ephemeral: true });
        }

        const category = await interaction.guild.channels.fetch(panelConfig.interview_category_id).catch(() => null);
        if (!category || category.type !== ChannelType.GuildCategory) {
            return interaction.reply({ content: `❌ 未找到ID为 "${panelConfig.interview_category_id}" 的分区，或该ID不是一个分区。`, ephemeral: true });
        }

        try {
            const ticketChannels = category.children.cache.filter(c => c.name.startsWith('ticket-'));
            let maxTicketNum = 0;
            for (const ch of ticketChannels.values()) {
                const num = parseInt(ch.name.split('-')[1], 10);
                if (!isNaN(num) && num > maxTicketNum) {
                    maxTicketNum = num;
                }
            }
            const newTicketNum = maxTicketNum + 1;
            const newChannelName = `ticket-${String(newTicketNum).padStart(4, '0')}`;
            const parentOverwrites = category.permissionOverwrites.cache;

            const channel = await interaction.guild.channels.create({
                name: newChannelName,
                type: ChannelType.GuildText,
                parent: category,
                permissionOverwrites: [
                    ...parentOverwrites.values(),
                    {
                        id: applicant.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
                    },
                ],
                topic: `面试申请 - 申请人ID: ${userId}, 身份组ID: ${roleId}, 配置ID: ${configId}`,
            });

            await channel.send(`欢迎 ${applicant}！这里是你的专属面谈频道。\n\n请在此等候，管理员会尽快与你联系。`);

            await interaction.reply({ content: `✅ 已为 ${applicant.user.tag} 创建面谈频道: ${channel}`, ephemeral: true });

            const originalMessage = interaction.message;
            const newEmbed = new EmbedBuilder(originalMessage.embeds[0].data)
                .setColor('#57F287') // Green
                .setFooter({ text: `已由 ${interaction.user.tag} 处理` });

            await originalMessage.edit({ embeds: [newEmbed], components: [] });

        } catch (error) {
            console.error('创建面谈频道时出错:', error);
            await interaction.reply({ content: '❌ 创建面谈频道时发生错误。', ephemeral: true });
        }
    }

    async handleReject(interaction) {
        const [, configId, userId, roleId] = interaction.customId.split(':');
        const applicant = await interaction.client.users.fetch(userId).catch(() => null);

        const guildConfig = config.get(`chat_ApplyConfig.${interaction.guildId}`);
        const panelConfig = guildConfig?.data[configId];
        const cooldownHours = panelConfig?.rejection_cooldown_hours?.pre_screen_rejection;

        if (cooldownHours && roleId) {
            await addTemporaryRejection(userId, roleId, cooldownHours);
        }

        if (applicant) {
            try {
                await applicant.send(`很遗憾，您在 **${interaction.guild.name}** 的面谈申请已被预审拒绝。`);
            } catch (error) {
                console.error(`向 ${applicant.tag} 发送拒绝通知失败:`, error);
            }
        }

        const originalMessage = interaction.message;
        const newEmbed = new EmbedBuilder(originalMessage.embeds[0].data)
            .setColor('#ED4245') // Red
            .setFooter({ text: `已由 ${interaction.user.tag} 拒绝` });

        await originalMessage.edit({ embeds: [newEmbed], components: [] });

        await interaction.reply({ content: `✅ 已拒绝 ${applicant ? applicant.tag : '未知用户'} 的申请。`, ephemeral: true });
    }
}

module.exports = new InterviewAdminHandler();
