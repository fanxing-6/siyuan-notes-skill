---
name: siyuan-notes
description: 思源笔记工具——搜索、阅读、编辑、组织用户的笔记。适用于：查询/检索笔记、阅读文档内容、创建或修改笔记内容、整理文档结构、管理任务和标签等场景
allowed-tools:
  - Bash
---

## 编辑策略选择（最重要）

根据用户意图选择正确的编辑方式，**选错会导致数据丢失**：

| 用户想要 | 正确做法 | 错误做法 |
|---------|---------|---------|
| 修改已有内容（改文字/表格数据） | `apply-patch`（仅 update） | |
| 删除某些块 | `apply-patch`（仅 delete） | |
| 重排已有块 | `apply-patch`（仅 reorder） | |
| 添加新内容 | `append-block` 逐个追加 | ~~apply-patch 插入新块~~ |
| 替换章节内容 | `replace-section` | ~~apply-patch 删除+插入~~ |
| 重构文档（如拆表格） | `replace-section --clear` + `append-block` 逐步重建 | ~~apply-patch 删除旧块+插入新块~~ |

> **apply-patch 的 insert 有已知 BUG：执行时报 "invalid ID argument"。更危险的是：如果同时有 delete 和 insert，delete 先执行成功，insert 失败 → 文档被清空且无法回滚。**

## Intent Decision Tree

```
用户想要…
├─ 查找/搜索内容 ──────→ search / search-md / tag / attr / bookmarks
├─ 阅读文档 ──────────→ open-doc <ID> readable
├─ 浏览最近动态 ──────→ recent / tasks / daily
├─ 了解文档结构 ──────→ docs / notebooks / headings / blocks / doc-tree / doc-tree-id / doc-children
├─ 查看引用关系 ──────→ backlinks / unreferenced
├─ 修改已有内容 ──────→ open-doc patchable → 编辑内容 → apply-patch（仅 update/delete/reorder）
├─ 创建新文档 ────────→ create-doc（指定笔记本、标题、可选初始内容）
├─ 重命名文档 ────────→ rename-doc（只需文档 ID 和新标题）
├─ 添加新内容 ────────→ open-doc readable → append-block（逐个追加）
├─ 替换章节 ──────────→ open-doc patchable → replace-section
├─ 重构文档结构 ──────→ open-doc readable → replace-section --clear → append-block 逐步重建
├─ 组织文档层级 ──────→ subdoc-analyze-move → move-docs-by-id
├─ SQL 高级查询 ──────→ node -e + executeSiyuanQuery()
└─ 检查连接 ──────────→ check / version
```

## Write Safety Protocol

**写入前必须完成这 2 步，缺一不可：**

```bash
# 步骤 1：读取文档（标记为"已读"，同时记录文档版本快照）
node index.js open-doc "docID" readable

# 步骤 2：环境变量启用写入
SIYUAN_ENABLE_WRITE=true node index.js append-block "docID" "内容"
```

- 只有 `open-doc` 计为"已读"；`headings`/`blocks`/`doc-tree` 等不算
- **核心保护：版本检查（乐观锁）**——写入前对比文档 `updated` 时间戳，若文档在 open-doc 后被其他端修改过则拒绝写入
- 连续写入安全：每次写入成功后自动刷新版本号，`open-doc → write → write → write` 不会误报冲突
- 读标记超过 3600 秒自动过期（仅作为缓存清理，版本检查才是真正的安全机制）

## Core Commands Quick Reference

所有命令：`node index.js <command> [args]`

### 读取

