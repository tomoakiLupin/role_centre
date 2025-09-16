const { config } = require('../../config/config');
const { sendLog } = require('../../utils/logger');
const { getEligibilityChecker } = require('../../db/eligibility_checker');

class ApplyRequestHandler {
    async handleApplyButton(interaction) {
        await interaction.deferReply({ flags: [64] });

        try {
            // 解析配置ID
            const configId = interaction.customId.split(':')[1];

            // 获取配置
            const autoApplyConfig = config.get('atuo_applyrole.autoApply_config', {});
            const roleConfig = autoApplyConfig[configId];

            if (!roleConfig) {
                return await interaction.editReply({
                    content: '❌ 配置不存在，请联系管理员检查'
                });
            }

            // 验证服务器
            if (roleConfig.guild_id !== interaction.guildId) {
                return await interaction.editReply({
                    content: '❌ 配置错误，请联系管理员检查'
                });
            }

            const member = interaction.member;
            const targetRoleId = roleConfig.data.role_id;

            // 检查用户是否已经拥有该身份组
            if (member.roles.cache.has(targetRoleId)) {
                return await interaction.editReply({
                    content: '您已经拥有该身份组了！'
                });
            }

            // 检查必需的身份组
            const mustHoldRoleId = roleConfig.data.musthold_role_id;
            if (mustHoldRoleId && mustHoldRoleId !== "0" && !member.roles.cache.has(mustHoldRoleId)) {
                return await interaction.editReply({
                    content: `您需要先获得 <@&${mustHoldRoleId}> 身份组才能申请此身份组`
                });
            }

            // 检查数据库资格
            const eligibilityChecker = getEligibilityChecker();
            const eligibilityResult = await eligibilityChecker.checkUserEligibility(
                member.id,
                roleConfig.data
            );

            if (roleConfig.manual_revive) {
                // 人工审核流程: 启用后，申请必须满足要求才能发起投票
                if (eligibilityResult.eligible) {
                    // 满足要求，发起人工审核
                    await this.startManualReview(interaction, member, roleConfig, eligibilityResult);
                } else {
                    // 不满足要求，直接拒绝
                    await interaction.editReply({
                        content: `申请被拒绝\n原因: ${eligibilityResult.reason}\n\n请达到要求后再次申请`
                    });
                    sendLog(interaction.client, 'info', {
                        module: '身份组申请',
                        operation: '申请被拒绝',
                        message: `用户 ${member.user.tag} 申请身份组失败 (人工审核路径): ${eligibilityResult.reason}`
                    });
                }
            } else {
                // 自动批准流程
                if (eligibilityResult.eligible) {
                    // 满足要求，自动批准
                    await this.approveApplication(interaction, member, roleConfig);
                } else {
                    // 不满足要求，直接拒绝
                    await interaction.editReply({
                        content: `申请被拒绝\n原因: ${eligibilityResult.reason}\n\n请达到要求后再次申请`
                    });
                    sendLog(interaction.client, 'info', {
                        module: '身份组申请',
                        operation: '申请被拒绝',
                        message: `用户 ${member.user.tag} 申请身份组失败 (自动路径): ${eligibilityResult.reason}`
                    });
                }
            }

        } catch (error) {
            console.error('[ApplyRequestHandler] 处理申请时出错:', error);
            await interaction.editReply({
                content: '处理申请时发生错误，请稍后重试'
            }).catch(() => {});

            sendLog(interaction.client, 'error', {
                module: '身份组申请',
                operation: '申请处理失败',
                message: `处理申请时发生错误: ${error.message}`
            });
        }
    }

    async approveApplication(interaction, member, roleConfig) {
        try {
            // 添加身份组
            await member.roles.add(roleConfig.data.role_id);

            await interaction.editReply({
                content: `申请成功！您已获得 <@&${roleConfig.data.role_id}> 身份组！`
            });

            // 记录日志
            sendLog(interaction.client, 'success', {
                module: '身份组申请',
                operation: '自动批准',
                message: `用户 ${member.user.tag} 自动获得身份组 <@&${roleConfig.data.role_id}>`
            });

        } catch (error) {
            console.error('[ApplyRequestHandler] 批准申请时出错:', error);
            await interaction.editReply({
                content: '添加身份组时发生错误，请联系管理员'
            });

            sendLog(interaction.client, 'error', {
                module: '身份组申请',
                operation: '自动批准失败',
                message: `为用户 ${member.user.tag} 添加身份组时出错: ${error.message}`
            });
        }
    }

    async startManualReview(interaction, member, roleConfig, eligibilityResult) {
        try {
            // 检查用户是否已有正在进行的投票
            const voteManager = require('../vote_system/vote_manager');
            const existingVoteInfo = await voteManager.findActiveVoteByRequester(member.id);

            if (existingVoteInfo) {
                return await interaction.editReply({
                    content: `您已经有一个正在进行中的投票 (ID: ${existingVoteInfo.voteId})，请等待该投票结束后再试`
                });
            }

            // 调用投票系统
            const voteId = await voteManager.createVote(interaction.client, member, roleConfig);

            await interaction.editReply({
                content: `您的申请已提交人工审核\n检查结果: ${eligibilityResult.reason}\n投票ID: ${voteId}\n\n审核通常在1-24小时内完成，请耐心等待`
            });

            // 记录日志
            sendLog(interaction.client, 'info', {
                module: '身份组申请',
                operation: '提交人工审核',
                message: `用户 ${member.user.tag} 的申请已提交人工审核，投票ID: ${voteId}`
            });

        } catch (error) {
            console.error('[ApplyRequestHandler] 启动人工审核时出错:', error);
            await interaction.editReply({
                content: '提交审核时发生错误，请稍后重试'
            });

            sendLog(interaction.client, 'error', {
                module: '身份组申请',
                operation: '启动人工审核失败',
                message: `启动人工审核时发生错误: ${error.message}`
            });
        }
    }
}

module.exports = new ApplyRequestHandler();