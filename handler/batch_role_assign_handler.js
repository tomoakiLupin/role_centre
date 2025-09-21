const FileEditor = require('../utils/file_editor');
const { sendLog } = require('../utils/logger');
const { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, ComponentType } = require('discord.js');
const path = require('path');
const { PERMISSION_LEVELS } = require('../utils/auth');

class BatchRoleAssignHandler {
    constructor() {
        this.roleAssignmentsPath = path.join(__dirname, '../data/role_assignments.json');
        this.fileEditor = new FileEditor(this.roleAssignmentsPath);
    }

    async execute(interaction) {
        await interaction.deferReply({ flags: [64] });

        try {
            // 获取参数
            const roleId1 = interaction.options.getString('role_id_1');
            const roleId2 = interaction.options.getString('role_id_2');
            const userIdsString = interaction.options.getString('user_ids');
            const messageLink = interaction.options.getString('message_link');
            const operationId = interaction.options.getString('operation_id');
            const timeout = interaction.options.getInteger('timeout') || 90;
            const skipAutoExpire = interaction.options.getBoolean('skip_auto_expire') || false;

            // 验证必要参数
            if (!userIdsString && !messageLink) {
                return await interaction.editReply({
                    content: '❌ 错误：必须提供用户ID列表或消息链接中的一个'
                });
            }

            // 解析用户ID列表
            let userIds = [];
            if (userIdsString) {
                userIds = this.parseUserIds(userIdsString);
            }

            // 解析消息链接获取用户
            if (messageLink) {
                const messageUsers = await this.parseMessageLink(messageLink, interaction);
                userIds = [...userIds, ...messageUsers];
            }

            // 去重
            userIds = [...new Set(userIds)];

            if (userIds.length === 0) {
                return await interaction.editReply({
                    content: '❌ 错误：未找到有效的用户ID'
                });
            }

            // 验证身份组是否存在
            const guild = interaction.guild;
            const role1 = await guild.roles.fetch(roleId1).catch(() => null);
            if (!role1) {
                return await interaction.editReply({
                    content: `❌ 错误：找不到身份组 ${roleId1}`
                });
            }

            let role2 = null;
            if (roleId2) {
                role2 = await guild.roles.fetch(roleId2).catch(() => null);
                if (!role2) {
                    return await interaction.editReply({
                        content: `❌ 错误：找不到身份组 ${roleId2}`
                    });
                }
            }

            // 生成报告并请求用户确认
            const confirmationEmbed = new EmbedBuilder()
                .setTitle('🔍 批量分发确认')
                .setDescription('请检查以下信息，确认无误后点击“确认”按钮')
                .setColor(0xffa500) // Orange
                .addFields(
                    { name: '🏷️ 身份组', value: [role1.name, role2?.name].filter(Boolean).join(', ') || '无', inline: true },
                    { name: '👥 用户数量', value: `${userIds.length} 个用户`, inline: true },
                    { name: '⏰ 有效期', value: `${timeout} 天`, inline: true },
                    { name: '🔄 自动过期', value: skipAutoExpire ? '否' : '是', inline: true },
                    { name: '👤 目标用户 (部分)', value: userIds.length > 0 ? userIds.slice(0, 10).map(id => `<@${id}>`).join(', ') + (userIds.length > 10 ? `...等 ${userIds.length - 10} 人` : '') : '无' }
                )
                .setTimestamp()
                .setFooter({ text: '操作将在 60 秒后自动取消' });

            const confirmButton = new ButtonBuilder()
                .setCustomId('confirm_assign')
                .setLabel('确认')
                .setStyle(ButtonStyle.Success);

            const cancelButton = new ButtonBuilder()
                .setCustomId('cancel_assign')
                .setLabel('取消')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

            const confirmationMessage = await interaction.editReply({
                embeds: [confirmationEmbed],
                components: [row]
            });

            const collector = confirmationMessage.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 60000 // 60 seconds
            });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: '❌ 你不能操作这个按钮', flags: [64] });
                }

                await i.deferUpdate();

                if (i.customId === 'confirm_assign') {
                    const result = await this.processRoleAssignment({
                        operationId, roleId1, roleId2, role1, role2, userIds, timeout, skipAutoExpire, guild
                    });

                    await i.editReply({ embeds: [result.embed], components: [] });

                    sendLog(interaction.client, 'success', {
                        module: '批量分发',
                        operation: '身份组分发',
                        message: `操作ID ${result.finalOperationId}: 成功为 ${userIds.length} 个用户分发身份组`,
                        details: {
                            operationId: result.finalOperationId,
                            roles: [role1.name, role2?.name].filter(Boolean),
                            userCount: userIds.length
                        }
                    });
                } else if (i.customId === 'cancel_assign') {
                    const cancelEmbed = new EmbedBuilder()
                        .setTitle('❌ 操作已取消')
                        .setDescription('批量分发操作已被用户取消')
                        .setColor(0xff0000);
                    await i.editReply({ embeds: [cancelEmbed], components: [] });
                }
            });

            collector.on('end', async collected => {
                if (collected.size === 0) {
                    const timeoutEmbed = new EmbedBuilder()
                        .setTitle('⏰ 操作超时')
                        .setDescription('确认时间已过，批量分发操作已自动取消')
                        .setColor(0xffff00);
                    await interaction.editReply({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('批量分发命令执行失败:', error);
            await interaction.editReply({
                content: '❌ 执行命令时发生错误，请稍后重试'
            }).catch(() => {});

            sendLog(interaction.client, 'error', {
                module: '批量分发',
                operation: '命令执行',
                message: `批量分发命令执行失败: ${error.message}`,
                error: error.stack
            });
        }
    }

    parseUserIds(userIdsString) {
        return userIdsString
            .split(/[,，\s]+/)
            .map(id => id.trim())
            .filter(id => /^\d+$/.test(id));
    }

    async parseMessageLink(messageLink, interaction) {
        try {
            // Discord消息链接格式: https://discord.com/channels/guildId/channelId/messageId
            const linkMatch = messageLink.match(/https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/);
            if (!linkMatch) {
                throw new Error('无效的消息链接格式');
            }

            const [, guildId, channelId, messageId] = linkMatch;

            // 验证是否为当前服务器
            if (guildId !== interaction.guild.id) {
                throw new Error('消息链接不属于当前服务器');
            }

            const channel = await interaction.guild.channels.fetch(channelId);
            if (!channel || !channel.isTextBased()) {
                throw new Error('找不到指定频道或频道类型不正确');
            }

            const message = await channel.messages.fetch(messageId);
            const userIds = [];

            // 获取消息反应的用户
            if (message.reactions.cache.size > 0) {
                for (const reaction of message.reactions.cache.values()) {
                    const users = await reaction.users.fetch();
                    users.forEach(user => {
                        if (!user.bot) {
                            userIds.push(user.id);
                        }
                    });
                }
            }

            // 获取消息中@提及的用户
            message.mentions.users.forEach(user => {
                if (!user.bot) {
                    userIds.push(user.id);
                }
            });

            return [...new Set(userIds)];

        } catch (error) {
            console.error('解析消息链接失败:', error);
            throw new Error(`解析消息链接失败: ${error.message}`);
        }
    }

    async processRoleAssignment(params) {
        const {
            operationId,
            roleId1,
            roleId2,
            role1,
            role2,
            userIds,
            timeout,
            skipAutoExpire,
            guild
        } = params;

        let finalOperationId = operationId;

        // 如果没有指定操作ID，生成新的
        if (!finalOperationId) {
            finalOperationId = this.generateOperationId();
        }

        // 准备身份组数据
        const roleIds = [roleId1];
        const roleNames = [role1.name];

        if (roleId2 && role2) {
            roleIds.push(roleId2);
            roleNames.push(role2.name);
        }

        // 更新数据文件
        await this.fileEditor.atomic_write(async (data) => {
            if (!data) {
                data = [];
            }

            // 查找现有操作
            let existingEntry = null;
            let existingIndex = -1;

            for (let i = 0; i < data.length; i++) {
                if (data[i][0] === finalOperationId) {
                    existingEntry = data[i][1];
                    existingIndex = i;
                    break;
                }
            }

            if (existingEntry) {
                // 合并到现有操作
                const existingUserIds = new Set(existingEntry.data[0].assigned_user_ids);
                userIds.forEach(id => existingUserIds.add(id));
                existingEntry.data[0].assigned_user_ids = [...existingUserIds];
                existingEntry.timestamp = Math.floor(Date.now() / 1000);

                data[existingIndex] = [finalOperationId, existingEntry];
            } else {
                // 创建新操作
                const newEntry = [
                    finalOperationId,
                    {
                        operation_id: finalOperationId,
                        fade: !skipAutoExpire,
                        outtime: timeout,
                        timestamp: Math.floor(Date.now() / 1000),
                        data: [
                            {
                                guild_id: parseInt(guild.id),
                                guild_name: guild.name,
                                role_ids: roleIds.map(id => parseInt(id)),
                                role_names: roleNames,
                                timestamp: new Date().toISOString(),
                                assigned_user_ids: userIds.map(id => parseInt(id)),
                                operation_id: finalOperationId
                            }
                        ]
                    }
                ];

                data.push(newEntry);
            }

            return data;
        });

        const actionText = operationId ? '追加' : '创建';

        const embed = new EmbedBuilder()
            .setTitle('✅ 批量分发操作成功')
            .setDescription(`成功${actionText}批量分发操作！`)
            .setColor(0x00ff00)
            .addFields(
                { name: '🆔 操作ID', value: `\`${finalOperationId}\``, inline: true },
                { name: '🏷️ 身份组', value: roleNames.join(', '), inline: true },
                { name: '👥 用户数量', value: `${userIds.length} 个用户`, inline: true },
                { name: '⏰ 有效期', value: `${timeout} 天`, inline: true },
                { name: '🔄 自动过期', value: skipAutoExpire ? '否' : '是', inline: true }
            )
            .setTimestamp()
            .setFooter({ text: '身份组批量分发系统' });

        return {
            finalOperationId,
            embed
        };
    }

    generateOperationId() {
        return Math.floor(1000 + Math.random() * 9000).toString();
    }
}

const handler = new BatchRoleAssignHandler();
handler.commandName = '批量分发';
handler.requiredPermission = PERMISSION_LEVELS.ADMIN;

module.exports = handler;