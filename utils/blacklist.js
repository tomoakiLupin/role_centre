const { config } = require('../config/config');

const REJECTION_REASONS = [
    "初始化数据库链接失败，Grpc 网关无法处理相应的请求",
    "当前系统繁忙，您的请求无法处理",
    "权限不足，无法执行此操作",
    "似乎出现了一个小问题，已记录，请重试",
    "您的请求已被记录，但未被执行",
    "系统检测到异常，操作已中止",
    "API 请求超时，可能是 bot 服务器无法与 DC 网关正常通信",
    "bot暂时无法响应您的请求",
    "警告，数据库返回：usertag无法解析",
    "处理数据库失败，配置文件似乎出现了语法错误",
    "我们遇到了一些技术问题，错误已报告开发者，请耐心等待",
    "操作超时，无法连接 Grpc 远程数据库"
];

let cachedReason = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * 获取一个随机的拒绝理由，并进行缓存
 * @returns {string}
 */
function getRandomReason() {
    const now = Date.now();
    if (cachedReason && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION)) {
        return cachedReason;
    }

    const randomIndex = Math.floor(Math.random() * REJECTION_REASONS.length);
    cachedReason = REJECTION_REASONS[randomIndex];
    cacheTimestamp = now;
    return cachedReason;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 检查用户是否在特定交互的黑名单中
 * 智能检查：只检查配置文件中存在的前缀，提供良好的可扩展性
 * @param {string} userId - 用户的Discord ID
 * @param {string} customId - 交互的customId
 * @returns {Promise<boolean>} - 如果用户在黑名单中则返回true，否则返回false
 */
async function isBlacklisted(userId, customId) {
    const blacklist = config.get('blacklist.blacklist');
    if (!blacklist || !userId || !customId) {
        return false;
    }

    // 检查按钮黑名单：只检查配置中存在的前缀
    if (blacklist.btn && Object.keys(blacklist.btn).length > 0) {
        // 按前缀长度降序排序，优先匹配最长的前缀，避免误伤
        // 例如：grpc_apply: 应该优先于 apply: 匹配
        const sortedPrefixes = Object.keys(blacklist.btn).sort((a, b) => b.length - a.length);

        for (const prefix of sortedPrefixes) {
            // 只有当 customId 匹配配置的前缀时才检查
            if (customId.startsWith(prefix)) {
                const userList = blacklist.btn[prefix];
                if (Array.isArray(userList) && userList.includes(userId)) {
                    await sleep(2000); // 只对黑名单用户延迟2秒
                    return true;
                }
                // 找到匹配的前缀但用户不在黑名单中，直接返回 false
                return false;
            }
        }
    }

    // 检查命令黑名单 (如果需要)
    if (blacklist.cmd && Object.keys(blacklist.cmd).length > 0) {
        // 可以在这里为命令实现类似的逻辑
    }

    // customId 不匹配任何配置的前缀，不受限制
    return false;
}

module.exports = {
    isBlacklisted,
    getRandomReason,
};