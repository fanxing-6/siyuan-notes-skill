# 命令完整参考

所有命令：`node index.js <command> [args]`

运行前提：cwd 必须是 skill 目录（即 `index.js` 所在目录）。

---

## 读取命令

### search — 搜索笔记

```bash
node index.js search <关键词> [数量] [块类型]
```

| 参数 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| 关键词 | 是 | | 搜索词 |
| 数量 | 否 | 20 | 返回数量（1-200） |
| 块类型 | 否 | 全部 | `p`段落 `h`标题 `l`列表 `c`代码 `d`文档 `t`表格 |

参数顺序灵活：`search "AI" 10 h` 或 `search "AI" h`（省略数量则用默认 20）

**返回**：格式化文本，每行一条结果含块 ID、内容、类型、时间

---

### search-md — 搜索并输出 Markdown 页面

```bash
node index.js search-md <关键词> [数量] [块类型]
```

参数同 `search`。**返回**：完整 Markdown 页面格式

---

### open-doc — 打开文档

```bash
node index.js open-doc <文档ID> [readable|patchable]
```

| 参数 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| 文档ID | 是 | | 文档块 ID |
| 视图 | 否 | readable | `readable`=干净 Markdown；`patchable`=PMF 格式 |

**返回**：
- `readable`：YAML 头 + Markdown 正文，适合阅读和总结
- `patchable`：带块 ID 注释的 PMF 格式，用于编辑

**副作用**：标记文档为"已读"并记录文档版本快照（满足写入前置条件，写入前会校验版本是否一致）

---

### notebooks — 列出笔记本

```bash
node index.js notebooks
```

无参数。**返回**：编号列表，含笔记本名称、ID、是否关闭

---

### docs — 列出文档

```bash
node index.js docs [笔记本ID] [数量]
```

| 参数 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| 笔记本ID | 否 | 全部 | 筛选特定笔记本 |
| 数量 | 否 | 200 | 返回数量（1-2000） |

**返回**：格式化文本，每行含文档 ID（如 `[20260206204419-vgvxojw]`）

---

### headings — 文档标题

```bash
node index.js headings <文档ID> [级别]
```

| 参数 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| 文档ID | 是 | | |
| 级别 | 否 | 全部 | `h1`/`h2`/`h3`/`h4`/`h5`/`h6`（必须是字符串格式，不能用数字 `1`/`2` 等） |

**返回**：格式化文本

---

### blocks — 文档子块

```bash
node index.js blocks <文档ID> [块类型]
```

| 参数 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| 文档ID | 是 | | |
| 块类型 | 否 | 全部 | `p`/`h`/`l`/`t`/`c` 等 |

**返回**：格式化文本，每行含块 ID（如 `[20260206204442-j76ycfo]`），可用于 append-block 的 parentID

---

### doc-children — 子文档列表

```bash
node index.js doc-children <笔记本ID> [路径]
```

| 参数 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| 笔记本ID | 是 | | |
| 路径 | 否 | `/` | 文件存储路径 |

**返回**：编号列表，含文档名、ID、路径、子文档数

---

### doc-tree — 子文档树

```bash
node index.js doc-tree <笔记本ID> [路径] [深度]
```

| 参数 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| 笔记本ID | 是 | | |
| 路径 | 否 | `/` | 起始路径 |
| 深度 | 否 | 4 | 最大展开层级（1-10） |

**返回**：缩进 Markdown 树

---

### doc-tree-id — 以文档 ID 展示子文档树

```bash
node index.js doc-tree-id <文档ID> [深度]
```

| 参数 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| 文档ID | 是 | | |
| 深度 | 否 | 4 | 最大展开层级（1-10） |

**返回**：缩进 Markdown 树

---

### tag — 按标签搜索

```bash
node index.js tag <标签名>
```

标签名不带 `#` 号。**返回**：格式化文本

---

### backlinks — 反向链接

```bash
node index.js backlinks <块ID>
```

