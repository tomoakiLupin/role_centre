const { EmbedBuilder } = require('discord.js');
const { getPermissionLevel, PERMISSION_LEVELS } = require('../utils/auth');
const fs = require('fs').promises;
const path = require('path');
const { getUserStats } = require('../db/message_stats_db');

class QueryMyStatsHandler {
    constructor() {
        this.commandName = 'query_my_stats';
        this.requiredPermission = PERMISSION_LEVELS.NONE;
    }

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const userOption = interaction.options.getUser('user');
        const member = interaction.member;
        const userPermissionLevel = getPermissionLevel(member.user.id, member.roles.cache.map(role => role.id));

        let targetUser = interaction.user;
        let permissionWarning = false;

        if (userOption) {
            if (userPermissionLevel >= PERMISSION_LEVELS.ADMIN) {
                targetUser = userOption;
            } else {
                permissionWarning = true;
            }
        }

        const stats = await getUserStats(targetUser.id);

        const embed = new EmbedBuilder()
            .setAuthor({ name: `${targetUser.username} 的消息统计`, iconURL: targetUser.displayAvatarURL() })
            .setColor('#0099ff')
            .setTimestamp();

        if (permissionWarning) {
            embed.setFooter({ text: '提示：您没有权限查询其他用户，已为您显示自己的数据' });
        }

        if (!stats || stats.message_count === 0) {
            embed.setDescription('在数据库中未找到您的消息记录');
        } else {
            embed.addFields(
                { name: '有效消息', value: `${stats.message_count} 条`, inline: true },
                { name: '无效消息', value: `${stats.invalid_message_count} 条`, inline: true },
                { name: '提及其他用户', value: `${stats.mention_count} 次`, inline: true },
                { name: '被其他用户提及', value: `${stats.mentioned_count} 次`, inline: true },
                { name: '最后发言时间', value: `<t:${Math.floor(stats.last_message_time / 1000)}:R>`, inline: true }
            );
        }

        await interaction.editReply({ embeds: [embed], ephemeral: true });
    }
}

module.exports = new QueryMyStatsHandler();