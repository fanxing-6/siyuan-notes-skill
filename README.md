# siyuan-notes-skill

给 Codex/Claude 用的思源笔记技能。  
重点是两件事：读写可控、批量编辑可恢复。

仓库地址：`https://github.com/fanxing-6/siyuan-notes-skill`

建议配合gpt、claude最新模型食用

## 这个项目要解决什么

- 文档很长时，不能把全文直接塞进上下文。
- 批量编辑时，不能因为输入不完整把文档误删。
- 多端同时编辑时，要能检测冲突，不做盲写。
- CLI 失败要返回非 0，方便脚本和 CI 判断。

## 默认行为（先看这个）

- `open-doc readable`：
  - 小文档：返回全文。
  - 大文档：自动截断，并附带标题大纲。
- `open-doc patchable`：
  - 小文档：返回完整 PMF。
  - 大文档：自动分页，header 含 `partial=true` 和 `next_cursor`。
- `apply-patch`：
  - 只接受完整 PMF。
  - 拒绝 `partial=true` 的 PMF（防止误删未包含块）。
- 写入命令：
  - 需要 `SIYUAN_ENABLE_WRITE=true`。
  - 通常需要先 `open-doc`（或 `open-section`）建立读后写上下文（`create-doc` / `rename-doc` 例外）。

**以下步骤可以直接粘贴给agent执行**

## 安装

```bash
# 根据情况选择路径
# cd ~/.claude/skills
# cd ~/.codex/skills
git clone https://github.com/fanxing-6/siyuan-notes-skill.git siyuan-notes
cd siyuan-notes
npm install
```

## 配置

在项目目录创建 `.env`：

```env
SIYUAN_HOST=localhost
SIYUAN_PORT=6806
SIYUAN_API_TOKEN=your_api_token
SIYUAN_ENABLE_WRITE=false
SIYUAN_REQUIRE_READ_BEFORE_WRITE=true
SIYUAN_READ_GUARD_TTL_SECONDS=3600
SIYUAN_LIST_DOCUMENTS_LIMIT=200
SIYUAN_OPEN_DOC_CHAR_LIMIT=15000
SIYUAN_OPEN_DOC_BLOCK_PAGE_SIZE=50
```

连通性检查：

```bash
node index.js check
node index.js version
```

## 编辑方式选择

| 需求 | 推荐命令 | 说明 |
|---|---|---|
| 改一个块 | `update-block` | 最小改动，风险最低 |
| 删一个块 | `delete-block` | 不需要整文 PMF |
| 改一个章节 | `replace-section` | 只影响标题下子块 |
| 追加内容 | `append-block` | 简单稳定 |
| 指定位置插入 | `insert-block` | 支持在目标块前/后插入 |
| 批量改/删/重排 | `apply-patch` | 必须基于完整 PMF |
| 超长文档定位 | `search-in-doc` + `open-section` | 不读全文 |

一句话：**小改动用小工具，整文重排才用 PMF。**

## 常用命令

所有命令格式：`node index.js <command> [args]`

读取：

- `open-doc <docID> [readable|patchable] [--full] [--cursor <blockID>] [--limit-chars <N>] [--limit-blocks <N>]`
- `open-section <headingBlockID> [readable|patchable]`
- `search-in-doc <docID> <keyword> [limit]`
- `search <keyword> [limit] [type]`
- `search-md <keyword> [limit] [type]`
- `notebooks`
- `docs [notebookID] [limit]`
- `headings <docID> [h1|h2|...|h6]`
- `blocks <docID> [type]`

写入：

- `create-doc <notebookID> <title>`（初始内容仅支持 stdin，可省略）
- `rename-doc <docID> <newTitle>`
- `append-block <parentID>`（Markdown 仅支持 stdin）
- `insert-block <--before <blockID>|--after <blockID>|--parent <blockID>>`（Markdown 仅支持 stdin）
- `replace-section <headingID>` 或 `replace-section <headingID> --clear`（Markdown 仅支持 stdin）
- `update-block <blockID>`（Markdown 仅支持 stdin）
- `delete-block <blockID>`
- `apply-patch <docID> < /tmp/doc.pmf`
- `subdoc-analyze-move <targetID> <sourceIDs> [depth]`
- `move-docs-by-id <targetID> <sourceIDs>`

完整参数与返回格式见 `docs/command-reference.md`。

## 典型流程

### 1) 改单个块（首选）

```bash
node index.js open-doc "docID" readable
SIYUAN_ENABLE_WRITE=true node index.js update-block "blockID" <<'EOF'
新内容（支持 $q \to \hat{o}$）
EOF
```

### 2) 改章节

```bash
node index.js open-doc "docID" readable
SIYUAN_ENABLE_WRITE=true node index.js replace-section "headingBlockID" <<'EOF'
段落A

段落B
EOF
```

### 2.5) 在指定位置插入

```bash
node index.js open-doc "docID" readable
SIYUAN_ENABLE_WRITE=true node index.js insert-block --before "targetBlockID" <<'EOF'
插入在该块之前
EOF
SIYUAN_ENABLE_WRITE=true node index.js insert-block --after "targetBlockID" <<'EOF'
插入在该块之后
EOF
```

### 3) 批量改（PMF）

```bash
node index.js open-doc "docID" patchable --full > /tmp/doc.pmf
# 编辑 /tmp/doc.pmf（保留块注释，修改内容）
SIYUAN_ENABLE_WRITE=true node index.js apply-patch "docID" < /tmp/doc.pmf
```

## 超长文档建议

优先顺序：

1. `open-doc readable` 看摘要和大纲。
2. `search-in-doc` 找关键词位置。
3. `open-section` 读目标章节。
4. 仅在确实需要整文编辑时使用 `patchable --full`。

注意：

- 分页 PMF（`partial=true`）不能用于 `apply-patch`。
- 如果需要翻页，使用 `--cursor <next_cursor>`。

## 写入安全机制

写入前有两道检查：

1. 写开关：`SIYUAN_ENABLE_WRITE=true`
2. 读后写围栏：必须先 `open-doc` 或 `open-section` 读取上下文（`create-doc` / `rename-doc` 例外）

写入时还会做版本检查：

- 比较文档 `updated` 时间戳。
- 如果读之后被其他端修改，当前写入会被拒绝。

## 常见错误与处理

- `读后写围栏`：先 `open-doc`（或 `open-section`）再重试。
- `版本冲突`：重新读取最新文档后再写。
- `partial PMF 被拒绝`：改用 `--full` 或改用 `update-block/replace-section`。
- `PMF 文档 ID 不匹配`：检查 `apply-patch` 的 docID 和 PMF header。

## 项目结构

- `index.js`：核心流程与写入保护
- `cli.js`：命令解析
- `lib/query-services.js`：搜索/查询相关逻辑
- `lib/pmf-utils.js`：PMF 解析与渲染
- `format-utils.js`：输出格式化

## 测试

```bash
npm test
SIYUAN_ENABLE_WRITE=true node edge-tests.js
SIYUAN_ENABLE_WRITE=true node complex-tests.js
```

## 相关文档

- `SKILL.md`：给 Agent 的操作策略
- `docs/command-reference.md`：命令参数和示例
- `docs/pmf-spec.md`：PMF 规则和边界
- `docs/sql-reference.md`：SQL 参考

## License

MIT