**返回**：引用了该块的所有块，格式化文本

---

### tasks — 任务查询

```bash
node index.js tasks [状态] [天数]
```

| 参数 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| 状态 | 否 | `[ ]` | `[ ]`未完成 `[x]`已完成 `[-]`进行中 |
| 天数 | 否 | 7 | 时间范围 |

**返回**：格式化文本

---

### daily — Daily Note 查询

```bash
node index.js daily <开始日期> <结束日期>
```

日期格式：`YYYYMMDD`（如 `20260101`）。**返回**：格式化文本

---

### attr — 按属性查询

```bash
node index.js attr <属性名> [属性值]
```

自定义属性需带 `custom-` 前缀。**返回**：格式化文本

---

### bookmarks — 书签查询

```bash
node index.js bookmarks [书签名]
```

省略书签名则返回所有书签。**返回**：格式化文本

---

### random — 随机漫游

```bash
node index.js random <文档ID>
```

**返回**：文档中随机一个标题，格式化文本

---

### recent — 最近修改

```bash
node index.js recent [天数] [块类型]
```

| 参数 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| 天数 | 否 | 7 | |
| 块类型 | 否 | 全部 | |

**返回**：格式化文本

---

### unreferenced — 未被引用的文档

```bash
node index.js unreferenced <笔记本ID>
```

**返回**：格式化文本

---

### check — 连接检查

```bash
node index.js check
```

**返回**：`✅ 思源笔记连接正常` 或 `❌ 思源笔记连接失败`

---

### version — 内核版本

```bash
node index.js version
```

**返回**：版本号文本

---

## 写入命令

**所有写入命令的通用前置条件：**
1. `.env` 中 `SIYUAN_ENABLE_WRITE=true`（或命令行前缀 `SIYUAN_ENABLE_WRITE=true`）
2. 必须先用 `open-doc` 读取过目标文档
3. 文档在 `open-doc` 之后不能被其他端修改过（**核心保护**：基于 `updated` 时间戳的乐观锁版本检查）

> 读标记超过 3600 秒会自动过期，但这只是缓存清理机制；真正防止脏写的是版本检查。

> **例外**：`create-doc` 和 `rename-doc` 不需要先 `open-doc`（因为文档可能尚未创建或不需要读取内容）

### create-doc — 创建新文档

```bash
node index.js create-doc <笔记本ID> <标题> [Markdown内容]
```

| 参数 | 必需 | 说明 |
|------|------|------|
| 笔记本ID | 是 | 目标笔记本（用 `notebooks` 命令查询） |
| 标题 | 是 | 文档标题（自动作为文档路径 `/标题`） |
| Markdown | 否 | 文档初始内容 |

**返回**：JSON，含新文档 ID

**常见用法：**
```bash
# 查询笔记本列表
node index.js notebooks

# 创建空文档
SIYUAN_ENABLE_WRITE=true node index.js create-doc "笔记本ID" "我的新文档"

# 创建带初始内容的文档（必须用 $'...' 传递真实换行）
SIYUAN_ENABLE_WRITE=true node index.js create-doc "笔记本ID" "会议纪要" $'## 议题\n\n## 决议'
```

> **注意**：标题即文档名。如果要创建子文档，使用 JS API `createDocWithMd(notebook, '/父文档/子文档标题', markdown)`。
>
> **Bash 换行提示**：Markdown 内容中的换行必须用 `$'...\n...'`（ANSI-C quoting）传递。普通双引号 `"...\n..."` 中的 `\n` 会被当作两个字面字符而非换行。

---

### rename-doc — 重命名文档

```bash
node index.js rename-doc <文档ID> <新标题>
```

| 参数 | 必需 | 说明 |
|------|------|------|
| 文档ID | 是 | 要重命名的文档 ID |
| 新标题 | 是 | 新的文档标题 |

**返回**：JSON

**常见用法：**
```bash
SIYUAN_ENABLE_WRITE=true node index.js rename-doc "文档ID" "新标题"
```

