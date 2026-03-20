# 思源数据库操作指南

这份文档是数据库功能的单一入口。只要阅读本文件，就可以完成本 skill 对思源数据库的大部分操作，不需要再去翻底层代码实现。

---

## 适用范围

本文件覆盖：

- 数据库定义读取
- 视图渲染
- 字段管理
- 选项管理
- 行管理
- 单元格写入
- 文档作为数据库行
- 普通块作为数据库行
- relation / rollup
- filters / sorts / groups
- 视图新增 / 重命名 / 排序 / 删除
- gallery / kanban 细项配置
- 布局切换
- 数据库复制
- 资源字段写入
- 通用 `av-call`

不覆盖：

- 思源前端私有 UI 细节
- 未封装的低层事务调试
- 与数据库无关的普通块编辑

---

## 核心概念

### 先发现数据库 ID

如果你只有宿主文档 ID，还不知道 `avID` 和数据库块 ID，先执行：

```bash
node index.js av-discover "{宿主文档ID}"
```

返回：

- `docId`
- `blockId`
- `avID`

这是数据库专用文档里默认的第一步。不要再依赖去翻代码或手动猜测。

### `avID`

属性视图 ID，也就是数据库本体 ID。大多数数据库命令都以它为入口。

### 数据库块 ID

文档里承载数据库的块 ID。一个数据库块通常对应 `type=av` 的块。

### `viewID`

数据库的某个视图 ID，例如表格视图、卡片视图、看板视图。

### `keyID`

数据库字段 ID。

### `itemID`

数据库行 ID。

### 宿主文档

数据库块所在的文档。数据库写命令会修改宿主文档，因此必须满足读后写围栏。

---

## 安全规则

### 1. 所有数据库写操作都受读后写围栏保护

先读，再写。

```bash
node index.js open-doc "{数据库宿主文档ID}" readable
```

然后再执行：

- `av-add-key`
- `av-add-option`
- `av-update-option`
- `av-remove-option`
- `av-add-relation-key`
- `av-update-relation-key`
- `av-add-rollup-key`
- `av-update-rollup-key`
- `av-add-rows`
- `av-add-doc-rows`
- `av-add-block-rows`
- `av-set-text-cell`
- `av-set-number-cell`
- `av-set-date-cell`
- `av-set-select-cell`
- `av-set-checkbox-cell`
- `av-set-mselect-cell`
- `av-set-url-cell`
- `av-set-email-cell`
- `av-set-phone-cell`
- `av-set-template-cell`
- `av-set-asset-cell`
- `av-set-block-cell`
- `av-set-relation-cell`
- `av-clear-relation-cell`
- `av-remove-rows`
- `av-sort-row`
- `av-set-filters`
- `av-set-sorts`
- `av-set-group`
- `av-remove-group`
- `av-hide-group`
- `av-hide-all-groups`
- `av-sort-group`
- `av-fold-group`
- `av-add-view`
- `av-remove-view`
- `av-rename-view`
- `av-duplicate-view`
- `av-sort-view`
- `av-set-view-icon`
- `av-set-view-desc`
- `av-set-page-size`
- `av-hide-view-name`
- `av-set-show-icon`
- `av-set-wrap-field`
- `av-set-fit-image`
- `av-set-display-field-name`
- `av-set-fill-col-bg`
- `av-set-cover-from`
- `av-set-card-size`
- `av-set-card-ratio`
- `av-change-layout`
- `av-set-view`
- `av-duplicate`

### 1.1 同一个数据库宿主文档上的写操作应串行执行

不要并行跑多条指向同一个数据库宿主文档的写命令。  
如果你需要连续写：

1. 先 `open-doc`
2. 再按顺序逐条写
3. 每条命令完成后再执行下一条

### 2. 双向 relation 可能影响两个数据库

如果是双向 relation，source/target 两边的数据库定义都会被修改。为了避免围栏拦截，建议先读取两个数据库宿主文档。

### 3. 文档作为数据库行不会修改源文档内容

`av-add-doc-rows` 只是把文档挂入数据库，不会改动源文档正文。

### 4. 优先使用高层命令

如果已有：

- `av-set-text-cell`
- `av-set-number-cell`
- `av-set-date-cell`
- `av-set-select-cell`
- `av-set-checkbox-cell`
- `av-set-mselect-cell`
- `av-set-url-cell`
- `av-set-email-cell`
- `av-set-phone-cell`
- `av-set-template-cell`
- `av-set-asset-cell`
- `av-set-block-cell`
- `av-add-doc-rows`
- `av-add-block-rows`

