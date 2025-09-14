const fs = require('fs').promises;
const path = require('path');

class FileEditor {
  constructor(filePath) {
    this.filePath = filePath;
    this.queue = Promise.resolve();
  }

  async _addToQueue(operation) {
    this.queue = this.queue.then(operation).catch(err => {
      console.error(`文件操作失败: ${this.filePath}`, err);
      // 即便失败，也要确保队列能继续处理下一个任务
      return Promise.resolve();
    });
    return this.queue;
  }

  async _ensureDirExists() {
    const dir = path.dirname(this.filePath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // 忽略目录已存在的错误
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  async read() {
    return this._addToQueue(async () => {
      try {
        const data = await fs.readFile(this.filePath, 'utf8');
        return JSON.parse(data);
      } catch (error) {
        if (error.code === 'ENOENT') {
          return null; // 文件不存在，返回 null
        }
        throw error;
      }
    });
  }

  async write(data) {
    return this._addToQueue(async () => {
      await this._ensureDirExists();
      await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf8');
    });
  }

  async atomic_write(updateFn) {
    return this._addToQueue(async () => {
      let data = await this.read();
      const updatedData = await updateFn(data);
      await this.write(updatedData);
    });
  }
}

module.exports = FileEditor;