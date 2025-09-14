const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');

class RoleLeavePanelUI {
    static createLeavePanel(roles, cacheId, options = {}) {
        const {
            enableLogging = false,
            autoDeleteMinutes = 0
        } = options;

        const embed = new EmbedBuilder()
            .setTitle('🚪 退出身份组')
            .setDescription('点击下方按钮退出指定的身份组。')
            .setColor(0xff6b6b)
            .addFields(
                {
                    name: '📋 可退出身份组',
                    value: roles.length > 0 ? roles.map(role => `• ${role.name}`).join('\n') : '无身份组',
                    inline: false
                },
                {
                    name: '📊 记录日志',
                    value: enableLogging ? '✅ 是' : '❌ 否',
                    inline: true
                },
                {
                    name: '⏰ 自动删除',
                    value: autoDeleteMinutes > 0 ? `${autoDeleteMinutes} 分钟` : '🔄 永不',
                    inline: true
                }
            )
            .setTimestamp()
            .setFooter({ text: `缓存ID: ${cacheId}` });

        const leaveButton = new ButtonBuilder()
            .setCustomId(`role_leave:${cacheId}`)
            .setLabel('退出身份组')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🚪');

        const row = new ActionRowBuilder().addComponents(leaveButton);

        return {
            embeds: [embed],
            components: [row]
        };
    }

    static createLeaveConfirmation(user, leftRoles) {
        const embed = new EmbedBuilder()
            .setTitle('✅ 成功退出身份组')
            .setDescription('您已成功退出指定的身份组。')
            .setColor(0x00ff00)
            .addFields(
                {
                    name: '👤 用户',
                    value: `<@${user.id}>`,
                    inline: true
                },
                {
                    name: '🏷️ 已退出身份组',
                    value: leftRoles.length > 0 ? leftRoles.join(', ') : '无身份组',
                    inline: false
                }
            )
            .setTimestamp();

        return { embeds: [embed] };
    }

    static createErrorMessage(errorType) {
        let title, description, color;

        switch (errorType) {
            case 'no_roles':
                title = '⚠️ 没有可退出的身份组';
                description = '您没有任何指定的身份组可以退出。';
                color = 0xffaa00;
                break;
            case 'permission_denied':
                title = '❌ 权限不足';
                description = '您没有权限执行此操作。';
                color = 0xff0000;
                break;
            case 'cache_expired':
                title = '⏰ 操作已过期';
                description = '此退出面板已过期或不存在。';
                color = 0xff6b6b;
                break;
            default:
                title = '❌ 操作失败';
                description = '执行操作时发生未知错误。';
                color = 0xff0000;
        }

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .setTimestamp();

        return { embeds: [embed] };
    }
}

module.exports = RoleLeavePanelUI;