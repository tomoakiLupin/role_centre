const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');

/**
 * 管理应用程序命令及其处理器的加载、注册和检索
 */
class CommandRegistry {
    constructor() {
        /**
         * 存储命令定义，以命令名称为键
         * @type {Collection<string, object>}
         */
        this.commands = new Collection();

        /**
         * 存储命令处理器，以命令名称为键
         * @type {Collection<string, object>}
         */
        this.handlers = new Collection();
    }

    /**
     * 从指定目录加载所有命令定义文件
     * @param {string} commandsPath - 包含命令文件的目录的绝对路径
     */
    loadCommands(commandsPath) {
        if (!fs.existsSync(commandsPath)) {
            console.warn(`命令目录未找到: ${commandsPath}跳过命令加载`);
            return;
        }

        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            try {
                const command = require(path.join(commandsPath, file));

                if (command.data && command.data.name) {
                    this.commands.set(command.data.name, command);
                    console.log(`✓ 已加载命令: ${command.data.name}`);
                } else {
                    console.warn(`✗ 命令文件 ${file} 必须导出包含 'data' 属性的对象`);
                }
            } catch (error) {
                console.error(`✗ 从 ${file} 加载命令失败:`, error);
            }
        }
    }

    /**
     * 从指定目录加载所有处理器文件
     * 每个处理器都需要导出一个 'commandName' 属性
     * @param {string} handlersPath - 包含处理器文件的目录的绝对路径
     */
    loadHandlers(handlersPath) {
        if (!fs.existsSync(handlersPath)) {
            console.warn(`处理器目录未找到: ${handlersPath}跳过处理器加载`);
            return;
        }

        const entries = fs.readdirSync(handlersPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(handlersPath, entry.name);
            if (entry.isDirectory()) {
                this.loadHandlers(fullPath); // Recursive call for subdirectories
            } else if (entry.isFile() && entry.name.endsWith('.js')) {
                try {
                    const handler = require(fullPath);
                    if (handler.commandName) {
                        this.handlers.set(handler.commandName, handler);
                        console.log(`已注册处理器对应命令: ${handler.commandName}`);
                    } else {
                        console.log(`处理器文件 ${entry.name} 未导出 'commandName'它可能不是一个斜杠命令处理器`);
                    }
                } catch (error) {
                    console.error(`从 ${entry.name} 加载处理器失败:`, error);
                }
            }
        }
    }

    /**
     * 检索与给定命令名称关联的处理器
     * @param {string} commandName - 命令的名称
     * @returns {object|undefined} 处理器对象，如果未找到则返回 undefined
     */
    getHandler(commandName) {
        return this.handlers.get(commandName);
    }

    /**
     * 检索与给定命令名称关联的命令定义
     * @param {string} commandName - 命令的名称
     * @returns {object|undefined} 命令定义对象，如果未找到则返回 undefined
     */
    getCommand(commandName) {
        return this.commands.get(commandName);
    }



    /**
     * 返回所有已加载命令数据的数组，适用于提交给 Discord API
     * @returns {object[]} 命令数据对象的数组
     */
    getAllCommands() {
        return Array.from(this.commands.values()).map(cmd => cmd.data);
    }
}

module.exports = CommandRegistry;