就不要优先手写 `av-set-cell` / `av-add-rows` 的 JSON。

---

## 读取数据库

### 从宿主文档发现数据库

```bash
node index.js av-discover "{宿主文档ID}"
```

如果一个文档里有多个数据库块，这个命令会返回多个对象。

### 获取数据库定义

```bash
node index.js av-get "{avID}"
```

返回数据库原始定义对象。

### 渲染数据库视图

```bash
node index.js av-render "{avID}"
node index.js av-render "{avID}" --page 1 --page-size 50
node index.js av-render "{avID}" --view-id "{viewID}"
node index.js av-render "{avID}" --query "客户"
```

适合获取：

- 当前字段列表
- 当前行数据
- 当前视图类型
- 分组视图内容

### 获取字段列表

```bash
node index.js av-keys "{avID}"
node index.js av-keys-by-av "{avID}"
```

### 获取主键/行列表

```bash
node index.js av-primary-keys "{avID}"
node index.js av-primary-keys "{avID}" --keyword "项目"
node index.js av-primary-keys "{avID}" --page 1 --page-size 100
```

---

## 字段管理

### 添加普通字段

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-add-key "{avID}" "{keyID}" "项目名称" text
SIYUAN_ENABLE_WRITE=true node index.js av-add-key "{avID}" "{keyID}" "预算" number
SIYUAN_ENABLE_WRITE=true node index.js av-add-key "{avID}" "{keyID}" "截止日期" date
SIYUAN_ENABLE_WRITE=true node index.js av-add-key "{avID}" "{keyID}" "状态" select
SIYUAN_ENABLE_WRITE=true node index.js av-add-key "{avID}" "{keyID}" "标签" mSelect
SIYUAN_ENABLE_WRITE=true node index.js av-add-key "{avID}" "{keyID}" "完成" checkbox
SIYUAN_ENABLE_WRITE=true node index.js av-add-key "{avID}" "{keyID}" "链接" url
SIYUAN_ENABLE_WRITE=true node index.js av-add-key "{avID}" "{keyID}" "邮箱" email
SIYUAN_ENABLE_WRITE=true node index.js av-add-key "{avID}" "{keyID}" "电话" phone
SIYUAN_ENABLE_WRITE=true node index.js av-add-key "{avID}" "{keyID}" "模板" template
SIYUAN_ENABLE_WRITE=true node index.js av-add-key "{avID}" "{keyID}" "资源" mAsset
```

参数：

- `avID`: 数据库 ID
- `keyID`: 字段 ID
- `名称`: 字段名
- `类型`: `text` / `number` / `date` / `select` / `mSelect` / `checkbox` / `url` / `email` / `phone` / `template` / `mAsset` / `relation` / `rollup`
- `图标`: 可选
- `前置键ID`: 可选

说明：

- 思源普通字段创建流程不支持额外创建“用户自定义 block 列”。`block` 主要存在于数据库主键列或已有 block 类型列中。
- 如果你需要“把块放进数据库”，优先用 `av-add-block-rows`，而不是尝试先 `av-add-key ... block`。

### select / mSelect 选项管理

添加选项：

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-add-option "{avID}" "{keyID}" "Backlog" --color 1
SIYUAN_ENABLE_WRITE=true node index.js av-add-option "{avID}" "{keyID}" "Archived" --color 5 --desc "已归档"
```

更新选项：

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-update-option "{avID}" "{keyID}" "Archived" "Done" --color 3 --desc "已完成"
```

删除选项：

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-remove-option "{avID}" "{keyID}" "Done"
```

### 删除字段

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-remove-key "{avID}" "{keyID}"
SIYUAN_ENABLE_WRITE=true node index.js av-remove-key "{avID}" "{keyID}" --remove-relation-dest
```

### 排序字段

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-sort-key "{avID}" "{keyID}" "{previousKeyID}"
SIYUAN_ENABLE_WRITE=true node index.js av-sort-view-key "{avID}" "{keyID}" "{previousKeyID}" --view-id "{viewID}"
```

---

## 行管理

### 新增 Detached rows

Detached row 是“仅存在于数据库里、不绑定到现有文档块”的行。

