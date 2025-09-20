// gRPC 远程查询申请处理程序
const { checkAmwayEligibility, getConfigById } = require('../../grpc/amway_checker');
const { sendLog } = require('../../utils/logger');
const { createSuccessEmbed, createFailureEmbed } = require('../../ui/post_apply_response');

class GrpcApplyRequestHandler {
    async handleGrpcApplyButton(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // customId 格式: grpc_apply:configId
        const customId = interaction.customId;
        const configId = customId.split(':')[1];

        if (!configId) {
            const failureEmbed = createFailureEmbed('无效的配置 ID');
            return await interaction.editReply({ embeds: [failureEmbed] });
        }

        try {
            // 获取配置信息
            const config = getConfigById(configId);
            if (!config) {
                const failureEmbed = createFailureEmbed('配置不存在');
                return await interaction.editReply({ embeds: [failureEmbed] });
            }

            // 验证服务器匹配
            if (config.guild_id !== interaction.guildId) {
                const failureEmbed = createFailureEmbed('配置与当前服务器不匹配');
                return await interaction.editReply({ embeds: [failureEmbed] });
            }

            // 获取目标身份组
            const roleId = config.data.give_roleid;
            if (!roleId) {
                const failureEmbed = createFailureEmbed('配置中未指定目标身份组');
                return await interaction.editReply({ embeds: [failureEmbed] });
            }

            const role = await interaction.guild.roles.fetch(roleId);
            if (!role) {
                const failureEmbed = createFailureEmbed('目标身份组不存在');
                return await interaction.editReply({ embeds: [failureEmbed] });
            }

            // 检查用户是否已经拥有该身份组
            if (interaction.member.roles.cache.has(roleId)) {
                const failureEmbed = createFailureEmbed(`您已经拥有 ${role.name} 身份组`);
                return await interaction.editReply({ embeds: [failureEmbed] });
            }

            // 调用 gRPC 检查函数
            const eligibilityResult = await checkAmwayEligibility(
                interaction.user.id,
                configId,
                interaction.guildId
            );

            if (!eligibilityResult.isEligible) {
                const failureEmbed = createFailureEmbed(
                    `您不满足申请条件。`,
                    {
                        count: eligibilityResult.count,
                        threshold: config.data.threshold,
                    }
                );
                return await interaction.editReply({ embeds: [failureEmbed] });
            }

            // 验证通过，授予身份组
            await interaction.member.roles.add(role);
            const successEmbed = createSuccessEmbed(role, {
                count: eligibilityResult.count,
            });
            await interaction.editReply({ embeds: [successEmbed] });

            sendLog(interaction.client, 'info', {
                module: 'gRPC申请',
                operation: '身份组授予',
                message: `用户 ${interaction.user.tag} 通过 gRPC 查询获得了 ${role.name} (配置: ${config.name})`
            });

        } catch (error) {
            console.error('gRPC 申请处理失败:', error);
            const errorEmbed = createFailureEmbed('远程查询失败，请稍后重试');
            await interaction.editReply({ embeds: [errorEmbed] });

            sendLog(interaction.client, 'error', {
                module: 'gRPC申请',
                operation: '申请失败',
                message: `用户 ${interaction.user.tag} gRPC 申请失败: ${error.message}`
            });
        }
    }
}

module.exports = new GrpcApplyRequestHandler();