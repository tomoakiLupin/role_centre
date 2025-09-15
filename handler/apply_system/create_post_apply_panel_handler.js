//帖子申请系统，自动申请面板创建

const { sendLog } = require('../../utils/logger');
const { PERMISSION_LEVELS } = require('../../utils/auth');
const { createPostApplyEmbed, createPostApplyButton } = require('../../ui/post_apply_panel');

class CreatePostApplyPanelHandler {
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const roleId = interaction.options.getString('role_id');
            const reactions = interaction.options.getInteger('reactions');
            const role = await this.validateRole(interaction.guild, roleId);

            if (!role) {
                return await interaction.editReply({
                    content: `❌ 错误：未找到ID为 \`${roleId}\` 的身份组。\n请检查ID是否正确，或在服务器设置中启用开发者模式后，右键点击身份组复制其ID。`
                });
            }
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

    async validateRole(guild, roleId) {
        try {
            const role = await guild.roles.fetch(roleId);
            return role || null;
        } catch (error) {
            console.warn(`Role ${roleId} not found:`, error.message);
            return null;
        }
    }
}

const handler = new CreatePostApplyPanelHandler();
handler.commandName = 'create_post_apply_panel';
handler.requiredPermission = PERMISSION_LEVELS.ADMIN;

module.exports = handler;