```bash
printf '%s\n' '[{"itemID":"20260319000000-row0001","id":"20260319000000-block001","isDetached":true,"content":""}]' \
  | SIYUAN_ENABLE_WRITE=true node index.js av-add-rows "{avID}"
```

也支持传对象：

```bash
printf '%s\n' '{"blockID":"{数据库块ID}","srcs":[{"itemID":"20260319000000-row0001","id":"20260319000000-block001","isDetached":true,"content":""}]}' \
  | SIYUAN_ENABLE_WRITE=true node index.js av-add-rows "{avID}"
```

### 将文档作为数据库行

这是最常见的“联合形式”场景。

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-add-doc-rows "{avID}" "{docID1},{docID2},{docID3}"
```

也支持带定位参数：

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-add-doc-rows "{avID}" "{docID1},{docID2}" --block-id "{数据库块ID}" --view-id "{viewID}" --group-id "{groupID}"
```

特点：

- 自动去重重复 docID
- 自动校验目标是否真的是文档块
- 多个文档会按稳定模式逐条插入，避免只插进去一部分

### 将普通块作为数据库行

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-add-block-rows "{avID}" "{blockID1},{blockID2}"
```

也支持带定位参数：

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-add-block-rows "{avID}" "{blockID1},{blockID2}" --block-id "{数据库块ID}" --view-id "{viewID}" --group-id "{groupID}"
```

适合：

- 把已有段落、列表项、标题块直接纳入数据库
- 构造“块级资料库”
- 测试数据库和普通块的联合场景

### 行排序 / 跨分组移动

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-sort-row "{avID}" "{itemID}" --previous-id "{previousItemID}"
```

跨分组移动：

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-sort-row "{avID}" "{itemID}" --group-id "{sourceGroupID}" --target-group-id "{targetGroupID}"
```

### 删除行

```bash
printf '%s\n' '["{itemID1}","{itemID2}"]' | SIYUAN_ENABLE_WRITE=true node index.js av-remove-rows "{avID}"
```

---

## 单元格写入

### 文本单元格

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-set-text-cell "{avID}" "{keyID}" "{itemID}" "ACME Corp"
SIYUAN_ENABLE_WRITE=true node index.js av-set-text-cell "{avID}" "{keyID}" "{itemID}" --clear
```

### 数字单元格

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-set-number-cell "{avID}" "{keyID}" "{itemID}" 128000
SIYUAN_ENABLE_WRITE=true node index.js av-set-number-cell "{avID}" "{keyID}" "{itemID}" -3.14
SIYUAN_ENABLE_WRITE=true node index.js av-set-number-cell "{avID}" "{keyID}" "{itemID}" --clear
```

### 日期单元格

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-set-date-cell "{avID}" "{keyID}" "{itemID}" 2026-03-31
SIYUAN_ENABLE_WRITE=true node index.js av-set-date-cell "{avID}" "{keyID}" "{itemID}" 2026-03-31T18:30
SIYUAN_ENABLE_WRITE=true node index.js av-set-date-cell "{avID}" "{keyID}" "{itemID}" --clear
```

支持格式：

- `YYYY-MM-DD`
- `YYYY-MM-DDTHH:mm`
- `YYYY-MM-DDTHH:mm:ss`

### 单选单元格

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-set-select-cell "{avID}" "{keyID}" "{itemID}" "Doing"
SIYUAN_ENABLE_WRITE=true node index.js av-set-select-cell "{avID}" "{keyID}" "{itemID}" "Blocked" --color 2
SIYUAN_ENABLE_WRITE=true node index.js av-set-select-cell "{avID}" "{keyID}" "{itemID}" --clear
```

### 复选框单元格

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-set-checkbox-cell "{avID}" "{keyID}" "{itemID}" true
SIYUAN_ENABLE_WRITE=true node index.js av-set-checkbox-cell "{avID}" "{keyID}" "{itemID}" false
```

### 多选单元格

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-set-mselect-cell "{avID}" "{keyID}" "{itemID}" "Research,AI,🚀上线"
SIYUAN_ENABLE_WRITE=true node index.js av-set-mselect-cell "{avID}" "{keyID}" "{itemID}" "Research,AI" --colors "6,7"
SIYUAN_ENABLE_WRITE=true node index.js av-set-mselect-cell "{avID}" "{keyID}" "{itemID}" --clear
```

