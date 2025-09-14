const FileEditor = require('../utils/file_editor');
const CacheMatch = require('../utils/cache_match');
const RoleLeavePanelUI = require('../ui/role_leave_panel');
const { sendLog } = require('../utils/logger');
const path = require('path');

class CreateLeavePanelHandler {
    constructor() {
        this.cacheFilePath = path.join(__dirname, '../data/cache/role_leave.json');
        this.logFilePath = path.join(__dirname, '../data/log/role_leave_log.json');
        this.cacheEditor = new FileEditor(this.cacheFilePath);
        this.logEditor = new FileEditor(this.logFilePath);
    }

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const roleIdsString = interaction.options.getString('role_ids');
            const enableLogging = interaction.options.getBoolean('enable_logging') || false;
            const autoDeleteMinutes = interaction.options.getInteger('auto_delete_minutes') || 0;

            const roleIds = this.parseRoleIds(roleIdsString);
            if (roleIds.length === 0) {
                return await interaction.editReply({
                    content: '❌ 错误：未找到有效的身份组ID'
                });
            }

            const guild = interaction.guild;
            const validRoles = await this.validateRoles(guild, roleIds);

            if (validRoles.length === 0) {
                return await interaction.editReply({
                    content: '❌ 错误：未找到有效的身份组'
                });
            }

            const cacheId = CacheMatch.generateCacheId();

            // 创建UI面板
            const panelData = RoleLeavePanelUI.createLeavePanel(validRoles, cacheId, {
                enableLogging,
                autoDeleteMinutes
            });

            // 在当前频道发送独立的ED消息
            const panelMessage = await interaction.channel.send(panelData);

            // 存储缓存数据
            await this.storeCacheData(cacheId, {
                roleIds: validRoles.map(role => role.id),
                roleNames: validRoles.map(role => role.name),
                enableLogging,
                autoDeleteMinutes,
                createdAt: Date.now(),
                messageId: panelMessage.id,
                channelId: interaction.channel.id,
                guildId: guild.id
            });

            // 设置自动删除
            if (autoDeleteMinutes > 0) {
                this.scheduleAutoDelete(cacheId, autoDeleteMinutes, interaction.client);
            }

            // 回复操作员（隐私回复）
            await interaction.editReply({
                content: `✅ 退出面板创建成功！\n📋 缓存ID: \`${cacheId}\`\n🏷️ 身份组: ${validRoles.length} 个\n📊 记录日志: ${enableLogging ? '是' : '否'}\n⏰ 自动删除: ${autoDeleteMinutes > 0 ? `${autoDeleteMinutes} 分钟` : '永不'}`
            });

            sendLog(interaction.client, 'success', {
                module: 'Role Leave Panel',
                operation: 'Panel Created',
                message: `Role leave panel created with cache ID ${cacheId}`,
                details: {
                    cacheId,
                    roleCount: validRoles.length,
                    enableLogging,
                    autoDeleteMinutes,
                    operator: interaction.user.tag
                }
            });

        } catch (error) {
            console.error('Create leave panel command failed:', error);
            await interaction.editReply({
                content: '❌ 创建退出面板时发生错误，请稍后重试'
            }).catch(() => {});

            sendLog(interaction.client, 'error', {
                module: 'Role Leave Panel',
                operation: 'Panel Creation',
                message: `Failed to create role leave panel: ${error.message}`,
                error: error.stack
            });
        }
    }

    parseRoleIds(roleIdsString) {
        return roleIdsString
            .split(/[,，\s]+/)
            .map(id => id.trim())
            .filter(id => /^\d+$/.test(id));
    }

    async validateRoles(guild, roleIds) {
        const validRoles = [];
        for (const roleId of roleIds) {
            try {
                const role = await guild.roles.fetch(roleId);
                if (role) {
                    validRoles.push(role);
                }
            } catch (error) {
                console.warn(`Role ${roleId} not found:`, error.message);
            }
        }
        return validRoles;
    }

    async storeCacheData(cacheId, data) {
        await this.cacheEditor.atomic_write(async (cacheData) => {
            if (!cacheData) {
                cacheData = {};
            }

            const key = CacheMatch.formatCustomId('role_leave', cacheId);
            cacheData[key] = data;

            return cacheData;
        });
    }

    scheduleAutoDelete(cacheId, minutes, client) {
        setTimeout(async () => {
            try {
                await this.autoDeletePanel(cacheId, client);
            } catch (error) {
                console.error(`Auto delete failed for cache ID ${cacheId}:`, error);
            }
        }, minutes * 60 * 1000);
    }

    async autoDeletePanel(cacheId, client) {
        const cacheData = await this.cacheEditor.read();
        const key = CacheMatch.formatCustomId('role_leave', cacheId);

        if (cacheData && cacheData[key]) {
            const data = cacheData[key];

            try {
                const channel = await client.channels.fetch(data.channelId);
                if (channel) {
                    const message = await channel.messages.fetch(data.messageId);
                    if (message) {
                        await message.delete();
                    }
                }
            } catch (error) {
                console.warn(`Failed to delete message for cache ID ${cacheId}:`, error.message);
            }

            // 删除缓存数据
            await this.cacheEditor.atomic_write(async (currentData) => {
                if (currentData && currentData[key]) {
                    delete currentData[key];
                }
                return currentData;
            });

            console.log(`Auto deleted panel with cache ID: ${cacheId}`);
        }
    }
}

module.exports = new CreateLeavePanelHandler();