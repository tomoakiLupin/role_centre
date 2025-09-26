const fs = require('fs/promises');
const path = require('path');
const VoteEmbedBuilder = require('../ui/vote_embed_builder');
const VoteButtonBuilder = require('../ui/vote_button_builder');
const VotePermissionManager = require('./vote_permission_manager');
const { getVoteConfigManager } = require('./vote_config_manager');
const { sendLog } = require('../../../utils/logger');
const rejectionManager = require('../../../utils/rejection_manager');

const votesDirPath = path.join(__dirname, '..', '..', '..', 'data', 'auto_votes');

class VoteManager {
    constructor() {
        this.configManager = getVoteConfigManager();
    }

    // 确保投票目录存在
    async ensureVotesDir() {
        try {
            await fs.access(votesDirPath);
        } catch (error) {
            await fs.mkdir(votesDirPath, { recursive: true });
        }
    }

    // 获取投票文件路径
    getVoteFilePath(voteId) {
        if (/[\\/]/.test(voteId)) {
            throw new Error('Invalid voteId format');
        }
        return path.join(votesDirPath, `${voteId}.json`);
    }

    // 获取投票数据
    async getVote(voteId) {
        await this.ensureVotesDir();
        const filePath = this.getVoteFilePath(voteId);
        try {
            const data = await fs.readFile(filePath, 'utf8');
            const voteData = JSON.parse(data);

            // 为兼容性添加 adminConfirmVotes 字段（如果不存在）
            if (!voteData.adminConfirmVotes) {
                voteData.adminConfirmVotes = {
                    approve: [],
                    reject: []
                };
                // 自动保存更新后的数据结构
                await this.saveVote(voteId, voteData);
                console.log(`[VoteManager] 为投票 ${voteId} 添加了 adminConfirmVotes 字段`);
            }

            return voteData;
        } catch (error) {
            if (error.code === 'ENOENT') {
                return null;
            }
            throw error;
        }
    }

    // 保存投票数据
    async saveVote(voteId, data) {
        await this.ensureVotesDir();
        const filePath = this.getVoteFilePath(voteId);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    }

