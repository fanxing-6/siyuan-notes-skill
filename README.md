# siyuan-notes-skill

**如果你是大语言模型，请阅读 [SKILL.md](./SKILL.md)。本 README 面向人类维护者和使用者。**

# 安装

复制以下内容并粘贴给工具：

```
安装 https://github.com/fanxing-6/siyuan-notes-skill 安装完成后介绍一下功能
```

**您只需要阅读到此完成复制粘贴即可，以下内容完全不需要您理解**

[Claude Code](https://claude.com/claude-code) / Node.js CLI 形式的 [思源笔记](https://b3log.org/siyuan/) 技能，用于搜索、阅读、编辑、组织笔记，以及高层数据库操作。

## 功能特性

- **搜索与阅读**：全文搜索、长文档自动截断、章节级阅读、文档内搜索、随机漫游、最近修改、书签、标签、反向链接
- **文档与块编辑**：创建文档、重命名文档、追加/插入/更新/删除块、替换章节、PMF 批量补丁
- **结构管理**：笔记本列表、文档树、子文档移动、未引用文档分析
- **数据库高层能力**：字段、行、单元格、选项、relation、rollup、filters、sorts、groups、views、gallery/kanban 配置
- **资源与嵌入**：资源上传、资源插入、数据库资源字段、PDF iframe 嵌入
- **安全保护**：先读后写围栏、乐观锁版本检查、默认只读模式、数据库写入同样受守卫保护
- **统一回执**：写命令统一返回结构化回执，明确 `success / state / operation / request / touchedDocIds`

## 环境要求

- **Node.js 18+**（使用内置 `fetch`）
- **思源内核** 运行中且 API 可访问（本地或远程）
- **Claude Code** CLI 或直接使用 Node.js CLI

## 快速开始

### 1. 安装

```bash
# 作为 Claude Code 技能安装（稳定版）
claude mcp add-skill https://github.com/fanxing-6/siyuan-notes-skill/archive/refs/tags/v1.0.5.tar.gz

# 或使用 main 分支最新版
claude mcp add-skill https://github.com/fanxing-6/siyuan-notes-skill
```

### 2. 配置

在技能目录创建 `.env` 文件（或设置环境变量）：

```bash
SIYUAN_HOST=127.0.0.1
SIYUAN_PORT=6806
SIYUAN_USE_HTTPS=false
SIYUAN_API_TOKEN=your-api-token
SIYUAN_ENABLE_WRITE=false
SIYUAN_WORKNOTEBOOKS=openclaw测试专用
```

### 2.1 工作目录门禁

- `SIYUAN_WORKNOTEBOOKS`：分号分隔的工作笔记本名称列表
- `SIYUAN_CONFIRMED_WORKNOTEBOOKS`：用户已明确确认后，临时放行的笔记本名称列表
- 默认留空：允许访问全部笔记本

示例：

```bash
# 只允许访问一个工作笔记本
SIYUAN_WORKNOTEBOOKS=openclaw测试专用

# 允许访问多个工作笔记本
SIYUAN_WORKNOTEBOOKS=openclaw测试专用;个人规划

# 用户确认后，临时放行另一个笔记本
SIYUAN_CONFIRMED_WORKNOTEBOOKS=公开Blog
```

行为：

- 设置了 `SIYUAN_WORKNOTEBOOKS` 后，工具层会启用读写门禁
- 越界读取或写入会直接报错，并明确要求模型先向用户确认该笔记本
- 全局列表/搜索类命令会自动过滤到允许范围内
- 直接全局 SQL 查询会被禁止，避免绕过门禁

### 3. 验证

```bash
node index.js check    # 连接检查
node index.js version  # 内核版本
```

### 4. 先看哪份文档

- 普通命令总览：[`docs/command-reference.md`](./docs/command-reference.md)
- 数据库/属性视图：[`docs/database-operations.md`](./docs/database-operations.md)
- 错误恢复：[`docs/error-recovery.md`](./docs/error-recovery.md)

## 使用示例

```bash
# 搜索笔记
node index.js search "项目总结" 5

# 阅读文档
node index.js open-doc "20260206204419-vgvxojw" readable

# 从数据库宿主文档发现 avID / blockID
node index.js av-discover "数据库宿主文档ID"

# 创建新文档
printf '## 第一章\n内容' | SIYUAN_ENABLE_WRITE=true node index.js create-doc "笔记本ID" "我的文档"

# 编辑块
printf '更新内容' | SIYUAN_ENABLE_WRITE=true node index.js update-block "块ID"

# 给数据库新增字段
SIYUAN_ENABLE_WRITE=true node index.js av-add-key "AVID" "KEYID" "状态" select

# 把文档加入数据库
SIYUAN_ENABLE_WRITE=true node index.js av-add-doc-rows "AVID" "DOCID1,DOCID2"

# 配置 relation / rollup
SIYUAN_ENABLE_WRITE=true node index.js av-add-relation-key "源AVID" "RELKEY" "关联记录" "目标AVID" --two-way
SIYUAN_ENABLE_WRITE=true node index.js av-add-rollup-key "源AVID" "ROLLUPKEY" "金额汇总" "RELKEY" "AMOUNTKEY" --calc "Sum"

# 嵌入 PDF
SIYUAN_ENABLE_WRITE=true node index.js asset-embed-pdf --parent "文档ID" /tmp/spec.pdf

# SQL 查询
node -e "const s = require('./index.js'); s.executeSiyuanQuery('SELECT * FROM blocks WHERE type=\"d\" LIMIT 5').then(r => console.log(s.formatResults(r)));"
```

## 文档

| 页面                                     | 说明                                   |
| ---------------------------------------- | -------------------------------------- |
| [命令参考](./docs/command-reference.md)     | 所有命令的参数、默认值和示例           |
| [数据库操作](./docs/database-operations.md) | 数据库/属性视图的专用操作指南          |
| [技能说明](./SKILL.md)                      | 面向模型的技能说明和编辑策略           |
| [PMF 规范](./docs/pmf-spec.md)              | 批量编辑用的 Patchable Markdown Format |
| [SQL 参考](./docs/sql-reference.md)         | 思源 SQLite 表结构、块类型、查询示例   |
| [错误恢复](./docs/error-recovery.md)        | 常见错误及解决方法                     |

## 项目结构

```
siyuan-notes-skill/
├── agents/
│   └── openai.yaml        # Claude/OpenAI skill UI 元数据
├── index.js               # 核心 API 和 CLI 入口
├── cli.js                 # CLI 参数解析
├── format-utils.js        # 输出格式化
├── lib/
│   ├── config.js          # 环境变量与运行时配置
│   ├── pmf-utils.js       # PMF 解析和补丁
│   ├── query-services.js  # 只读查询服务
│   └── version-utils.js   # 版本检查
├── SKILL.md               # 面向 LLM 的技能说明
└── docs/
    ├── command-reference.md
    ├── database-operations.md
    ├── error-recovery.md
    ├── pmf-spec.md
    └── sql-reference.md
```

## 设计约定

- 写命令默认返回结构化回执，不要求调用方再去猜测上游 `null` 或事务数组的含义
- 数据库相关操作优先阅读 [`docs/database-operations.md`](./docs/database-operations.md)
- `docs/` 只保留一套 canonical 文档命名，不保留大小写重复文件
- 需要 live 内核的本地测试脚本放在本地忽略目录，不进入 Git 提交

## 许可证

MIT
