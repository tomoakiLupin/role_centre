const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder, ComponentType } = require('discord.js');
const { getDbInstance } = require('../db/shared_files_db');
const { sendLog } = require('../utils/logger');

class GetFileHandler {
    constructor() {
        this.commandName = 'get_file';
        this.db = getDbInstance();
    }

    async execute(interaction) {
        // 先不 deferReply，因为有可能会直接弹出 Modal（如果只有验证码要求）
        // 最好还是先 deferReply，后续的所有操作通过按钮触发 Modal，这样兼容性更好
        await interaction.deferReply({ flags: [64] }); // ephemeral

        try {
            const fileId = interaction.options.getString('file_id').trim().toUpperCase();
            const userId = interaction.user.id;

            // 1. 获取文件记录
            const fileRecord = await this.db.getFileRecord(fileId);
            if (!fileRecord) {
                return await interaction.editReply({ content: '❌ 找不到该文件，请检查提取码是否正确。' });
            }

            // 2. 检查每日下载限制
            const canDownload = await this.db.checkAndUpdateDownloadLimit(userId, 75);
            if (!canDownload) {
                return await interaction.editReply({ content: '❌ 您今天的下载次数已达上限 (75次)，请明天再来！' });
            }

            // 3. 检查点赞条件 (Reaction)
            if (fileRecord.req_reaction) {
                let hasReacted = false;
                try {
                    // 判断当前频道是否是帖子，并尝试获取首楼消息
                    if (interaction.channel && interaction.channel.isThread()) {
                        const starterMsg = await interaction.channel.fetchStarterMessage();
                        if (starterMsg && starterMsg.reactions.cache.size > 0) {
                            for (const reaction of starterMsg.reactions.cache.values()) {
                                const users = await reaction.users.fetch();
                                if (users.has(userId)) {
                                    hasReacted = true;
                                    break;
                                }
                            }
                        }
                    } else if (fileRecord.source_message_id) {
                        const msg = await interaction.channel.messages.fetch(fileRecord.source_message_id).catch(() => null);
                        if (msg && msg.reactions.cache.size > 0) {
                            for (const reaction of msg.reactions.cache.values()) {
                                const users = await reaction.users.fetch();
                                if (users.has(userId)) {
                                    hasReacted = true;
                                    break;
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error('[GetFileHandler] 检查点赞失败:', e);
                }

                if (!hasReacted) {
                    return await interaction.editReply({ content: '⚠️ **下载被拒绝**\n发布者要求必须在原贴（首楼消息）点赞后才能下载附件。请点赞后再试！' });
                }
            }

            // 4. 检查条款和验证码条件
            if (fileRecord.req_terms || fileRecord.req_captcha) {
                await this.handleVerificationFlow(interaction, fileRecord);
            } else {
                // 如果没有验证条件，直接发送文件
                await this.sendFile(interaction, fileRecord);
            }

        } catch (error) {
            console.error('[GetFileHandler] 获取文件出错:', error);
            await interaction.editReply({ content: '❌ 处理请求时发生内部错误。' }).catch(() => { });
        }
    }

    async handleVerificationFlow(interaction, fileRecord) {
        let reqTermsPassed = !fileRecord.req_terms;
        let reqCaptchaPassed = !fileRecord.req_captcha;

        const getRow = () => {
            const row = new ActionRowBuilder();
            if (!reqTermsPassed) {
                row.addComponents(
                    new ButtonBuilder().setCustomId('btn_read_terms').setLabel('阅读注意事项').setStyle(ButtonStyle.Secondary)
                );
            }
            if (!reqCaptchaPassed) {
                row.addComponents(
                    new ButtonBuilder().setCustomId('btn_captcha').setLabel('进行人机验证').setStyle(ButtonStyle.Primary)
                );
            }
            return row;
        };

        const msg = await interaction.editReply({
            content: '⚠️ 获取该文件需要完成以下验证：',
            components: [getRow()]
        });

        const collector = msg.createMessageComponentCollector({ time: 300000 }); // 5 mins

        // 简单的验证码逻辑
        const num1 = Math.floor(Math.random() * 10) + 1;
        const num2 = Math.floor(Math.random() * 10) + 1;
        const expectedAnswer = (num1 + num2).toString();

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: '这不是你的交互！', flags: [64] });
            }

            if (i.customId === 'btn_read_terms') {
                const termsEmbed = new EmbedBuilder()
                    .setTitle('📜 下载注意事项')
                    .setDescription('1. 下载的内容仅供学习和交流使用。\n2. 请勿将内容用于任何商业用途。\n3. 您需要对下载后的文件安全负责，请在打开前自行杀毒。\n4. 同意即代表遵守本社区的所有规章制度。')
                    .setColor(0xffff00);

                const agreeRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('btn_agree_terms').setLabel('同意并继续').setStyle(ButtonStyle.Success)
                );

                await i.reply({ embeds: [termsEmbed], components: [agreeRow], flags: [64] });
            }
            else if (i.customId === 'btn_agree_terms') {
                reqTermsPassed = true;
                // Update the main panel to remove the Terms button
                await interaction.editReply({ components: getRow().components.length > 0 ? [getRow()] : [] });
                await i.update({ content: '✅ 已同意注意事项', embeds: [], components: [] });
                this.checkIfAllPassed(reqTermsPassed, reqCaptchaPassed, interaction, fileRecord, collector);
            }
            else if (i.customId === 'btn_captcha') {
                const modal = new ModalBuilder()
                    .setCustomId('captcha_modal')
                    .setTitle('人机验证');

                const verifyInput = new TextInputBuilder()
                    .setCustomId('captcha_input')
                    .setLabel(`请计算 ${num1} + ${num2} 的结果`)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const firstActionRow = new ActionRowBuilder().addComponents(verifyInput);
                modal.addComponents(firstActionRow);

                await i.showModal(modal);

                try {
                    const submitted = await i.awaitModalSubmit({ time: 60000, filter: subI => subI.user.id === interaction.user.id });
                    if (submitted) {
                        if (submitted.fields.getTextInputValue('captcha_input').trim() === expectedAnswer) {
                            reqCaptchaPassed = true;
                            await submitted.reply({ content: '✅ 验证码正确', flags: [64] });

                            // 更新原消息面板
                            await interaction.editReply({ components: getRow().components.length > 0 ? [getRow()] : [] });
                            this.checkIfAllPassed(reqTermsPassed, reqCaptchaPassed, interaction, fileRecord, collector);
                        } else {
                            await submitted.reply({ content: '❌ 验证码错误，请重新点击按钮重试。', flags: [64] });
                        }
                    }
                } catch (err) {
                    // Modal timeout
                }
            }
        });
    }

    async checkIfAllPassed(terms, captcha, interaction, fileRecord, collector) {
        if (terms && captcha) {
            collector.stop();
            await this.sendFile(interaction, fileRecord);
        }
    }

    async sendFile(interaction, fileRecord) {
        try {
            await interaction.editReply({ content: '🔄 正在获取文件...', embeds: [], components: [] });

            const attachment = new AttachmentBuilder(fileRecord.file_url)
                .setName(fileRecord.file_name);

            await interaction.editReply({
                content: `✅ 文件加载成功！\n文件代码: \`${fileRecord.id}\`\n文件名: 📁 **${fileRecord.file_name}**`,
                files: [attachment]
            });

            // 日志记录
            sendLog(interaction.client, 'info', {
                module: '文件分享',
                operation: '获取文件',
                message: `用户 <@${interaction.user.id}> 查看/下载了文件: ${fileRecord.file_name}`,
                details: { fileId: fileRecord.id }
            });

        } catch (error) {
            console.error('[GetFileHandler] 发送文件失败:', error);
            await interaction.editReply({ content: '❌ 文件地址可能已失效或拉取失败。' });
        }
    }
}

module.exports = new GetFileHandler();
