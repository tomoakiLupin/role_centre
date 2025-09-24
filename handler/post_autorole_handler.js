const { config } = require('../config/config');
const { sendLog } = require('../utils/logger');

class PostAutoRoleHandler {
    constructor(client) {
        this.client = client;
        // 从加载的配置中获取本功能的特定配置
        this.configData = config.get('newpost_autorole_apply.newpost_autorole_apply');
    }

    /**
     * 处理帖子创建事件
     * @param {ThreadChannel} thread - 新创建的帖子（子区）
     */
    async handleThreadCreate(thread) {
        if (!this.configData) {
            // 如果没有找到相关配置，则直接返回
            return;
        }

        const guildId = thread.guild.id;
        const guildConfig = this.configData[guildId];

        if (!guildConfig) {
            // 如果该服务器没有配置，则直接返回
            return;
        }

        const parentChannel = thread.parent;
        if (!parentChannel) return;

        const devMode = this.configData.dev_mode === true;

        for (const configId in guildConfig) {
            const config = guildConfig[configId];
            const { role_id, data } = config;
            const { monitor_category_list, exclude_channels, start_at, end_at } = data;

            // 1. 检查是否在监控的分类下
            if (!monitor_category_list.includes(parentChannel.parentId)) {
                console.log(`[PostAutoRoleHandler] Thread ${thread.id} is not in monitored category.`);
                continue; // 不在监控的分类中，跳过此配置
            }

            // 2. 检查是否在排除的频道内
            if (exclude_channels && exclude_channels.includes(thread.parentId)) {
                console.log(`[PostAutoRoleHandler] Thread ${thread.id} is in excluded channel.`);
                continue; // 在排除的频道中，跳过此配置
            }

            // 3. 检查时间
            const now = Math.floor(Date.now() / 1000);
            if (devMode) {
                console.log(`[PostAutoRoleHandler] Dev mode is active, skipping time check for thread ${thread.id}.`);
            } else {
                if (now < parseInt(start_at, 10) || now > parseInt(end_at, 10)) {
                    console.log(`[PostAutoRoleHandler] Thread ${thread.id} is outside the active time window.`);
                    continue; // 不在活动时间内，跳过
                }
            }

            // 4. 获取帖主
            const ownerId = thread.ownerId;
            if (!ownerId) continue;

            try {
                const member = await thread.guild.members.fetch(ownerId);
                if (!member) continue;

                // 5. 检查是否已拥有身份组
                if (member.roles.cache.has(role_id)) {
                    console.log(`[PostAutoRoleHandler] User ${ownerId} already has role ${role_id}.`);
                    continue; // 已有身份组，跳过
                }

                // 6. 分配身份组
                const role = await thread.guild.roles.fetch(role_id);
                if (role) {
                    await member.roles.add(role);
                    await sendLog(this.client, 'info', {
                        module: 'PostAutoRole',
                        operation: '身份组自动分配',
                        message: `成功为用户 ${member.user.tag} (${ownerId}) 分配了身份组 ${role.name} (${role_id})，因为他在 ${thread.name} 发帖。`,
                        details: { guildId, userId: ownerId, roleId: role_id, threadId: thread.id }
                    });
                }
            } catch (error) {
                console.error(`[PostAutoRoleHandler] Error processing thread ${thread.id}:`, error);
                await sendLog(this.client, 'error', {
                    module: 'PostAutoRole',
                    operation: '身份组自动分配失败',
                    message: `为用户 ${ownerId} 分配身份组 ${role_id} 时出错: ${error.message}`,
                    error: error.stack,
                    details: { guildId, userId: ownerId, roleId: role_id, threadId: thread.id }
                });
            }
        }
    }
}

module.exports = PostAutoRoleHandler;