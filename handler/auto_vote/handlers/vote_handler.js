const VoteManager = require('../managers/vote_manager');
const VoteButtonBuilder = require('../ui/vote_button_builder');
const VoteDebugTools = require('../utils/vote_debug_tools');

class VoteHandler {
    constructor() {
        this.voteManager = new VoteManager();
        this.debugTools = new VoteDebugTools();
        this.cleanupInterval = null;

        // 启动自动清理定时器
        this.startAutoCleanup();
    }

    // 处理投票按钮交互
    async handleVoteInteraction(interaction) {
        const startTime = Date.now();
        const debugId = `${interaction.user.id}-${Date.now()}`;

        console.log(`[VoteHandler] [${debugId}] 开始处理投票交互, customId: ${interaction.customId}, 用户: ${interaction.user.tag} (${interaction.user.id})`);

        // 检查是否为自动投票系统的按钮
        if (!VoteButtonBuilder.isAutoVoteButton(interaction.customId)) {
            console.log(`[VoteHandler] [${debugId}] 不是自动投票按钮，跳过处理`);
            return false; // 不是我们的按钮，返回false让其他处理器处理
        }

        try {
            // 解析按钮信息
            const buttonInfo = VoteButtonBuilder.parseButtonId(interaction.customId);
            console.log(`[VoteHandler] [${debugId}] 按钮信息:`, buttonInfo);

            if (!buttonInfo) {
                console.error(`[VoteHandler] [${debugId}] 无法解析按钮ID: ${interaction.customId}`);
                await this.sendErrorReply(interaction, '无效的投票按钮');
                return true;
            }

            console.log(`[VoteHandler] [${debugId}] 调用 VoteManager.handleVote, 投票ID: ${buttonInfo.voteId}, 操作: ${buttonInfo.action}`);

            // 记录调试信息
            await this.debugTools.logVoteInteraction(debugId, 'interaction_start', {
                customId: interaction.customId,
                userId: interaction.user.id,
                username: interaction.user.tag,
                buttonInfo,
                timestamp: new Date().toISOString()
            });

            await this.voteManager.handleVote(interaction);

            const processingTime = Date.now() - startTime;
            console.log(`[VoteHandler] [${debugId}] 投票交互处理成功，耗时: ${processingTime}ms`);

            // 记录成功处理的调试信息
            await this.debugTools.logVoteInteraction(debugId, 'interaction_success', {
                processingTime,
                voteId: buttonInfo.voteId,
                action: buttonInfo.action,
                timestamp: new Date().toISOString()
            });

            return true; // 成功处理
        } catch (error) {
            const processingTime = Date.now() - startTime;
            console.error(`[VoteHandler] [${debugId}] 处理投票交互失败，耗时: ${processingTime}ms`, error);
            console.error(`[VoteHandler] [${debugId}] 错误堆栈:`, error.stack);
            console.error(`[VoteHandler] [${debugId}] 交互状态: replied=${interaction.replied}, deferred=${interaction.deferred}`);

            // 记录错误调试信息
            await this.debugTools.logVoteInteraction(debugId, 'interaction_error', {
                error: error.message,
                stack: error.stack,
                processingTime,
                interactionState: {
                    replied: interaction.replied,
                    deferred: interaction.deferred
                },
                timestamp: new Date().toISOString()
            });

            // 发送用户友好的错误消息
            await this.sendErrorReply(interaction, '处理投票时发生错误，请稍后重试');
            return true; // 即使出错也返回true，因为这是我们的按钮
        }
    }

    // 统一的错误回复方法
    async sendErrorReply(interaction, message) {
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: message,
                    ephemeral: true
                });
            } else {
                await interaction.editReply({
                    content: message
                });
            }
        } catch (replyError) {
            console.error(`[VoteHandler] 发送错误回复失败:`, replyError);
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

    // 健康检查
    async performHealthCheck() {
        try {
            console.log('[VoteHandler] 执行投票系统健康检查');
            const health = await this.debugTools.checkVoteSystemHealth();

            if (health.status !== 'healthy') {
                console.warn('[VoteHandler] 投票系统健康检查发现问题:', health.issues);
            }

            return health;
        } catch (error) {
            console.error('[VoteHandler] 健康检查失败:', error);
            return {
                status: 'error',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    // 获取投票统计
    async getVoteStatistics(days = 7) {
        try {
            return await this.debugTools.getVoteStatistics(days);
        } catch (error) {
            console.error('[VoteHandler] 获取投票统计失败:', error);
            return null;
        }
    }

    // 清理旧数据
    async cleanupOldData() {
        try {
            const cleanedLogs = await this.debugTools.cleanupOldLogs(30);
            console.log(`[VoteHandler] 清理完成，删除了 ${cleanedLogs} 个旧日志文件`);
            return cleanedLogs;
        } catch (error) {
            console.error('[VoteHandler] 清理旧数据失败:', error);
            return 0;
        }
    }

    // 启动自动清理定时器
    startAutoCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        // 计算到下一个凌晨3点的时间
        const now = new Date();
        const nextCleanup = new Date();
        nextCleanup.setHours(3, 0, 0, 0); // 设置为凌晨3点

        // 如果当前时间已经过了今天的3点，则设置为明天的3点
        if (now > nextCleanup) {
            nextCleanup.setDate(nextCleanup.getDate() + 1);
        }

        const timeUntilCleanup = nextCleanup.getTime() - now.getTime();

        console.log(`[VoteHandler] 自动清理将在 ${nextCleanup.toLocaleString()} 开始`);

        // 设置初始定时器
        setTimeout(() => {
            this.performAutoCleanup();

            // 设置每24小时重复执行的定时器
            this.cleanupInterval = setInterval(() => {
                this.performAutoCleanup();
            }, 24 * 60 * 60 * 1000); // 24小时
        }, timeUntilCleanup);
    }

    // 执行自动清理
    async performAutoCleanup() {
        try {
            console.log('[VoteHandler] 开始执行自动清理...');

            // 清理旧的调试日志
            const cleanedLogs = await this.cleanupOldData();

            // 执行健康检查
            const health = await this.performHealthCheck();

            console.log(`[VoteHandler] 自动清理完成，删除了 ${cleanedLogs} 个文件，系统状态: ${health.status}`);

            // 如果发现问题，记录详细信息
            if (health.status !== 'healthy' && health.issues?.length > 0) {
                console.warn('[VoteHandler] 自动清理发现系统问题:', health.issues);
            }

        } catch (error) {
            console.error('[VoteHandler] 自动清理失败:', error);
        }
    }

    // 停止自动清理定时器
    stopAutoCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            console.log('[VoteHandler] 自动清理定时器已停止');
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