> **注意**：rename-doc 自动查询文档的笔记本和存储路径，只需提供文档 ID 和新标题。

---

### append-block — 追加内容

```bash
node index.js append-block <父块ID> <Markdown内容>
```

| 参数 | 必需 | 说明 |
|------|------|------|
| 父块ID | 是 | 追加到哪个块下。文档 ID → 追加到文档末尾；标题块 ID → 追加到该标题的章节内 |
| Markdown | 是 | 要追加的内容（引号包裹） |

**返回**：JSON

**常见用法：**
```bash
# 追加段落到文档末尾
SIYUAN_ENABLE_WRITE=true node index.js append-block "文档ID" "新段落"

# 追加标题
SIYUAN_ENABLE_WRITE=true node index.js append-block "文档ID" "## 新标题"

# 追加表格（多行内容用引号包裹）
SIYUAN_ENABLE_WRITE=true node index.js append-block "文档ID" "|列1|列2|
|---|---|
|a|b|"

# 追加任务
SIYUAN_ENABLE_WRITE=true node index.js append-block "父块ID" "- [ ] 待办事项"
```

---

### replace-section — 替换章节

```bash
node index.js replace-section <标题块ID> <Markdown内容>
node index.js replace-section <标题块ID> --clear
```

| 参数 | 必需 | 说明 |
|------|------|------|
| 标题块ID | 是 | 必须是标题块（type=h） |
| Markdown | 是（除非 --clear） | 替换内容 |
| --clear | 否 | 清空该标题下所有子块 |

**行为**：删除标题下所有子块 → 追加新内容。**标题块本身保留不变**，所以新 Markdown 内容**不要重复标题**（例如标题是 `## 第一章`，新内容应直接是正文段落、列表等，而不是再写一个 `## ...`）。

**返回**：JSON，含删除的块 ID 列表和追加结果

---

### apply-patch — 应用 PMF 补丁

```bash
node index.js apply-patch <文档ID> < patch.pmf
```

| 参数 | 必需 | 说明 |
|------|------|------|
| 文档ID | 是 | 必须与 PMF 文件中的 doc id 匹配 |
| stdin | 是 | PMF 格式文本 |

**返回**：JSON，含 `plan.summary` 和 `execution`

> **重要限制：仅用于修改已有块内容、删除块、重排块。不要用来插入新块（会导致 "invalid ID argument" 且可能丢失数据）。** 详见 [docs/pmf-spec.md](pmf-spec.md)。
>
> **PMF 必须完整**：提交的 PMF 文件必须包含文档的**所有**块。缺失的块会被视为删除操作。正确做法是先 `open-doc patchable > /tmp/doc.pmf` 导出完整 PMF，只修改目标块的文本内容，然后提交完整文件。**不要只写目标块的 PMF**，否则其他所有块都会被删除。

---

### move-docs-by-id — 移动文档

```bash
node index.js move-docs-by-id <目标ID> <来源ID列表>
```

| 参数 | 必需 | 说明 |
|------|------|------|
| 目标ID | 是 | 目标父文档 ID 或笔记本 ID |
| 来源ID列表 | 是 | 逗号或空格分隔的文档 ID |

**前置条件**：必须先 `open-doc` 目标文档**和**每个来源文档（写入围栏要求所有涉及的文档都已被读取）。

**返回**：JSON，含移动计划或执行结果

---

### subdoc-analyze-move — 分析子文档移动（只读）

```bash
node index.js subdoc-analyze-move <目标ID> <来源ID列表> [深度]
```

| 参数 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| 目标ID | 是 | | |
| 来源ID列表 | 是 | | 逗号分隔 |
| 深度 | 否 | 5 | 分析深度（1-10） |

**只读分析**，不执行移动。**返回**：JSON 分析报告

---

## JS API 调用（node -e）

CLI 无法满足时可直接调用导出的 API。

