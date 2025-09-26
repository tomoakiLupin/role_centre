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
            return JSON.parse(data);
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
        const { review_channel_id, allow_vote_role } = revive_config;
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
            createdAt: new Date().toISOString()
        };

        // 创建嵌入消息和按钮
        const embed = await VoteEmbedBuilder.createVoteEmbedWithCounts(voteData, config, member.guild);
        const buttons = VoteButtonBuilder.createVoteButtons(voteId, 'pending');

        // 发送提及消息
        const userRole = allow_vote_role?.user;
        let mentionContent = '';
        if (userRole) {
            mentionContent = `<@&${userRole}> 新的投票申请`;
        }

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
        await interaction.deferReply({ ephemeral: true });

        const buttonInfo = VoteButtonBuilder.parseButtonId(interaction.customId);
        if (!buttonInfo) {
            return interaction.editReply({ content: '无效的投票按钮' });
        }

        const { action, voteId } = buttonInfo;
        const voter = interaction.member;

        const voteData = await this.getVote(voteId);
        if (!voteData || !['pending', 'pending_admin'].includes(voteData.status)) {
            return interaction.editReply({ content: '这个投票已结束或不存在' });
        }

        // 检查投票权限
        const permissionCheck = VotePermissionManager.checkVotePermission(voter, voteData, action);
        if (!permissionCheck.allowed) {
            return interaction.editReply({ content: permissionCheck.reason });
        }

        // 处理投票逻辑
        const voteType = action.includes('approve') ? 'approve' : 'reject';
        const oppositeType = voteType === 'approve' ? 'reject' : 'approve';

        // 检查是否为管理员终局投票
        const adminFinalCheck = VotePermissionManager.checkAdminFinalVote(voter, voteData);

        // 在管理员确认阶段，不允许重复投票
        if (voteData.status === 'pending_admin') {
            const hasAlreadyVoted = voteData.votes[voteType].includes(voter.id) ||
                                   voteData.votes[oppositeType].includes(voter.id);
            if (hasAlreadyVoted) {
                return interaction.editReply({ content: '您在管理员确认阶段已经操作过，无法重复操作' });
            }

            // 直接添加投票
            voteData.votes[voteType].push(voter.id);
        } else {
            // 普通投票阶段 - 允许撤销和更改投票
            if (voteData.votes[voteType].includes(voter.id)) {
                // 撤销投票
                voteData.votes[voteType] = voteData.votes[voteType].filter(id => id !== voter.id);
                await this.saveVote(voteId, voteData);
                await interaction.editReply({ content: '您已撤销投票' });
                return this.checkVoteStatus(interaction.client, voteId);
            }

            // 移除相反的投票并添加新投票
            voteData.votes[oppositeType] = voteData.votes[oppositeType].filter(id => id !== voter.id);
            voteData.votes[voteType].push(voter.id);
        }

        await this.saveVote(voteId, voteData);

        // 反馈用户
        if (voteData.status === 'pending_admin') {
            const actionText = voteType === 'approve' ? '管理确认' : '管理拒绝';
            await interaction.editReply({ content: `您已成功 **${actionText}**` });
        } else {
            const actionText = voteType === 'approve' ? '同意' : '拒绝';
            await interaction.editReply({ content: `您已成功投出 **${actionText}** 票` });
        }

        // 检查投票状态
        await this.checkVoteStatus(interaction.client, voteId);
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

        // 检查投票阈值
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

        // 在管理员确认阶段，如果管理员同意，立即通过
        if (voteData.status === 'pending_admin' && thresholdResult.shouldApprove) {
            console.log(`[VoteManager] 投票 ${voteId} 管理员确认，立即通过`);
            return this.finalizeVote(client, voteId, 'approved');
        }

        // 如果用户投票达标且当前为普通投票阶段，进入管理员确认期
        if (voteData.status === 'pending' && thresholdResult.shouldApprove) {
            console.log(`[VoteManager] 投票 ${voteId} 用户投票达标，进入管理员等待期`);
            return this.startPendingPeriod(client, voteId);
        }

        // 如果投票未结束，更新消息显示
        await this.updateVoteMessage(client, voteId, thresholdResult.counts);
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
    async updateVoteMessage(client, voteId, voteCounts) {
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