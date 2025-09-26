const fs = require('fs/promises');
const path = require('path');

class VoteDebugTools {
    constructor() {
        this.debugLogsPath = path.join(__dirname, '..', '..', '..', 'data', 'debug_logs');
    }

    // 确保调试日志目录存在
    async ensureDebugDir() {
        try {
            await fs.access(this.debugLogsPath);
        } catch (error) {
            await fs.mkdir(this.debugLogsPath, { recursive: true });
        }
    }

    // 记录投票交互调试信息
    async logVoteInteraction(debugId, type, data) {
        try {
            await this.ensureDebugDir();
            const timestamp = new Date().toISOString();
            const logEntry = {
                timestamp,
                debugId,
                type,
                data
            };

            const logFile = path.join(this.debugLogsPath, `vote_interactions_${new Date().toISOString().slice(0, 10)}.log`);
            const logLine = JSON.stringify(logEntry) + '\n';

            await fs.appendFile(logFile, logLine);
            console.log(`[VoteDebugTools] 调试日志已记录: ${type} - ${debugId}`);
        } catch (error) {
            console.error('[VoteDebugTools] 记录调试日志失败:', error);
        }
    }

    // 检查投票系统健康状态
    async checkVoteSystemHealth() {
        const health = {
            timestamp: new Date().toISOString(),
            status: 'healthy',
            issues: [],
            metrics: {}
        };

        try {
            // 检查投票数据目录
            const votesDirPath = path.join(__dirname, '..', '..', '..', 'data', 'auto_votes');
            try {
                await fs.access(votesDirPath);
                const files = await fs.readdir(votesDirPath);
                health.metrics.totalVotes = files.filter(f => f.endsWith('.json')).length;
            } catch (error) {
                health.issues.push('无法访问投票数据目录');
                health.status = 'warning';
            }

            // 检查活跃投票数量
            let activeVotes = 0;
            let pendingAdminVotes = 0;
            try {
                const files = await fs.readdir(votesDirPath);
                for (const file of files) {
                    if (file.endsWith('.json')) {
                        const voteData = JSON.parse(await fs.readFile(path.join(votesDirPath, file), 'utf8'));
                        if (voteData.status === 'pending') {
                            activeVotes++;
                        } else if (voteData.status === 'pending_admin') {
                            pendingAdminVotes++;
                        }
                    }
                }
                health.metrics.activeVotes = activeVotes;
                health.metrics.pendingAdminVotes = pendingAdminVotes;
            } catch (error) {
                health.issues.push('无法统计活跃投票');
                health.status = 'warning';
            }

            // 检查是否有超时的投票
            try {
                const files = await fs.readdir(votesDirPath);
                let timeoutVotes = 0;
                const now = new Date();

                for (const file of files) {
                    if (file.endsWith('.json')) {
                        const voteData = JSON.parse(await fs.readFile(path.join(votesDirPath, file), 'utf8'));
                        if (voteData.pendingUntil) {
                            const pendingUntil = new Date(voteData.pendingUntil);
                            if (now > pendingUntil && voteData.status === 'pending_admin') {
                                timeoutVotes++;
                            }
                        }
                    }
                }

                health.metrics.timeoutVotes = timeoutVotes;
                if (timeoutVotes > 0) {
                    health.issues.push(`发现 ${timeoutVotes} 个超时的管理员确认投票`);
                    health.status = 'warning';
                }
            } catch (error) {
                health.issues.push('无法检查超时投票');
                health.status = 'warning';
            }

            console.log('[VoteDebugTools] 投票系统健康检查完成:', health);
            return health;
        } catch (error) {
            console.error('[VoteDebugTools] 健康检查失败:', error);
            return {
                timestamp: new Date().toISOString(),
                status: 'error',
                issues: ['健康检查执行失败'],
                error: error.message
            };
        }
    }