| Command | Signature | Description |
|---------|-----------|-------------|
| `search` | `<keyword> [limit] [type]` | 搜索笔记（type: p/h/l/c/d…） |
| `search-md` | `<keyword> [limit] [type]` | 搜索并输出 Markdown 结果页 |
| `open-doc` | `<docID> [readable\|patchable]` | 打开文档（默认 readable）。**副作用：标记已读** |
| `notebooks` | | 列出笔记本 |
| `docs` | `[notebookID] [limit]` | 列出文档（含文档 ID，默认 200） |
| `headings` | `<docID> [level]` | 文档标题（level 格式：`h1`/`h2`/…/`h6`，不是数字） |
| `blocks` | `<docID> [type]` | 文档子块（含块 ID，可用于写入） |
| `doc-children` | `<notebookID> [path]` | 子文档列表 |
| `doc-tree` | `<notebookID> [path] [depth]` | 子文档树（默认深度 4） |
| `doc-tree-id` | `<docID> [depth]` | 以文档 ID 展示子文档树 |
| `tag` | `<tagName>` | 按标签搜索 |
| `backlinks` | `<blockID>` | 反向链接 |
| `tasks` | `[status] [days]` | 任务（`[ ]`/`[x]`/`[-]`，默认 7 天） |
| `daily` | `<start> <end>` | Daily Note（YYYYMMDD） |
| `attr` | `<name> [value]` | 按属性查询（自定义属性加 `custom-` 前缀） |
| `bookmarks` | `[name]` | 书签 |
| `random` | `<docID>` | 随机标题 |
| `recent` | `[days] [type]` | 最近修改（默认 7 天） |
| `unreferenced` | `<notebookID>` | 未被引用的文档 |
| `check` | | 连接检查 |
| `version` | | 内核版本 |

### 写入

| Command | Signature | 适用场景 |
|---------|-----------|---------|
| `create-doc` | `<notebookID> <标题> [markdown]` | 创建新文档（标题即文档名） |
| `rename-doc` | `<docID> <新标题>` | 重命名文档 |
| `append-block` | `<parentID> <markdown>` | 添加新内容（parentID 可以是文档 ID 或标题块 ID） |
| `replace-section` | `<headingID> <markdown\|--clear>` | 替换/清空章节（保留标题块本身，只替换子内容；新 markdown 不要重复标题） |
| `apply-patch` | `<docID> < pmf` | **仅限**修改/删除/重排已有块 |
| `move-docs-by-id` | `<targetID> <sourceIDs>` | 移动文档（需先 open-doc 目标文档**和**所有来源文档） |
| `subdoc-analyze-move` | `<targetID> <sourceIDs> [depth]` | 分析移动计划（只读） |

## Common Patterns

### 1. 搜索并阅读

```bash
node index.js search "项目总结" 5
node index.js open-doc "找到的文档ID" readable
```

### 2. 修改已有块内容（apply-patch 安全用法）

```bash
# 导出 PMF
node index.js open-doc "docID" patchable > /tmp/doc.pmf

# 编辑 /tmp/doc.pmf：只改 markdown 内容，保留所有块 ID 注释不变
# ⚠️ 关键：PMF 必须包含文档的 **所有** 块！缺失的块会被视为删除！
#    正确做法：导出完整 PMF → 只修改目标块的文本 → 提交完整文件
#    错误做法：只写目标块 → 其他块全部丢失

# 执行
SIYUAN_ENABLE_WRITE=true node index.js apply-patch "docID" < /tmp/doc.pmf
```

### 3. 添加新内容到文档

```bash
node index.js open-doc "docID" readable                    # 先读
SIYUAN_ENABLE_WRITE=true node index.js append-block "docID" "## 新标题"
SIYUAN_ENABLE_WRITE=true node index.js append-block "docID" "段落内容"
SIYUAN_ENABLE_WRITE=true node index.js append-block "docID" "- [ ] 任务"
```

### 4. 重构文档（如拆分表格为多个）

```bash
# 读取原始内容
node index.js open-doc "docID" readable

# 用 patchable 视图找到要操作的块 ID
node index.js open-doc "docID" patchable

# 方案A：有标题块 → 清空章节再重建
# replace-section 保留标题块本身，只删除标题下的子内容
# 所以新内容不要重复标题（例如标题是 "## 表格" 则直接追加表格数据即可）
SIYUAN_ENABLE_WRITE=true node index.js replace-section "标题块ID" --clear
# 追加到标题块 ID 下 → 新内容会出现在该标题的章节内
SIYUAN_ENABLE_WRITE=true node index.js append-block "标题块ID" "### 概览"
SIYUAN_ENABLE_WRITE=true node index.js append-block "标题块ID" "|列1|列2|
|---|---|
|数据|数据|"

# 方案B：没有标题块 → 用 node -e 删除旧块再追加
SIYUAN_ENABLE_WRITE=true node -e "
const s = require('./index.js');
s.deleteBlock('旧块ID').then(r => console.log(JSON.stringify(r)));
"
SIYUAN_ENABLE_WRITE=true node index.js append-block "docID" "新内容"
```

