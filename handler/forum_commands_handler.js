const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const forumPanelHandler = require('./forum_panel_handler');
const { getDbInstance } = require('../db/shared_files_db');
const crypto = require('crypto');

class ForumCommandsHandler {
    constructor() {
        this.db = getDbInstance();
    }

    // ========== SLASH COMMAND EXECUTORS ==========

    async executePublishWork(interaction) {
        // 命令： /发布作品
        // 鉴权
        const authError = await forumPanelHandler.checkEligibility(interaction);
        if (authError) {
            return await forumPanelHandler.sendAuthFailed(interaction, authError);
        }

        // 发送面板
        await interaction.deferReply({ flags: [64] });
        await forumPanelHandler.sendAuthorPanel(interaction, interaction.user.id);
    }

    async executeDisablePrompt(interaction) {
        // 命令： /关闭自动提示
        await interaction.deferReply({ flags: [64] });
        await this.db.setUserPreference(interaction.user.id, true);
        await interaction.editReply({ content: '✅ 已关闭发帖时的作品发布自动提示。您仍然可以使用 `/发布作品` 手动呼出面板。' });
    }

    async executeEnablePrompt(interaction) {
        // 命令： /启用自动提示
        await interaction.deferReply({ flags: [64] });
        await this.db.setUserPreference(interaction.user.id, false);
        await interaction.editReply({ content: '✅ 已启用发帖时的作品发布自动提示。' });
    }

    async executeGetLatestWork(interaction) {
        // 命令： /获取作品
        const authError = await forumPanelHandler.checkEligibility(interaction);
        if (authError) {
            return await forumPanelHandler.sendAuthFailed(interaction, authError);
        }

        // 这里的 channelId 其实就是 ThreadId
        const sourceMessageId = interaction.channelId;
        const latestFile = await this.db.getLatestFileBySourceMessage(sourceMessageId);

        if (!latestFile) {
            return await interaction.reply({ content: '❌ 本帖内尚未发布任何作品，或作品已被移除。', flags: [64] });
        }

        // 复用 get_file 的逻辑 （这里简单模拟调用或者是要求用户点原本那套就行）
        // 因为 get_file 也是个 slash command，最简单的办法是直接把参数转发给它，或者重新写一遍
        // 为了方便，直接复写这部分分发逻辑
        const getFileHandler = require('./get_file_handler');

        // 模拟一个伪装着 file_id 的 interaction options
        const originalOptions = interaction.options;
        interaction.options = {
            getString: (name) => {
                if (name === 'file_id') return latestFile.id;
                return originalOptions.getString(name);
            }
        };

        await getFileHandler.execute(interaction);
    }


    // ========== BUTTON / MODAL HANDLERS ==========

    async handleButton(interaction) {
        const customId = interaction.customId;

        // 【移除消息】按钮
        if (customId.startsWith('fp_remove_panel:')) {
            const uploaderId = customId.split(':')[1];
            if (interaction.user.id !== uploaderId && !interaction.member.permissions.has('Administrator')) {
                return await interaction.reply({ content: '❌ 只有发布者或管理员可以移除此面板。', flags: [64] });
            }
            await interaction.message.delete();
            return;
        }

        // 【不再提示】按钮
        if (customId.startsWith('fp_disable_prompt:')) {
            const uploaderId = customId.split(':')[1];
            if (interaction.user.id !== uploaderId) {
                return await interaction.reply({ content: '❌ 只有发布者可以操作此面板。', flags: [64] });
            }

            await this.db.setUserPreference(interaction.user.id, true);
            await interaction.reply({ content: '✅ 已关闭自动提示。您可以使用 `/发布作品` 手动呼出面板，或者使用 `/启用自动提示` 重新开启。', flags: [64] });
            await interaction.message.delete();
            return;
        }

        // 【发布作品】按钮 (弹出模态框)
        if (customId.startsWith('fp_publish_work:') || customId.startsWith('fp_republish:')) {
            const uploaderId = customId.split(':')[1];
            if (interaction.user.id !== uploaderId && !interaction.member.permissions.has('Administrator')) {
                return await interaction.reply({ content: '❌ 只有该帖子的作者可以发布作品。', flags: [64] });
            }

            const modal = new ModalBuilder()
                .setCustomId(`modal_publish_work:${interaction.message.id}`)
                .setTitle('发布新作品');

            const urlInput = new TextInputBuilder()
                .setCustomId('file_url')
                .setLabel('在此输入文件的下载链接（Discord/网盘等）')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            const conditionsInput = new TextInputBuilder()
                .setCustomId('conditions')
                .setLabel('获取条件：0=无, 1=点赞, 2=人机验证, 3=阅读提示')
                .setPlaceholder('输入纯数字，如需组合可填 12 或 13')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setValue('1');

            modal.addComponents(
                new ActionRowBuilder().addComponents(urlInput),
                new ActionRowBuilder().addComponents(conditionsInput)
            );

            await interaction.showModal(modal);
            return;
        }

        // 【获取作品】按钮
        if (customId.startsWith('fp_get_work:')) {
            const fileId = customId.split(':')[1];
            const getFileHandler = require('./get_file_handler');

            // 伪装 interaction 以重用 getFileHandler
            const tempInteraction = Object.assign(Object.create(Object.getPrototypeOf(interaction)), interaction);
            tempInteraction.options = {
                getString: () => fileId
            };

            await getFileHandler.execute(tempInteraction);
            return;
        }
    }

