const fs = require('fs');
const path = require('path');
const { queryThroughGateway } = require('./client');

const configPath = path.join(__dirname, '../config/grpc_roleapply_config.json');

/**
 * 检查用户是否满足安利条目阈值要求
 *
 * 通过网关查询安利系统，获取用户在指定服务器的安利条目数量，
 * 并与配置文件中设定的阈值进行比较，返回是否满足条件的布尔值。
 *
 * @async
 * @function checkAmwayEligibility
 * @param {string} userId - Discord 用户 ID
 * @param {string} configId - 配置文件中的配置项 ID (如 "0")
 * @param {string} guildId - Discord 服务器 ID
 * @returns {Promise<{isEligible: boolean, count: number, uuids: string[]}>} 一个包含资格、有效条目数和 UUID 列表的对象
 *
 * @example
 * // 检查用户是否满足安利条目要求
 * const result = await checkAmwayEligibility(
 *   '1290468316401504280',  // 用户ID
 *   '0',                    // 配置ID
 *   '1291925535324110879'   // 服务器ID
 * );
 * if (result.isEligible) {
 *   console.log('✅ 满足条件');
 *   console.log(`有效条目数: ${result.count}`);
 *   console.log(`条目 UUID: ${result.uuids.join(', ')}`);
 * } else {
 *   console.log('❌ 不满足条件');
 * }
 *
 * @throws {Error} 当配置文件不存在或格式错误时抛出错误
 *
 * @description
 * 函数执行流程：
 * 1. 从配置文件加载指定 configId 的配置项
 * 2. 验证服务器 ID 是否匹配
 * 3. 验证配置类型是否为 'amway'
 * 4. 通过网关查询安利系统获取用户的安利条目
 * 5. 过滤掉已删除的条目 (is_deleted: false)
 * 6. 比较有效条目数与阈值，返回布尔结果
 *
 * @since 1.0.0
 */
async function checkAmwayEligibility(userId, configId, guildId) {
  try {
    const config = loadConfig();
    const configItem = config.grpc_roleapply_config[configId];

    if (!configItem) {
      throw new Error(`配置 ID ${configId} 不存在`);
    }

    if (configItem.guild_id !== guildId) {
      console.log(`[amway_checker] 服务器 ID 不匹配: 配置=${configItem.guild_id}, 传入=${guildId}`);
      return { isEligible: false, count: 0, uuids: [] };
    }

    if (configItem.type !== 'amway') {
      console.log(`[amway_checker] 配置类型不是 amway: ${configItem.type}`);
      return { isEligible: false, count: 0, uuids: [] };
    }

    const { grpc_path, threshold } = configItem.data;
    const thresholdNum = parseInt(threshold, 10);

    console.log(`[amway_checker] 查询用户 ${userId} 在服务器 ${guildId} 的安利条目，阈值: ${thresholdNum}`);

    const requestData = {
      author_id: userId,
      guild_id: guildId,
    };

    const response = await queryThroughGateway(grpc_path, requestData);

    console.log(`[amway_checker] 收到响应:`, JSON.stringify(response, null, 2));

    if (!response || !response.recommendationsList) {
      console.log(`[amway_checker] 查询返回空结果或缺少 recommendationsList 字段`);
      console.log(`[amway_checker] response 存在: ${!!response}`);
      console.log(`[amway_checker] response.recommendationsList 存在: ${!!(response && response.recommendationsList)}`);
      return { isEligible: false, count: 0, uuids: [] };
    }

    const validRecommendations = response.recommendationsList.filter(rec => !rec.isDeleted && rec.auditStatus === 2);
    const validCount = validRecommendations.length;

    console.log(`[amway_checker] 用户 ${userId} 有效安利条目数: ${validCount}, 阈值: ${thresholdNum}`);

    const isEligible = validCount >= thresholdNum;
    const uuids = validRecommendations.map(rec => rec.uuid);

    return {
      isEligible,
      count: validCount,
      uuids,
    };

  } catch (error) {
    console.error(`[amway_checker] 检查安利资格时出错:`, error);
    return { isEligible: false, count: 0, uuids: [] };
  }
}

/**
 * 加载安利系统角色申请配置文件
 *
 * @function loadConfig
 * @returns {Object} 解析后的配置对象
 * @throws {Error} 当配置文件读取失败或 JSON 解析失败时抛出错误
 *
 * @description
 * 同步读取并解析 grpc_roleapply_config.json 配置文件
 *
 * @since 1.0.0
 */
function loadConfig() {
  try {
    const configData = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    throw new Error(`无法读取配置文件: ${error.message}`);
  }
}

/**
 * 根据配置 ID 获取对应的配置项
 *
 * @function getConfigById
 * @param {string} configId - 配置项的唯一标识符
 * @returns {Object|undefined} 配置项对象，如果不存在则返回 undefined
 *
 * @example
 * // 获取 ID 为 "0" 的配置项
 * const config = getConfigById('0');
 * console.log(config.name); // "旅程 · amway 链接鉴赏家发放方法"
 *
 * @description
 * 从配置文件中提取指定 ID 的配置项，包含安利系统相关的参数设置
 *
 * @since 1.0.0
 */
function getConfigById(configId) {
  const config = loadConfig();
  return config.grpc_roleapply_config[configId];
}

module.exports = {
  checkAmwayEligibility,
  getConfigById,
  loadConfig
};