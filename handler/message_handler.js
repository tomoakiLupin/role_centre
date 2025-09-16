const FileEditor = require('../utils/file_editor');
const path = require('path');
const RolePanelUI = require('../ui/role_panel');

class MessageHandler {
    constructor(client) {
        this.client = client;
        this.cacheFilePath = path.join(__dirname, '../data/cache/role_distributors.json');
        this.cacheEditor = new FileEditor(this.cacheFilePath);
        this.monitoredChannels = {};
        this.loadMonitoredChannels();
    }

    async loadMonitoredChannels() {
        const cacheData = await this.cacheEditor.read();
        if (cacheData) {
            this.monitoredChannels = cacheData;
        }
    }

    async handleMessage(message) {
        if (message.author.bot) return;
        
        // 强制重新加载缓存以获取最新配置
        await this.loadMonitoredChannels();

        const channelId = message.channel.id;
        if (this.monitoredChannels[channelId]) {
            const config = this.monitoredChannels[channelId];
            const targetChannel = message.channel;

            try {
                console.log(`[MessageHandler] Attempting to delete old panel message ${config.message_id}`);
                const oldMessage = await targetChannel.messages.fetch(config.message_id);
                await oldMessage.delete();
                console.log(`[MessageHandler] Successfully deleted old panel message.`);
            } catch (error) {
                console.warn(`[MessageHandler] Could not delete old panel message in channel ${targetChannel.id}:`, error.message);
            }

            let role;
            try {
                role = await message.guild.roles.fetch(config.role_id);
            } catch (error) {
                console.error(`[MessageHandler] Error fetching role ${config.role_id}:`, error);
            }

            if (!role) {
                console.error(`[MessageHandler] Role with ID ${config.role_id} not found in guild ${message.guild.id}`);
                try {
                    await message.channel.send(`⚠️ **错误**: 无法找到身份组 ID \`${config.role_id}\`请管理员检查配置`);
                } catch (sendError) {
                    console.error(`[MessageHandler] Failed to send error message to channel:`, sendError);
                }
                return;
            }
            
            console.log(`[MessageHandler] Creating new role panel for role "${role.name}".`);
            const panelData = RolePanelUI.createRolePanel(config.title, config.content, null, role);
            const newPanelMessage = await targetChannel.send(panelData);
            console.log(`[MessageHandler] Successfully sent new panel message ${newPanelMessage.id}.`);

            console.log(`[MessageHandler] Updating cache with new message ID.`);
            this.monitoredChannels[channelId].message_id = newPanelMessage.id;
            await this.cacheEditor.write(this.monitoredChannels);
            console.log(`[MessageHandler] Cache updated successfully.`);
        }
    }
}

module.exports = MessageHandler;