const VoteManager = require('./auto_vote/managers/vote_manager');
const { EmbedBuilder } = require('discord.js');
const { PERMISSION_LEVELS } = require('../utils/auth');

class CloseVoteHandler {
    constructor() {
        this.commandName = 'close_vote';
        this.requiredPermission = PERMISSION_LEVELS.NONE; // 不使用全局权限，在 execute 中进行投票配置的权限检查
        this.voteManager = new VoteManager();
    }

    async execute(interaction) {
        const identifier = interaction.options.getString('identifier');
        const reason = interaction.options.getString('reason') || '管理员关闭';
        const anonymous = interaction.options.getBoolean('anonymous') || false;
        const banUser = interaction.options.getBoolean('ban_user') || false;
        const operator = interaction.member;

        await interaction.deferReply({ ephemeral: true });

        try {
            // 尝试通过不同方式查找投票
            let voteData = null;
            let voteId = null;

            // 1. 先尝试作为消息ID查找
            console.log(`[CloseVoteHandler] 尝试通过消息ID查找: ${identifier}`);
            const voteByMessage = await this.voteManager.findVoteByMessageId(identifier);
            if (voteByMessage) {
                voteData = voteByMessage.voteData;
                voteId = voteByMessage.voteId;
                console.log(`[CloseVoteHandler] 通过消息ID找到投票: ${voteId}`);
            }

            // 2. 如果找不到，尝试作为 vote_id 查找
            if (!voteData) {
                console.log(`[CloseVoteHandler] 尝试作为 vote_id 查找: ${identifier}`);
                voteData = await this.voteManager.getVote(identifier);
                if (voteData) {
                    voteId = identifier;
                    console.log(`[CloseVoteHandler] 通过 vote_id 找到投票: ${voteId}`);
                }
            }

            // 3. 都找不到则报错
            if (!voteData) {
                console.warn(`[CloseVoteHandler] 找不到投票: ${identifier}`);
                return interaction.editReply({
                    content: `找不到该投票。\n请提供有效的投票ID或消息ID。`
                });
            }

            // 检查投票状态
            if (!['pending', 'pending_admin'].includes(voteData.status)) {
                return interaction.editReply({
                    content: `该投票已结束（状态：${voteData.status}），无法关闭。`
                });
            }

            // 权限检查：检查用户是否拥有投票配置中的管理员身份组
            const adminRoleId = voteData.config.revive_config.allow_vote_role.admin;
            const isAdmin = operator.roles.cache.has(String(adminRoleId));

            if (!isAdmin) {
                console.warn(`[CloseVoteHandler] 用户 ${operator.id} 没有权限关闭投票 ${voteId}`);
                return interaction.editReply({
                    content: '您没有权限关闭此投票。\n只有配置的管理员身份组成员可以关闭投票。'
                });
            }

            // 执行关闭操作
            console.log(`[CloseVoteHandler] 用户 ${operator.id} 正在关闭投票 ${voteId}，原因: ${reason}, 匿名: ${anonymous}, 封禁: ${banUser}`);
            await this.voteManager.cancelVote(interaction.client, voteId, reason, operator.id, anonymous, banUser);

            // 成功反馈
            const embed = new EmbedBuilder()
                .setColor('#95A5A6')
                .setTitle('投票已关闭')
                .setDescription(`**投票已被管理员关闭**`)
                .addFields(
                    { name: '投票ID', value: voteId, inline: false },
                    { name: '操作者', value: `<@${operator.id}>`, inline: true },
                    { name: '原因', value: reason, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({
                content: '投票已成功关闭。',
                embeds: [embed]
            });

        } catch (error) {
            console.error('[CloseVoteHandler] 关闭投票时出错:', error);
            await interaction.editReply({
                content: `关闭投票时发生错误：${error.message}\n请稍后重试或联系管理员。`
            });
        }
    }
}

module.exports = new CloseVoteHandler();
