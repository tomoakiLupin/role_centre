//帖子自动申请模态框
const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const PostApplyValidator = require('./post_apply_validator');
const { sendLog } = require('../../utils/logger');
const { createSuccessEmbed, createFailureEmbed } = require('../../ui/post_apply_response');

class PostApplyRequestHandler {
    async handlePostApplyButton(interaction) {
        // customId 格式: post_apply:roleId:reactions[:channelId]
        const customId = interaction.customId;

        const modal = new ModalBuilder()
            .setCustomId(`post_apply_modal:${customId}`)
            .setTitle('帖子链接申请');

        const postLinkInput = new TextInputBuilder()
            .setCustomId('post_link')
            .setLabel('请输入您的帖子链接')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('https://discord.com/channels/...')
            .setRequired(true);

        const firstActionRow = new ActionRowBuilder().addComponents(postLinkInput);

        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);
    }

    async handleModalSubmit(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const postLink = interaction.fields.getTextInputValue('post_link');
        const validationResult = await PostApplyValidator.validate(interaction, postLink);

        if (!validationResult.valid) {
            const failureEmbed = createFailureEmbed(validationResult.message);
            return await interaction.editReply({ embeds: [failureEmbed] });
        }

        // 验证通过，执行授权
        try {
            await interaction.member.roles.add(validationResult.role);
            const successEmbed = createSuccessEmbed(validationResult.role);
            await interaction.editReply({ embeds: [successEmbed] });
            
            sendLog(interaction.client, 'info', {
                module: '帖子申请',
                operation: '身份组授予',
                message: `用户 ${interaction.user.tag} 通过帖子申请获得了 ${validationResult.role.name}`
            });
        } catch (error) {
            console.error('授予身份组时出错:', error);
            const errorEmbed = createFailureEmbed('身份组授予失败，可能是因为我没有足够的权限。');
            await interaction.editReply({ embeds: [errorEmbed] });

            sendLog(interaction.client, 'error', {
                module: '帖子申请',
                operation: '身份组授予失败',
                message: `为 ${interaction.user.tag} 授予 ${validationResult.role.name} 失败: ${error.message}`
            });
        }
    }
}

module.exports = new PostApplyRequestHandler();