### URL / Email / Phone

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-set-url-cell "{avID}" "{keyID}" "{itemID}" "https://www.zhihu.com/question/123456"
SIYUAN_ENABLE_WRITE=true node index.js av-set-email-cell "{avID}" "{keyID}" "{itemID}" "openclaw@example.com"
SIYUAN_ENABLE_WRITE=true node index.js av-set-phone-cell "{avID}" "{keyID}" "{itemID}" "+86-021-12345678"
```

清空：

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-set-url-cell "{avID}" "{keyID}" "{itemID}" --clear
SIYUAN_ENABLE_WRITE=true node index.js av-set-email-cell "{avID}" "{keyID}" "{itemID}" --clear
SIYUAN_ENABLE_WRITE=true node index.js av-set-phone-cell "{avID}" "{keyID}" "{itemID}" --clear
```

### template 字段模板

`template` 不是“按行独立写值”，而是“按列维护模板文本”。

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-set-template-cell "{avID}" "{keyID}" "## 模板\n- 子任务 A"
SIYUAN_ENABLE_WRITE=true node index.js av-set-template-cell "{avID}" "{keyID}" --clear
```

### 资源单元格

支持两种输入：

- 已存在的 `assets/...` 路径
- 本地文件路径，skill 会先上传再写入数据库

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-set-asset-cell "{avID}" "{keyID}" "{itemID}" assets/demo.png
SIYUAN_ENABLE_WRITE=true node index.js av-set-asset-cell "{avID}" "{keyID}" "{itemID}" /tmp/demo.png /tmp/spec.pdf --skip-duplicated
SIYUAN_ENABLE_WRITE=true node index.js av-set-asset-cell "{avID}" "{keyID}" "{itemID}" --clear
```

### block 单元格

`block` setter 用于“已有 block 类型列”，最常见是数据库主键列。  
它不会替你创建新的用户自定义 block 字段。

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-set-block-cell "{avID}" "{blockKeyID}" "{itemID}" "{targetBlockID}"
SIYUAN_ENABLE_WRITE=true node index.js av-set-block-cell "{avID}" "{blockKeyID}" "{itemID}" "{targetBlockID}" --content "覆盖显示文本"
SIYUAN_ENABLE_WRITE=true node index.js av-set-block-cell "{avID}" "{blockKeyID}" "{itemID}" --clear
```

---

## 资源与 PDF

### 上传资源

```bash
SIYUAN_ENABLE_WRITE=true node index.js asset-upload /tmp/demo.png
SIYUAN_ENABLE_WRITE=true node index.js asset-upload /tmp/demo.png /tmp/spec.pdf --skip-duplicated
```

### 上传并插入到文档

```bash
SIYUAN_ENABLE_WRITE=true node index.js asset-insert --parent "{docID}" /tmp/demo.png
SIYUAN_ENABLE_WRITE=true node index.js asset-insert --after "{blockID}" /tmp/demo.txt --mode link
```

### PDF 嵌入

```bash
SIYUAN_ENABLE_WRITE=true node index.js asset-embed-pdf --parent "{docID}" /tmp/spec.pdf
```

验证方式建议：

```bash
node index.js open-doc "{docID}" readable --full
```

读取结果里应出现一个 `<iframe ...pdf...></iframe>`。  
不要依赖 `blocks {docID} iframe` 作为唯一校验方式。

### 通用单元格写入

只有在高层命令不够用时再使用：

```bash
printf '%s\n' '{"id":"cell-id","keyID":"key-id","blockID":"row-id","type":"text","text":{"content":"ACME Corp"}}' \
  | SIYUAN_ENABLE_WRITE=true node index.js av-set-cell "{avID}" "{keyID}" "{rowID}"
```

---

## Relation

### 添加 relation 字段

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-add-relation-key "{源AVID}" "{keyID}" "关联客户" "{目标AVID}"
```

双向 relation：

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-add-relation-key "{源AVID}" "{keyID}" "关联客户" "{目标AVID}" --two-way --back-name "来源记录"
```

可选：

- `--back-key-id`
- `--back-name`

### 设置 relation 单元格

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-set-relation-cell "{AVID}" "{keyID}" "{itemID}" "{目标AVID}" "{目标项ID1},{目标项ID2}"
```

说明：

- `itemID` 是当前行 ID
- `目标项ID列表` 是目标数据库里的 row/item ID
- 可以一次关联多个目标行

