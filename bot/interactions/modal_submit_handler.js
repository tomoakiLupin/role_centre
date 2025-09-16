class ModalSubmitHandler {
    constructor() {
        this.postApplyRequestHandler = require('../../handler/apply_system/post_apply_request_handler');
    }

    async handleInteraction(interaction) {
        if (!interaction.isModalSubmit()) {
            return false;
        }

        try {
            if (interaction.customId.startsWith('post_apply_modal:')) {
                await this.postApplyRequestHandler.handleModalSubmit(interaction);
            } else {
                // 可以为其他modal添加处理逻辑
                await interaction.reply({ content: '未知的模态框提交', ephemeral: true });
            }
        } catch (error) {
            console.error('处理模态框提交时出错:', error);
            const reply = { content: '处理模态框提交时发生错误，请稍后重试', ephemeral: true };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(reply);
            } else {
                await interaction.reply(reply);
            }
        }

        return true;
    }
}

module.exports = ModalSubmitHandler;