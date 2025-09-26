const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class VoteButtonBuilder {
    static createVoteButtons(voteId, status = 'pending') {
        const row = new ActionRowBuilder();

        switch (status) {
            case 'pending':
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`auto_vote:approve:${voteId}`)
                        .setLabel('同意')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('👍'),
                    new ButtonBuilder()
                        .setCustomId(`auto_vote:reject:${voteId}`)
                        .setLabel('拒绝')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('👎')
                );
                break;

            case 'pending_admin':
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`auto_vote:admin_approve:${voteId}`)
                        .setLabel('管理确认')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✅'),
                    new ButtonBuilder()
                        .setCustomId(`auto_vote:admin_reject:${voteId}`)
                        .setLabel('管理拒绝')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('❌')
                );
                break;

            case 'approved':
            case 'rejected':
                // 投票结束后直接移除所有按钮
                return [];

            default:
                throw new Error(`未知的投票状态: ${status}`);
        }

        return [row];
    }

    static updateButtonsForStatus(voteId, status) {
        switch (status) {
            case 'pending':
                return this.createVoteButtons(voteId, 'pending');
            case 'pending_admin':
                return this.createVoteButtons(voteId, 'pending_admin');
            case 'approved':
            case 'rejected':
                // 投票完成后返回空数组，移除所有按钮
                return [];
            default:
                return [];
        }
    }

    // 检查按钮 ID 是否属于自动投票系统
    static isAutoVoteButton(customId) {
        return customId.startsWith('auto_vote:');
    }

    // 解析按钮 ID
    static parseButtonId(customId) {
        if (!this.isAutoVoteButton(customId)) {
            return null;
        }

        const parts = customId.split(':');
        if (parts.length < 3) {
            return null;
        }

        return {
            system: parts[0], // 'auto_vote'
            action: parts[1], // 'approve', 'reject', 'admin_approve', etc.
            voteId: parts[2]  // vote ID
        };
    }

    // 获取按钮动作类型
    static getActionType(action) {
        const actionTypes = {
            approve: 'user_approve',
            reject: 'user_reject',
            admin_approve: 'admin_approve',
            admin_reject: 'admin_reject'
        };

        return actionTypes[action] || 'unknown';
    }

    // 检查动作是否为管理员专属
    static isAdminAction(action) {
        const adminActions = ['admin_approve', 'admin_reject'];
        return adminActions.includes(action);
    }
}

module.exports = VoteButtonBuilder;