### 清空 relation 单元格

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-clear-relation-cell "{AVID}" "{keyID}" "{itemID}"
```

### 修改 relation 字段配置

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-update-relation-key "{AVID}" "{keyID}" --target-av "{目标AVID}" --two-way --back-name "来源记录" --name "关联客户"
```

可选：

- `--two-way`
- `--one-way`
- `--back-key-id`
- `--back-name`
- `--name`

---

## Rollup

### 添加 rollup 字段

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-add-rollup-key "{AVID}" "{keyID}" "预算汇总" "{关系字段ID}" "{目标字段ID}"
```

带计算器：

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-add-rollup-key "{AVID}" "{keyID}" "预算汇总" "{关系字段ID}" "{目标字段ID}" --calc "Sum"
```

### 修改 rollup 字段配置

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-update-rollup-key "{AVID}" "{keyID}" --relation-key "{关系字段ID}" --target-key "{目标字段ID}" --calc "Max"
SIYUAN_ENABLE_WRITE=true node index.js av-update-rollup-key "{AVID}" "{keyID}" --clear-calc
```

### 常见 `--calc` 值

- `Count all`
- `Count empty`
- `Count not empty`
- `Count values`
- `Count unique values`
- `Percent empty`
- `Percent not empty`
- `Percent unique values`
- `Checked`
- `Unchecked`
- `Percent checked`
- `Percent unchecked`
- `Sum`
- `Average`
- `Median`
- `Min`
- `Max`
- `Range`
- `Earliest`
- `Latest`
- `Unique values`

---

## Filters / Sorts / Groups

### 读取 filters / sorts

```bash
node index.js av-get-filter-sort "{avID}"
node index.js av-get-filter-sort "{avID}" --block-id "{数据库块ID}"
```

### 覆盖 filters

```bash
printf '%s\n' '[{"column":"{keyID}","operator":"=","value":{"type":"select","mSelect":[{"content":"Doing","color":"2"}]}}]' \
  | SIYUAN_ENABLE_WRITE=true node index.js av-set-filters "{avID}"

SIYUAN_ENABLE_WRITE=true node index.js av-set-filters "{avID}" --clear
```

### 覆盖 sorts

```bash
printf '%s\n' '[{"column":"{keyID}","order":"ASC"}]' \
  | SIYUAN_ENABLE_WRITE=true node index.js av-set-sorts "{avID}"

SIYUAN_ENABLE_WRITE=true node index.js av-set-sorts "{avID}" --clear
```

### 设置分组

```bash
printf '%s\n' '{"field":"{keyID}","method":0,"order":0,"range":null,"hideEmpty":false}' \
  | SIYUAN_ENABLE_WRITE=true node index.js av-set-group "{avID}"
```

移除分组：

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-remove-group "{avID}"
```

隐藏 / 显示分组：

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-hide-group "{avID}" "{groupID}"
SIYUAN_ENABLE_WRITE=true node index.js av-hide-group "{avID}" "{groupID}" --show
SIYUAN_ENABLE_WRITE=true node index.js av-hide-all-groups "{avID}"
SIYUAN_ENABLE_WRITE=true node index.js av-hide-all-groups "{avID}" --show
```

排序 / 折叠分组：

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-sort-group "{avID}" "{groupID}" --previous-id "{previousGroupID}"
SIYUAN_ENABLE_WRITE=true node index.js av-fold-group "{avID}" "{groupID}" --close
SIYUAN_ENABLE_WRITE=true node index.js av-fold-group "{avID}" "{groupID}" --open
```

---

## 视图操作

### 切换布局

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-change-layout "{数据库块ID}" "{avID}" table
SIYUAN_ENABLE_WRITE=true node index.js av-change-layout "{数据库块ID}" "{avID}" gallery
SIYUAN_ENABLE_WRITE=true node index.js av-change-layout "{数据库块ID}" "{avID}" kanban
```

注意：

- `av-change-layout` 修改的是“该数据库块当前选中的视图”的布局类型
- 如果你先执行过 `av-set-view "{数据库块ID}" "{avID}" "{viewID}"`，那么 `av-change-layout` 会直接修改这个 `viewID`
- 想保留现有 gallery / kanban 视图时，不要随手对同一个 block 执行 `av-change-layout`
- 若目标是新增一个不同布局的视图，优先用 `av-add-view`

### 切换当前视图

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-set-view "{数据库块ID}" "{avID}" "{viewID}"
```

