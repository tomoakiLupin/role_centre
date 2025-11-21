const { config } = require('../../config/config');
const { addTemporaryRejection } = require('../../utils/rejection_manager');

class InterviewResultHandler {
    async handlePass(interaction) {
        const [, applicantId, roleId] = interaction.customId.split(':');
        const member = await interaction.guild.members.fetch(applicantId).catch(() => null);

        if (!member) {
            await interaction.reply({ content: '❌ 无法找到该用户。', ephemeral: true });
            return this.closeChannel(interaction, '用户未找到');
        }

        try {
            await member.roles.add(roleId);
            await interaction.reply({ content: `✅ 已成功授予 <@&${roleId}> 身份给 ${member.user.tag}。`, ephemeral: true });
            await this.closeChannel(interaction, `面谈通过 - 操作人: ${interaction.user.tag}`);
        } catch (error) {
            console.error('授予身份时出错:', error);
            await interaction.reply({ content: '❌ 授予身份时发生错误。', ephemeral: true });
        }
    }

    async handleFail(interaction) {
        const [, applicantId, roleId, configId] = interaction.customId.split(':');
        const member = await interaction.guild.members.fetch(applicantId).catch(() => null);

        const guildConfig = config.get(`chat_Apply.${interaction.guildId}`);
        const panelConfig = guildConfig?.data[configId];
        const cooldownHours = panelConfig?.rejection_cooldown_hours?.interview_rejection;

        if (cooldownHours && roleId) {
            await addTemporaryRejection(applicantId, roleId, cooldownHours);
        }

        if (member) {
            try {
                await member.send(`很遗憾，您在 **${interaction.guild.name}** 的面谈未通过。`);
            } catch (error) {
                console.error(`向 ${member.user.tag} 发送面试失败通知失败:`, error);
            }
        }
        
        await interaction.reply({ content: `ℹ️ 已将此面谈标记为未通过。`, ephemeral: true });
        await this.closeChannel(interaction, `面谈未通过 - 操作人: ${interaction.user.tag}`);
    }

    async closeChannel(interaction, reason = '无特定原因') {
        try {
            // Adding a small delay to ensure reply is sent before channel deletion
            setTimeout(async () => {
                await interaction.channel.delete(reason);
            }, 2000);
        } catch (error) {
            console.error('关闭频道时出错:', error);
            // If deletion fails, at least notify the admin
            await interaction.followUp({ content: '❌ 关闭频道时发生错误，请手动删除。', ephemeral: true });
        }
    }
}

module.exports = new InterviewResultHandler();