### 删除单个块

```bash
node index.js open-doc "文档ID" readable
SIYUAN_ENABLE_WRITE=true node -e "
const s = require('./index.js');
s.deleteBlock('要删除的块ID').then(r => console.log(JSON.stringify(r)));
"
```

### 更新单个块内容

```bash
node index.js open-doc "文档ID" readable
SIYUAN_ENABLE_WRITE=true node -e "
const s = require('./index.js');
s.updateBlock('块ID', 'kramdown', '新的 Markdown 内容').then(r => console.log(JSON.stringify(r)));
"
```

### 执行 SQL 查询

```bash
node -e "
const s = require('./index.js');
s.executeSiyuanQuery('SELECT * FROM blocks WHERE type=\"d\" LIMIT 10').then(r => console.log(s.formatResults(r)));
"
```

### 获取子块列表（用于找块 ID）

```bash
node -e "
const s = require('./index.js');
s.getChildBlocks('文档或块ID').then(r => console.log(JSON.stringify(r, null, 2)));
"
```

### 创建文档（JS API）

```bash
SIYUAN_ENABLE_WRITE=true node -e "
const s = require('./index.js');
s.createDocWithMd('笔记本ID', '/文档标题', '初始 Markdown').then(r => console.log(JSON.stringify(r)));
"
```

> `path` 参数的最后一段即为文档标题。例如 `/父文档/子标题` 会在"父文档"下创建名为"子标题"的文档。

### 重命名文档（JS API）

```bash
SIYUAN_ENABLE_WRITE=true node -e "
const s = require('./index.js');
s.renameDoc('笔记本ID', '/文档存储路径.sy', '新标题').then(r => console.log(JSON.stringify(r)));
"
```

> 需要先获取文档的笔记本 ID 和存储路径：`s.getPathByID('文档ID')`，推荐使用 `rename-doc` CLI 命令自动处理。

### 不可用的函数（未导出，不要调用）

- `markDocumentRead` — 用 `open-doc` 命令代替
- `loadReadGuardCache` / `saveReadGuardCache` — 内部函数

---

## 错误处理策略

### "invalid ID argument"

**原因**：传给思源 API 的块 ID 不存在（通常是 apply-patch 的 temp ID 问题）

**恢复**：
1. 立即 `open-doc "docID" readable` 检查文档当前状态
2. 如果文档被清空，用 append-block 逐步重建内容
3. 以后避免在 apply-patch 中插入新块

### 写入围栏报错

**原因**：没有先 open-doc，或读标记已过期

**恢复**：执行 `node index.js open-doc "文档ID" readable` 然后重试

### 版本冲突报错

**原因**：文档在 open-doc 之后被其他端（浏览器/手机/同步）修改过

**错误信息**：`文档 XXX 自上次读取后已被修改（读取时版本: ..., 当前版本: ...）`

**恢复**：执行 `node index.js open-doc "文档ID" readable` 重新读取最新版本，然后重试写入

**PMF 版本冲突**：如果 apply-patch 报 `PMF 版本冲突`，需要重新导出 PMF：
```bash
node index.js open-doc "文档ID" patchable > /tmp/doc.pmf
# 重新编辑 PMF 后再 apply-patch
```

### 连接失败

**检查**：思源是否运行 → `.env` 端口 → API Token → `node index.js check`

### 多步写入最佳实践

```bash
# 1. 开始前读取一次（记录文档版本快照）
node index.js open-doc "docID" readable

# 2. 连续写入无需重新读取（每次写入后版本自动刷新）
SIYUAN_ENABLE_WRITE=true node index.js append-block "docID" "内容1"
SIYUAN_ENABLE_WRITE=true node index.js append-block "docID" "内容2"
SIYUAN_ENABLE_WRITE=true node index.js append-block "docID" "内容3"

# ⚠️ 如果在步骤 1 和 2 之间有其他端修改了文档，会报版本冲突，需要重新 open-doc
```