### 新增 / 重命名 / 复制 / 删除 / 排序视图

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-add-view "{avID}" "{数据库块ID}" --layout gallery --view-id "{galleryViewID}"
SIYUAN_ENABLE_WRITE=true node index.js av-rename-view "{avID}" "{viewID}" "Gallery Cards"
SIYUAN_ENABLE_WRITE=true node index.js av-duplicate-view "{avID}" "{数据库块ID}" "{sourceViewID}" --view-id "{newViewID}"
SIYUAN_ENABLE_WRITE=true node index.js av-sort-view "{avID}" "{viewID}" --previous-id "{previousViewID}"
SIYUAN_ENABLE_WRITE=true node index.js av-remove-view "{avID}" "{数据库块ID}" "{viewID}"
```

### 视图元信息

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-set-view-icon "{avID}" "{viewID}" "🖼️"
SIYUAN_ENABLE_WRITE=true node index.js av-set-view-desc "{avID}" "{viewID}" "卡片视图说明"
SIYUAN_ENABLE_WRITE=true node index.js av-set-page-size "{avID}" 20 --block-id "{数据库块ID}" --view-id "{viewID}"
SIYUAN_ENABLE_WRITE=true node index.js av-hide-view-name "{avID}" true --block-id "{数据库块ID}" --view-id "{viewID}"
```

### 通用视图开关

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-set-show-icon "{avID}" true --block-id "{数据库块ID}" --view-id "{viewID}"
SIYUAN_ENABLE_WRITE=true node index.js av-set-wrap-field "{avID}" true --block-id "{数据库块ID}" --view-id "{viewID}"
```

### gallery / kanban 细项配置

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-set-fit-image "{avID}" true --block-id "{数据库块ID}" --view-id "{viewID}"
SIYUAN_ENABLE_WRITE=true node index.js av-set-display-field-name "{avID}" true --block-id "{数据库块ID}" --view-id "{viewID}"
SIYUAN_ENABLE_WRITE=true node index.js av-set-fill-col-bg "{avID}" true --block-id "{数据库块ID}" --view-id "{viewID}"
SIYUAN_ENABLE_WRITE=true node index.js av-set-cover-from "{avID}" asset --block-id "{数据库块ID}" --view-id "{viewID}" --asset-key-id "{assetKeyID}"
SIYUAN_ENABLE_WRITE=true node index.js av-set-card-size "{avID}" large --block-id "{数据库块ID}" --view-id "{viewID}"
SIYUAN_ENABLE_WRITE=true node index.js av-set-card-ratio "{avID}" 1:1 --block-id "{数据库块ID}" --view-id "{viewID}"
```

说明：

- `av-set-cover-from` 支持：`none` / `content-image` / `asset` / `content-block`
- `av-set-card-size` 支持：`small` / `medium` / `large`
- `av-set-card-ratio` 支持：`16:9` / `9:16` / `4:3` / `3:4` / `3:2` / `2:3` / `1:1`
- 这些命令如果带 `--view-id`，skill 会先把指定数据库块切到目标视图，再落配置

