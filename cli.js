const CLI_USAGE_TEXT = `
思源笔记查询工具使用说明 (基于思源SQL规范):

用法:
  node index.js <命令> [参数]

命令:
  search <关键词> [数量] [类型] - 搜索包含关键词的笔记 (类型: p段落, h标题, l列表等)
  search-md <关键词> [数量] [类型] - 搜索并输出Markdown结果页
  open-doc <文档ID> [视图] [--cursor <块ID>] [--limit-chars <N>] [--limit-blocks <N>] [--full]
                           - 打开文档Markdown视图 (视图: readable|patchable, --full 跳过截断/分页)
  open-section <标题块ID> [视图]
                           - 读取标题下的章节内容 (视图: readable|patchable)
  search-in-doc <文档ID> <关键词> [数量]
                           - 在指定文档内搜索关键词
  notebooks                - 列出可用笔记本
  doc-children <笔记本ID> [路径]
                           - 列出指定路径下的子文档
  doc-tree <笔记本ID> [路径] [深度]
                           - 以Markdown树展示子文档组织关系
  doc-tree-id <文档ID> [深度]
                           - 以Markdown树展示指定文档下的子文档组织关系
  subdoc-analyze-move <目标ID> <来源ID列表> [深度]
                           - 分析复杂子文档重组计划（不执行）
  move-docs-by-id <目标ID> <来源ID列表>
                           - 重新组织子文档，来源ID可逗号或空格分隔
  append-block <父块ID>
                             - 向父块追加内容（Markdown 仅支持 stdin）
  insert-block <--before 块ID|--after 块ID|--parent 块ID>
                             - 在指定锚点插入内容（前/后/父块下，Markdown 仅支持 stdin）
  replace-section <标题块ID>
                             - 替换标题下全部子块（Markdown 仅支持 stdin）
  replace-section <标题块ID> --clear
                           - 清空标题下全部子块
  apply-patch <文档ID>      - 从 stdin 读取 PMF 并应用补丁
  update-block <块ID>
                            - 更新单个块内容（Markdown 仅支持 stdin）
  delete-block <块ID>       - 删除单个块
  docs [笔记本ID] [数量]     - 列出所有文档或指定笔记本的文档
  headings <文档ID> [级别]   - 查询文档标题 (级别: h1, h2等)
  blocks <文档ID> [类型]     - 查询文档子块
  tag <标签名>              - 搜索包含标签的笔记
  backlinks <块ID>          - 查询块的反向链接
  tasks [状态] [天数]        - 查询任务列表 (状态: "[ ]"未完成, "[x]"已完成, "[-]"进行中)
  daily <开始日期> <结束日期> - 查询Daily Note (日期格式: YYYYMMDD)
  attr <属性名> [属性值]     - 查询包含属性的块
  bookmarks [书签名]         - 查询书签
  random <文档ID>           - 随机漫游文档标题
  recent [天数] [类型]       - 查询最近修改的块
  unreferenced <笔记本ID>    - 查询未被引用的文档
  create-doc <笔记本ID> <标题>
                            - 创建新文档（初始 Markdown 仅支持 stdin，可省略）
  rename-doc <文档ID> <新标题>
                           - 重命名文档
  av-discover <文档ID>
                           - 从宿主文档发现数据库块ID和 avID
  av-get <属性视图ID>        - 获取数据库定义
  av-render <属性视图ID> [--block-id <块ID>] [--view-id <视图ID>] [--query <查询>] [--page <N>] [--page-size <N>] [--no-create]
                           - 渲染数据库视图
  av-keys <属性视图ID>       - 获取数据库键列表
  av-keys-by-av <属性视图ID> - 按 avID 获取数据库键列表
  av-primary-keys <属性视图ID> [--keyword <关键词>] [--page <N>] [--page-size <N>]
                           - 获取数据库主键值/行列表
  av-set-cell <属性视图ID> <键ID> <项ID>
                           - 从 stdin 读取 JSON 值并更新单元格
  av-set-text-cell <AVID> <键ID> <项ID> <文本> [--clear]
                           - 更新 text 单元格
  av-set-number-cell <AVID> <键ID> <项ID> <数字> [--clear]
                           - 更新 number 单元格
  av-set-date-cell <AVID> <键ID> <项ID> <日期> [--clear]
                           - 更新 date 单元格，支持 YYYY-MM-DD 或 YYYY-MM-DDTHH:mm[:ss]
  av-set-select-cell <AVID> <键ID> <项ID> <选项> [--color <颜色>] [--clear]
                           - 更新 select 单元格
  av-set-checkbox-cell <AVID> <键ID> <项ID> <true|false>
                           - 更新 checkbox 单元格
  av-set-mselect-cell <AVID> <键ID> <项ID> <选项列表> [--colors <颜色列表>] [--clear]
                           - 更新 mSelect 单元格，选项列表可逗号分隔
  av-set-url-cell <AVID> <键ID> <项ID> <URL> [--clear]
                           - 更新 url 单元格
  av-set-email-cell <AVID> <键ID> <项ID> <邮箱> [--clear]
                           - 更新 email 单元格
  av-set-phone-cell <AVID> <键ID> <项ID> <电话> [--clear]
                           - 更新 phone 单元格
  av-set-template-cell <AVID> <键ID> <模板文本> [--clear]
                           - 更新 template 字段模板
  av-set-asset-cell <AVID> <键ID> <项ID> <资源路径...> [--assets-dir <目录>] [--skip-duplicated] [--clear]
                           - 更新 mAsset 单元格，支持直接传 assets 路径或本地文件
  av-set-block-cell <AVID> <键ID> <项ID> <目标块ID> [--content <文本>] [--clear]
                           - 更新 block 单元格
  av-set-relation-cell <AVID> <键ID> <项ID> <目标AVID> <目标项ID列表>
                           - 设置 relation 单元格，目标项ID列表可逗号分隔
  av-clear-relation-cell <AVID> <键ID> <项ID>
                           - 清空 relation 单元格
  av-batch-set-cells <属性视图ID>
                           - 从 stdin 读取 JSON 数组并批量更新单元格
  av-add-key <属性视图ID> <键ID> <名称> <类型> [图标] [前置键ID]
                           - 添加数据库字段
  av-add-option <AVID> <键ID> <名称> [--color <颜色>] [--desc <描述>]
                           - 添加 select/mSelect 选项
  av-update-option <AVID> <键ID> <旧名称> <新名称> [--color <颜色>] [--desc <描述>]
                           - 更新 select/mSelect 选项
  av-remove-option <AVID> <键ID> <名称>
                           - 删除 select/mSelect 选项
  av-add-relation-key <源AVID> <键ID> <名称> <目标AVID> [--two-way] [--back-key-id <键ID>] [--back-name <名称>]
                           - 添加并配置 relation 字段
  av-add-rollup-key <AVID> <键ID> <名称> <关系字段ID> <目标字段ID> [--calc <操作符>]
                           - 添加并配置 rollup 字段
  av-update-relation-key <AVID> <键ID> [--target-av <目标AVID>] [--two-way|--one-way] [--back-key-id <键ID>] [--back-name <名称>] [--name <列名>]
                           - 修改 relation 字段配置
  av-update-rollup-key <AVID> <键ID> [--relation-key <关系字段ID>] [--target-key <目标字段ID>] [--calc <操作符>] [--clear-calc]
                           - 修改 rollup 字段配置
  av-remove-key <属性视图ID> <键ID> [--remove-relation-dest]
                           - 删除数据库字段
  av-sort-key <属性视图ID> <键ID> [前置键ID]
                           - 排序数据库字段
  av-sort-view-key <属性视图ID> <键ID> [前置键ID] [--view-id <视图ID>]
                           - 排序数据库视图字段
  av-add-rows <属性视图ID>   - 从 stdin 读取 JSON（数组或对象）并新增行
  av-add-doc-rows <AVID> <文档ID列表> [--block-id <数据库块ID>] [--view-id <视图ID>] [--group-id <分组ID>] [--previous-id <项ID>]
                           - 将文档作为数据库行批量加入
  av-add-block-rows <AVID> <块ID列表> [--block-id <数据库块ID>] [--view-id <视图ID>] [--group-id <分组ID>] [--previous-id <项ID>]
                           - 将已有块作为数据库行批量加入
  av-remove-rows <属性视图ID>
                           - 从 stdin 读取 JSON 数组并删除行
  av-sort-row <AVID> <项ID> [--block-id <数据库块ID>] [--view-id <视图ID>] [--previous-id <前置项ID>] [--group-id <分组ID>] [--target-group-id <目标分组ID>]
                           - 排序数据库行，可跨分组移动
  av-get-filter-sort <AVID> [--block-id <数据库块ID>]
                           - 获取当前视图 filters / sorts
  av-set-filters <AVID> [--block-id <数据库块ID>] [--view-id <视图ID>] [--clear]
                           - 从 stdin 读取 JSON 数组并覆盖 filters
  av-set-sorts <AVID> [--block-id <数据库块ID>] [--view-id <视图ID>] [--clear]
                           - 从 stdin 读取 JSON 数组并覆盖 sorts
  av-set-group <AVID> [--block-id <数据库块ID>] [--view-id <视图ID>]
                           - 从 stdin 读取 JSON 对象并设置分组
  av-remove-group <AVID> [--block-id <数据库块ID>] [--view-id <视图ID>]
                           - 移除当前分组配置
  av-hide-group <AVID> <分组ID> [--block-id <数据库块ID>] [--view-id <视图ID>] [--show]
                           - 隐藏或显示指定分组
  av-hide-all-groups <AVID> [--block-id <数据库块ID>] [--view-id <视图ID>] [--show]
                           - 隐藏或显示全部分组
  av-sort-group <AVID> <分组ID> [--block-id <数据库块ID>] [--view-id <视图ID>] [--previous-id <前置分组ID>]
                           - 排序分组
  av-fold-group <AVID> <分组ID> [--block-id <数据库块ID>] [--view-id <视图ID>] [--open|--close]
                           - 折叠或展开分组
  av-change-layout <块ID> <属性视图ID> <布局类型>
                           - 修改数据库视图布局
  av-set-view <块ID> <属性视图ID> <视图ID>
                           - 设置数据库块当前视图
  av-add-view <AVID> <数据库块ID> [--layout <table|gallery|kanban>] [--view-id <视图ID>]
                           - 新增视图
  av-remove-view <AVID> <数据库块ID> <视图ID>
                           - 删除视图
  av-rename-view <AVID> <视图ID> <名称>
                           - 重命名视图
  av-duplicate-view <AVID> <数据库块ID> <源视图ID> [--view-id <新视图ID>]
                           - 复制视图
  av-sort-view <AVID> <视图ID> [--previous-id <前置视图ID>] [--unrefresh]
                           - 排序视图
  av-set-view-icon <AVID> <视图ID> <图标>
                           - 设置视图图标
  av-set-view-desc <AVID> <视图ID> <描述>
                           - 设置视图描述
  av-set-page-size <AVID> <数量> [--block-id <数据库块ID>] [--view-id <视图ID>]
                           - 设置视图分页大小
  av-hide-view-name <AVID> <true|false> [--block-id <数据库块ID>] [--view-id <视图ID>]
                           - 设置是否隐藏视图标题
  av-set-show-icon <AVID> <true|false> [--block-id <数据库块ID>] [--view-id <视图ID>]
                           - 设置是否显示条目图标
  av-set-wrap-field <AVID> <true|false> [--block-id <数据库块ID>] [--view-id <视图ID>]
                           - 设置是否字段换行
  av-set-fit-image <AVID> <true|false> [--block-id <数据库块ID>] [--view-id <视图ID>]
                           - 设置 gallery / kanban 是否适应图片
  av-set-display-field-name <AVID> <true|false> [--block-id <数据库块ID>] [--view-id <视图ID>]
                           - 设置 gallery / kanban 是否显示字段名
  av-set-fill-col-bg <AVID> <true|false> [--block-id <数据库块ID>] [--view-id <视图ID>]
                           - 设置 kanban 是否填充分组背景色
  av-set-cover-from <AVID> <none|content-image|asset|content-block> [--block-id <数据库块ID>] [--view-id <视图ID>] [--asset-key-id <字段ID>]
                           - 设置 gallery / kanban 封面来源
  av-set-card-size <AVID> <small|medium|large> [--block-id <数据库块ID>] [--view-id <视图ID>]
                           - 设置 gallery / kanban 卡片尺寸
  av-set-card-ratio <AVID> <16:9|9:16|4:3|3:4|3:2|2:3|1:1> [--block-id <数据库块ID>] [--view-id <视图ID>]
                           - 设置 gallery / kanban 卡片比例
  av-duplicate <属性视图ID>  - 复制数据库块
  av-call <操作名>           - 从 stdin 读取 JSON 调用通用数据库接口
  asset-upload <文件路径...> [--assets-dir <目录>] [--doc <块ID>] [--skip-duplicated]
                           - 上传资源文件到思源 assets
  asset-insert <--before 块ID|--after 块ID|--parent 块ID> <文件路径...> [--assets-dir <目录>] [--skip-duplicated] [--mode auto|link|iframe|pdf]
                           - 上传资源并插入到指定位置
  asset-embed-pdf <--before 块ID|--after 块ID|--parent 块ID> <PDF路径...> [--assets-dir <目录>] [--skip-duplicated]
                           - 上传 PDF 并以 iframe 方式嵌入
  check                    - 检查连接状态
  version                  - 获取思源内核版本
  version-check            - 检查 skill 版本是否最新

示例:
  node index.js search "人工智能" 10 p
  node index.js search-md "人工智能" 10
  node index.js open-doc "20211231120000-d0rzbmm" readable
  node index.js doc-children "20210817205410-2kvfpfn" "/"
  node index.js doc-tree "20210817205410-2kvfpfn" "/" 4
  node index.js doc-tree-id "20211231120000-d0rzbmm" 5
  node index.js subdoc-analyze-move "20211231120000-d0rzbmm" "20211231121000-aaa111,20211231122000-bbb222" 6
  SIYUAN_ENABLE_WRITE=true node index.js move-docs-by-id "20211231120000-d0rzbmm" "20211231121000-aaa111,20211231122000-bbb222"
  SIYUAN_ENABLE_WRITE=true node index.js apply-patch "20211231120000-d0rzbmm" < /tmp/doc.pmf
  SIYUAN_ENABLE_WRITE=true node index.js append-block "20211231120000-d0rzbmm" <<'EOF'
- [ ] 新任务
EOF
  SIYUAN_ENABLE_WRITE=true node index.js insert-block --before "20211231120001-h1abcde" <<'EOF'
## 新增导读
EOF
  SIYUAN_ENABLE_WRITE=true node index.js insert-block --after "20211231120001-h1abcde" <<'EOF'
插入到该块后
EOF
  SIYUAN_ENABLE_WRITE=true node index.js replace-section "20211231120001-h1abcde" <<'EOF'
- 更新内容
EOF
  node index.js docs
  node index.js docs 100
  node index.js headings "20211231120000-d0rzbmm" h2
  node index.js tasks "[ ]" 7
  node index.js daily 20231010 20231013
  node index.js attr "custom-priority" "high"
  SIYUAN_ENABLE_WRITE=true node index.js create-doc "20210817205410-2kvfpfn" "我的新文档" <<'EOF'
初始内容
EOF
  SIYUAN_ENABLE_WRITE=true node index.js rename-doc "20211231120000-d0rzbmm" "新标题"
  printf '{"keyword":"项目"}' | node index.js av-call searchAttributeView
  printf '"新的单元格值"' | SIYUAN_ENABLE_WRITE=true node index.js av-set-cell "AVID" "KEYID" "ITEMID"
  SIYUAN_ENABLE_WRITE=true node index.js av-set-text-cell "AVID" "KEYID" "ITEMID" "ACME Corp"
  SIYUAN_ENABLE_WRITE=true node index.js av-set-number-cell "AVID" "KEYID" "ITEMID" 128000
  SIYUAN_ENABLE_WRITE=true node index.js av-set-date-cell "AVID" "KEYID" "ITEMID" 2026-03-31
  SIYUAN_ENABLE_WRITE=true node index.js av-set-select-cell "AVID" "KEYID" "ITEMID" "Doing" --color 2
  SIYUAN_ENABLE_WRITE=true node index.js av-add-doc-rows "AVID" "DOCID1,DOCID2"
  SIYUAN_ENABLE_WRITE=true node index.js av-add-relation-key "源AVID" "KEYID" "关联客户" "目标AVID" --two-way
  SIYUAN_ENABLE_WRITE=true node index.js av-add-rollup-key "AVID" "KEYID" "预算汇总" "关系字段ID" "目标字段ID" --calc "Sum"
  SIYUAN_ENABLE_WRITE=true node index.js asset-upload /tmp/demo.png
  SIYUAN_ENABLE_WRITE=true node index.js asset-insert --parent "20211231120000-d0rzbmm" /tmp/demo.png
  SIYUAN_ENABLE_WRITE=true node index.js asset-embed-pdf --parent "20211231120000-d0rzbmm" /tmp/spec.pdf
  node index.js version-check

写入提示:
  默认只读。若要写入，请在环境变量中设置 SIYUAN_ENABLE_WRITE=true。
`;

