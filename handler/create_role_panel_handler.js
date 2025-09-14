const FileEditor = require('../utils/file_editor');
const { sendLog } = require('../utils/logger');
const path = require('path');
const { PERMISSION_LEVELS } = require('../utils/auth');
const RolePanelUI = require('../ui/role_panel'); // This will be created next

class CreateRolePanelHandler {
    constructor() {
        this.cacheFilePath = path.join(__dirname, '../data/cache/role_distributors.json');
        this.cacheEditor = new FileEditor(this.cacheFilePath);
    }

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const roleId = interaction.options.getString('role_id');
            const title = interaction.options.getString('title');
            const content = interaction.options.getString('content');
            const imageUrl = interaction.options.getString('image_url');
            const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

            const guild = interaction.guild;
            const role = await this.validateRole(guild, roleId);

            if (!role) {
                return await interaction.editReply({
                    content: '❌ 错误：未找到有效的身份组'
                });
            }

            // UI will be created in the next step
            const panelData = RolePanelUI.createRolePanel(title, content, imageUrl, role);

            // Message pinning logic
            const cacheData = await this.cacheEditor.read() || {};
            const channelCacheKey = targetChannel.id;

            if (cacheData[channelCacheKey]) {
                try {
                    const oldMessage = await targetChannel.messages.fetch(cacheData[channelCacheKey].message_id);
                    await oldMessage.delete();
                } catch (error) {
                    console.warn(`Could not delete old panel message in channel ${targetChannel.id}:`, error.message);
                }
            }

            const panelMessage = await targetChannel.send(panelData);

            // Update cache
            cacheData[channelCacheKey] = {
                message_id: panelMessage.id,
                role_id: role.id,
                title: title,
                content: content,
                name: role.name
            };
            await this.cacheEditor.write(cacheData);


            await interaction.editReply({
                content: `✅ 自主获取面板创建成功！\n🏷️ 身份组: ${role.name}\n#️⃣ 频道: <#${targetChannel.id}>`
            });

            sendLog(interaction.client, 'success', {
                module: 'Role Panel',
                operation: 'Panel Created',
                message: `Role panel created for role ${role.name} in channel ${targetChannel.name}`,
                details: {
                    roleId: role.id,
                    roleName: role.name,
                    channelId: targetChannel.id,
                    operator: interaction.user.tag
                }
            });

        } catch (error) {
            console.error('Create role panel command failed:', error);
            await interaction.editReply({
                content: '❌ 创建面板时发生错误，请稍后重试'
            }).catch(() => {});

            sendLog(interaction.client, 'error', {
                module: 'Role Panel',
                operation: 'Panel Creation',
                message: `Failed to create role panel: ${error.message}`,
                error: error.stack
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

const handler = new CreateRolePanelHandler();
handler.commandName = 'create_role_panel';
handler.requiredPermission = PERMISSION_LEVELS.ADMIN;

module.exports = handler;