### 5. 创建新文档

```bash
# 先查笔记本ID
node index.js notebooks

# 创建空文档
SIYUAN_ENABLE_WRITE=true node index.js create-doc "笔记本ID" "文档标题"

# 创建带初始内容的文档（注意：用 $'...' 语法才能传递真正的换行）
SIYUAN_ENABLE_WRITE=true node index.js create-doc "笔记本ID" "文档标题" $'## 第一章\n内容'

# 重命名已有文档
SIYUAN_ENABLE_WRITE=true node index.js rename-doc "文档ID" "新标题"
```

### 6. 删除单个块（用 JS API）

```bash
node index.js open-doc "文档ID" readable
SIYUAN_ENABLE_WRITE=true node -e "
const s = require('./index.js');
s.deleteBlock('块ID').then(r => console.log(JSON.stringify(r)));
"
```

## 错误恢复

| 错误 | 原因 | 恢复方法 |
|------|------|---------|
| `invalid ID argument` | apply-patch 的新块 temp ID 无法解析 | 1. `open-doc` 检查文档状态 2. 用 `append-block` 重建丢失内容 |
| 文档被清空 | apply-patch delete 成功但 insert 失败 | 用 `append-block` 逐步重建全部内容 |
| 写入围栏报错 | 未先 open-doc 或读标记过期 | `open-doc "docID" readable` 然后重试 |
| 版本冲突报错 | 文档在 open-doc 后被其他端修改 | `open-doc "docID" readable` 重新读取最新版本然后重试 |
| PMF 版本冲突 | PMF 导出后文档被修改 | `open-doc "docID" patchable > /tmp/doc.pmf` 重新导出后再编辑 |
| 只读模式报错 | 未设置 `SIYUAN_ENABLE_WRITE=true` | 在命令前加 `SIYUAN_ENABLE_WRITE=true` |
| 文档标题为"未命名文档" | `createDocWithMd` 的 path 参数决定标题 | 用 `create-doc` CLI 命令（自动设置标题）或 `rename-doc` 修正 |
| 连接失败 | 思源未运行/端口/Token 错误 | `node index.js check` 验证 |
| search 返回空 | 全文索引未更新或关键词不在 markdown 字段 | 改用 SQL 查询：`node -e "const s=require('./index.js'); s.executeSiyuanQuery(\"SELECT * FROM blocks WHERE content LIKE '%关键词%' LIMIT 20\").then(r=>console.log(s.formatResults(r)))"` |

## Output Guidance

- 读取命令返回格式化文本 → 直接展示给用户
- `open-doc readable` 返回干净 Markdown → 适合阅读和总结
- `open-doc patchable` 返回 PMF 格式 → 仅用于编辑后 apply-patch
- 写入命令返回 JSON（通常很冗长） → 只提取关键信息（如新文档 ID、成功/失败）展示给用户，不要原样输出全部 JSON

## Supporting Files

- [docs/command-reference.md](docs/command-reference.md) — 每个命令的详细参数、默认值、返回格式、示例
- [docs/pmf-spec.md](docs/pmf-spec.md) — PMF 格式规范、安全操作 vs 危险操作、编辑策略详解
- [docs/sql-reference.md](docs/sql-reference.md) — SQL 表结构、字段说明、查询示例

## SQL Quick Reference

- SQLite 语法；默认最多返回 64 行
- 时间格式 `YYYYMMDDHHmmss`
- 主要表：`blocks`（块）、`refs`（引用）、`attributes`（属性）
- 块类型：`d`文档 `h`标题 `p`段落 `l`列表 `c`代码 `t`表格 `m`公式 `b`引述 `s`超级块
- 层级：`root_id` → 文档，`parent_id` → 父容器

## Notes

- cwd 必须是 skill 目录（`index.js` 所在目录）
- `.env` 自动从 `index.js` 目录加载
- 路径含空格需加引号
- Markdown 内容含换行时必须用 `$'...\n...'` 语法（Bash ANSI-C quoting），普通双引号 `"...\n..."` 中的 `\n` 是字面文本不是换行
- 连接检查：`node index.js check`
