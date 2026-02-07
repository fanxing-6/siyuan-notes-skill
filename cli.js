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
  append-block <父块ID> <Markdown>
                           - 向父块追加内容
  replace-section <标题块ID> <Markdown>
                           - 替换标题下全部子块
  replace-section <标题块ID> --clear
                           - 清空标题下全部子块
  apply-patch <文档ID>      - 从 stdin 读取 PMF 并应用补丁
  update-block <块ID> <Markdown|--stdin>
                           - 更新单个块内容（多行内容用 --stdin 从标准输入读取）
  delete-block <块ID>       - 删除单个块
  docs [笔记本ID] [数量]     - 列出所有文档或指定笔记本的文档
  headings <文档ID> [级别]   - 查询文档标题 (级别: h1, h2等)
  blocks <文档ID> [类型]     - 查询文档子块
  tag <标签名>              - 搜索包含标签的笔记
  backlinks <块ID>          - 查询块的反向链接
  tasks [状态] [天数]        - 查询任务列表 (状态: [ ]未完成, [x]已完成, [-]进行中)
  daily <开始日期> <结束日期> - 查询Daily Note (日期格式: YYYYMMDD)
  attr <属性名> [属性值]     - 查询包含属性的块
  bookmarks [书签名]         - 查询书签
  random <文档ID>           - 随机漫游文档标题
  recent [天数] [类型]       - 查询最近修改的块
  unreferenced <笔记本ID>    - 查询未被引用的文档
  create-doc <笔记本ID> <标题> [Markdown]
                           - 创建新文档
  rename-doc <文档ID> <新标题>
                           - 重命名文档
  check                    - 检查连接状态
  version                  - 获取思源内核版本

示例:
  node index.js search "人工智能" 10 p
  node index.js search-md "人工智能" 10
  node index.js open-doc "20211231120000-d0rzbmm" readable
  node index.js doc-children "20210817205410-2kvfpfn" "/"
  node index.js doc-tree "20210817205410-2kvfpfn" "/" 4
  node index.js doc-tree-id "20211231120000-d0rzbmm" 5
  node index.js subdoc-analyze-move "20211231120000-d0rzbmm" "20211231121000-aaa111,20211231122000-bbb222" 6
  SIYUAN_ENABLE_WRITE=true node index.js move-docs-by-id "20211231120000-d0rzbmm" "20211231121000-aaa111,20211231122000-bbb222"
  SIYUAN_ENABLE_WRITE=true node index.js apply-patch "20211231120000-d0rzbmm" < patch.pmf
  SIYUAN_ENABLE_WRITE=true node index.js append-block "20211231120000-d0rzbmm" "- [ ] 新任务"
  SIYUAN_ENABLE_WRITE=true node index.js replace-section "20211231120000-d0rzbmm" "- 更新内容"
  node index.js docs
  node index.js docs 100
  node index.js headings "20211231120000-d0rzbmm" h2
  node index.js tasks "[ ]" 7
  node index.js daily 20231010 20231013
  node index.js attr "custom-priority" "high"
  SIYUAN_ENABLE_WRITE=true node index.js create-doc "20210817205410-2kvfpfn" "我的新文档" "初始内容"
  SIYUAN_ENABLE_WRITE=true node index.js rename-doc "20211231120000-d0rzbmm" "新标题"

写入提示:
  默认只读。若要写入，请在环境变量中设置 SIYUAN_ENABLE_WRITE=true。