function printCliUsage() {
    console.log(CLI_USAGE_TEXT);
}

function cliError(message) {
    console.error(message);
    process.exitCode = 1;
}

function cliRequireArg(args, index, message) {
    if (!args[index]) {
        cliError(message);
        return '';
    }

    return args[index];
}

function cliParseBool(value, fieldName = '布尔值') {
    const raw = String(value ?? '').trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on', 'checked', '是'].includes(raw)) {
        return true;
    }
    if (['false', '0', 'no', 'n', 'off', 'unchecked', '否'].includes(raw)) {
        return false;
    }
    throw new Error(`${fieldName} 必须是 true/false`);
}

async function cliPrintFormattedResults(loader, formatResults) {
    const results = await loader();
    console.log(formatResults(results));
}

async function readRequiredMarkdownFromStdin(readStdinText, commandName) {
    const markdown = String(await readStdinText() || '');
    if (!markdown.trim()) {
        cliError(`${commandName} 仅支持通过 stdin 提供 Markdown 内容（例如 <<'EOF' ... EOF）`);
        return '';
    }
    return markdown;
}

async function readJsonFromStdin(readStdinText, commandName, { required = false, defaultValue = null } = {}) {
    const raw = String(await readStdinText() || '').trim();
    if (!raw) {
        if (required) {
            cliError(`${commandName} 需要通过 stdin 提供 JSON 内容`);
            return undefined;
        }
        return defaultValue;
    }

    try {
        return JSON.parse(raw);
    } catch (error) {
        cliError(`${commandName} 提供的 JSON 无法解析: ${error.message}`);
        return undefined;
    }
}

