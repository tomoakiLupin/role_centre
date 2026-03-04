const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const forumPanelHandler = require('./forum_panel_handler');
const { getDbInstance } = require('../db/shared_files_db');

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

        // 仅限帖子作者或管理员使用
        if (interaction.channel && interaction.channel.isThread()) {
            if (interaction.user.id !== interaction.channel.ownerId && !interaction.member.permissions.has('Administrator')) {
                return await interaction.reply({ content: '❌ 权限不足：只有本帖的发布者（楼主）才能在此发布作品。', flags: [64] });
            }
        }

        // 委托给可视化交互向导处理
        const uploadWizardHandler = require('./upload_wizard_handler');
        await uploadWizardHandler.startWizard(interaction);
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

    async executeRemoveWork(interaction) {
        // 命令： /移除作品
        await interaction.deferReply({ flags: [64] });

        const fileId = interaction.options.getString('file_id').trim().toUpperCase();
        const isAdmin = interaction.member.permissions.has('Administrator');

        try {
            const success = await this.db.deleteFileRecord(fileId, interaction.user.id, isAdmin);
            if (success) {
                await interaction.editReply({ content: `✅ 文件 \`${fileId}\` 及其所有访问信息已彻底从库中删除。` });
            } else {
                await interaction.editReply({ content: `❌ 未找到编号为 \`${fileId}\` 的文件，或者您没有删除它的权限（仅发布者或管理员可删除）。` });
            }
        } catch (error) {
            console.error('[ForumCommandsHandler] 删除文件数据失败:', error);
            await interaction.editReply({ content: '❌ 删除过程中发生数据库错误。' });
        }
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

        // 【重新放置作品发布处】按钮 (由于改成了斜杠原生，要求用户再打一遍指令)
        if (customId.startsWith('fp_republish:')) {
            const uploaderId = customId.split(':')[1];
            if (interaction.user.id !== uploaderId && !interaction.member.permissions.has('Administrator')) {
                return await interaction.reply({ content: '❌ 只有该帖子的作者可以重新发布作品。', flags: [64] });
            }

            await interaction.reply({ content: '💡 **请在聊天框再次输入 `/发布作品` 命令。**\n\n这会重新弹出一个上传框供您上传新文件并覆盖之前的发布处。', flags: [64] });
            return;
        }

        // 【获取作品】按钮
        if (customId.startsWith('fp_get_work:')) {
            const fileId = customId.split(':')[1];
            const getFileHandler = require('./get_file_handler');

            try {
                // 因为原本的 getFileHandler 预期接收一个 Slash Command Interaction, 
                // 我们通过代理(Proxy)拦截 options.getString 来注入 file_id
                const pseudoInteraction = new Proxy(interaction, {
                    get(target, prop, receiver) {
                        if (prop === 'options') {
                            return {
                                getString: (name) => {
                                    if (name === 'file_id') return fileId;
                                    return null;
                                }
                            };
                        }
                        // 兜底其它方法
                        const value = Reflect.get(target, prop, receiver);
                        if (typeof value === 'function') {
                            return value.bind(target);
                        }
                        return value;
                    }
                });

                await getFileHandler.execute(pseudoInteraction);
            } catch (err) {
                console.error('[ForumCommandsHandler] 模拟获取作品时发生错误:', err);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: '❌ 获取作品时发生系统错误。', flags: [64] });
                } else {
                    await interaction.editReply({ content: '❌ 获取作品时发生系统错误。' });
                }
            }
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
