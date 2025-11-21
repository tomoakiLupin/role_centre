const fs = require('fs');
const path = require('path');

class ConfigLoader {
  constructor(configDir = 'data/config') {
    this.configDir = configDir;
    this.config = {};
    this.loadConfigs();
  }

  loadConfigs() {
    const configFiles = [
      'channle_san_config.json',
      'bot_config.json',
      'atuo_applyrole_config.json',
      'log_config.json',
      'blacklist.json',
      'post_reaction_autoapply.json',
      'newpost_autorole_apply.json',
      'chat_ApplyConfig.json'
    ];

    // 加载所有配置文件
    configFiles.forEach(filename => {
      const filepath = path.join(this.configDir, filename);
      if (fs.existsSync(filepath)) {
        try {
          const content = JSON.parse(fs.readFileSync(filepath, 'utf8'));
          const configKey = filename.replace('_config.json', '').replace('.json', '');
          this.config[configKey] = content;
          console.log(`✓ 已加载配置: ${filename}`);
        } catch (error) {
          console.error(`✗ 加载配置失败: ${filename}`, error.message);
        }
      }
    });

    // 支持环境变量覆盖
    this.applyEnvironmentOverrides();
  }

  applyEnvironmentOverrides() {
    // 支持环境变量覆盖，格式: CONFIG_SECTION_KEY
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('CONFIG_')) {
        const parts = key.replace('CONFIG_', '').toLowerCase().split('_');
        if (parts.length >= 2) {
          const section = parts[0];
          const configKey = parts.slice(1).join('_');

          if (this.config[section]) {
            this.config[section][configKey] = process.env[key];
            console.log(`✓ 环境变量覆盖: ${section}.${configKey} = ${process.env[key]}`);
          }
        }
      }
    });
  }

  get(path, defaultValue = null) {
    const parts = path.split('.');
    let current = this.config;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return defaultValue;
      }
    }

    return current;
  }

  has(path) {
    return this.get(path) !== null;
  }

  getAll() {
    return this.config;
  }

  reload() {
    this.config = {};
    this.loadConfigs();
  }
}

// 单例模式
let configInstance = null;

function getConfig() {
  if (!configInstance) {
    configInstance = new ConfigLoader();
  }
  return configInstance;
}

module.exports = {
  ConfigLoader,
  getConfig,
  config: getConfig()
};