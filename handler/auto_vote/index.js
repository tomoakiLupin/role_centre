// 自动投票模块主入口文件

// UI 组件
const VoteEmbedBuilder = require('./ui/vote_embed_builder');
const VoteButtonBuilder = require('./ui/vote_button_builder');

// 管理器
const VoteManager = require('./managers/vote_manager');
const VotePermissionManager = require('./managers/vote_permission_manager');
const { getVoteConfigManager } = require('./managers/vote_config_manager');

// 处理器
const { getVoteHandler } = require('./handlers/vote_handler');

// 工具类
const VoteAutoProcessor = require('./utils/vote_auto_processor');

// 导出所有组件
module.exports = {
    // UI 组件
    VoteEmbedBuilder,
    VoteButtonBuilder,

    // 管理器
    VoteManager,
    VotePermissionManager,
    getVoteConfigManager,

    // 处理器
    getVoteHandler,

    // 工具类
    VoteAutoProcessor,

    // 便捷方法
    async handleVoteInteraction(interaction) {
        const handler = getVoteHandler();
        return await handler.handleVoteInteraction(interaction);
    },

    async createVote(client, member, configId) {
        const handler = getVoteHandler();
        return await handler.createVote(client, member, configId);
    },

    async hasActiveVote(userId) {
        const handler = getVoteHandler();
        return await handler.hasActiveVote(userId);
    },

    async getUserActiveVote(userId) {
        const handler = getVoteHandler();
        return await handler.getUserActiveVote(userId);
    },

    // 初始化方法
    init() {
        console.log('[AutoVote] 自动投票模块已加载');
        return {
            configManager: getVoteConfigManager(),
            voteHandler: getVoteHandler(),
            autoProcessor: new VoteAutoProcessor()
        };
    }
};