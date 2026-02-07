# siyuan-notes-skill

Claude Code Skill，通过思源笔记 API 实现笔记的搜索、阅读、编辑和组织。

**GitHub 仓库**: https://github.com/fanxing-6/siyuan-notes-skill

## 安装

```bash
cd ~/.claude/skills
git clone https://github.com/fanxing-6/siyuan-notes-skill.git siyuan-notes
cd siyuan-notes
npm install
```

## 配置

创建 `.env` 文件：

```env
SIYUAN_HOST=localhost
SIYUAN_PORT=6806
SIYUAN_API_TOKEN=你的API_TOKEN
SIYUAN_ENABLE_WRITE=false
SIYUAN_REQUIRE_READ_BEFORE_WRITE=true
SIYUAN_READ_GUARD_TTL_SECONDS=3600
SIYUAN_LIST_DOCUMENTS_LIMIT=200
```

API Token 获取：思源笔记 → 设置 → 关于。

验证连接：

```bash
node index.js check
```

## 命令概览

所有命令：`node index.js <command> [args]`

### 读取

| 命令 | 用途 |
|------|------|
| `search <关键词> [数量] [类型]` | 全文搜索 |
| `search-md <关键词> [数量] [类型]` | 搜索并输出 Markdown 结果页 |
| `open-doc <文档ID> [readable\|patchable] [--cursor <块ID>] [--limit-chars <N>] [--limit-blocks <N>] [--full]` | 打开文档（超长文档自动截断/分页，`--full` 跳过） |
| `open-section <标题块ID> [readable\|patchable]` | 读取标题下的章节内容 |
| `search-in-doc <文档ID> <关键词> [数量]` | 在指定文档内搜索 |
| `notebooks` | 列出笔记本 |
| `docs [笔记本ID] [数量]` | 列出文档 |
| `headings <文档ID> [级别]` | 文档标题（级别：h1-h6） |
| `blocks <文档ID> [类型]` | 文档子块（含块 ID） |
| `doc-children <笔记本ID> [路径]` | 子文档列表 |
| `doc-tree <笔记本ID> [路径] [深度]` | 子文档树 |
| `doc-tree-id <文档ID> [深度]` | 以文档 ID 展示子文档树 |
| `tag <标签名>` | 按标签搜索 |
| `backlinks <块ID>` | 反向链接 |
| `tasks [状态] [天数]` | 任务查询 |
| `daily <开始> <结束>` | Daily Note（YYYYMMDD） |
| `attr <属性名> [值]` | 按属性查询 |
| `bookmarks [名称]` | 书签 |
| `random <文档ID>` | 随机标题 |
| `recent [天数] [类型]` | 最近修改 |
| `unreferenced <笔记本ID>` | 未被引用的文档 |
| `check` | 连接检查 |
| `version` | 内核版本 |

### 写入

写入前必须满足：`SIYUAN_ENABLE_WRITE=true` + 先 `open-doc` 读取目标文档。

| 命令 | 用途 |
|------|------|
| `create-doc <笔记本ID> <标题> [markdown]` | 创建新文档 |
| `rename-doc <文档ID> <新标题>` | 重命名文档 |
| `append-block <父块ID> <markdown>` | 追加内容 |
| `replace-section <标题块ID> <markdown\|--clear>` | 替换/清空章节 |
| `update-block <块ID> <markdown\|--stdin>` | 更新单个块内容 |
| `delete-block <块ID>` | 删除单个块 |
| `apply-patch <文档ID> < pmf` | 批量修改/删除/重排已有块（从 stdin 读取 PMF） |
| `move-docs-by-id <目标ID> <来源ID列表>` | 移动文档 |
| `subdoc-analyze-move <目标ID> <来源ID列表> [深度]` | 分析移动计划（只读） |

## 写入安全机制

1. **环境变量开关**：`SIYUAN_ENABLE_WRITE=true` 才允许写入
2. **读后写围栏**：写入前必须先 `open-doc` 读取目标文档
3. **乐观锁**：写入前对比文档 `updated` 时间戳，被其他端修改过则拒绝写入
4. **连续写入安全**：每次写入成功后自动刷新版本号，无需重新 open-doc

```bash
# 典型写入流程
node index.js open-doc "docID" readable
SIYUAN_ENABLE_WRITE=true node index.js append-block "docID" "新内容"
SIYUAN_ENABLE_WRITE=true node index.js append-block "docID" "更多内容"
```

## 详细文档

- [docs/command-reference.md](docs/command-reference.md) — 命令详细参数、返回格式、示例
- [docs/pmf-spec.md](docs/pmf-spec.md) — PMF 格式规范、编辑策略
- [docs/sql-reference.md](docs/sql-reference.md) — SQL 表结构、查询示例

## License

MIT
