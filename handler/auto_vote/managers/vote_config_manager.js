const { config } = require('../../../config/config');

class VoteConfigManager {
    constructor() {
        this.configCache = new Map();
    }

    // 获取所有自动申请角色配置
    getAllAutoApplyConfigs() {
        const autoApplyConfigs = config.get('atuo_applyrole.autoApply_config');
        if (!autoApplyConfigs) {
            console.warn('[VoteConfigManager] 未找到自动申请角色配置');
            return new Map();
        }

        // 更新缓存
        this.configCache.clear();
        for (const [id, configData] of Object.entries(autoApplyConfigs)) {
            this.configCache.set(id, configData);
        }

        return new Map(Object.entries(autoApplyConfigs));
    }

    // 根据ID获取配置
    getConfigById(configId) {
        if (this.configCache.size === 0) {
            this.getAllAutoApplyConfigs();
        }
        return this.configCache.get(configId);
    }

    // 根据角色ID获取配置
    getConfigByRoleId(roleId, guildId) {
        if (this.configCache.size === 0) {
            this.getAllAutoApplyConfigs();
        }

        for (const [id, configData] of this.configCache.entries()) {
            if (configData.data.role_id === roleId && configData.guild_id === guildId) {
                return { id, config: configData };
            }
        }
        return null;
    }

    // 获取所有启用手动审核的配置
    getManualReviewConfigs(guildId = null) {
        if (this.configCache.size === 0) {
            this.getAllAutoApplyConfigs();
        }

        const manualConfigs = [];
        for (const [id, configData] of this.configCache.entries()) {
            if (configData.manual_revive && (!guildId || configData.guild_id === guildId)) {
                manualConfigs.push({ id, config: configData });
            }
        }
        return manualConfigs;
    }

    // 验证配置的完整性
    validateConfig(configData) {
        const errors = [];

        // 检查基本字段
        if (!configData.name) errors.push('缺少配置名称');
        if (!configData.guild_id) errors.push('缺少服务器ID');
        if (!configData.data) errors.push('缺少数据配置');

        if (configData.data) {
            // 检查数据字段
            if (!configData.data.role_id) errors.push('缺少目标角色ID');
            if (!configData.data.database_name || !Array.isArray(configData.data.database_name)) {
                errors.push('数据库名称必须是数组');
            }
            if (!configData.data.database_kv || !Array.isArray(configData.data.database_kv)) {
                errors.push('数据库字段必须是数组');
            }
            if (typeof configData.data.threshold !== 'number') {
                errors.push('阈值必须是数字');
            }
        }

        // 如果启用手动审核，检查审核配置
        if (configData.manual_revive && configData.revive_config) {
            const reviveConfig = configData.revive_config;
            if (!reviveConfig.review_channel_id) {
                errors.push('缺少审核频道ID');
            }
            if (!reviveConfig.allow_vote_role) {
                errors.push('缺少投票角色配置');
            } else {
                const voteRole = reviveConfig.allow_vote_role;
                if (!voteRole.admin) errors.push('缺少管理员角色ID');
                if (!voteRole.user) errors.push('缺少用户角色ID');
                if (!voteRole.ratio_allow || !voteRole.ratio_reject) {
                    errors.push('缺少投票比例配置');
                }
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // 检查配置是否需要投票
    needsVote(configData) {
        return configData.manual_revive === true;
    }

    // 生成投票ID
    generateVoteId(configId, userId) {
        const timestamp = Date.now();
        return `${configId}-${timestamp}-${userId}`;
    }

    // 获取投票时长设置（小时）
    getVoteTimeout(configData) {
        if (configData.revive_config && configData.revive_config.time) {
            const timeStr = configData.revive_config.time;
            if (timeStr.endsWith('h')) {
                return parseInt(timeStr.slice(0, -1));
            }
        }
        return 24; // 默认24小时
    }

    // 检查配置是否匹配当前服务器
    isConfigForGuild(configData, guildId) {
        return configData.guild_id === guildId;
    }

    // 获取投票角色配置的摘要信息
    getVoteRoleSummary(configData) {
        if (!configData.revive_config || !configData.revive_config.allow_vote_role) {
            return null;
        }

        const voteRole = configData.revive_config.allow_vote_role;
        return {
            adminRoleId: voteRole.admin,
            userRoleId: voteRole.user,
            approveThreshold: {
                admin: voteRole.ratio_allow?.admin || 0,
                user: voteRole.ratio_allow?.user || 0
            },
            rejectThreshold: {
                admin: voteRole.ratio_reject?.admin || 0,
                user: voteRole.ratio_reject?.user || 0
            }
        };
    }

    // 刷新配置缓存
    refreshCache() {
        config.reload();
        this.getAllAutoApplyConfigs();
        console.log('[VoteConfigManager] 配置缓存已刷新');
    }

    // 获取配置统计信息
    getConfigStats() {
        if (this.configCache.size === 0) {
            this.getAllAutoApplyConfigs();
        }

        const total = this.configCache.size;
        let manualReviewEnabled = 0;
        const guildStats = new Map();

        for (const [id, configData] of this.configCache.entries()) {
            if (configData.manual_revive) manualReviewEnabled++;

            const guildId = configData.guild_id;
            if (!guildStats.has(guildId)) {
                guildStats.set(guildId, 0);
            }
            guildStats.set(guildId, guildStats.get(guildId) + 1);
        }

        return {
            total,
            manualReviewEnabled,
            autoOnly: total - manualReviewEnabled,
            guilds: guildStats.size,
            guildStats: Object.fromEntries(guildStats)
        };
    }

    // 获取数据库查询配置
    getDatabaseConfig(configData) {
        return {
            databaseNames: configData.data.database_name || [],
            databaseFields: configData.data.database_kv || [],
            threshold: configData.data.threshold || 0,
            mustHoldRoleId: configData.data.musthold_role_id || null
        };
    }

    // 获取管理员频道ID
    getAdminChannelId(configData) {
        return configData.data.admin_channel_id;
    }

    // 获取审核频道ID
    getReviewChannelId(configData) {
        return configData.revive_config?.review_channel_id;
    }
}

// 单例模式
let instance = null;

module.exports = {
    getVoteConfigManager() {
        if (!instance) {
            instance = new VoteConfigManager();
        }
        return instance;
    }
};