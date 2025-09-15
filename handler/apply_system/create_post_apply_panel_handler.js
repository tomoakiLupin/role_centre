//帖子申请系统，自动申请面板创建

const { sendLog } = require('../../utils/logger');
const { PERMISSION_LEVELS } = require('../../utils/auth');
const { createPostApplyEmbed, createPostApplyButton } = require('../../ui/post_apply_panel');

class CreatePostApplyPanelHandler {
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const role = interaction.options.getRole('role');
            const reactions = interaction.options.getInteger('reactions');
            const channel = interaction.options.getChannel('channel');
            const targetChannel = interaction.channel;

            // 创建自定义ID, 格式: post_apply:roleId:reactions[:channelId]
            const customIdParts = ['post_apply', role.id, reactions];
            if (channel) {
                customIdParts.push(channel.id);
            }
            const customId = customIdParts.join(':');

            // 从UI模块创建面板
            const embed = createPostApplyEmbed(role, reactions, channel);
            const button = createPostApplyButton(customId);

            await targetChannel.send({
                embeds: [embed],
                components: [button]
            });

            await interaction.editReply({
                content: `基于帖子反应的身份组申请面板创建成功！\n身份组: ${role.name}\n频道: <#${targetChannel.id}>`
            });

            sendLog(interaction.client, 'info', {
                module: '帖子申请面板',
                operation: '面板创建',
                message: `为身份组 ${role.name} 创建了帖子申请面板`
            });

        } catch (error) {
            console.error('Create post apply panel command failed:', error);
            await interaction.editReply({
                content: '创建面板时发生错误，请稍后重试'
            }).catch(() => {});

            sendLog(interaction.client, 'error', {
                module: '帖子申请面板',
                operation: '面板创建失败',
                message: `创建面板失败: ${error.message}`
            });
        }
    }
}

const handler = new CreatePostApplyPanelHandler();
handler.commandName = 'create_post_apply_panel';
handler.requiredPermission = PERMISSION_LEVELS.ADMIN;

module.exports = handler;