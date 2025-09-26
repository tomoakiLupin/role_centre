const { EmbedBuilder } = require('discord.js');

class VoteEmbedBuilder {
    static createVoteEmbed(voteData, config) {
        const { requesterId, targetRoleId, status, votes, pendingUntil } = voteData;
        const { revive_config } = config;
        const { allow_vote_role } = revive_config;

        const embed = new EmbedBuilder()
            .setTitle('身份组申请人工审核')
            .setColor(this.getColorByStatus(status))
            .setTimestamp()
            .setFooter({ text: `投票ID: ${voteData.voteId}` });

        // 基本信息
        embed.addFields(
            { name: '申请人', value: `<@${requesterId}>`, inline: true },
            { name: '申请身份组', value: `<@&${targetRoleId}>`, inline: true }
        );

        // 根据状态显示不同内容
        switch (status) {
            case 'pending':
                this.addPendingFields(embed, votes, allow_vote_role);
                break;
            case 'pending_admin':
                this.addPendingAdminFields(embed, pendingUntil);
                break;
            case 'approved':
                this.addApprovedFields(embed);
                break;
            case 'rejected':
                this.addRejectedFields(embed);
                break;
        }

        return embed;
    }

    static addPendingFields(embed, votes, allowVoteRole) {
        const { ratio_allow, ratio_reject } = allowVoteRole;

        // 计算当前票数
        const adminApprovals = this.countVotesByRole(votes.approve, allowVoteRole.admin);
        const userApprovals = this.countVotesByRole(votes.approve, allowVoteRole.user);
        const adminRejections = this.countVotesByRole(votes.reject, allowVoteRole.admin);
        const userRejections = this.countVotesByRole(votes.reject, allowVoteRole.user);

        embed.setDescription('投票正在进行中，请相关人员参与投票')
            .addFields(
                { name: '当前状态', value: '⏳ 投票中...', inline: false },
                {
                    name: '👍 同意',
                    value: `管理员: ${adminApprovals}/${ratio_allow.admin}\n用户: ${userApprovals}/${ratio_allow.user}`,
                    inline: true
                },
                {
                    name: '👎 拒绝',
                    value: `管理员: ${adminRejections}/${ratio_reject.admin}\n用户: ${userRejections}/${ratio_reject.user}`,
                    inline: true
                }
            );
    }

    static addPendingAdminFields(embed, pendingUntil) {
        const timestamp = Math.floor(new Date(pendingUntil).getTime() / 1000);

        embed.setDescription('用户投票已达标，等待管理员最终确认')
            .addFields(
                { name: '当前状态', value: '⏳ 等待管理员确认', inline: false },
                {
                    name: '详情',
                    value: `用户投票已达标，如果在 <t:${timestamp}:R> 内没有管理员拒绝，申请将自动通过`,
                    inline: false
                }
            );
    }

    static addApprovedFields(embed) {
        embed.setDescription('投票已通过，身份组已成功授予申请人')
            .addFields(
                { name: '最终状态', value: '✅ 已通过', inline: false }
            );
    }

    static addRejectedFields(embed) {
        embed.setDescription('投票已被拒绝，申请未通过')
            .addFields(
                { name: '最终状态', value: '❌ 已拒绝', inline: false }
            );
    }

    static getColorByStatus(status) {
        const colors = {
            pending: 0x3498db,      // 蓝色
            pending_admin: 0xf1c40f, // 黄色
            approved: 0x2ecc71,     // 绿色
            rejected: 0xe74c3c      // 红色
        };
        return colors[status] || 0x95a5a6;
    }

    static countVotesByRole(votes, roleId) {
        // 这个方法需要在实际使用时传入 guild 对象来检查用户角色
        // 暂时返回 0，实际实现时需要遍历投票用户并检查角色
        return 0;
    }

    // 异步版本的票数统计，需要 guild 对象
    static async countVotesByRoleAsync(votes, roleId, guild) {
        if (!votes || !Array.isArray(votes) || !guild) return 0;

        let count = 0;
        for (const userId of votes) {
            try {
                const member = await guild.members.fetch(userId);
                if (member && member.roles.cache.has(String(roleId))) {
                    count++;
                }
            } catch (error) {
                console.warn(`[VoteEmbedBuilder] 无法获取用户 ${userId} 信息:`, error.message);
            }
        }
        return count;
    }

    // 创建带有实时票数的嵌入消息
    static async createVoteEmbedWithCounts(voteData, config, guild) {
        const { votes, status } = voteData;
        const { revive_config } = config;
        const { allow_vote_role } = revive_config;

        if (status !== 'pending') {
            return this.createVoteEmbed(voteData, config);
        }

        // 异步计算票数
        const adminApprovals = await this.countVotesByRoleAsync(votes.approve, allow_vote_role.admin, guild);
        const userApprovals = await this.countVotesByRoleAsync(votes.approve, allow_vote_role.user, guild);
        const adminRejections = await this.countVotesByRoleAsync(votes.reject, allow_vote_role.admin, guild);
        const userRejections = await this.countVotesByRoleAsync(votes.reject, allow_vote_role.user, guild);

        // 创建基础嵌入
        const embed = new EmbedBuilder()
            .setTitle('身份组申请人工审核')
            .setColor(this.getColorByStatus(status))
            .setDescription('投票正在进行中，请相关人员参与投票')
            .setTimestamp()
            .setFooter({ text: `投票ID: ${voteData.voteId}` })
            .addFields(
                { name: '申请人', value: `<@${voteData.requesterId}>`, inline: true },
                { name: '申请身份组', value: `<@&${voteData.targetRoleId}>`, inline: true },
                { name: '当前状态', value: '⏳ 投票中...', inline: false },
                {
                    name: '👍 同意',
                    value: `管理员: ${adminApprovals}/${allow_vote_role.ratio_allow.admin}\n用户: ${userApprovals}/${allow_vote_role.ratio_allow.user}`,
                    inline: true
                },
                {
                    name: '👎 拒绝',
                    value: `管理员: ${adminRejections}/${allow_vote_role.ratio_reject.admin}\n用户: ${userRejections}/${allow_vote_role.ratio_reject.user}`,
                    inline: true
                }
            );

        return embed;
    }
}

module.exports = VoteEmbedBuilder;