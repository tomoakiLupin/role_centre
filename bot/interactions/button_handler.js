class ButtonHandler {
    constructor() {
        this.roleLeaveButtonHandler = require('../../handler/button_handler/role_leave_button_handler');
        this.roleButtonHandler = require('../../handler/button_handler/role_button_handler');
        this.applyRequestHandler = require('../../handler/apply_system/apply_request_handler');
        this.postApplyRequestHandler = require('../../handler/apply_system/post_apply_request_handler');
        this.grpcApplyRequestHandler = require('../../handler/apply_system/grpc_apply_request_handler');
        this.voteHandler = require('../../handler/vote_system/vote_handler');
        this.manageMyRolesButtonHandler = require('../../handler/button_handler/manage_my_roles_button_handler');
    }

    async handleInteraction(interaction) {
        if (!interaction.isButton() && !interaction.isStringSelectMenu()) {
            return false;
        }
        
        const { isBlacklisted, getRandomReason } = require('../../utils/blacklist');
        if (await isBlacklisted(interaction.user.id, interaction.customId)) {
            const reason = getRandomReason();
            await interaction.reply({ content: reason, ephemeral: true });
            return;
        }

        try {
            if (interaction.customId.startsWith('apply:')) {
                await this.applyRequestHandler.handleApplyButton(interaction);
            } else if (interaction.customId.startsWith('post_apply:')) {
                await this.postApplyRequestHandler.handlePostApplyButton(interaction);
            } else if (interaction.customId.startsWith('grpc_apply:')) {
                await this.grpcApplyRequestHandler.handleGrpcApplyButton(interaction);
            } else if (interaction.customId.startsWith('vote:')) {
                await this.voteHandler.handleVote(interaction);
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
            } else {
                // For button interactions that don't match, we can provide a generic response.
                // For select menus, it's often better to just let them be, as they might be part of a multi-step process handled elsewhere.
                if (interaction.isButton()) {
                    await interaction.reply({ content: '未知的按钮操作', ephemeral: true });
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