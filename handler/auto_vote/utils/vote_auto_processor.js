const fs = require('fs/promises');
const path = require('path');
const VoteManager = require('../managers/vote_manager');

const votesDirPath = path.join(__dirname, '..', '..', '..', 'data', 'auto_votes');

class VoteAutoProcessor {
    constructor() {
        this.voteManager = new VoteManager();
    }

    // 扫描并处理过期的投票
    async scanAndProcessExpiredVotes(client) {
        try {
            // 确保投票目录存在
            try {
                await fs.access(votesDirPath);
            } catch (error) {
                console.log('[VoteAutoProcessor] 投票目录不存在，跳过扫描');
                return;
            }

            const files = await fs.readdir(votesDirPath);
            const now = new Date();
            let processedCount = 0;

            for (const file of files) {
                if (path.extname(file) === '.json') {
                    const voteId = path.basename(file, '.json');
                    try {
                        await this.processVoteFile(client, voteId, now);
                        processedCount++;
                    } catch (error) {
                        console.error(`[VoteAutoProcessor] 处理投票文件 ${file} 失败:`, error);
                    }
                }
            }

            if (processedCount > 0) {
                console.log(`[VoteAutoProcessor] 扫描完成，处理了 ${processedCount} 个投票文件`);
            }
        } catch (error) {
            console.error('[VoteAutoProcessor] 扫描投票时出错:', error);
        }
    }

    // 处理单个投票文件
    async processVoteFile(client, voteId, currentTime) {
        const voteData = await this.voteManager.getVote(voteId);

        if (!voteData || !['pending', 'pending_admin'].includes(voteData.status)) {
            return; // 投票已结束或不存在
        }

        // 解析投票创建时间
        const creationTime = new Date(voteData.createdAt || 0);
        const timeSinceCreation = currentTime - creationTime;

        // 48小时 = 48 * 60 * 60 * 1000 毫秒
        const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

        // 如果超过48小时，自动拒绝
        if (timeSinceCreation >= FORTY_EIGHT_HOURS) {
            console.log(`[VoteAutoProcessor] 投票 ${voteId} 超过48小时，自动拒绝`);
            await this.voteManager.finalizeVote(client, voteId, 'rejected', false);
            return;
        }

        // 如果是管理员确认阶段且确认期已过，自动通过
        if (voteData.status === 'pending_admin' && voteData.pendingUntil) {
            const pendingUntil = new Date(voteData.pendingUntil);
            if (currentTime >= pendingUntil) {
                console.log(`[VoteAutoProcessor] 投票 ${voteId} 管理员确认期已过，自动通过`);
                await this.voteManager.finalizeVote(client, voteId, 'approved');
                return;
            }
        }

        // 如果是普通投票阶段且超过配置的时间限制，进入管理员确认期
        if (voteData.status === 'pending') {
            const configTimeout = this.voteManager.configManager.getVoteTimeout(voteData.config);
            const timeoutMs = configTimeout * 60 * 60 * 1000; // 转换为毫秒

            if (timeSinceCreation >= timeoutMs) {
                // 检查是否有足够的用户投票支持进入管理员确认期
                // 这里可以添加更复杂的逻辑，比如检查当前票数是否接近阈值
                console.log(`[VoteAutoProcessor] 投票 ${voteId} 已达到时间限制但仍在普通投票阶段`);
            }
        }
    }

    // 清理已完成的投票文件（可选）
    async cleanupCompletedVotes(maxAge = 7) {
        try {
            const files = await fs.readdir(votesDirPath);
            const now = new Date();
            const maxAgeMs = maxAge * 24 * 60 * 60 * 1000; // 转换为毫秒
            let cleanedCount = 0;

            for (const file of files) {
                if (path.extname(file) === '.json') {
                    const voteId = path.basename(file, '.json');
                    try {
                        const voteData = await this.voteManager.getVote(voteId);

                        if (voteData &&
                            ['approved', 'rejected'].includes(voteData.status) &&
                            voteData.finalizedAt) {
                            const finalizedTime = new Date(voteData.finalizedAt);
                            const ageMs = now - finalizedTime;

                            if (ageMs >= maxAgeMs) {
                                await this.voteManager.deleteVote(voteId);
                                cleanedCount++;
                                console.log(`[VoteAutoProcessor] 清理已完成投票: ${voteId}`);
                            }
                        }
                    } catch (error) {
                        console.error(`[VoteAutoProcessor] 清理投票文件 ${file} 时出错:`, error);
                    }
                }
            }

            if (cleanedCount > 0) {
                console.log(`[VoteAutoProcessor] 清理完成，删除了 ${cleanedCount} 个已完成的投票文件`);
            }
        } catch (error) {
            console.error('[VoteAutoProcessor] 清理投票文件时出错:', error);
        }
    }

    // 获取投票统计信息
    async getVoteStats() {
        try {
            const files = await fs.readdir(votesDirPath);
            const stats = {
                total: 0,
                pending: 0,
                pending_admin: 0,
                approved: 0,
                rejected: 0,
                expired: 0
            };

            const now = new Date();
            const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;

            for (const file of files) {
                if (path.extname(file) === '.json') {
                    try {
                        const voteId = path.basename(file, '.json');
                        const voteData = await this.voteManager.getVote(voteId);

                        if (voteData) {
                            stats.total++;
                            stats[voteData.status] = (stats[voteData.status] || 0) + 1;

                            // 检查是否过期
                            const creationTime = new Date(voteData.createdAt || 0);
                            if (now - creationTime >= FORTY_EIGHT_HOURS) {
                                stats.expired++;
                            }
                        }
                    } catch (error) {
                        console.error(`[VoteAutoProcessor] 读取投票统计 ${file} 时出错:`, error);
                    }
                }
            }

            return stats;
        } catch (error) {
            console.error('[VoteAutoProcessor] 获取投票统计时出错:', error);
            return { error: error.message };
        }
    }
}

module.exports = VoteAutoProcessor;