function createCliHandlers(deps) {
    const {
        parseIdList,
        readStdinText,
        normalizeInt,
        hasClearFlag,
        stripCommandFlags,
        formatResults,
        searchNotes,
        searchInDocument,
        searchNotesMarkdown,
        openDocument,
        openSection,
        listNotebooks,
        getDocumentChildren,
        getDocumentTree,
        renderDocumentTreeMarkdown,
        getDocumentTreeByID,
        analyzeSubdocMovePlan,
        reorganizeSubdocsByID,
        appendMarkdownToBlock,
        insertBlock,
        replaceSection,
        applyPatchToDocument,
        listDocuments,
        getDocumentHeadings,
        getDocumentBlocks,
        searchByTag,
        getBacklinks,
        searchTasks,
        getDailyNotes,
        searchByAttribute,
        getBookmarks,
        getRandomHeading,
        getRecentBlocks,
        getUnreferencedDocuments,
        checkConnection,
        getSystemVersion,
        checkSkillVersion,
        createDocWithMd,
        renameDoc,
        discoverAttributeViewsInDocument,
        getPathByID,
        updateBlock,
        deleteBlock,
        callAttributeViewApi,
        addAttributeViewRows,
        addAttributeViewRelationKey,
        addAttributeViewRollupKey,
        setAttributeViewTextCell,
        setAttributeViewNumberCell,
        setAttributeViewDateCell,
        setAttributeViewSelectCell,
        setAttributeViewCheckboxCell,
        setAttributeViewMultiSelectCell,
        setAttributeViewUrlCell,
        setAttributeViewEmailCell,
        setAttributeViewPhoneCell,
        setAttributeViewTemplateCell,
        setAttributeViewAssetCell,
        setAttributeViewBlockCell,
        addAttributeViewDocRows,
        setAttributeViewRelationCell,
        clearAttributeViewRelationCell,
        addAttributeViewOption,
        updateAttributeViewOption,
        removeAttributeViewOption,
        updateAttributeViewRelationKey,
        updateAttributeViewRollupKey,
        getAttributeViewFilterSortState,
        setAttributeViewFilters,
        setAttributeViewSorts,
        setAttributeViewGroup,
        removeAttributeViewGroup,
        hideAttributeViewGroup,
        hideAllAttributeViewGroups,
        sortAttributeViewGroup,
        foldAttributeViewGroup,
        addAttributeViewView,
        removeAttributeViewView,
        renameAttributeViewView,
        setAttributeViewViewIcon,
        setAttributeViewViewDesc,
        duplicateAttributeViewView,
        sortAttributeViewView,
        setAttributeViewPageSize,
        hideAttributeViewName,
        setAttributeViewShowIcon,
        setAttributeViewWrapField,
        setAttributeViewFitImage,
        setAttributeViewDisplayFieldName,
        setAttributeViewFillColBackgroundColor,
        setAttributeViewCardSize,
        setAttributeViewCardAspectRatio,
        setAttributeViewCoverFrom,
        sortAttributeViewRow,
        addAttributeViewBlockRows,
        uploadAssets,
        uploadAndInsertAssets
    } = deps;

    const parseBlockViewFlags = (raw) => {
        const positional = [];
        const options = { blockID: '', viewID: '' };
        for (let i = 0; i < raw.length; i++) {
            if (raw[i] === '--block-id' && i + 1 < raw.length) {
                options.blockID = raw[++i];
            } else if (raw[i] === '--view-id' && i + 1 < raw.length) {
                options.viewID = raw[++i];
            } else {
                positional.push(raw[i]);
            }
        }
        return { positional, options };
    };

    const handleStringCellCommand = async (args, setter, label) => {
        const raw = args.slice(1);
        const clear = raw.includes('--clear');
        const positional = raw.filter((item) => item !== '--clear');
        const avID = positional[0];
        const keyID = positional[1];
        const itemID = positional[2];
        const content = positional.slice(3).join(' ').trim();
        if (!avID || !keyID || !itemID || (!clear && !content)) {
            cliError(`请提供 AVID、键ID、项ID 和 ${label}，或使用 --clear`);
            return;
        }
        const result = await setter(avID, keyID, itemID, clear ? '' : content);
        console.log(JSON.stringify(result, null, 2));
    };

    return {
        search: async (args) => {
            const keyword = cliRequireArg(args, 1, '请提供搜索关键词');
            if (!keyword) {
                return;
            }
            let limit = 20;
            let blockType = null;

            if (args[2]) {
                if (/^\d+$/.test(args[2])) {
                    limit = normalizeInt(args[2], 20, 1, 200);
                    blockType = args[3] || null;
                } else {
                    blockType = args[2] || null;
                }
            }

            const searchResults = await searchNotes(keyword, limit, blockType);
            console.log(formatResults(searchResults));
        },

        'search-md': async (args) => {
            const keyword = cliRequireArg(args, 1, '请提供搜索关键词');
            if (!keyword) {
                return;
            }
            const limit = normalizeInt(args[2], 20, 1, 200);
            const blockType = args[3] || null;
            const markdownView = await searchNotesMarkdown(keyword, limit, blockType);
            console.log(markdownView);
        },

        'open-doc': async (args) => {
            const raw = args.slice(1);
            // Extract --flag value pairs
            const options = {};
            const positional = [];
            for (let i = 0; i < raw.length; i++) {
                if (raw[i] === '--cursor' && i + 1 < raw.length) {
                    options.cursor = raw[++i];
                } else if (raw[i] === '--limit-chars' && i + 1 < raw.length) {
                    options.limitChars = normalizeInt(raw[++i], 15000, 1000, 1000000);
                } else if (raw[i] === '--limit-blocks' && i + 1 < raw.length) {
                    options.limitBlocks = normalizeInt(raw[++i], 50, 5, 10000);
                } else if (raw[i] === '--full') {
                    options.full = true;
                } else {
                    positional.push(raw[i]);
                }
            }
            const docId = positional[0];
            if (!docId) {
                cliError('请提供文档ID');
                return;
            }
            const view = (positional[1] || 'readable').toLowerCase();
            if (view !== 'readable' && view !== 'patchable') {
                cliError('视图参数仅支持 readable 或 patchable');
                return;
            }

            const markdownView = await openDocument(docId, view, options);
            console.log(markdownView);
        },

        'open-section': async (args) => {
            const headingBlockId = cliRequireArg(args, 1, '请提供标题块ID');
            if (!headingBlockId) return;
            const view = (args[2] || 'readable').toLowerCase();
            if (view !== 'readable' && view !== 'patchable') {
                cliError('视图参数仅支持 readable 或 patchable');
                return;
            }
            const result = await openSection(headingBlockId, view);
            console.log(result);
        },

        'search-in-doc': async (args) => {
            const docId = cliRequireArg(args, 1, '请提供文档ID');
            if (!docId) return;
            const keyword = cliRequireArg(args, 2, '请提供搜索关键词');
            if (!keyword) return;
            const limit = normalizeInt(args[3], 20, 1, 200);
            const results = await searchInDocument(docId, keyword, limit);
            console.log(formatResults(results));
        },

        notebooks: async () => {
            const notebooks = await listNotebooks();
            if (!notebooks.length) {
                console.log('未获取到笔记本列表');
                return;
            }

            notebooks.forEach((item, index) => {
                const id = item.id || item.notebook || '';
                const name = item.name || item.notebook || '(未命名)';
                const closed = item.closed ? ' (closed)' : '';
                console.log(`${index + 1}. ${name}${closed} [${id}]`);
            });
        },

        'doc-children': async (args) => {
            const notebook = cliRequireArg(args, 1, '请提供笔记本ID');
            if (!notebook) {
                return;
            }
            const pathValue = args[2] || '/';
            const children = await getDocumentChildren(notebook, pathValue);

            if (!children.length) {
                console.log('该路径下没有子文档');
                return;
            }

            children.forEach((item, index) => {
                console.log(`${index + 1}. ${item.name || '(未命名文档)'} [${item.id}] (${item.path}) sub=${item.subFileCount}`);
            });
        },

        'doc-tree': async (args) => {
            const notebook = cliRequireArg(args, 1, '请提供笔记本ID');
            if (!notebook) {
                return;
            }
            const pathValue = args[2] || '/';
            const maxDepth = normalizeInt(args[3], 4, 1, 10);
            const tree = await getDocumentTree(notebook, pathValue, maxDepth);
            console.log(renderDocumentTreeMarkdown(tree));
        },

        'doc-tree-id': async (args) => {
            const docId = cliRequireArg(args, 1, '请提供文档ID');
            if (!docId) {
                return;
            }
            const maxDepth = normalizeInt(args[2], 4, 1, 10);
            const tree = await getDocumentTreeByID(docId, maxDepth);
            console.log(renderDocumentTreeMarkdown(tree));
        },

        'subdoc-analyze-move': async (args) => {
            const toID = cliRequireArg(args, 1, '请提供目标ID和来源文档ID列表');
            const fromRaw = cliRequireArg(args, 2, '请提供目标ID和来源文档ID列表');
            if (!toID || !fromRaw) {
                return;
            }
            const maxDepth = normalizeInt(args[3], 5, 1, 10);
            const fromIDs = parseIdList(fromRaw);

            const result = await analyzeSubdocMovePlan(toID, fromIDs, maxDepth);
            console.log(JSON.stringify(result, null, 2));
        },

        'move-docs-by-id': async (args) => {
            const positional = args.slice(1);
            const toID = positional[0];
            const fromRaw = positional.slice(1).join(' ').trim();

            if (!toID) {
                cliError('请提供目标ID（父文档ID或笔记本ID）');
                return;
            }

            if (!fromRaw) {
                cliError('请提供来源文档ID列表（逗号或空格分隔）');
                return;
            }

            const fromIDs = parseIdList(fromRaw);

            const result = await reorganizeSubdocsByID(toID, fromIDs);
            console.log(JSON.stringify(result, null, 2));
        },

        'append-block': async (args) => {
            const positional = args.slice(1);
            const parentBlockId = positional[0];

            if (!parentBlockId) {
                cliError('请提供父块ID');
                return;
            }

            if (positional.length > 1) {
                cliError('append-block 仅支持通过 stdin 传入 Markdown 内容');
                return;
            }

            const markdown = await readRequiredMarkdownFromStdin(readStdinText, 'append-block');
            if (!markdown) return;

            const result = await appendMarkdownToBlock(parentBlockId, markdown);
            console.log(JSON.stringify(result, null, 2));
        },

        'insert-block': async (args) => {
            const raw = args.slice(1);
            const anchors = {
                parentID: '',
                previousID: '',
                nextID: ''
            };
            const positional = [];

            for (let i = 0; i < raw.length; i++) {
                const token = raw[i];
                if (token === '--before' || token === '--after' || token === '--parent') {
                    if (i + 1 >= raw.length) {
                        cliError(`${token} 需要提供块ID`);
                        return;
                    }
                    const anchorId = String(raw[++i] || '').trim();
                    if (!anchorId) {
                        cliError(`${token} 需要提供块ID`);
                        return;
                    }
                    if (token === '--before') {
                        anchors.nextID = anchorId;
                    } else if (token === '--after') {
                        anchors.previousID = anchorId;
                    } else {
                        anchors.parentID = anchorId;
                    }
                } else {
                    positional.push(token);
                }
            }

            const anchorCount = [anchors.parentID, anchors.previousID, anchors.nextID].filter(Boolean).length;
            if (anchorCount !== 1) {
                cliError('请且仅提供一个锚点：--before <块ID> 或 --after <块ID> 或 --parent <块ID>');
                return;
            }

            if (positional.length > 0) {
                cliError('insert-block 仅支持通过 stdin 传入 Markdown 内容');
                return;
            }

            const markdown = await readRequiredMarkdownFromStdin(readStdinText, 'insert-block');
            if (!markdown) return;

            const result = await insertBlock(markdown, anchors);
            console.log(JSON.stringify(result, null, 2));
        },

        'replace-section': async (args) => {
            const raw = args.slice(1);
            const clearMode = hasClearFlag(raw);
            const positional = stripCommandFlags(raw);
            const headingBlockId = positional[0];

            if (!headingBlockId) {
                cliError('请提供标题块ID');
                return;
            }

            if (positional.length > 1) {
                cliError('replace-section 仅支持通过 stdin 传入 Markdown 内容');
                return;
            }

            let markdown = '';
            if (!clearMode) {
                markdown = await readRequiredMarkdownFromStdin(readStdinText, 'replace-section');
                if (!markdown) return;
            }

            const result = await replaceSection(headingBlockId, markdown);
            console.log(JSON.stringify(result, null, 2));
        },

        'apply-patch': async (args) => {
            const positional = args.slice(1);
            const docId = positional[0];

            if (!docId) {
                cliError('请提供文档ID');
                return;
            }

            if (positional.length > 1) {
                cliError('apply-patch 仅支持通过 stdin 提供 PMF 文本');
                return;
            }

            const patchText = String(await readStdinText() || '').trim();
            if (!patchText) {
                cliError('apply-patch 仅支持通过 stdin 提供 PMF 文本（例如 < /tmp/doc.pmf）');
                return;
            }

            const result = await applyPatchToDocument(docId, patchText);
            console.log(JSON.stringify(result, null, 2));
        },

        docs: async (args) => {
            const maybeNotebook = args[1] || '';
            const hasNotebookArg = maybeNotebook && !/^\d+$/.test(maybeNotebook);
            const notebookId = hasNotebookArg ? maybeNotebook : null;
            const limitArg = hasNotebookArg ? args[2] : args[1];
            const limit = typeof limitArg === 'string' && limitArg.trim()
                ? normalizeInt(limitArg, 200, 1, 2000)
                : undefined;
            await cliPrintFormattedResults(() => listDocuments(notebookId, limit), formatResults);
        },

        headings: async (args) => {
            const rootId = cliRequireArg(args, 1, '请提供文档ID');
            if (!rootId) {
                return;
            }
            const headingType = args[2] || null;
            await cliPrintFormattedResults(() => getDocumentHeadings(rootId, headingType), formatResults);
        },

        blocks: async (args) => {
            const docRootId = cliRequireArg(args, 1, '请提供文档ID');
            if (!docRootId) {
                return;
            }
            const blocksType = args[2] || null;
            await cliPrintFormattedResults(() => getDocumentBlocks(docRootId, blocksType), formatResults);
        },

        tag: async (args) => {
            const tag = cliRequireArg(args, 1, '请提供标签名');
            if (!tag) {
                return;
            }
            await cliPrintFormattedResults(() => searchByTag(tag), formatResults);
        },

        backlinks: async (args) => {
            const blockId = cliRequireArg(args, 1, '请提供被引用的块ID');
            if (!blockId) {
                return;
            }
            await cliPrintFormattedResults(() => getBacklinks(blockId), formatResults);
        },

        tasks: async (args) => {
            let taskStatus = '[ ]';
            let dayArg = args[2];
            if (args[1]) {
                // 兼容未加引号的 [ ]（shell 会拆成两个参数）
                if (args[1] === '[' && args[2] === ']') {
                    taskStatus = '[ ]';
                    dayArg = args[3];
                } else {
                    taskStatus = args[1];
                }
            }
            const taskDays = normalizeInt(dayArg, 7, 1, 3650);
            await cliPrintFormattedResults(() => searchTasks(taskStatus, taskDays), formatResults);
        },

        daily: async (args) => {
            const startDate = cliRequireArg(args, 1, '请提供开始日期和结束日期 (格式: YYYYMMDD)');
            if (!startDate) {
                return;
            }
            const endDate = cliRequireArg(args, 2, '请提供开始日期和结束日期 (格式: YYYYMMDD)');
            if (!endDate) {
                return;
            }
            await cliPrintFormattedResults(() => getDailyNotes(startDate, endDate), formatResults);
        },

        attr: async (args) => {
            const attrName = cliRequireArg(args, 1, '请提供属性名称');
            if (!attrName) {
                return;
            }
            const attrValue = args[2] || null;
            await cliPrintFormattedResults(() => searchByAttribute(attrName, attrValue), formatResults);
        },

        bookmarks: async (args) => {
            const bookmarkName = args[1] || null;
            await cliPrintFormattedResults(() => getBookmarks(bookmarkName), formatResults);
        },

        random: async (args) => {
            const docId = cliRequireArg(args, 1, '请提供文档ID');
            if (!docId) {
                return;
            }
            await cliPrintFormattedResults(() => getRandomHeading(docId), formatResults);
        },

        recent: async (args) => {
            const recentDays = parseInt(args[1]) || 7;
            const recentType = args[2] || null;
            await cliPrintFormattedResults(() => getRecentBlocks(recentDays, 'updated', recentType), formatResults);
        },

        unreferenced: async (args) => {
            const notebookId = cliRequireArg(args, 1, '请提供笔记本ID');
            if (!notebookId) {
                return;
            }
            await cliPrintFormattedResults(() => getUnreferencedDocuments(notebookId), formatResults);
        },

        'create-doc': async (args) => {
            const positional = args.slice(1);
            const notebook = positional[0];
            const title = positional[1];
            let markdown = '';

            if (!notebook) {
                cliError('请提供笔记本ID');
                return;
            }

            if (!title) {
                cliError('请提供文档标题');
                return;
            }

            if (positional.length > 2) {
                cliError('create-doc 的初始内容仅支持通过 stdin 传入 Markdown；不传 stdin 则创建空文档');
                return;
            }

            if (!process.stdin.isTTY) {
                markdown = String(await readStdinText() || '').trim();
            }

            const result = await createDocWithMd(notebook, `/${title}`, markdown);
            console.log(JSON.stringify({
                ...result,
                title
            }, null, 2));
        },

        'rename-doc': async (args) => {
            const positional = args.slice(1);
            const docId = positional[0];
            const newTitle = positional.slice(1).join(' ').trim();

            if (!docId) {
                cliError('请提供文档ID');
                return;
            }

            if (!newTitle) {
                cliError('请提供新标题');
                return;
            }

            const pathInfo = await getPathByID(docId);
            if (!pathInfo || !pathInfo.notebook || !pathInfo.path) {
                cliError(`无法获取文档路径信息: ${docId}`);
                return;
            }

            await renameDoc(pathInfo.notebook, pathInfo.path, newTitle);
            console.log(JSON.stringify({ success: true, docId, newTitle }, null, 2));
        },

        'av-discover': async (args) => {
            const docId = cliRequireArg(args, 1, '请提供宿主文档ID');
            if (!docId) return;
            const result = await discoverAttributeViewsInDocument(docId);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-get': async (args) => {
            const avID = cliRequireArg(args, 1, '请提供属性视图ID');
            if (!avID) return;
            const result = await callAttributeViewApi('getAttributeView', { id: avID });
            console.log(JSON.stringify(result, null, 2));
        },

        'av-render': async (args) => {
            const raw = args.slice(1);
            const options = {
                blockID: '',
                viewID: '',
                query: '',
                page: 1,
                pageSize: -1,
                createIfNotExist: true
            };
            const positional = [];
            for (let i = 0; i < raw.length; i++) {
                if (raw[i] === '--block-id' && i + 1 < raw.length) {
                    options.blockID = raw[++i];
                } else if (raw[i] === '--view-id' && i + 1 < raw.length) {
                    options.viewID = raw[++i];
                } else if (raw[i] === '--query' && i + 1 < raw.length) {
                    options.query = raw[++i];
                } else if (raw[i] === '--page' && i + 1 < raw.length) {
                    options.page = normalizeInt(raw[++i], 1, 1, 1000000);
                } else if (raw[i] === '--page-size' && i + 1 < raw.length) {
                    options.pageSize = normalizeInt(raw[++i], -1, -1, 1000000);
                } else if (raw[i] === '--no-create') {
                    options.createIfNotExist = false;
                } else {
                    positional.push(raw[i]);
                }
            }
            const avID = positional[0];
            if (!avID) {
                cliError('请提供属性视图ID');
                return;
            }
            const payload = { id: avID };
            if (options.blockID) payload.blockID = options.blockID;
            if (options.viewID) payload.viewID = options.viewID;
            if (options.query) payload.query = options.query;
            if (options.page !== 1) payload.page = options.page;
            if (options.pageSize !== -1) payload.pageSize = options.pageSize;
            if (!options.createIfNotExist) payload.createIfNotExist = false;
            const result = await callAttributeViewApi('renderAttributeView', payload);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-keys': async (args) => {
            const id = cliRequireArg(args, 1, '请提供属性视图ID');
            if (!id) return;
            const result = await callAttributeViewApi('getAttributeViewKeys', { id });
            console.log(JSON.stringify(result, null, 2));
        },

        'av-keys-by-av': async (args) => {
            const avID = cliRequireArg(args, 1, '请提供属性视图ID');
            if (!avID) return;
            const result = await callAttributeViewApi('getAttributeViewKeysByAvID', { avID });
            console.log(JSON.stringify(result, null, 2));
        },

        'av-primary-keys': async (args) => {
            const raw = args.slice(1);
            const positional = [];
            const payload = {};
            for (let i = 0; i < raw.length; i++) {
                if (raw[i] === '--keyword' && i + 1 < raw.length) {
                    payload.keyword = raw[++i];
                } else if (raw[i] === '--page' && i + 1 < raw.length) {
                    payload.page = normalizeInt(raw[++i], 1, 1, 1000000);
                } else if (raw[i] === '--page-size' && i + 1 < raw.length) {
                    payload.pageSize = normalizeInt(raw[++i], -1, -1, 1000000);
                } else {
                    positional.push(raw[i]);
                }
            }
            const id = positional[0];
            if (!id) {
                cliError('请提供属性视图ID');
                return;
            }
            payload.id = id;
            const result = await callAttributeViewApi('getAttributeViewPrimaryKeyValues', payload);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-set-cell': async (args) => {
            const avID = cliRequireArg(args, 1, '请提供属性视图ID、键ID和项ID');
            const keyID = cliRequireArg(args, 2, '请提供属性视图ID、键ID和项ID');
            const itemID = cliRequireArg(args, 3, '请提供属性视图ID、键ID和项ID');
            if (!avID || !keyID || !itemID) return;
            const value = await readJsonFromStdin(readStdinText, 'av-set-cell', { required: true });
            if (typeof value === 'undefined') return;
            const result = await callAttributeViewApi('setAttributeViewBlockAttr', { avID, keyID, itemID, value });
            console.log(JSON.stringify(result, null, 2));
        },

        'av-set-text-cell': async (args) => {
            const raw = args.slice(1);
            const clear = raw.includes('--clear');
            const positional = raw.filter((item) => item !== '--clear');
            const avID = positional[0];
            const keyID = positional[1];
            const itemID = positional[2];
            const text = positional.slice(3).join(' ').trim();
            if (!avID || !keyID || !itemID || (!clear && !text)) {
                cliError('请提供 AVID、键ID、项ID 和文本，或使用 --clear');
                return;
            }
            const result = await setAttributeViewTextCell(avID, keyID, itemID, clear ? '' : text);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-set-number-cell': async (args) => {
            const raw = args.slice(1);
            const clear = raw.includes('--clear');
            const positional = raw.filter((item) => item !== '--clear');
            const avID = positional[0];
            const keyID = positional[1];
            const itemID = positional[2];
            const numberValue = positional[3];
            if (!avID || !keyID || !itemID || (!clear && typeof numberValue === 'undefined')) {
                cliError('请提供 AVID、键ID、项ID 和数字，或使用 --clear');
                return;
            }
            const result = await setAttributeViewNumberCell(avID, keyID, itemID, numberValue, { clear });
            console.log(JSON.stringify(result, null, 2));
        },

        'av-set-date-cell': async (args) => {
            const raw = args.slice(1);
            const clear = raw.includes('--clear');
            const positional = raw.filter((item) => item !== '--clear');
            const avID = positional[0];
            const keyID = positional[1];
            const itemID = positional[2];
            const dateInput = positional[3];
            if (!avID || !keyID || !itemID || (!clear && !dateInput)) {
                cliError('请提供 AVID、键ID、项ID 和日期，或使用 --clear');
                return;
            }
            const result = await setAttributeViewDateCell(avID, keyID, itemID, dateInput, { clear });
            console.log(JSON.stringify(result, null, 2));
        },

        'av-set-select-cell': async (args) => {
            const raw = args.slice(1);
            const positional = [];
            let color = '1';
            let clear = false;
            for (let i = 0; i < raw.length; i++) {
                if (raw[i] === '--color' && i + 1 < raw.length) {
                    color = raw[++i];
                } else if (raw[i] === '--clear') {
                    clear = true;
                } else {
                    positional.push(raw[i]);
                }
            }
            const avID = positional[0];
            const keyID = positional[1];
            const itemID = positional[2];
            const optionName = positional.slice(3).join(' ').trim();
            if (!avID || !keyID || !itemID || (!clear && !optionName)) {
                cliError('请提供 AVID、键ID、项ID 和选项名，或使用 --clear');
                return;
            }
            const result = await setAttributeViewSelectCell(avID, keyID, itemID, optionName, { color, clear });
            console.log(JSON.stringify(result, null, 2));
        },

        'av-set-checkbox-cell': async (args) => {
            const avID = cliRequireArg(args, 1, '请提供 AVID、键ID、项ID 和 true/false');
            const keyID = cliRequireArg(args, 2, '请提供 AVID、键ID、项ID 和 true/false');
            const itemID = cliRequireArg(args, 3, '请提供 AVID、键ID、项ID 和 true/false');
            const checkedRaw = cliRequireArg(args, 4, '请提供 true/false');
            if (!avID || !keyID || !itemID || !checkedRaw) return;
            const result = await setAttributeViewCheckboxCell(avID, keyID, itemID, cliParseBool(checkedRaw, 'checkbox'));
            console.log(JSON.stringify(result, null, 2));
        },

        'av-set-mselect-cell': async (args) => {
            const raw = args.slice(1);
            const positional = [];
            let colors = [];
            let clear = false;
            for (let i = 0; i < raw.length; i++) {
                if (raw[i] === '--colors' && i + 1 < raw.length) {
                    colors = parseIdList(raw[++i]);
                } else if (raw[i] === '--clear') {
                    clear = true;
                } else {
                    positional.push(raw[i]);
                }
            }
            const avID = positional[0];
            const keyID = positional[1];
            const itemID = positional[2];
            const optionNames = parseIdList(positional.slice(3).join(' '));
            if (!avID || !keyID || !itemID || (!clear && optionNames.length === 0)) {
                cliError('请提供 AVID、键ID、项ID 和选项列表，或使用 --clear');
                return;
            }
            const options = optionNames.map((name, index) => ({
                name,
                color: colors[index] || colors[0] || '1'
            }));
            const result = await setAttributeViewMultiSelectCell(avID, keyID, itemID, options, {
                clear,
                defaultColor: colors[0] || '1'
            });
            console.log(JSON.stringify(result, null, 2));
        },

        'av-set-url-cell': async (args) => {
            await handleStringCellCommand(args, setAttributeViewUrlCell, 'URL');
        },

        'av-set-email-cell': async (args) => {
            await handleStringCellCommand(args, setAttributeViewEmailCell, '邮箱');
        },

        'av-set-phone-cell': async (args) => {
            await handleStringCellCommand(args, setAttributeViewPhoneCell, '电话');
        },

        'av-set-template-cell': async (args) => {
            const raw = args.slice(1);
            const clear = raw.includes('--clear');
            const positional = raw.filter((item) => item !== '--clear');
            const avID = positional[0];
            const keyID = positional[1];
            const content = positional.slice(2).join(' ').trim();
            if (!avID || !keyID || (!clear && !content)) {
                cliError('请提供 AVID、键ID 和模板文本，或使用 --clear');
                return;
            }
            const result = await setAttributeViewTemplateCell(avID, keyID, clear ? '' : content);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-set-asset-cell': async (args) => {
            const raw = args.slice(1);
            const positional = [];
            const options = {
                assetsDirPath: '',
                skipIfDuplicated: false,
                clear: false
            };
            for (let i = 0; i < raw.length; i++) {
                if (raw[i] === '--assets-dir' && i + 1 < raw.length) {
                    options.assetsDirPath = raw[++i];
                } else if (raw[i] === '--skip-duplicated') {
                    options.skipIfDuplicated = true;
                } else if (raw[i] === '--clear') {
                    options.clear = true;
                } else {
                    positional.push(raw[i]);
                }
            }
            const avID = positional[0];
            const keyID = positional[1];
            const itemID = positional[2];
            const sources = positional.slice(3);
            if (!avID || !keyID || !itemID || (!options.clear && sources.length === 0)) {
                cliError('请提供 AVID、键ID、项ID 和资源路径，或使用 --clear');
                return;
            }
            const result = await setAttributeViewAssetCell(avID, keyID, itemID, sources, options);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-set-block-cell': async (args) => {
            const raw = args.slice(1);
            const positional = [];
            const options = { clear: false, content: '' };
            for (let i = 0; i < raw.length; i++) {
                if (raw[i] === '--content' && i + 1 < raw.length) {
                    options.content = raw[++i];
                } else if (raw[i] === '--clear') {
                    options.clear = true;
                } else {
                    positional.push(raw[i]);
                }
            }
            const avID = positional[0];
            const keyID = positional[1];
            const itemID = positional[2];
            const sourceBlockID = positional[3];
            if (!avID || !keyID || !itemID || (!options.clear && !sourceBlockID)) {
                cliError('请提供 AVID、键ID、项ID 和目标块ID，或使用 --clear');
                return;
            }
            const result = await setAttributeViewBlockCell(avID, keyID, itemID, sourceBlockID, options);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-set-relation-cell': async (args) => {
            const avID = cliRequireArg(args, 1, '请提供 AVID、键ID、项ID、目标AVID 和目标项ID列表');
            const keyID = cliRequireArg(args, 2, '请提供 AVID、键ID、项ID、目标AVID 和目标项ID列表');
            const itemID = cliRequireArg(args, 3, '请提供 AVID、键ID、项ID、目标AVID 和目标项ID列表');
            const targetAvID = cliRequireArg(args, 4, '请提供 AVID、键ID、项ID、目标AVID 和目标项ID列表');
            const targetRaw = cliRequireArg(args, 5, '请提供目标项ID列表');
            if (!avID || !keyID || !itemID || !targetAvID || !targetRaw) return;
            const targetRowIDs = parseIdList(targetRaw);
            if (targetRowIDs.length === 0) {
                cliError('目标项ID列表不能为空');
                return;
            }
            const result = await setAttributeViewRelationCell({ avID, keyID, itemID, targetAvID, targetRowIDs });
            console.log(JSON.stringify(result, null, 2));
        },

        'av-clear-relation-cell': async (args) => {
            const avID = cliRequireArg(args, 1, '请提供 AVID、键ID 和项ID');
            const keyID = cliRequireArg(args, 2, '请提供 AVID、键ID 和项ID');
            const itemID = cliRequireArg(args, 3, '请提供 AVID、键ID 和项ID');
            if (!avID || !keyID || !itemID) return;
            const result = await clearAttributeViewRelationCell(avID, keyID, itemID);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-batch-set-cells': async (args) => {
            const avID = cliRequireArg(args, 1, '请提供属性视图ID');
            if (!avID) return;
            const values = await readJsonFromStdin(readStdinText, 'av-batch-set-cells', { required: true });
            if (!Array.isArray(values)) {
                cliError('av-batch-set-cells 需要通过 stdin 提供 JSON 数组');
                return;
            }
            const result = await callAttributeViewApi('batchSetAttributeViewBlockAttrs', { avID, values });
            console.log(JSON.stringify(result, null, 2));
        },

        'av-add-key': async (args) => {
            const avID = cliRequireArg(args, 1, '请提供属性视图ID、键ID、名称和类型');
            const keyID = cliRequireArg(args, 2, '请提供属性视图ID、键ID、名称和类型');
            const keyName = cliRequireArg(args, 3, '请提供属性视图ID、键ID、名称和类型');
            const keyType = cliRequireArg(args, 4, '请提供属性视图ID、键ID、名称和类型');
            if (!avID || !keyID || !keyName || !keyType) return;
            const keyIcon = args[5] || '';
            const previousKeyID = args[6] || '';
            const result = await callAttributeViewApi('addAttributeViewKey', { avID, keyID, keyName, keyType, keyIcon, previousKeyID });
            console.log(JSON.stringify(result, null, 2));
        },

        'av-add-option': async (args) => {
            const raw = args.slice(1);
            const positional = [];
            const option = { color: '', desc: '' };
            for (let i = 0; i < raw.length; i++) {
                if (raw[i] === '--color' && i + 1 < raw.length) {
                    option.color = raw[++i];
                } else if (raw[i] === '--desc' && i + 1 < raw.length) {
                    option.desc = raw[++i];
                } else {
                    positional.push(raw[i]);
                }
            }
            const avID = positional[0];
            const keyID = positional[1];
            const name = positional.slice(2).join(' ').trim();
            if (!avID || !keyID || !name) {
                cliError('请提供 AVID、键ID 和选项名');
                return;
            }
            const result = await addAttributeViewOption(avID, keyID, {
                name,
                color: option.color || undefined,
                desc: option.desc || undefined
            });
            console.log(JSON.stringify(result, null, 2));
        },

        'av-update-option': async (args) => {
            const raw = args.slice(1);
            const positional = [];
            const option = { color: '', desc: '' };
            for (let i = 0; i < raw.length; i++) {
                if (raw[i] === '--color' && i + 1 < raw.length) {
                    option.color = raw[++i];
                } else if (raw[i] === '--desc' && i + 1 < raw.length) {
                    option.desc = raw[++i];
                } else {
                    positional.push(raw[i]);
                }
            }
            const avID = positional[0];
            const keyID = positional[1];
            const oldName = positional[2];
            const newName = positional.slice(3).join(' ').trim();
            if (!avID || !keyID || !oldName || !newName) {
                cliError('请提供 AVID、键ID、旧名称和新名称');
                return;
            }
            const result = await updateAttributeViewOption(avID, keyID, oldName, {
                name: newName,
                color: option.color || undefined,
                desc: option.desc || undefined
            });
            console.log(JSON.stringify(result, null, 2));
        },

        'av-remove-option': async (args) => {
            const avID = cliRequireArg(args, 1, '请提供 AVID、键ID 和选项名');
            const keyID = cliRequireArg(args, 2, '请提供 AVID、键ID 和选项名');
            const optionName = args.slice(3).join(' ').trim();
            if (!avID || !keyID || !optionName) {
                cliError('请提供 AVID、键ID 和选项名');
                return;
            }
            const result = await removeAttributeViewOption(avID, keyID, optionName);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-add-relation-key': async (args) => {
            const raw = args.slice(1);
            const positional = [];
            const options = {
                twoWay: false,
                backRelationKeyID: '',
                backRelationName: ''
            };
            for (let i = 0; i < raw.length; i++) {
                if (raw[i] === '--two-way') {
                    options.twoWay = true;
                } else if (raw[i] === '--back-key-id' && i + 1 < raw.length) {
                    options.backRelationKeyID = raw[++i];
                } else if (raw[i] === '--back-name' && i + 1 < raw.length) {
                    options.backRelationName = raw[++i];
                } else {
                    positional.push(raw[i]);
                }
            }
            const sourceAvID = positional[0];
            const keyID = positional[1];
            const name = positional[2];
            const targetAvID = positional[3];
            if (!sourceAvID || !keyID || !name || !targetAvID) {
                cliError('请提供源AVID、键ID、名称和目标AVID');
                return;
            }
            const result = await addAttributeViewRelationKey({
                sourceAvID,
                keyID,
                name,
                targetAvID,
                twoWay: options.twoWay,
                backRelationKeyID: options.backRelationKeyID || undefined,
                backRelationName: options.backRelationName
            });
            console.log(JSON.stringify(result, null, 2));
        },

        'av-add-rollup-key': async (args) => {
            const raw = args.slice(1);
            const positional = [];
            let calcOperator = '';
            for (let i = 0; i < raw.length; i++) {
                if (raw[i] === '--calc' && i + 1 < raw.length) {
                    calcOperator = raw[++i];
                } else {
                    positional.push(raw[i]);
                }
            }
            const avID = positional[0];
            const keyID = positional[1];
            const name = positional[2];
            const relationKeyID = positional[3];
            const targetKeyID = positional[4];
            if (!avID || !keyID || !name || !relationKeyID || !targetKeyID) {
                cliError('请提供 AVID、键ID、名称、关系字段ID和目标字段ID');
                return;
            }
            const result = await addAttributeViewRollupKey({
                avID,
                keyID,
                name,
                relationKeyID,
                targetKeyID,
                calcOperator
            });
            console.log(JSON.stringify(result, null, 2));
        },

        'av-update-relation-key': async (args) => {
            const raw = args.slice(1);
            const positional = [];
            const options = {
                targetAvID: '',
                twoWay: undefined,
                backRelationKeyID: '',
                backRelationName: '',
                columnName: ''
            };
            for (let i = 0; i < raw.length; i++) {
                if (raw[i] === '--target-av' && i + 1 < raw.length) {
                    options.targetAvID = raw[++i];
                } else if (raw[i] === '--two-way') {
                    options.twoWay = true;
                } else if (raw[i] === '--one-way') {
                    options.twoWay = false;
                } else if (raw[i] === '--back-key-id' && i + 1 < raw.length) {
                    options.backRelationKeyID = raw[++i];
                } else if (raw[i] === '--back-name' && i + 1 < raw.length) {
                    options.backRelationName = raw[++i];
                } else if (raw[i] === '--name' && i + 1 < raw.length) {
                    options.columnName = raw[++i];
                } else {
                    positional.push(raw[i]);
                }
            }
            const avID = positional[0];
            const keyID = positional[1];
            if (!avID || !keyID) {
                cliError('请提供 AVID 和键ID');
                return;
            }
            const result = await updateAttributeViewRelationKey({
                avID,
                keyID,
                targetAvID: options.targetAvID,
                twoWay: options.twoWay,
                backRelationKeyID: options.backRelationKeyID,
                backRelationName: options.backRelationName,
                columnName: options.columnName
            });
            console.log(JSON.stringify(result, null, 2));
        },

        'av-update-rollup-key': async (args) => {
            const raw = args.slice(1);
            const positional = [];
            const options = {
                relationKeyID: '',
                targetKeyID: '',
                calcOperator: '',
                clearCalc: false
            };
            for (let i = 0; i < raw.length; i++) {
                if (raw[i] === '--relation-key' && i + 1 < raw.length) {
                    options.relationKeyID = raw[++i];
                } else if (raw[i] === '--target-key' && i + 1 < raw.length) {
                    options.targetKeyID = raw[++i];
                } else if (raw[i] === '--calc' && i + 1 < raw.length) {
                    options.calcOperator = raw[++i];
                } else if (raw[i] === '--clear-calc') {
                    options.clearCalc = true;
                } else {
                    positional.push(raw[i]);
                }
            }
            const avID = positional[0];
            const keyID = positional[1];
            if (!avID || !keyID) {
                cliError('请提供 AVID 和键ID');
                return;
            }
            const result = await updateAttributeViewRollupKey({
                avID,
                keyID,
                relationKeyID: options.relationKeyID,
                targetKeyID: options.targetKeyID,
                calcOperator: options.calcOperator,
                clearCalc: options.clearCalc
            });
            console.log(JSON.stringify(result, null, 2));
        },

        'av-remove-key': async (args) => {
            const avID = cliRequireArg(args, 1, '请提供属性视图ID和键ID');
            const keyID = cliRequireArg(args, 2, '请提供属性视图ID和键ID');
            if (!avID || !keyID) return;
            const removeRelationDest = args.includes('--remove-relation-dest');
            const result = await callAttributeViewApi('removeAttributeViewKey', { avID, keyID, removeRelationDest });
            console.log(JSON.stringify(result, null, 2));
        },

        'av-sort-key': async (args) => {
            const avID = cliRequireArg(args, 1, '请提供属性视图ID和键ID');
            const keyID = cliRequireArg(args, 2, '请提供属性视图ID和键ID');
            if (!avID || !keyID) return;
            const previousKeyID = args[3] || '';
            const result = await callAttributeViewApi('sortAttributeViewKey', { avID, keyID, previousKeyID });
            console.log(JSON.stringify(result, null, 2));
        },

        'av-sort-view-key': async (args) => {
            const raw = args.slice(1);
            const positional = [];
            let viewID = '';
            for (let i = 0; i < raw.length; i++) {
                if (raw[i] === '--view-id' && i + 1 < raw.length) {
                    viewID = raw[++i];
                } else {
                    positional.push(raw[i]);
                }
            }
            const avID = positional[0];
            const keyID = positional[1];
            if (!avID || !keyID) {
                cliError('请提供属性视图ID和键ID');
                return;
            }
            const previousKeyID = positional[2] || '';
            const payload = { avID, keyID, previousKeyID };
            if (viewID) payload.viewID = viewID;
            const result = await callAttributeViewApi('sortAttributeViewViewKey', payload);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-add-rows': async (args) => {
            const avID = cliRequireArg(args, 1, '请提供属性视图ID');
            if (!avID) return;
            const input = await readJsonFromStdin(readStdinText, 'av-add-rows', { required: true });
            if (typeof input === 'undefined') return;
            const payload = Array.isArray(input) ? { avID, srcs: input } : { ...input, avID };
            if (!Array.isArray(payload.srcs)) {
                cliError('av-add-rows 需要 JSON 数组，或包含 srcs 数组的 JSON 对象');
                return;
            }
            const result = await addAttributeViewRows(payload);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-add-doc-rows': async (args) => {
            const raw = args.slice(1);
            const positional = [];
            const options = {
                blockID: '',
                viewID: '',
                groupID: '',
                previousID: '',
                ignoreDefaultFill: false
            };
            for (let i = 0; i < raw.length; i++) {
                if (raw[i] === '--block-id' && i + 1 < raw.length) {
                    options.blockID = raw[++i];
                } else if (raw[i] === '--view-id' && i + 1 < raw.length) {
                    options.viewID = raw[++i];
                } else if (raw[i] === '--group-id' && i + 1 < raw.length) {
                    options.groupID = raw[++i];
                } else if (raw[i] === '--previous-id' && i + 1 < raw.length) {
                    options.previousID = raw[++i];
                } else if (raw[i] === '--ignore-default-fill') {
                    options.ignoreDefaultFill = true;
                } else {
                    positional.push(raw[i]);
                }
            }
            const avID = positional[0];
            const docRaw = positional.slice(1).join(' ').trim();
            if (!avID || !docRaw) {
                cliError('请提供 AVID 和文档ID列表（逗号或空格分隔）');
                return;
            }
            const docIds = parseIdList(docRaw);
            if (docIds.length === 0) {
                cliError('文档ID列表不能为空');
                return;
            }
            const result = await addAttributeViewDocRows(avID, docIds, options);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-add-block-rows': async (args) => {
            const raw = args.slice(1);
            const positional = [];
            const options = {
                blockID: '',
                viewID: '',
                groupID: '',
                previousID: '',
                ignoreDefaultFill: false
            };
            for (let i = 0; i < raw.length; i++) {
                if (raw[i] === '--block-id' && i + 1 < raw.length) {
                    options.blockID = raw[++i];
                } else if (raw[i] === '--view-id' && i + 1 < raw.length) {
                    options.viewID = raw[++i];
                } else if (raw[i] === '--group-id' && i + 1 < raw.length) {
                    options.groupID = raw[++i];
                } else if (raw[i] === '--previous-id' && i + 1 < raw.length) {
                    options.previousID = raw[++i];
                } else if (raw[i] === '--ignore-default-fill') {
                    options.ignoreDefaultFill = true;
                } else {
                    positional.push(raw[i]);
                }
            }
            const avID = positional[0];
            const blockRaw = positional.slice(1).join(' ').trim();
            if (!avID || !blockRaw) {
                cliError('请提供 AVID 和块ID列表（逗号或空格分隔）');
                return;
            }
            const blockIds = parseIdList(blockRaw);
            if (blockIds.length === 0) {
                cliError('块ID列表不能为空');
                return;
            }
            const result = await addAttributeViewBlockRows(avID, blockIds, options);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-remove-rows': async (args) => {
            const avID = cliRequireArg(args, 1, '请提供属性视图ID');
            if (!avID) return;
            const srcIDs = await readJsonFromStdin(readStdinText, 'av-remove-rows', { required: true });
            if (!Array.isArray(srcIDs)) {
                cliError('av-remove-rows 需要通过 stdin 提供 JSON 数组');
                return;
            }
            const result = await callAttributeViewApi('removeAttributeViewBlocks', { avID, srcIDs });
            console.log(JSON.stringify(result, null, 2));
        },

        'av-sort-row': async (args) => {
            const raw = args.slice(1);
            const positional = [];
            const options = {
                blockID: '',
                viewID: '',
                previousID: '',
                groupID: '',
                targetGroupID: ''
            };
            for (let i = 0; i < raw.length; i++) {
                if (raw[i] === '--block-id' && i + 1 < raw.length) {
                    options.blockID = raw[++i];
                } else if (raw[i] === '--view-id' && i + 1 < raw.length) {
                    options.viewID = raw[++i];
                } else if (raw[i] === '--previous-id' && i + 1 < raw.length) {
                    options.previousID = raw[++i];
                } else if (raw[i] === '--group-id' && i + 1 < raw.length) {
                    options.groupID = raw[++i];
                } else if (raw[i] === '--target-group-id' && i + 1 < raw.length) {
                    options.targetGroupID = raw[++i];
                } else {
                    positional.push(raw[i]);
                }
            }
            const avID = positional[0];
            const itemID = positional[1];
            if (!avID || !itemID) {
                cliError('请提供 AVID 和项ID');
                return;
            }
            const result = await sortAttributeViewRow(avID, itemID, options);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-get-filter-sort': async (args) => {
            const raw = args.slice(1);
            const { positional, options } = parseBlockViewFlags(raw);
            const avID = positional[0];
            if (!avID) {
                cliError('请提供 AVID');
                return;
            }
            const result = await getAttributeViewFilterSortState(avID, options);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-set-filters': async (args) => {
            const raw = args.slice(1);
            const clear = raw.includes('--clear');
            const { positional, options } = parseBlockViewFlags(raw.filter((item) => item !== '--clear'));
            const avID = positional[0];
            if (!avID) {
                cliError('请提供 AVID');
                return;
            }
            const filters = clear ? [] : await readJsonFromStdin(readStdinText, 'av-set-filters', { required: true });
            if (!clear && !Array.isArray(filters)) {
                cliError('av-set-filters 需要通过 stdin 提供 JSON 数组');
                return;
            }
            const result = await setAttributeViewFilters(avID, filters || [], options);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-set-sorts': async (args) => {
            const raw = args.slice(1);
            const clear = raw.includes('--clear');
            const { positional, options } = parseBlockViewFlags(raw.filter((item) => item !== '--clear'));
            const avID = positional[0];
            if (!avID) {
                cliError('请提供 AVID');
                return;
            }
            const sorts = clear ? [] : await readJsonFromStdin(readStdinText, 'av-set-sorts', { required: true });
            if (!clear && !Array.isArray(sorts)) {
                cliError('av-set-sorts 需要通过 stdin 提供 JSON 数组');
                return;
            }
            const result = await setAttributeViewSorts(avID, sorts || [], options);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-set-group': async (args) => {
            const { positional, options } = parseBlockViewFlags(args.slice(1));
            const avID = positional[0];
            if (!avID) {
                cliError('请提供 AVID');
                return;
            }
            const group = await readJsonFromStdin(readStdinText, 'av-set-group', { required: true });
            if (!group || typeof group !== 'object' || Array.isArray(group)) {
                cliError('av-set-group 需要通过 stdin 提供 JSON 对象');
                return;
            }
            const result = await setAttributeViewGroup(avID, group, options);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-remove-group': async (args) => {
            const { positional, options } = parseBlockViewFlags(args.slice(1));
            const avID = positional[0];
            if (!avID) {
                cliError('请提供 AVID');
                return;
            }
            const result = await removeAttributeViewGroup(avID, options);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-hide-group': async (args) => {
            const raw = args.slice(1);
            const positional = [];
            const options = { blockID: '', viewID: '', hidden: true };
            for (let i = 0; i < raw.length; i++) {
                if (raw[i] === '--block-id' && i + 1 < raw.length) {
                    options.blockID = raw[++i];
                } else if (raw[i] === '--view-id' && i + 1 < raw.length) {
                    options.viewID = raw[++i];
                } else if (raw[i] === '--show') {
                    options.hidden = false;
                } else {
                    positional.push(raw[i]);
                }
            }
            const avID = positional[0];
            const groupID = positional[1];
            if (!avID || !groupID) {
                cliError('请提供 AVID 和分组ID');
                return;
            }
            const result = await hideAttributeViewGroup(avID, groupID, options);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-hide-all-groups': async (args) => {
            const raw = args.slice(1);
            const { positional, options } = parseBlockViewFlags(raw.filter((item) => item !== '--show'));
            options.hidden = !raw.includes('--show');
            const avID = positional[0];
            if (!avID) {
                cliError('请提供 AVID');
                return;
            }
            const result = await hideAllAttributeViewGroups(avID, options);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-sort-group': async (args) => {
            const raw = args.slice(1);
            const positional = [];
            const options = { blockID: '', viewID: '', previousID: '' };
            for (let i = 0; i < raw.length; i++) {
                if (raw[i] === '--block-id' && i + 1 < raw.length) {
                    options.blockID = raw[++i];
                } else if (raw[i] === '--view-id' && i + 1 < raw.length) {
                    options.viewID = raw[++i];
                } else if (raw[i] === '--previous-id' && i + 1 < raw.length) {
                    options.previousID = raw[++i];
                } else {
                    positional.push(raw[i]);
                }
            }
            const avID = positional[0];
            const groupID = positional[1];
            if (!avID || !groupID) {
                cliError('请提供 AVID 和分组ID');
                return;
            }
            const result = await sortAttributeViewGroup(avID, groupID, options);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-fold-group': async (args) => {
            const raw = args.slice(1);
            const positional = [];
            const options = { blockID: '', viewID: '', folded: true };
            for (let i = 0; i < raw.length; i++) {
                if (raw[i] === '--block-id' && i + 1 < raw.length) {
                    options.blockID = raw[++i];
                } else if (raw[i] === '--view-id' && i + 1 < raw.length) {
                    options.viewID = raw[++i];
                } else if (raw[i] === '--open') {
                    options.folded = false;
                } else if (raw[i] === '--close') {
                    options.folded = true;
                } else {
                    positional.push(raw[i]);
                }
            }
            const avID = positional[0];
            const groupID = positional[1];
            if (!avID || !groupID) {
                cliError('请提供 AVID 和分组ID');
                return;
            }
            const result = await foldAttributeViewGroup(avID, groupID, options);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-change-layout': async (args) => {
            const blockID = cliRequireArg(args, 1, '请提供块ID、属性视图ID和布局类型');
            const avID = cliRequireArg(args, 2, '请提供块ID、属性视图ID和布局类型');
            const layoutType = cliRequireArg(args, 3, '请提供块ID、属性视图ID和布局类型');
            if (!blockID || !avID || !layoutType) return;
            const result = await callAttributeViewApi('changeAttrViewLayout', { blockID, avID, layoutType });
            console.log(JSON.stringify(result, null, 2));
        },

        'av-set-view': async (args) => {
            const id = cliRequireArg(args, 1, '请提供块ID、属性视图ID和视图ID');
            const avID = cliRequireArg(args, 2, '请提供块ID、属性视图ID和视图ID');
            const viewID = cliRequireArg(args, 3, '请提供块ID、属性视图ID和视图ID');
            if (!id || !avID || !viewID) return;
            const result = await callAttributeViewApi('setDatabaseBlockView', { id, avID, viewID });
            console.log(JSON.stringify(result, null, 2));
        },

        'av-add-view': async (args) => {
            const raw = args.slice(1);
            const positional = [];
            const options = { layout: '', viewID: '' };
            for (let i = 0; i < raw.length; i++) {
                if (raw[i] === '--layout' && i + 1 < raw.length) {
                    options.layout = raw[++i];
                } else if (raw[i] === '--view-id' && i + 1 < raw.length) {
                    options.viewID = raw[++i];
                } else {
                    positional.push(raw[i]);
                }
            }
            const avID = positional[0];
            const blockID = positional[1];
            if (!avID || !blockID) {
                cliError('请提供 AVID 和数据库块ID');
                return;
            }
            const result = await addAttributeViewView(avID, {
                blockID,
                layout: options.layout,
                viewID: options.viewID
            });
            console.log(JSON.stringify(result, null, 2));
        },

        'av-remove-view': async (args) => {
            const avID = cliRequireArg(args, 1, '请提供 AVID、数据库块ID 和视图ID');
            const blockID = cliRequireArg(args, 2, '请提供 AVID、数据库块ID 和视图ID');
            const viewID = cliRequireArg(args, 3, '请提供 AVID、数据库块ID 和视图ID');
            if (!avID || !blockID || !viewID) return;
            const result = await removeAttributeViewView(avID, viewID, { blockID });
            console.log(JSON.stringify(result, null, 2));
        },

        'av-rename-view': async (args) => {
            const avID = cliRequireArg(args, 1, '请提供 AVID、视图ID 和名称');
            const viewID = cliRequireArg(args, 2, '请提供 AVID、视图ID 和名称');
            const name = args.slice(3).join(' ').trim();
            if (!avID || !viewID || !name) {
                cliError('请提供 AVID、视图ID 和名称');
                return;
            }
            const result = await renameAttributeViewView(avID, viewID, name);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-duplicate-view': async (args) => {
            const raw = args.slice(1);
            const positional = [];
            const options = { viewID: '' };
            for (let i = 0; i < raw.length; i++) {
                if (raw[i] === '--view-id' && i + 1 < raw.length) {
                    options.viewID = raw[++i];
                } else {
                    positional.push(raw[i]);
                }
            }
            const avID = positional[0];
            const blockID = positional[1];
            const sourceViewID = positional[2];
            if (!avID || !blockID || !sourceViewID) {
                cliError('请提供 AVID、数据库块ID 和源视图ID');
                return;
            }
            const result = await duplicateAttributeViewView(avID, sourceViewID, {
                blockID,
                viewID: options.viewID
            });
            console.log(JSON.stringify(result, null, 2));
        },

        'av-sort-view': async (args) => {
            const raw = args.slice(1);
            const positional = [];
            const options = { previousID: '', unRefresh: false };
            for (let i = 0; i < raw.length; i++) {
                if (raw[i] === '--previous-id' && i + 1 < raw.length) {
                    options.previousID = raw[++i];
                } else if (raw[i] === '--unrefresh') {
                    options.unRefresh = true;
                } else {
                    positional.push(raw[i]);
                }
            }
            const avID = positional[0];
            const viewID = positional[1];
            if (!avID || !viewID) {
                cliError('请提供 AVID 和视图ID');
                return;
            }
            const result = await sortAttributeViewView(avID, viewID, options);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-set-view-icon': async (args) => {
            const avID = cliRequireArg(args, 1, '请提供 AVID、视图ID 和图标');
            const viewID = cliRequireArg(args, 2, '请提供 AVID、视图ID 和图标');
            const icon = args.slice(3).join(' ').trim();
            if (!avID || !viewID || !icon) {
                cliError('请提供 AVID、视图ID 和图标');
                return;
            }
            const result = await setAttributeViewViewIcon(avID, viewID, icon);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-set-view-desc': async (args) => {
            const avID = cliRequireArg(args, 1, '请提供 AVID、视图ID 和描述');
            const viewID = cliRequireArg(args, 2, '请提供 AVID、视图ID 和描述');
            const desc = args.slice(3).join(' ').trim();
            if (!avID || !viewID) {
                cliError('请提供 AVID、视图ID 和描述');
                return;
            }
            const result = await setAttributeViewViewDesc(avID, viewID, desc);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-set-page-size': async (args) => {
            const { positional, options } = parseBlockViewFlags(args.slice(1));
            const avID = positional[0];
            const pageSize = positional[1];
            if (!avID || !pageSize) {
                cliError('请提供 AVID 和数量');
                return;
            }
            const result = await setAttributeViewPageSize(avID, pageSize, options);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-hide-view-name': async (args) => {
            const { positional, options } = parseBlockViewFlags(args.slice(1));
            const avID = positional[0];
            const hidden = positional[1];
            if (!avID || typeof hidden === 'undefined') {
                cliError('请提供 AVID 和 true/false');
                return;
            }
            const result = await hideAttributeViewName(avID, cliParseBool(hidden, 'hideViewName'), options);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-set-show-icon': async (args) => {
            const { positional, options } = parseBlockViewFlags(args.slice(1));
            const avID = positional[0];
            const show = positional[1];
            if (!avID || typeof show === 'undefined') {
                cliError('请提供 AVID 和 true/false');
                return;
            }
            const result = await setAttributeViewShowIcon(avID, cliParseBool(show, 'showIcon'), options);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-set-wrap-field': async (args) => {
            const { positional, options } = parseBlockViewFlags(args.slice(1));
            const avID = positional[0];
            const wrap = positional[1];
            if (!avID || typeof wrap === 'undefined') {
                cliError('请提供 AVID 和 true/false');
                return;
            }
            const result = await setAttributeViewWrapField(avID, cliParseBool(wrap, 'wrapField'), options);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-set-fit-image': async (args) => {
            const { positional, options } = parseBlockViewFlags(args.slice(1));
            const avID = positional[0];
            const enabled = positional[1];
            if (!avID || typeof enabled === 'undefined') {
                cliError('请提供 AVID 和 true/false');
                return;
            }
            const result = await setAttributeViewFitImage(avID, cliParseBool(enabled, 'fitImage'), options);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-set-display-field-name': async (args) => {
            const { positional, options } = parseBlockViewFlags(args.slice(1));
            const avID = positional[0];
            const enabled = positional[1];
            if (!avID || typeof enabled === 'undefined') {
                cliError('请提供 AVID 和 true/false');
                return;
            }
            const result = await setAttributeViewDisplayFieldName(avID, cliParseBool(enabled, 'displayFieldName'), options);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-set-fill-col-bg': async (args) => {
            const { positional, options } = parseBlockViewFlags(args.slice(1));
            const avID = positional[0];
            const enabled = positional[1];
            if (!avID || typeof enabled === 'undefined') {
                cliError('请提供 AVID 和 true/false');
                return;
            }
            const result = await setAttributeViewFillColBackgroundColor(avID, cliParseBool(enabled, 'fillColBackgroundColor'), options);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-set-cover-from': async (args) => {
            const raw = args.slice(1);
            const positional = [];
            const options = { blockID: '', viewID: '', assetKeyID: '' };
            for (let i = 0; i < raw.length; i++) {
                if (raw[i] === '--block-id' && i + 1 < raw.length) {
                    options.blockID = raw[++i];
                } else if (raw[i] === '--view-id' && i + 1 < raw.length) {
                    options.viewID = raw[++i];
                } else if (raw[i] === '--asset-key-id' && i + 1 < raw.length) {
                    options.assetKeyID = raw[++i];
                } else {
                    positional.push(raw[i]);
                }
            }
            const avID = positional[0];
            const mode = positional[1];
            if (!avID || !mode) {
                cliError('请提供 AVID 和封面来源');
                return;
            }
            const result = await setAttributeViewCoverFrom(avID, mode, options);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-set-card-size': async (args) => {
            const { positional, options } = parseBlockViewFlags(args.slice(1));
            const avID = positional[0];
            const size = positional[1];
            if (!avID || !size) {
                cliError('请提供 AVID 和卡片尺寸');
                return;
            }
            const result = await setAttributeViewCardSize(avID, size, options);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-set-card-ratio': async (args) => {
            const { positional, options } = parseBlockViewFlags(args.slice(1));
            const avID = positional[0];
            const ratio = positional[1];
            if (!avID || !ratio) {
                cliError('请提供 AVID 和卡片比例');
                return;
            }
            const result = await setAttributeViewCardAspectRatio(avID, ratio, options);
            console.log(JSON.stringify(result, null, 2));
        },

        'av-duplicate': async (args) => {
            const avID = cliRequireArg(args, 1, '请提供属性视图ID');
            if (!avID) return;
            const result = await callAttributeViewApi('duplicateAttributeViewBlock', { avID });
            console.log(JSON.stringify(result, null, 2));
        },

        'av-call': async (args) => {
            const operationName = cliRequireArg(args, 1, '请提供属性视图操作名');
            if (!operationName) return;
            const payload = await readJsonFromStdin(readStdinText, 'av-call', { defaultValue: {} });
            if (typeof payload === 'undefined') return;
            const result = await callAttributeViewApi(operationName, payload || {});
            console.log(JSON.stringify(result, null, 2));
        },

        'asset-upload': async (args) => {
            const raw = args.slice(1);
            const positional = [];
            const options = {
                assetsDirPath: '',
                docBlockId: '',
                skipIfDuplicated: false
            };
            for (let i = 0; i < raw.length; i++) {
                if (raw[i] === '--assets-dir' && i + 1 < raw.length) {
                    options.assetsDirPath = raw[++i];
                } else if (raw[i] === '--doc' && i + 1 < raw.length) {
                    options.docBlockId = raw[++i];
                } else if (raw[i] === '--skip-duplicated') {
                    options.skipIfDuplicated = true;
                } else {
                    positional.push(raw[i]);
                }
            }
            if (positional.length === 0) {
                cliError('请提供至少一个文件路径');
                return;
            }
            const result = await uploadAssets(positional, options);
            console.log(JSON.stringify(result, null, 2));
        },

        'asset-insert': async (args) => {
            const raw = args.slice(1);
            const anchors = { parentID: '', previousID: '', nextID: '' };
            const options = { assetsDirPath: '', skipIfDuplicated: false, mode: 'auto' };
            const positional = [];
            for (let i = 0; i < raw.length; i++) {
                const token = raw[i];
                if (token === '--before' || token === '--after' || token === '--parent') {
                    if (i + 1 >= raw.length) {
                        cliError(`${token} 需要提供块ID`);
                        return;
                    }
                    const anchorId = String(raw[++i] || '').trim();
                    if (!anchorId) {
                        cliError(`${token} 需要提供块ID`);
                        return;
                    }
                    if (token === '--before') anchors.nextID = anchorId;
                    if (token === '--after') anchors.previousID = anchorId;
                    if (token === '--parent') anchors.parentID = anchorId;
                } else if (token === '--assets-dir' && i + 1 < raw.length) {
                    options.assetsDirPath = raw[++i];
                } else if (token === '--skip-duplicated') {
                    options.skipIfDuplicated = true;
                } else if (token === '--mode' && i + 1 < raw.length) {
                    options.mode = raw[++i];
                } else {
                    positional.push(token);
                }
            }

            const anchorCount = [anchors.parentID, anchors.previousID, anchors.nextID].filter(Boolean).length;
            if (anchorCount !== 1) {
                cliError('请且仅提供一个锚点：--before <块ID> 或 --after <块ID> 或 --parent <块ID>');
                return;
            }
            if (positional.length === 0) {
                cliError('请提供至少一个文件路径');
                return;
            }
            if (!['auto', 'link', 'iframe', 'pdf'].includes(options.mode)) {
                cliError('asset-insert 的 --mode 仅支持 auto、link、iframe、pdf');
                return;
            }
            const result = await uploadAndInsertAssets(positional, anchors, options);
            console.log(JSON.stringify(result, null, 2));
        },

        'asset-embed-pdf': async (args) => {
            const raw = args.slice(1);
            const anchors = { parentID: '', previousID: '', nextID: '' };
            const options = { assetsDirPath: '', skipIfDuplicated: false, mode: 'pdf' };
            const positional = [];
            for (let i = 0; i < raw.length; i++) {
                const token = raw[i];
                if (token === '--before' || token === '--after' || token === '--parent') {
                    if (i + 1 >= raw.length) {
                        cliError(`${token} 需要提供块ID`);
                        return;
                    }
                    const anchorId = String(raw[++i] || '').trim();
                    if (!anchorId) {
                        cliError(`${token} 需要提供块ID`);
                        return;
                    }
                    if (token === '--before') anchors.nextID = anchorId;
                    if (token === '--after') anchors.previousID = anchorId;
                    if (token === '--parent') anchors.parentID = anchorId;
                } else if (token === '--assets-dir' && i + 1 < raw.length) {
                    options.assetsDirPath = raw[++i];
                } else if (token === '--skip-duplicated') {
                    options.skipIfDuplicated = true;
                } else {
                    positional.push(token);
                }
            }
            const anchorCount = [anchors.parentID, anchors.previousID, anchors.nextID].filter(Boolean).length;
            if (anchorCount !== 1) {
                cliError('请且仅提供一个锚点：--before <块ID> 或 --after <块ID> 或 --parent <块ID>');
                return;
            }
            if (positional.length === 0) {
                cliError('请提供至少一个 PDF 文件路径');
                return;
            }
            if (!positional.every((item) => /\.pdf$/i.test(item))) {
                cliError('asset-embed-pdf 仅支持 .pdf 文件');
                return;
            }
            const result = await uploadAndInsertAssets(positional, anchors, options);
            console.log(JSON.stringify(result, null, 2));
        },

        'update-block': async (args) => {
            const positional = args.slice(1);
            const blockId = positional[0];

            if (!blockId) {
                cliError('请提供块ID');
                return;
            }

            if (positional.length > 1) {
                cliError('update-block 仅支持通过 stdin 传入 Markdown 内容');
                return;
            }

            const markdown = await readRequiredMarkdownFromStdin(readStdinText, 'update-block');
            if (!markdown) return;

            const result = await updateBlock(blockId, markdown);
            console.log(JSON.stringify(result, null, 2));
        },

        'delete-block': async (args) => {
            const blockId = cliRequireArg(args, 1, '请提供要删除的块ID');
            if (!blockId) return;
            const result = await deleteBlock(blockId);
            console.log(JSON.stringify(result, null, 2));
        },

        check: async () => {
            const isConnected = await checkConnection();
            console.log(isConnected ? '✅ 思源笔记连接正常' : '❌ 思源笔记连接失败');
            if (!isConnected) {
                process.exitCode = 1;
            }
        },

        version: async () => {
            const version = await getSystemVersion();
            console.log(version ? `思源内核版本: ${version}` : '未获取到版本号');
        },

        'version-check': async () => {
            const result = await checkSkillVersion();
            const localInfo = `local: ${result.localVersion}, commit: ${result.localSha}`;
            if (result.status === 'latest') {
                console.log(`✅ 当前 skill 版本已是最新（${localInfo}, latest: ${result.latestVersion || 'unknown'}）。`);
                return;
            }
            if (result.status === 'outdated') {
                console.log(`⚠️ 当前 skill 版本不是最新（local: ${result.localVersion}, latest: ${result.latestVersion}, commit: ${result.localSha}）。`);
                console.log('建议尽快更新到最新版本以获得最佳体验。');
                return;
            }
            console.log(`⚠️ 无法获取远程版本，已跳过检查（${localInfo}）。`);
        }
    };
}

module.exports = {
    createCliHandlers,
    printCliUsage
};
