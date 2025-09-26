const VoteManager = require('../managers/vote_manager');
const VoteButtonBuilder = require('../ui/vote_button_builder');

class VoteHandler {
    constructor() {
        this.voteManager = new VoteManager();
    }

    // 处理投票按钮交互
    async handleVoteInteraction(interaction) {
        // 检查是否为自动投票系统的按钮
        if (!VoteButtonBuilder.isAutoVoteButton(interaction.customId)) {
            return false; // 不是我们的按钮，返回false让其他处理器处理
        }

        try {
            await this.voteManager.handleVote(interaction);
            return true; // 成功处理
        } catch (error) {
            console.error('[VoteHandler] 处理投票交互失败:', error);

            // 如果交互还未响应，则发送错误消息
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '处理投票时发生错误，请稍后重试',
                    ephemeral: true
                });
            } else {
                await interaction.editReply({
                    content: '处理投票时发生错误，请稍后重试'
                });
            }
            return true; // 即使出错也返回true，因为这是我们的按钮
        }
    }

    // 创建投票
    async createVote(client, member, configId) {
        try {
            return await this.voteManager.createVote(client, member, configId);
        } catch (error) {
            console.error('[VoteHandler] 创建投票失败:', error);
            throw error;
        }
    }

    // 检查用户是否有活跃的投票
    async hasActiveVote(userId) {
        try {
            const activeVote = await this.voteManager.findActiveVoteByRequester(userId);
            return activeVote !== null;
        } catch (error) {
            console.error('[VoteHandler] 检查活跃投票失败:', error);
            return false;
        }
    }

    // 获取用户的活跃投票
    async getUserActiveVote(userId) {
        try {
            return await this.voteManager.findActiveVoteByRequester(userId);
        } catch (error) {
            console.error('[VoteHandler] 获取用户活跃投票失败:', error);
            return null;
        }
    }

    // 获取投票数据
    async getVoteData(voteId) {
        try {
            return await this.voteManager.getVote(voteId);
        } catch (error) {
            console.error('[VoteHandler] 获取投票数据失败:', error);
            return null;
        }
    }

    // 强制结束投票（管理员操作）
    async forceEndVote(client, voteId, result, adminRejected = false) {
        try {
            await this.voteManager.finalizeVote(client, voteId, result, adminRejected);
            return true;
        } catch (error) {
            console.error('[VoteHandler] 强制结束投票失败:', error);
            return false;
        }
    }
}

// 单例模式
let instance = null;

module.exports = {
    getVoteHandler() {
        if (!instance) {
            instance = new VoteHandler();
        }
        return instance;
    }
};