### 复制数据库块

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-duplicate "{avID}"
```

---

## 通用数据库接口

高层命令不够时，用：

```bash
printf '%s\n' '{"id":"AVID","page":1,"pageSize":50}' | node index.js av-call renderAttributeView
printf '%s\n' '{"keyword":"客户"}' | node index.js av-call searchAttributeView
printf '%s\n' '{"avID":"AVID","keyword":""}' | node index.js av-call searchAttributeViewRelationKey
printf '%s\n' '{"avID":"AVID","keyword":""}' | node index.js av-call searchAttributeViewRollupDestKeys
```

适合：

- 只读探索
- relation/rollup 辅助查询
- 尚未封装成高层命令的 AV 接口

说明：

- 对写操作，本 skill 现在会统一返回结构化回执，不再把上游 `null` 直接暴露出来
- 典型回执格式：

```json
{
  "success": true,
  "state": "applied",
  "operation": "addAttributeViewKey",
  "request": {
    "avID": "20260320135555-tmv4foc",
    "keyID": "20260320135555-txt8zu4"
  },
  "touchedDocIds": [
    "20260320135555-yjdvq1s"
  ],
  "data": null,
  "resultType": "empty"
}
```

- 字段含义：
  - `success=true`: skill 已确认调用成功
  - `state="applied"`: 写操作已经落到内核
  - `operation`: 具体执行的数据库操作
  - `request`: 关键请求参数摘要
  - `touchedDocIds`: 被这次写操作触及并刷新过版本的宿主文档
  - `data`: 上游原始返回；若上游没有返回体，这里仍为 `null`
  - `resultType`: `empty` / `object` / `array` / 其他原始类型
- 做自动化验收时，仍推荐用后续 `av-render` / `av-get` / `open-doc` 读回结果验证最终状态

---

## 复杂场景范式

### 范式 1：文档数据库

目标：把已有文档批量纳入数据库管理。

1. 先 `open-doc` 数据库宿主文档
2. 用 `av-add-doc-rows` 批量加入 docID
3. 用 `av-set-text-cell` / `av-set-select-cell` 补齐元数据

### 范式 2：源数据库 -> 目标数据库 relation + rollup

目标：在“项目表”里聚合“合同表”的金额。

1. 在目标库新增 `Amount` 数字列
2. 在源库新增 relation 到目标库
3. 在源库新增 rollup，relationKey 指向上一步，targetKey 指向 `Amount`
4. 用 `av-set-relation-cell` 把源行关联到目标行
5. `av-render` 验证 rollup 结果

### 范式 3：高体量 Detached row 压测

目标：验证批量新增与批量改单元格稳定性。

1. `av-add-rows` 一次或分批新增 10/50/100 行
2. `av-batch-set-cells` 批量更新 text/number/date/select/checkbox
3. `av-change-layout` 在 `table/gallery/kanban` 间来回切换
4. `av-render` 检查总行数和字段值

### 范式 4：文档 / 普通块 / 数据库联合

目标：让数据库既能管理子文档，也能管理普通块。

1. `av-add-doc-rows` 把子文档纳入数据库
2. `av-add-block-rows` 把段落 / 标题 / 列表块纳入数据库
3. `av-set-select-cell` / `av-set-mselect-cell` 补齐状态和标签
4. `av-set-group` 按状态分组
5. `av-sort-row` 做跨分组拖拽式移动

### 范式 5：高级视图配置

目标：构造接近 Notion 风格的数据库视图。

1. `av-add-view` 创建 gallery 视图
2. `av-duplicate-view` 复制一份作为 kanban 视图
3. `av-set-view-icon` / `av-set-view-desc` 设定元信息
4. `av-set-cover-from` / `av-set-card-size` / `av-set-card-ratio`
5. `av-set-fill-col-bg` / `av-set-fit-image` / `av-set-display-field-name`
6. `av-sort-view` 排列视图顺序

---

## 常见错误

### `读后写围栏` 报错

原因：没有先 `open-doc` 数据库宿主文档。

恢复：

```bash
node index.js open-doc "{数据库宿主文档ID}" readable
```

如果你还不知道 `avID`：

```bash
node index.js av-discover "{数据库宿主文档ID}"
```

### `view not found`

常见于刚创建数据库块后立刻写字段。  
本 skill 现在会自动触发一次 `renderAttributeView(createIfNotExist=true)` 做初始化。

### `无效日期格式`

请改用：

- `2026-03-31`
- `2026-03-31T18:30`
- `2026-03-31T18:30:00`

### `目标不是文档块或不存在`

这是 `av-add-doc-rows` 的校验报错，表示你传入的 ID 不是文档块 ID。

### `未找到属性视图单元格`

常见原因：

- 你传错了 `keyID`
- 该字段并没有真正创建成功
- 你在尝试把普通 `add-key` 生成成自定义 `block` 列

处理：

- 先用 `av-render` / `av-keys` 确认字段真实存在
- `block` 写入优先针对已有 block 列（通常是主键列）
- 如果目标是“把块加入数据库”，改用 `av-add-block-rows`

### `未找到属性视图分组`

这表示你传入的 `groupID` 不属于当前 block 当前视图。

恢复：

1. 先 `av-render "{avID}"` 找到真实 `group.id`
2. 如果你之前执行过 `av-set-view`，确认当前 block 仍在你预期的视图上

### template 看起来“没写进去”

`template` 实际上是列模板，不是每一行单独维护的自由文本。  
请用：

```bash
SIYUAN_ENABLE_WRITE=true node index.js av-set-template-cell "{avID}" "{keyID}" "模板文本"
```

---

## 与其他文档的关系

如果你只关心数据库：

- 先读本文件

如果你需要普通块编辑、章节编辑、PMF：

- 再读 `command-reference.md`
