class ButtonHandler {
    constructor() {
        this.roleLeaveButtonHandler = require('../../handler/button_handler/role_leave_button_handler');
        this.roleButtonHandler = require('../../handler/button_handler/role_button_handler');
        this.applyRequestHandler = require('../../handler/apply_system/apply_request_handler');
        this.postApplyRequestHandler = require('../../handler/apply_system/post_apply_request_handler');
        this.grpcApplyRequestHandler = require('../../handler/apply_system/grpc_apply_request_handler');
        this.autoVoteHandler = require('../../handler/auto_vote');
        this.manageMyRolesButtonHandler = require('../../handler/button_handler/manage_my_roles_button_handler');
        this.reactionVoteManager = require('../../handler/reaction_vote_system/reaction_vote_manager');
        this.interviewApplyHandler = require('../../handler/chat_apply/interview_apply_handler');
        this.interviewAdminHandler = require('../../handler/chat_apply/interview_admin_handler');
        this.interviewResultHandler = require('../../handler/chat_apply/interview_result_handler');
    }

    async handleInteraction(interaction) {
        if (!interaction.isButton() && !interaction.isStringSelectMenu()) {
            return false;
        }

        try {
            // 黑名单检查：自动检查配置文件中存在的前缀
            const { isBlacklisted, getRandomReason } = require('../../utils/blacklist');
            if (await isBlacklisted(interaction.user.id, interaction.customId)) {
                const reason = getRandomReason();
                await interaction.reply({ content: reason, flags: [64] });
                return;
            }

            if (interaction.customId.startsWith('apply:')) {
                await this.applyRequestHandler.handleApplyButton(interaction);
            } else if (interaction.customId.startsWith('post_apply:')) {
                await this.postApplyRequestHandler.handlePostApplyButton(interaction);
            } else if (interaction.customId.startsWith('grpc_apply:')) {
                await this.grpcApplyRequestHandler.handleGrpcApplyButton(interaction);
            } else if (interaction.customId.startsWith('auto_vote:')) {
                await this.autoVoteHandler.handleVoteInteraction(interaction);
            } else if (interaction.customId.startsWith('role_leave_panel:')) {
                const cacheId = interaction.customId.split(':')[1];
                await this.roleLeaveButtonHandler.execute(interaction, cacheId);
            } else if (interaction.customId.startsWith('role_leave_confirm:')) {
                const cacheId = interaction.customId.split(':')[1];
                await this.roleLeaveButtonHandler.handleConfirm(interaction, cacheId);
            } else if (interaction.customId.startsWith('role_leave_cancel:')) {
                await this.roleLeaveButtonHandler.handleCancel(interaction);
            } else if (interaction.customId.startsWith('role_join:') || interaction.customId.startsWith('role_leave:')) {
                await this.roleButtonHandler.execute(interaction);
            } else if (interaction.customId.startsWith('manage_my_roles:')) {
                await this.manageMyRolesButtonHandler.execute(interaction);
            } else if (interaction.customId.startsWith('reaction_vote:')) {
                await this.reactionVoteManager.togglePauseState(interaction);
            } else if (interaction.customId.startsWith('interview_apply:')) {
                await this.interviewApplyHandler.handleButton(interaction);
            } else if (interaction.customId.startsWith('interview_role_select:')) {
                await this.interviewApplyHandler.handleSelectMenu(interaction);
            } else if (interaction.customId.startsWith('interview_approve:')) {
                await this.interviewAdminHandler.handleApprove(interaction);
            } else if (interaction.customId.startsWith('interview_reject:')) {
                await this.interviewAdminHandler.handleReject(interaction);
            } else if (interaction.customId.startsWith('interview_pass:')) {
                await this.interviewResultHandler.handlePass(interaction);
            } else if (interaction.customId.startsWith('interview_fail:')) {
                await this.interviewResultHandler.handleFail(interaction);
            } else if (interaction.customId === 'confirm_assign' || interaction.customId === 'cancel_assign') {
                // These are handled by a collector in batch_role_assign_handler.js, so we do nothing here.
                return;
            } else {
                // For button interactions that don't match, we can provide a generic response.
                // For select menus, it's often better to just let them be, as they might be part of a multi-step process handled elsewhere.
                if (interaction.isButton()) {
                    await interaction.reply({ content: '未知的按钮操作', flags: [64] });
                }
            }
        } catch (error) {
            console.error('处理组件交互时出错:', error);
            const reply = { content: '处理组件交互时发生错误，请稍后重试', flags: [64] };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        }

        return true;
    }
}

module.exports = ButtonHandler;