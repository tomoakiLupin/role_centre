class PostApplyValidator {

    parseLink(link) {
        // 匹配论坛帖子链接: /channels/guildId/threadId
        const match = link.match(/discord\.com\/channels\/(\d+)\/(\d+)/);
        if (!match) return null;
        
        // 检查是否有第三部分（messageId），如果有则认为无效
        const parts = link.split('/');
        if (parts.length > 7) return null;

        return {
            guildId: match[1],
            threadId: match[2]
        };
    }

    async validate(interaction, postLink) {
        const linkData = this.parseLink(postLink);
        if (!linkData) {
            return { valid: false, message: '无效的论坛帖子链接格式请提供帖子的主链接，而不是帖子内某条消息的链接' };
        }

        if (linkData.guildId !== interaction.guildId) {
            return { valid: false, message: '该帖子不属于当前服务器' };
        }

        // 从 modal customId 解析参数: post_apply_modal:post_apply:roleId:reactions[:channelId]
        const parts = interaction.customId.split(':');
        const roleId = parts[2];
        const requiredReactions = parseInt(parts[3], 10);
        const requiredChannelId = parts.length > 4 ? parts[4] : null;

        const role = await interaction.guild.roles.fetch(roleId);
        if (!role) {
            return { valid: false, message: '申请的身份组不存在' };
        }

        try {
            const thread = await interaction.client.channels.fetch(linkData.threadId);
            if (!thread || !thread.isThread()) {
                 return { valid: false, message: '找不到指定的论坛帖子' };
            }

            if (requiredChannelId && thread.parentId !== requiredChannelId) {
                return { valid: false, message: `该帖子必须发布在 <#${requiredChannelId}> 论坛中` };
            }
            
            // 论坛帖子的第一条消息就是主楼
            const message = await thread.fetchStarterMessage();

            if (message.author.id !== interaction.user.id) {
                return { valid: false, message: '您不是该帖子的作者' };
            }

            const highestReactionCount = message.reactions.cache.reduce((max, reaction) => Math.max(max, reaction.count), 0);

            if (highestReactionCount < requiredReactions) {
                return { valid: false, message: `您的帖子最高反应数（${highestReactionCount}）未达到要求的 ${requiredReactions} 个` };
            }

            return { valid: true, role: role, message: '验证通过！' };

        } catch (error) {
            console.error('获取帖子信息时出错:', error);
            return { valid: false, message: '无法获取帖子信息，请检查链接是否正确或机器人是否有权限访问该频道' };
        }
    }
}

module.exports = new PostApplyValidator();