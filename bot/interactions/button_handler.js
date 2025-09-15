class ButtonHandler {
    constructor() {
        this.roleLeaveButtonHandler = require('../../handler/button_handler/role_leave_button_handler');
        this.roleButtonHandler = require('../../handler/button_handler/role_button_handler');
        this.applyRequestHandler = require('../../handler/apply_system/apply_request_handler');
        this.postApplyRequestHandler = require('../../handler/apply_system/post_apply_request_handler');
        this.voteHandler = require('../../handler/vote_system/vote_handler');
    }

    async handleInteraction(interaction) {
        if (!interaction.isButton()) {
            return false;
        }

        try {
            if (interaction.customId.startsWith('apply:')) {
                await this.applyRequestHandler.handleApplyButton(interaction);
            } else if (interaction.customId.startsWith('post_apply:')) {
                await this.postApplyRequestHandler.handlePostApplyButton(interaction);
            } else if (interaction.customId.startsWith('vote:')) {
                await this.voteHandler.handleVote(interaction);
            } else if (interaction.customId.startsWith('role_leave:')) {
                const cacheId = interaction.customId.split(':')[1];
                await this.roleLeaveButtonHandler.execute(interaction, cacheId);
            } else if (interaction.customId.startsWith('role_join:') || interaction.customId.startsWith('role_leave:')) {
                await this.roleButtonHandler.execute(interaction);
            } else {
                await interaction.reply({ content: '未知的按钮操作。', ephemeral: true });
            }
        } catch (error) {
            console.error('处理按钮交互时出错:', error);
            const reply = { content: '处理按钮交互时发生错误，请稍后重试。', ephemeral: true };
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