`;

function printCliUsage() {
    console.log(CLI_USAGE_TEXT);
}

function cliRequireArg(args, index, message) {
    if (!args[index]) {
        console.error(message);
        return '';
    }

    return args[index];
}

async function cliPrintFormattedResults(loader, formatResults) {
    const results = await loader();
    console.log(formatResults(results));
}

function createCliHandlers(deps) {
    const {
        parseIdList,
        readStdinText,
        normalizeInt,
        hasClearFlag,
        rejectDeprecatedFlags,
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
        createDocWithMd,
        renameDoc,
        getPathByID,
        updateBlock,
        deleteBlock
    } = deps;

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
                console.error('请提供文档ID');
                return;
            }
            const view = (positional[1] || 'readable').toLowerCase();
            if (view !== 'readable' && view !== 'patchable') {
                console.error('视图参数仅支持 readable 或 patchable');
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
                console.error('视图参数仅支持 readable 或 patchable');
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
            rejectDeprecatedFlags(args);
            const positional = args.slice(1);
            const toID = positional[0];
            const fromRaw = positional.slice(1).join(' ').trim();

            if (!toID) {
                console.error('请提供目标ID（父文档ID或笔记本ID）');
                return;
            }

            if (!fromRaw) {
                console.error('请提供来源文档ID列表（逗号或空格分隔）');
                return;
            }

            const fromIDs = parseIdList(fromRaw);

            const result = await reorganizeSubdocsByID(toID, fromIDs);
            console.log(JSON.stringify(result, null, 2));
        },

        'append-block': async (args) => {
            rejectDeprecatedFlags(args);
            const positional = args.slice(1);
            const parentBlockId = positional[0];
            const markdown = positional.slice(1).join(' ').trim();

            if (!parentBlockId) {
                console.error('请提供父块ID');
                return;
            }

            if (!markdown) {
                console.error('请提供要追加的Markdown内容');
                return;
            }

            const result = await appendMarkdownToBlock(parentBlockId, markdown);
            console.log(JSON.stringify(result, null, 2));
        },

        'replace-section': async (args) => {
            rejectDeprecatedFlags(args);
            const raw = args.slice(1);
            const clearMode = hasClearFlag(raw);
            const positional = stripCommandFlags(raw);
            const headingBlockId = positional[0];
            const markdown = clearMode ? '' : positional.slice(1).join(' ').trim();

            if (!headingBlockId) {
                console.error('请提供标题块ID');
                return;
            }

            if (!clearMode && !markdown) {
                console.error('请提供替换内容，或使用 --clear 清空该章节');
                return;
            }

            const result = await replaceSection(headingBlockId, markdown);
            console.log(JSON.stringify(result, null, 2));
        },

        'apply-patch': async (args) => {
            rejectDeprecatedFlags(args);
            const positional = args.slice(1);
            const docId = positional[0];

            if (!docId) {
                console.error('请提供文档ID');
                return;
            }

            const inlinePatch = positional.slice(1).join(' ').trim();
            const stdinPatch = await readStdinText();
            const patchText = inlinePatch || String(stdinPatch || '').trim();
            if (!patchText) {
                console.error('请通过参数或 stdin 提供 PMF 文本');
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
            const taskStatus = args[1] || '[ ]';
            const taskDays = parseInt(args[2]) || 7;
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
            rejectDeprecatedFlags(args);
            const positional = args.slice(1);
            const notebook = positional[0];
            const title = positional[1];
            const markdown = positional.slice(2).join(' ').trim();

            if (!notebook) {
                console.error('请提供笔记本ID');
                return;
            }

            if (!title) {
                console.error('请提供文档标题');
                return;
            }

            const result = await createDocWithMd(notebook, `/${title}`, markdown);
            console.log(JSON.stringify({ success: true, docId: result, title }, null, 2));
        },

        'rename-doc': async (args) => {
            rejectDeprecatedFlags(args);
            const positional = args.slice(1);
            const docId = positional[0];
            const newTitle = positional.slice(1).join(' ').trim();

            if (!docId) {
                console.error('请提供文档ID');
                return;
            }

            if (!newTitle) {
                console.error('请提供新标题');
                return;
            }

            const pathInfo = await getPathByID(docId);
            if (!pathInfo || !pathInfo.notebook || !pathInfo.path) {
                console.error(`无法获取文档路径信息: ${docId}`);
                return;
            }

            const result = await renameDoc(pathInfo.notebook, pathInfo.path, newTitle);
            console.log(JSON.stringify({ success: true, docId, newTitle }, null, 2));
        },

        'update-block': async (args) => {
            rejectDeprecatedFlags(args);
            const raw = args.slice(1);
            const useStdin = raw.includes('--stdin');
            const positional = raw.filter(a => a !== '--stdin');
            const blockId = positional[0];

            if (!blockId) {
                console.error('请提供块ID');
                return;
            }

            let markdown;
            if (useStdin) {
                markdown = String(await readStdinText() || '').trim();
            } else {
                markdown = positional.slice(1).join(' ').trim();
            }

            if (!markdown) {
                console.error('请提供新的Markdown内容（参数传入或 --stdin 从标准输入读取）');
                return;
            }

            const result = await updateBlock(blockId, markdown);
            console.log(JSON.stringify(result, null, 2));
        },

        'delete-block': async (args) => {
            rejectDeprecatedFlags(args);
            const blockId = cliRequireArg(args, 1, '请提供要删除的块ID');
            if (!blockId) return;
            const result = await deleteBlock(blockId);
            console.log(JSON.stringify(result, null, 2));
        },

        check: async () => {
            const isConnected = await checkConnection();
            console.log(isConnected ? '✅ 思源笔记连接正常' : '❌ 思源笔记连接失败');
        },

        version: async () => {
            const version = await getSystemVersion();
            console.log(version ? `思源内核版本: ${version}` : '未获取到版本号');
        }
    };
}

module.exports = {
    createCliHandlers,
    printCliUsage
};
