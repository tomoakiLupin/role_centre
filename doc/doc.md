我现在希望完成一个 / 的命令，这个命令可以创建一个带按钮的面板，通过这个面板连带的下拉选项框可以退出自己的身份组

/创建退出面板
- 身份组ID str （“，” 分割多个身份组）
- 生成退出日志（补全，是否）
- 自动删除（单位为分钟，0 表示不删除）

持久化逻辑：
每一个按钮生成一个 4 位的cache ID ，自定义 ID 格式为 「role_leave: cacheID 」，存储在 data/cache/role_leave.json 中
退出日志保存在 data/log/role_leave_log.json 中，按按钮的 cache ID 分组，记录用户在什么时间退出的什么身份组