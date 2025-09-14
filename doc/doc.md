接下来我们会一起完成最难的 申请处理器 和 投票 逻辑

我的想法是由管理员创建一个 XXX（身份组名称） 申请 的 ED 嵌入式面板，点击面板申请

```json
 "2": {
            "name": "旅程答疑区身份组分发配置 · 答疑组",
            "guild_id": "1291925535324110879",
            "data": {
                "database_name": ["data_1338199016957022278.db"],
                "database_kv": ["mentions_made_count",""], // <-- 
                "threshold": 1500,
                "musthold_role_id": "1336817752844796016",
                "role_id": "1354048449099599962",
                "admin_channel_id": "1384547452765339760"
            },
            "manual_revive": true,
            "revive_config": {
                "time": "24h",
                "review_channel_id": "1374692298688036984",
                "allow_vote_role": {
                    "admin": "1337451654705971330",
                    "user": "1354048449099599962",
                    "ratio_allow": {
                        "admin": 1,
                        "user": 7
                    },
                    "ratio_reject": {
                        "admin": 1,
                        "user": 2
                    }
                }
            }
        }
```
我来为您讲解一下要怎么解读这些 json 片段
guild_id: 这是一个服务器的id，这个id是唯一的
database_name: 这是一个数据库的名字
database_kv: 这是一个数据库的键值对，表示你要在默认的用户统计表中查询的什么字段（列），这是一个数组，表示你可能需要查询多个
threshold: 这是一个阈值， database_kv  中查询到的数值相加等于阈值时，通过

你可以在 @db/db_init.js 看到数据库所有可以用的表

下面是关于review 的部分，那是一个投票器，我有成品的，在这里
@doc/outinput/voteHandler.js 
@doc/outinput/voteManager.js 

有什么问题请提问！！！！！

---

1.我的建议是
在 handler 文件夹下面专门存放这些文件，UI 就不用了，

2.可能需要检查一下适用性

3。我写错了，抱歉

4。 管理员，有多个