    // 删除投票数据
    async deleteVote(voteId) {
        await this.ensureVotesDir();
        const filePath = this.getVoteFilePath(voteId);
        try {
            await fs.unlink(filePath);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                console.error(`[VoteManager] 删除投票文件失败 ${voteId}:`, error);
                throw error;
            }
        }
    }

    // 创建新投票
    async createVote(client, member, configId) {
        const config = this.configManager.getConfigById(configId);
        if (!config) {
            throw new Error(`配置 ${configId} 不存在`);
        }

        if (!config.manual_revive) {
            throw new Error('该配置未启用手动审核');
        }

        const { revive_config, data: configData, guild_id } = config;
        const { review_channel_id } = revive_config;
        const { role_id: targetRoleId } = configData;

        if (!review_channel_id) {
            throw new Error('配置中缺少审核频道ID');
        }

        const reviewChannel = await client.channels.fetch(review_channel_id);
        if (!reviewChannel) {
            throw new Error(`找不到审核频道 ${review_channel_id}`);
        }

        const voteId = this.configManager.generateVoteId(configId, member.id);

        // 创建投票数据
        const voteData = {
            voteId,
            configId,
            messageId: null, // 稍后设置
            channelId: reviewChannel.id,
            requesterId: member.id,
            targetRoleId: targetRoleId,
            guildId: guild_id,
            config: config,
            status: 'pending',
            votes: {
                approve: [],
                reject: []
            },
            // 管理员确认阶段的独立投票记录
            adminConfirmVotes: {
                approve: [],
                reject: []
            },
            createdAt: new Date().toISOString()
        };

        // 创建嵌入消息和按钮
        const embed = await VoteEmbedBuilder.createVoteEmbedWithCounts(voteData, config, member.guild);
        const buttons = VoteButtonBuilder.createVoteButtons(voteId, 'pending');

        // 发送提及消息
        let mentionContent = '';
        // 暂时禁用提及功能
        // const userRole = allow_vote_role?.user;
        // if (userRole) {
        //     mentionContent = `<@&${userRole}> 新的投票申请`;
        // }

        // 发送投票消息
        const voteMessage = await reviewChannel.send({
            content: mentionContent || undefined,
            embeds: [embed],
            components: buttons
        });

        // 更新投票数据的消息ID
        voteData.messageId = voteMessage.id;
        await this.saveVote(voteId, voteData);

        console.log(`[VoteManager] 已为用户 ${member.id} 创建投票，ID: ${voteId}`);

        // 发送日志
        await sendLog(client, 'info', {
            module: '自动投票系统',
            operation: '发起投票',
            message: `为用户 <@${member.id}> 的身份组申请 <@&${targetRoleId}> 发起了投票\n[点击查看投票](https://discord.com/channels/${guild_id}/${reviewChannel.id}/${voteMessage.id})\n投票ID: ${voteId}`
        });

        return voteId;
    }

    // 处理投票
    async handleVote(interaction) {
        const debugId = `${interaction.user.id}-${Date.now()}`;
        const startTime = Date.now();

        console.log(`[VoteManager] [${debugId}] 开始处理投票，customId: ${interaction.customId}`);

        // 立即延迟回复，防止交互超时
        try {
            await interaction.deferReply({ ephemeral: true });
            console.log(`[VoteManager] [${debugId}] deferReply 成功，耗时: ${Date.now() - startTime}ms`);
        } catch (deferError) {
            console.error(`[VoteManager] [${debugId}] deferReply 失败:`, deferError);
            throw new Error(`无法延迟回复: ${deferError.message}`);
        }

        const buttonInfo = VoteButtonBuilder.parseButtonId(interaction.customId);
        if (!buttonInfo) {
            console.error(`[VoteManager] [${debugId}] 按钮解析失败: ${interaction.customId}`);
            return interaction.editReply({ content: '无效的投票按钮' });
        }

        const { action, voteId } = buttonInfo;
        const voter = interaction.member;

        console.log(`[VoteManager] [${debugId}] 投票信息: voteId=${voteId}, action=${action}, voter=${voter.user.tag} (${voter.id})`);

        // 获取投票数据
        let voteData;
        try {
            voteData = await this.getVote(voteId);
            console.log(`[VoteManager] [${debugId}] 获取投票数据成功: status=${voteData?.status || 'null'}`);
        } catch (error) {
            console.error(`[VoteManager] [${debugId}] 获取投票数据失败:`, error);
            return interaction.editReply({ content: '获取投票数据失败，请稍后重试' });
        }

        if (!voteData) {
            console.warn(`[VoteManager] [${debugId}] 投票数据不存在: ${voteId}`);
            return interaction.editReply({ content: '这个投票不存在' });
        }

        if (!['pending', 'pending_admin'].includes(voteData.status)) {
            console.warn(`[VoteManager] [${debugId}] 投票状态无效: ${voteData.status}, 期望: pending 或 pending_admin`);
            return interaction.editReply({ content: '这个投票已结束' });
        }

        // 检查投票权限
        let permissionCheck;
        try {
            permissionCheck = VotePermissionManager.checkVotePermission(voter, voteData, action);
            console.log(`[VoteManager] [${debugId}] 权限检查结果:`, permissionCheck);
        } catch (error) {
            console.error(`[VoteManager] [${debugId}] 权限检查失败:`, error);
            return interaction.editReply({ content: '权限检查失败，请稍后重试' });
        }

        if (!permissionCheck.allowed) {
            console.warn(`[VoteManager] [${debugId}] 权限被拒绝: ${permissionCheck.reason}`);
            return interaction.editReply({ content: permissionCheck.reason });
        }

        // 处理投票逻辑
        const voteType = action.includes('approve') ? 'approve' : 'reject';
        const oppositeType = voteType === 'approve' ? 'reject' : 'approve';

        console.log(`[VoteManager] [${debugId}] 投票类型: ${voteType}, 当前投票状态: ${voteData.status}`);

        // 检查是否为管理员终局投票
        let adminFinalCheck;
        try {
            adminFinalCheck = VotePermissionManager.checkAdminFinalVote(voter, voteData);
            console.log(`[VoteManager] [${debugId}] 管理员终局检查:`, adminFinalCheck);
        } catch (error) {
            console.error(`[VoteManager] [${debugId}] 管理员终局检查失败:`, error);
            return interaction.editReply({ content: '检查管理员权限失败，请稍后重试' });
        }

        // 在管理员确认阶段，使用独立的管理员确认投票记录
        if (voteData.status === 'pending_admin') {
            console.log(`[VoteManager] [${debugId}] 管理员确认阶段处理`);

            // 检查管理员确认阶段是否已经投过票（而不是普通投票阶段）
            const hasAdminConfirmVoted = voteData.adminConfirmVotes[voteType].includes(voter.id) ||
                                        voteData.adminConfirmVotes[oppositeType].includes(voter.id);
            console.log(`[VoteManager] [${debugId}] 管理员确认投票检查: ${hasAdminConfirmVoted}, adminApprove=${voteData.adminConfirmVotes.approve.includes(voter.id)}, adminReject=${voteData.adminConfirmVotes.reject.includes(voter.id)}`);

            if (hasAdminConfirmVoted) {
                console.warn(`[VoteManager] [${debugId}] 管理员在确认阶段已经操作过`);
                return interaction.editReply({ content: '您在管理员确认阶段已经操作过，无法重复操作' });
            }

            // 添加到管理员确认投票记录（不影响普通投票记录）
            console.log(`[VoteManager] [${debugId}] 添加管理员确认投票: ${voteType}`);
            voteData.adminConfirmVotes[voteType].push(voter.id);
        } else {
            console.log(`[VoteManager] [${debugId}] 普通投票阶段处理`);

            // 普通投票阶段 - 允许撤销和更改投票
            if (voteData.votes[voteType].includes(voter.id)) {
                console.log(`[VoteManager] [${debugId}] 撤销投票: ${voteType}`);
                // 撤销投票
                voteData.votes[voteType] = voteData.votes[voteType].filter(id => id !== voter.id);

                try {
                    await this.saveVote(voteId, voteData);
                    await interaction.editReply({ content: '您已撤销投票' });
                    console.log(`[VoteManager] [${debugId}] 投票撤销完成，检查投票状态`);
                    return this.checkVoteStatus(interaction.client, voteId);
                } catch (error) {
                    console.error(`[VoteManager] [${debugId}] 撤销投票保存失败:`, error);
                    return interaction.editReply({ content: '撤销投票失败，请稍后重试' });
                }
            }

            console.log(`[VoteManager] [${debugId}] 添加/更改投票: ${voteType}`);
            // 移除相反的投票并添加新投票
            voteData.votes[oppositeType] = voteData.votes[oppositeType].filter(id => id !== voter.id);
            voteData.votes[voteType].push(voter.id);
        }

        // 保存投票数据
        try {
            await this.saveVote(voteId, voteData);
            console.log(`[VoteManager] [${debugId}] 投票数据保存成功`);
        } catch (error) {
            console.error(`[VoteManager] [${debugId}] 投票数据保存失败:`, error);
            return interaction.editReply({ content: '保存投票失败，请稍后重试' });
        }

        // 反馈用户
        try {
            if (voteData.status === 'pending_admin') {
                const actionText = voteType === 'approve' ? '管理确认' : '管理拒绝';
                await interaction.editReply({ content: `您已成功 **${actionText}**` });
                console.log(`[VoteManager] [${debugId}] 管理员操作反馈已发送: ${actionText}`);
            } else {
                const actionText = voteType === 'approve' ? '同意' : '拒绝';
                await interaction.editReply({ content: `您已成功投出 **${actionText}** 票` });
                console.log(`[VoteManager] [${debugId}] 普通投票反馈已发送: ${actionText}`);
            }
        } catch (error) {
            console.error(`[VoteManager] [${debugId}] 发送用户反馈失败:`, error);
        }

        // 检查投票状态
        try {
            console.log(`[VoteManager] [${debugId}] 开始检查投票状态`);
            await this.checkVoteStatus(interaction.client, voteId);
            console.log(`[VoteManager] [${debugId}] 投票状态检查完成，总耗时: ${Date.now() - startTime}ms`);
        } catch (error) {
            console.error(`[VoteManager] [${debugId}] 检查投票状态失败:`, error);
        }
    }

    // 检查投票状态
    async checkVoteStatus(client, voteId) {
        const voteData = await this.getVote(voteId);
        if (!voteData || !['pending', 'pending_admin'].includes(voteData.status)) {
            return;
        }

        const guild = await client.guilds.fetch(voteData.guildId);
        if (!guild) {
            console.error(`[VoteManager] 无法找到服务器: ${voteData.guildId}`);
            return;
        }

        if (voteData.status === 'pending_admin') {
            // 管理员确认阶段：基于 adminConfirmVotes 进行判断
            console.log(`[VoteManager] 检查管理员确认阶段投票状态，adminConfirmVotes:`, voteData.adminConfirmVotes);

            const adminApproveCount = voteData.adminConfirmVotes.approve.length;
            const adminRejectCount = voteData.adminConfirmVotes.reject.length;

            console.log(`[VoteManager] 管理员确认投票统计: approve=${adminApproveCount}, reject=${adminRejectCount}`);

            // 如果有管理员拒绝，立即结束
            if (adminRejectCount > 0) {
                console.log(`[VoteManager] 投票 ${voteId} 管理员拒绝，立即结束`);
                return this.finalizeVote(client, voteId, 'rejected', true);
            }

            // 如果有管理员同意，立即通过
            if (adminApproveCount > 0) {
                console.log(`[VoteManager] 投票 ${voteId} 管理员确认，立即通过`);
                return this.finalizeVote(client, voteId, 'approved');
            }

            // 没有管理员操作，继续等待
            console.log(`[VoteManager] 投票 ${voteId} 等待管理员确认`);
        } else {
            // 普通投票阶段：基于 votes 进行判断
            const thresholdResult = await VotePermissionManager.checkVoteThreshold(
                voteData.votes,
                voteData.config.revive_config.allow_vote_role,
                guild
            );

            if (thresholdResult.error) {
                console.error(`[VoteManager] 检查投票阈值失败:`, thresholdResult.error);
                return;
            }

            // 如果被拒绝，立即结束投票
            if (thresholdResult.shouldReject) {
                console.log(`[VoteManager] 投票 ${voteId} 被拒绝`);
                return this.finalizeVote(client, voteId, 'rejected', thresholdResult.adminRejected);
            }

            // 如果用户投票达标且当前为普通投票阶段，进入管理员确认期
            if (voteData.status === 'pending' && thresholdResult.shouldApprove) {
                console.log(`[VoteManager] 投票 ${voteId} 用户投票达标，进入管理员等待期`);
                return this.startPendingPeriod(client, voteId);
            }
        }

        // 如果投票未结束，更新消息显示
        await this.updateVoteMessage(client, voteId);
    }

    // 开始管理员确认期
    async startPendingPeriod(client, voteId) {
        const voteData = await this.getVote(voteId);
        if (!voteData || voteData.status !== 'pending') {
            return;
        }

        const now = new Date();
        const pendingUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24小时后

        voteData.status = 'pending_admin';
        voteData.pendingUntil = pendingUntil.toISOString();
        await this.saveVote(voteId, voteData);

        // 更新消息
        const guild = await client.guilds.fetch(voteData.guildId);
        const channel = await guild.channels.fetch(voteData.channelId);
        const message = await channel.messages.fetch(voteData.messageId);

        const embed = VoteEmbedBuilder.createVoteEmbed(voteData, voteData.config);
        const buttons = VoteButtonBuilder.updateButtonsForStatus(voteId, 'pending_admin');

        await message.edit({ embeds: [embed], components: buttons });

        console.log(`[VoteManager] 投票 ${voteId} 已进入管理员等待期`);

        // 发送日志
        await sendLog(client, 'info', {
            module: '自动投票系统',
            operation: '进入管理员等待期',
            message: `用户 <@${voteData.requesterId}> 的申请 <@&${voteData.targetRoleId}> 用户投票已达标，进入24小时等待期\n[点击查看投票](https://discord.com/channels/${voteData.guildId}/${voteData.channelId}/${voteData.messageId})\n投票ID: ${voteId}`
        });
    }

    // 更新投票消息
    async updateVoteMessage(client, voteId) {
        const voteData = await this.getVote(voteId);
        if (!voteData) return;

        try {
            const guild = await client.guilds.fetch(voteData.guildId);
            const channel = await guild.channels.fetch(voteData.channelId);
            const message = await channel.messages.fetch(voteData.messageId);

            const embed = await VoteEmbedBuilder.createVoteEmbedWithCounts(voteData, voteData.config, guild);
            await message.edit({ embeds: [embed] });
        } catch (error) {
            console.error(`[VoteManager] 更新投票消息失败 ${voteId}:`, error);
        }
    }

    // 结束投票
    async finalizeVote(client, voteId, result, adminRejected = false) {
        const voteData = await this.getVote(voteId);
        if (!voteData || !['pending', 'pending_admin'].includes(voteData.status)) {
            return;
        }

        voteData.status = result;
        voteData.finalizedAt = new Date().toISOString();
        if (voteData.pendingUntil) {
            delete voteData.pendingUntil;
        }
        await this.saveVote(voteId, voteData);

        const guild = await client.guilds.fetch(voteData.guildId);
        if (!guild) {
            console.error(`[VoteManager] 无法找到服务器: ${voteData.guildId}`);
            return;
        }

        const requester = await guild.members.fetch(voteData.requesterId).catch(() => null);

        // 更新消息
        const channel = await guild.channels.fetch(voteData.channelId);
        const message = await channel.messages.fetch(voteData.messageId);

        const embed = VoteEmbedBuilder.createVoteEmbed(voteData, voteData.config);
        const buttons = VoteButtonBuilder.updateButtonsForStatus(voteId, result);

        await message.edit({ embeds: [embed], components: buttons });

        // 处理结果
        if (result === 'approved' && requester) {
            await requester.roles.add(voteData.targetRoleId);
            // 发送成功私信给申请人
            try {
                await requester.send({
                    content: `恭喜！您在 **${guild.name}** 的身份组申请已通过人工审核，已获得 <@&${voteData.targetRoleId}> 身份组。`
                });
            } catch (e) {
                console.log(`[VoteManager] 无法私信用户 ${voteData.requesterId}`);
            }
        } else if (result === 'rejected') {
            // 添加到拒绝列表
            if (adminRejected) {
                await rejectionManager.addPermanentRejection(voteData.requesterId, voteData.targetRoleId);
            } else {
                await rejectionManager.addTemporaryRejection(voteData.requesterId, voteData.targetRoleId, 720); // 30天
            }

            // 发送拒绝私信给申请人
            if (requester) {
                try {
                    await requester.send({
                        content: `很抱歉，您在 **${guild.name}** 的身份组申请未通过人工审核。`
                    });
                } catch (e) {
                    console.log(`[VoteManager] 无法私信用户 ${voteData.requesterId}`);
                }
            }
        }

        console.log(`[VoteManager] 投票 ${voteId} 已结束，结果: ${result}`);

        // 发送日志
        await sendLog(client, result === 'approved' ? 'success' : 'warning', {
            module: '自动投票系统',
            operation: '投票结束',
            message: `用户 <@${voteData.requesterId}> 的申请投票已结束，结果为 **${result === 'approved' ? '通过' : '拒绝'}**\n[点击查看投票](https://discord.com/channels/${voteData.guildId}/${voteData.channelId}/${voteData.messageId})\n投票ID: ${voteId}`
        });
    }

    // 查找用户的活跃投票
    async findActiveVoteByRequester(requesterId) {
        await this.ensureVotesDir();
        const files = await fs.readdir(votesDirPath);

        for (const file of files) {
            if (path.extname(file) === '.json') {
                const voteId = path.basename(file, '.json');
                const voteData = await this.getVote(voteId);
                if (voteData &&
                    voteData.requesterId === requesterId &&
                    ['pending', 'pending_admin'].includes(voteData.status)) {
                    return { voteId, voteData };
                }
            }
        }
        return null;
    }
}

module.exports = VoteManager;