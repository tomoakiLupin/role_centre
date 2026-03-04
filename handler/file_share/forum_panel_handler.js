const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { config } = require('../../config/config');
const { getDbInstance } = require('../../db/shared_files_db');

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
            console.log('[ForumPanel] checkEligibility fail: Not a thread.');
            return '该交互必须位于指定的论坛帖子内使用。';
        }

        const thread = context.isThread ? context : context.channel;
        const parentId = thread.parentId;

        const forumConfig = config.get('forum_panel');

        let enabledChannelIds = [];
        if (forumConfig && forumConfig.forum_panel_config && forumConfig.forum_panel_config.enabled_channel_ids) {
            enabledChannelIds = forumConfig.forum_panel_config.enabled_channel_ids;
        }

        console.log(`[ForumPanel] checkEligibility: Thread ParentID = ${parentId}, Config Enabled IDs = ${JSON.stringify(enabledChannelIds)}`);

        if (!enabledChannelIds.includes(parentId)) {
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
            .setDescription(`本 BOT 为反自动化爬虫脚本的防盗卡措施，提供交互性作品发布功能\n作者可选择通过本BOT发布作品，用户通过交互性按钮获取作品进行下载\n\n**如何发布？**\n为了保证您的文件**绝对私密且不被抓取**，您可以直接点击下方的 **[📝 发布作品]** 按钮，系统会为您弹出一个安全的交互式配置面板。\n\n*如果你觉得不需要自动弹出此面板，可点击下方“不再提示”或直接无视。*`)
            .setColor(0x2B2D31);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('wiz_start').setLabel('发布作品').setEmoji('📝').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`fp_remove_panel:${ownerId}`).setLabel('移除消息').setEmoji('⚠️').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`fp_disable_prompt:${ownerId}`).setLabel('不再提示').setEmoji('🔕').setStyle(ButtonStyle.Danger)
        );

        if (editMessage) {
            await editMessage.edit({ content: `<@${ownerId}>`, embeds: [embed], components: [row] });
        } else {
            // --- 🤖 修复 Discord.js 版本兼容性 Bug 开始 ---
            if (typeof thread_or_interaction.send === 'function') {
                // 如果传来的是真正的频道或帖子对象，它自带 send 方法
                await thread_or_interaction.send({ content: `<@${ownerId}>`, embeds: [embed], components: [row] });
            } else if (thread_or_interaction.channel && typeof thread_or_interaction.channel.send === 'function') {
                // 如果传来的是斜杠命令交互对象，则向它所在的频道发送面板
                await thread_or_interaction.channel.send({ content: `<@${ownerId}>`, embeds: [embed], components: [row] });
            } else if (typeof thread_or_interaction.followUp === 'function') {
                // 最后的安全兜底方案
                await thread_or_interaction.followUp({ content: `<@${ownerId}>`, embeds: [embed], components: [row] });
            }
            // --- 🤖 修复 Discord.js 版本兼容性 Bug 结束 ---
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
