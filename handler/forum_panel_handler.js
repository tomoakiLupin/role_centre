const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { config } = require('../config/config');
const { getDbInstance } = require('../db/shared_files_db');

class ForumPanelHandler {
    constructor() {
        this.db = getDbInstance();
    }

    /**
     * 鉴权：检查交互/帖子是否发生在配置的论坛频道内
     * @param {Interaction|ThreadChannel} context 
     * @returns {string|null} 返回错误信息，如果通过则返回 null
     */
    async checkEligibility(context) {
        const isThread = context.isThread ? context.isThread() : context.channel?.isThread();
        if (!isThread) {
            return '该交互必须位于指定的论坛帖子内使用。';
        }

        const thread = context.isThread ? context : context.channel;
        const parentId = thread.parentId;

        const forumConfig = config.get('forum_panel_config.forum_panel_config');
        if (!forumConfig || !forumConfig.enabled_channel_ids || !forumConfig.enabled_channel_ids.includes(parentId)) {
            return '该交互必须位于卡区的论坛频道内使用。';
        }

        return null;
    }

    /**
     * 构建或发送“鉴权未通过”提示
     */
    async sendAuthFailed(interaction, reason) {
        const errorEmbed = new EmbedBuilder()
            .setTitle('⛔ 鉴权未通过')
            .setDescription(`**${reason}**`)
            .setColor(0xED4245); // Red

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ embeds: [errorEmbed], components: [] });
        } else {
            await interaction.reply({ embeds: [errorEmbed], flags: [64] });
        }
    }

    /**
     * 发帖时触发，自动发送助手面板
     * @param {ThreadChannel} thread 
     */
    async handleThreadCreate(thread) {
        const authError = await this.checkEligibility(thread);
        if (authError) return;

        const ownerId = thread.ownerId;
        if (!ownerId) return;

        // 检查用户偏好，是否开启了自动提示
        const disableAutoPrompt = await this.db.getUserPreference(ownerId);
        if (disableAutoPrompt) return; // 用户选择了“不再提示”或通过命令关闭了

        await this.sendAuthorPanel(thread, ownerId);
    }

    /**
     * 构建并发送/编辑作者面板
     */
    async sendAuthorPanel(thread_or_interaction, ownerId, editMessage = null) {
        const embed = new EmbedBuilder()
            .setTitle('📄 作品发布')
            .setDescription(`本 BOT 为反自动化爬虫脚本的防盗卡措施，提供交互性作品发布功能\n作者可选择通过本BOT发布作品，用户通过交互性按钮获取作品进行下载\n如果选择不使用本BOT，也建议首楼尽量放置图片，贴内放置作品，以避免简易爬虫批量盗取首楼作品\n\n**作者可选获取作品方式：**\n*   **无限制**: 用户通过点击按钮即可下载作品。无任何限制\n*   **点赞**: 用户对首楼进行反应后可下载作品\n*   **提阅/验证码**: 在此简单替代为“阅读注意事项”与“人机验证”\n\n*注：通过本面板发布时需提供直接下载链接或者提取码。*\n*如使用中有任何问题请反馈*`)
            .setColor(0x2B2D31);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`fp_remove_panel:${ownerId}`).setLabel('移除消息').setEmoji('⚠️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`fp_disable_prompt:${ownerId}`).setLabel('不再提示').setEmoji('🔕').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`fp_publish_work:${ownerId}`).setLabel('发布作品').setEmoji('📝').setStyle(ButtonStyle.Success)
        );

        if (editMessage) {
            await editMessage.edit({ content: `<@${ownerId}>`, embeds: [embed], components: [row] });
        } else {
            await thread_or_interaction.send({ content: `<@${ownerId}>`, embeds: [embed], components: [row] });
        }
    }

    /**
     * 将面板切换为公开的“作品发布处”状态 (普通用户可见的下载按钮)
     */
    async convertToPublicPanel(interaction, fileRecord) {
        let conditionText = '无限制：可直接获取';
        if (fileRecord.req_reaction) conditionText = '点赞：对帖子首楼点赞(任意反应)后获取';
        if (fileRecord.req_captcha || fileRecord.req_terms) conditionText = '验证：需要阅读群规或人机验证';

        const embed = new EmbedBuilder()
            .setTitle('🎈 作品发布处')
            .setDescription(`请在此处交互获取本帖作品\n或者直接发送 \`/获取作品\` 来使用命令获取本帖内最新的发布处的作品\n\n*   **前置条件**: ${fileRecord.req_reaction ? '**点赞**' : '**无制限**'}\n    *   ${conditionText}\n*   **分享模式**: **开放分享**\n    *   每日限定：用户的每日获取作品次数耗尽后**无法获取**（上限 75 次）\n\nTips:\n如果出现了点击按钮后再滑到最下面发现没有作品消息\n可以滑到最下面后输入 \`/获取作品\` 来获取最新发布的作品`)
            .setColor(0x2B2D31)
            .setFooter({ text: `作品ID: ${fileRecord.id}` });

        // 保留原作者管理的按钮，添加公开的获取按钮
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`fp_remove_panel:${fileRecord.uploader_id}`).setLabel('移除本条发布处').setEmoji('⚠️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`fp_republish:${fileRecord.uploader_id}`).setLabel('放置新的作品发布处').setEmoji('🆕').setStyle(ButtonStyle.Success)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`fp_get_work:${fileRecord.id}`).setLabel('获取作品').setEmoji('🎁').setStyle(ButtonStyle.Primary)
        );

        await interaction.message.edit({ content: '', embeds: [embed], components: [row1, row2] });
    }
}

module.exports = new ForumPanelHandler();
