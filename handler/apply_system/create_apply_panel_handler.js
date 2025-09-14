const { sendLog } = require('../../utils/logger');
const { PERMISSION_LEVELS } = require('../../utils/auth');
const { config } = require('../../config/config');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class CreateApplyPanelHandler {
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const configId = interaction.options.getString('config_id');
            const customTitle = interaction.options.getString('title');
            const customDescription = interaction.options.getString('description');
            const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

            // 获取配置
            const autoApplyConfig = config.get('atuo_applyrole.autoApply_config', {});
            const roleConfig = autoApplyConfig[configId];

            if (!roleConfig) {
                return await interaction.editReply({
                    content: `错误：未找到配置ID "${configId}"`
                });
            }

            // 验证配置是否属于当前服务器
            if (roleConfig.guild_id !== interaction.guildId) {
                return await interaction.editReply({
                    content: '错误：该配置不属于当前服务器'
                });
            }

            // 获取身份组信息
            const role = await this.validateRole(interaction.guild, roleConfig.data.role_id);
            if (!role) {
                return await interaction.editReply({
                    content: '错误：配置中的身份组不存在'
                });
            }

            // 创建申请面板
            const embed = this.createApplyEmbed(roleConfig, role, customTitle, customDescription);
            const button = this.createApplyButton(configId);

            const panelMessage = await targetChannel.send({
                embeds: [embed],
                components: [button]
            });

            await interaction.editReply({
                content: `身份组申请面板创建成功！\n身份组: ${role.name}\n频道: <#${targetChannel.id}>`
            });

            // 记录日志
            sendLog(interaction.client, 'info', {
                module: '申请面板',
                operation: '面板创建',
                message: `为身份组 ${role.name} 创建申请面板`
            });

        } catch (error) {
            console.error('Create apply panel command failed:', error);
            await interaction.editReply({
                content: '创建申请面板时发生错误，请稍后重试'
            }).catch(() => {});

            sendLog(interaction.client, 'error', {
                module: '申请面板',
                operation: '面板创建失败',
                message: `创建申请面板失败: ${error.message}`
            });
        }
    }

    createApplyEmbed(roleConfig, role, customTitle, customDescription) {
        const title = customTitle || `${role.name} 申请`;

        let description;
        if (customDescription) {
            description = customDescription;
        } else {
            description = `点击下方按钮申请 **${role.name}** 身份组\n\n`;

            // 只显示简单的审核信息
            if (roleConfig.manual_revive) {
                description += '申请后需要通过人工审核\n审核时间通常为1-24小时';
            } else {
                description += '系统将自动检查您的资格\n符合条件将立即获得身份组';
            }
        }

        return new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(0x3498db)
            .addFields(
                { name: '目标身份组', value: `<@&${role.id}>`, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: '点击按钮开始申请' });
    }

    createApplyButton(configId) {
        return new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`apply:${configId}`)
                    .setLabel('申请身份组')
                    .setStyle(ButtonStyle.Primary)
            );
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

const handler = new CreateApplyPanelHandler();
handler.commandName = 'create_apply_panel';
handler.requiredPermission = PERMISSION_LEVELS.ADMIN;

module.exports = handler;