    // 获取投票统计信息
    async getVoteStatistics(days = 7) {
        try {
            const votesDirPath = path.join(__dirname, '..', '..', '..', 'data', 'auto_votes');
            const files = await fs.readdir(votesDirPath);

            const stats = {
                total: 0,
                approved: 0,
                rejected: 0,
                pending: 0,
                pendingAdmin: 0,
                byDay: {},
                avgProcessingTime: 0
            };

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - days);

            let totalProcessingTime = 0;
            let processedVotes = 0;

            for (const file of files) {
                if (file.endsWith('.json')) {
                    const voteData = JSON.parse(await fs.readFile(path.join(votesDirPath, file), 'utf8'));
                    const createdAt = new Date(voteData.createdAt);

                    if (createdAt >= cutoffDate) {
                        stats.total++;

                        switch (voteData.status) {
                            case 'approved':
                                stats.approved++;
                                break;
                            case 'rejected':
                                stats.rejected++;
                                break;
                            case 'pending':
                                stats.pending++;
                                break;
                            case 'pending_admin':
                                stats.pendingAdmin++;
                                break;
                        }

                        // 按日期统计
                        const dateKey = createdAt.toISOString().slice(0, 10);
                        stats.byDay[dateKey] = (stats.byDay[dateKey] || 0) + 1;

                        // 计算处理时间
                        if (voteData.finalizedAt) {
                            const finalizedAt = new Date(voteData.finalizedAt);
                            const processingTime = finalizedAt - createdAt;
                            totalProcessingTime += processingTime;
                            processedVotes++;
                        }
                    }
                }
            }

            if (processedVotes > 0) {
                stats.avgProcessingTime = Math.round(totalProcessingTime / processedVotes / 1000 / 60); // 分钟
            }

            console.log(`[VoteDebugTools] 投票统计 (${days}天):`, stats);
            return stats;
        } catch (error) {
            console.error('[VoteDebugTools] 获取投票统计失败:', error);
            return null;
        }
    }

    // 清理旧的调试日志
    async cleanupOldLogs(daysToKeep = 30) {
        try {
            await this.ensureDebugDir();
            const files = await fs.readdir(this.debugLogsPath);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            let cleanedCount = 0;
            const cleanedFiles = [];

            for (const file of files) {
                if (file.startsWith('vote_interactions_') && file.endsWith('.log')) {
                    const dateStr = file.match(/vote_interactions_(\d{4}-\d{2}-\d{2})\.log/)?.[1];
                    if (dateStr) {
                        const fileDate = new Date(dateStr);
                        if (fileDate < cutoffDate) {
                            await fs.unlink(path.join(this.debugLogsPath, file));
                            cleanedFiles.push(file);
                            cleanedCount++;
                        }
                    }
                }
            }

            const logEntry = {
                timestamp: new Date().toISOString(),
                action: 'cleanup_logs',
                daysToKeep,
                cutoffDate: cutoffDate.toISOString(),
                cleanedCount,
                cleanedFiles
            };

            // 记录清理日志
            if (cleanedCount > 0) {
                console.log(`[VoteDebugTools] 清理了 ${cleanedCount} 个旧的调试日志文件:`, cleanedFiles);
            } else {
                console.log(`[VoteDebugTools] 没有找到需要清理的旧日志文件（保留${daysToKeep}天）`);
            }

            // 记录清理操作到日志文件
            await this.logVoteInteraction('system', 'cleanup_operation', logEntry);

            return cleanedCount;
        } catch (error) {
            console.error('[VoteDebugTools] 清理调试日志失败:', error);
            return 0;
        }
    }

    // 导出投票数据用于分析
    async exportVoteData(outputPath) {
        try {
            const votesDirPath = path.join(__dirname, '..', '..', '..', 'data', 'auto_votes');
            const files = await fs.readdir(votesDirPath);

            const exportData = {
                exportedAt: new Date().toISOString(),
                votes: []
            };

            for (const file of files) {
                if (file.endsWith('.json')) {
                    const voteData = JSON.parse(await fs.readFile(path.join(votesDirPath, file), 'utf8'));
                    // 移除敏感信息
                    const sanitizedData = {
                        voteId: voteData.voteId,
                        status: voteData.status,
                        createdAt: voteData.createdAt,
                        finalizedAt: voteData.finalizedAt,
                        pendingUntil: voteData.pendingUntil,
                        voteCount: {
                            approve: voteData.votes?.approve?.length || 0,
                            reject: voteData.votes?.reject?.length || 0
                        }
                    };
                    exportData.votes.push(sanitizedData);
                }
            }

            await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2));
            console.log(`[VoteDebugTools] 投票数据已导出到: ${outputPath}`);
            return exportData;
        } catch (error) {
            console.error('[VoteDebugTools] 导出投票数据失败:', error);
            return null;
        }
    }
}

module.exports = VoteDebugTools;