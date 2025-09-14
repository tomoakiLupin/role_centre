require('dotenv').config();
const Bot = require('./bot');

async function main() {
    try {
        const bot = new Bot();
        await bot.start();
    } catch (error) {
        console.error('启动机器人时出错:', error);
        process.exit(1);
    }
}

main();