    async handleModalSubmit(interaction) {
        if (!interaction.customId.startsWith('modal_publish_work:')) return false;

        const messageId = interaction.customId.split(':')[1];

        await interaction.deferUpdate(); // 回应模态框

        try {
            const fileUrl = interaction.fields.getTextInputValue('file_url').trim();
            const conditionsStr = interaction.fields.getTextInputValue('conditions').trim();

            const reqReaction = conditionsStr.includes('1');
            const reqCaptcha = conditionsStr.includes('2');
            const reqTerms = conditionsStr.includes('3');

            const sourceMessageId = interaction.channelId; // Thread ID

            const fileId = crypto.randomBytes(4).toString('hex').toUpperCase();

            // 生成临时文件名（通过链接提取，或给个默认）
            let fileName = fileUrl.split('/').pop().split('?')[0];
            if (!fileName || fileName.length < 3) fileName = `Published_File_${fileId}`;

            const fileData = {
                id: fileId,
                uploader_id: interaction.user.id,
                file_name: fileName,
                file_url: fileUrl, // 注意：这里的链接可能会在外部网盘失效
                upload_time: new Date().toISOString(),
                source_message_id: sourceMessageId,
                req_reaction: reqReaction,
                req_captcha: reqCaptcha,
                req_terms: reqTerms
            };

            await this.db.saveFileRecord(fileData);

            // 转换原消息为图1的“作品发布处”
            // 找到原来的面板消息
            let originalMessage;
            try {
                originalMessage = await interaction.channel.messages.fetch(messageId);
            } catch (e) {
                // Ignore
            }

            if (originalMessage) {
                // 使用原作者的interaction转换为公开面板所需的消息引用
                // 这里我们传递一个伪装的对象给 convert 函数，这样它可以编辑那个消息
                const fakeContext = { message: originalMessage };
                await forumPanelHandler.convertToPublicPanel(fakeContext, fileData);
            } else {
                // 如果找不到原消息，就新发一条
                const channel = interaction.channel;
                const tempMsg = await channel.send('正在生成面板...');
                const fakeContext = { message: tempMsg };
                await forumPanelHandler.convertToPublicPanel(fakeContext, fileData);
            }

            // 发一个只有作者能看到的成功提醒
            await interaction.followUp({ content: `✅ 作品已成功发布！\n为了避免链接在未来失效，如果您使用的是 Discord 附件链接，请确保原附件事先上传到了某个私密频道且该消息不会被删除。`, flags: [64] });

        } catch (error) {
            console.error('[ForumCommandsHandler] 发布模态框处理错误:', error);
            await interaction.followUp({ content: '❌ 保存文件信息失败。', flags: [64] });
        }

        return true;
    }
}

module.exports = new ForumCommandsHandler();
