// EXPORTS: useEditor, DEFAULT_MD
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type {
  IBlock,
  IEditorSettings,
  IFileNode,
  IFindMatch,
  IFindState,
  IFormatAction,
  IOutlineItem,
  ISidebarView,
  ISourceMode,
} from '@/data/types';
import { splitBlocksWithOffsets, blocksToMarkdown } from '@/lib/md-blocks';
import {
  renderBlockMd,
  blockHtmlToMd,
  postProcessRendered,
  renderWholeHtml,
  exportThemeCss,
} from '@/lib/markdown-engine';
import { getCaretInBlock, getSelectionInBlock, setCaretInBlock } from '@/lib/caret';
import { countStats } from '@/lib/stats';
import { store } from '@/lib/store';
import { transformMarkdown } from '@/lib/format';
import {
  fsSupported,
  isCapacitor,
  openFile,
  openFolder,
  saveToHandle,
  saveFileAs,
  exportHtml,
  shareFile,
  readDirTree,
  readTreeFile,
  resolveDirHandle,
  createFileInDir,
  createDirInDir,
  removeEntryFrom,
  renameEntryIn,
} from '@/lib/file-system';
import type { IFileHandle, IDirHandle } from '@/lib/file-system';

export const DEFAULT_MD = `# 欢迎使用 Markdown 编辑器

这是一款**参照 Typora** 的所见即所得 Markdown 编辑器。

## 快速上手

- 直接输入 Markdown 语法，例如在行首输入 \`# \` 即可变为标题
- 按 \`Ctrl+B\` 加粗，\`Ctrl+I\` 斜体，\`Ctrl+K\` 插入链接
- 按 \`Ctrl+/\` 切换源码模式
- 按 \`Ctrl+Shift+L\` 显示 / 隐藏侧边栏
- 支持打开文件夹批量管理 \`.md\` 文件

## 支持的功能

1. 标题、列表、任务列表、引用、表格
2. 数学公式：行内 $E = mc^2$，块级：

$$
\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}
$$

3. Mermaid 流程图：

\`\`\`mermaid
graph LR
    A[开始] --> B{是否了解 Markdown?}
    B -->|是| C[尽情书写]
    B -->|否| D[阅读本文档]
    D --> C
\`\`\`

4. 代码高亮：

\`\`\`python
def hello(name: str) -> str:
    return f"Hello, {name}!"

print(hello("Typora"))
\`\`\`

> 提示：引用块、脚注[^1]、高亮 ==重点==、上标^TM^、下标 H~2~O 都已支持。

| 功能 | 快捷键 | 说明 |
| --- | --- | --- |
| 保存 | Ctrl+S | 保存当前文档 |
| 导出 | 文件菜单 | 导出 HTML / PDF |

[^1]: 这是一条脚注。

---

祝写作愉快！
`;

const DEFAULT_SETTINGS: IEditorSettings = {
  theme: 'github',
  fontSize: 16,
  sidebarWidth: 234,
  focusMode: false,
  typewriterMode: false,
  spellcheck: false,
  recentFiles: [],
};

interface IHistoryEntry {
  md: string;
  caret: number;
}

function offsetToBlock(blocks: IBlock[], offset: number): { blockIdx: number; rel: number } | null {
  for (let i = 0; i < blocks.length; i += 1) {
    if (offset >= blocks[i].start && offset <= blocks[i].end) {
      return { blockIdx: i, rel: offset - blocks[i].start };
    }
  }
  return null;
}

/** 在块 DOM 中按文本偏移包裹 <mark> 高亮（基于文本节点数组，安全分割） */
function wrapRangeInBlock(blockEl: HTMLElement, start: number, len: number, cls: string): void {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(blockEl, NodeFilter.SHOW_TEXT);
  let n: Node | null = walker.nextNode();
  while (n) {
    textNodes.push(n as Text);
    n = walker.nextNode();
  }
  let acc = 0;
  let cursor = start;
  let remaining = len;
  let i = 0;
  while (i < textNodes.length && remaining > 0) {
    const text = textNodes[i];
    const tl = text.textContent?.length ?? 0;
    if (acc + tl <= cursor) {
      acc += tl;
      i += 1;
      continue;
    }
    const takeStart = Math.max(0, cursor - acc);
    const take = Math.min(tl - takeStart, remaining);
    const content = text.textContent ?? '';
    const before = document.createTextNode(content.slice(0, takeStart));
    const selected = document.createTextNode(content.slice(takeStart, takeStart + take));
    const after = document.createTextNode(content.slice(takeStart + take));
    const parent = text.parentNode!;
    const next = text.nextSibling;
    parent.insertBefore(before, next);
    parent.insertBefore(selected, next);
    parent.insertBefore(after, next);
    parent.removeChild(text);
    const mark = document.createElement('mark');
    mark.className = cls;
    mark.appendChild(selected);
    parent.insertBefore(mark, after);
    textNodes.splice(i, 1, before, after);
    remaining -= take;
    cursor += take;
    acc += takeStart + take;
    i += 1;
  }
}

/** 应用查找高亮（先清除旧的，再按全文偏移包裹） */
function applyFindHighlight(
  root: HTMLElement,
  matches: IFindMatch[],
  currentIndex: number,
  blks: IBlock[],
): void {
  root.querySelectorAll('mark.ed-match').forEach((el) => {
    el.replaceWith(document.createTextNode(el.textContent ?? ''));
  });
  if (matches.length === 0) return;
  matches.forEach((mt, i) => {
    const loc = offsetToBlock(blks, mt.offset);
    if (!loc) return;
    const blockEl = root.querySelector<HTMLElement>(`[data-block-idx="${loc.blockIdx}"]`);
    if (!blockEl) return;
    wrapRangeInBlock(
      blockEl,
      loc.rel,
      mt.length,
      i === currentIndex ? 'ed-match ed-match-current' : 'ed-match',
    );
  });
}

export type EditorApi = ReturnType<typeof useEditor>;

export function useEditor() {
  /* ---------------- 状态 ---------------- */
  const [blocks, setBlocksRaw] = useState<IBlock[]>(() => {
    const draft = store.get<{ md?: string } | null>('draft', null);
    return splitBlocksWithOffsets(draft?.md ?? DEFAULT_MD);
  });
  const [sourceValue, setSourceValue] = useState<string>(() => {
    const draft = store.get<{ md?: string } | null>('draft', null);
    return draft?.md ?? DEFAULT_MD;
  });
  const [mode, setMode] = useState<ISourceMode>('wysiwyg');
  const [fileName, setFileName] = useState(() => store.get('lastFileName', '未命名.md'));
  const [savedMd, setSavedMd] = useState(() => {
    const draft = store.get<{ md?: string } | null>('draft', null);
    return draft?.md ?? DEFAULT_MD;
  });
  const [settings, setSettings] = useState<IEditorSettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...store.get('settings', DEFAULT_SETTINGS),
  }));
  const [fileHandle, setFileHandle] = useState<IFileHandle | null>(null);
  const [dirHandle, setDirHandle] = useState<IDirHandle | null>(null);
  const [dirRootName, setDirRootName] = useState('');
  const [dirTree, setDirTree] = useState<IFileNode[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarView, setSidebarView] = useState<ISidebarView>('files');
  const [findOpen, setFindOpen] = useState(false);
  const [find, setFind] = useState<IFindState>({
    query: '',
    replaceWith: '',
    caseSensitive: false,
    matchIndex: -1,
    matches: [],
  });
  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);
  const [busy, setBusy] = useState(false);

  /* ---------------- refs ---------------- */
  const editorRef = useRef<HTMLDivElement | null>(null);
  const sourceRef = useRef<HTMLTextAreaElement | null>(null);
  const blocksRef = useRef(blocks);
  const skipRebuildRef = useRef(false);
  const pendingCaretRef = useRef<{ blockIdx: number; offset: number } | null>(null);
  const undoStackRef = useRef<IHistoryEntry[]>([]);
  const redoStackRef = useRef<IHistoryEntry[]>([]);
  const isRenderingRef = useRef(false);

  useLayoutEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  /* ---------------- 派生 ---------------- */
  const fullMd = useMemo(
    () => (mode === 'source' ? sourceValue : blocksToMarkdown(blocks)),
    [mode, sourceValue, blocks],
  );
  const dirty = fullMd !== savedMd;
  const stats = useMemo(() => countStats(fullMd), [fullMd]);
  const outline = useMemo<IOutlineItem[]>(() => {
    const items: IOutlineItem[] = [];
    blocks.forEach((b, i) => {
      const m = /^(#{1,6})\s+(.*)$/.exec(b.text);
      if (m) items.push({ level: m[1].length, text: m[2], blockIdx: i });
    });
    return items;
  }, [blocks]);

  /* ---------------- 渲染管线 ---------------- */
  const setBlocks = useCallback((next: IBlock[]) => {
    setBlocksRaw(next);
  }, []);

  const renderBlocksToDom = useCallback((root: HTMLElement, blks: IBlock[]) => {
    isRenderingRef.current = true;
    root.innerHTML = '';
    const frag = document.createDocumentFragment();
    blks.forEach((b, i) => {
      const el = document.createElement('div');
      el.className = 'md-block';
      el.setAttribute('data-block-idx', String(i));
      const html = renderBlockMd(b.text);
      el.innerHTML = html || '<br>';
      frag.appendChild(el);
    });
    root.appendChild(frag);
    // 后处理：KaTeX / Mermaid
    Array.from(root.children).forEach((el) => postProcessRendered(el as HTMLElement));
    isRenderingRef.current = false;
  }, []);

  useLayoutEffect(() => {
    if (mode !== 'wysiwyg') return;
    if (skipRebuildRef.current) {
      skipRebuildRef.current = false;
      return;
    }
    const root = editorRef.current;
    if (!root) return;
    renderBlocksToDom(root, blocks);
    if (findOpen && find.matches.length > 0) {
      applyFindHighlight(root, find.matches, find.matchIndex, blocks);
    }
    const pc = pendingCaretRef.current;
    if (pc) {
      const clamp = Math.min(pc.offset, blocks[pc.blockIdx]?.text.length ?? 0);
      setCaretInBlock(root, pc.blockIdx, clamp);
      pendingCaretRef.current = null;
    }
  }, [blocks, mode, renderBlocksToDom, findOpen, find.matches, find.matchIndex]);

  /* ---------------- 历史 ---------------- */
  const currentCaretOffset = useCallback((): number => {
    if (mode === 'source') return sourceRef.current?.selectionStart ?? 0;
    const root = editorRef.current;
    if (!root) return 0;
    const caret = getCaretInBlock(root);
    if (!caret) return 0;
    const b = blocksRef.current[caret.blockIdx];
    return b ? b.start + caret.offset : 0;
  }, [mode]);

  const lastHistoryRef = useRef(0);
  const pushHistory = useCallback(
    (md: string, caret: number) => {
      const now = Date.now();
      // 连续快速输入（500ms 内）合并为同一段历史，避免每击键全量入栈造成卡顿
      if (now - lastHistoryRef.current < 500 && undoStackRef.current.length > 0) {
        undoStackRef.current[undoStackRef.current.length - 1] = { md, caret };
      } else {
        undoStackRef.current.push({ md, caret });
        if (undoStackRef.current.length > 100) undoStackRef.current.shift();
      }
      lastHistoryRef.current = now;
      redoStackRef.current = [];
      setUndoDepth(undoStackRef.current.length);
      setRedoDepth(0);
    },
    [],
  );

  const applyMd = useCallback(
    (md: string, caretOffset?: number) => {
      if (mode === 'source') {
        setSourceValue(md);
        if (caretOffset !== undefined) {
          requestAnimationFrame(() => {
            const ta = sourceRef.current;
            if (ta) ta.setSelectionRange(caretOffset, caretOffset);
          });
        }
        return;
      }
      const next = splitBlocksWithOffsets(md);
      setBlocks(next);
      if (caretOffset !== undefined) {
        const loc = offsetToBlock(next, Math.min(caretOffset, md.length));
        if (loc) pendingCaretRef.current = { blockIdx: loc.blockIdx, offset: loc.rel };
      }
    },
    [mode, setBlocks],
  );

  const undo = useCallback(() => {
    const stack = undoStackRef.current;
    if (stack.length === 0) return;
    const entry = stack.pop()!;
    redoStackRef.current.push({ md: fullMd, caret: currentCaretOffset() });
    setUndoDepth(stack.length);
    setRedoDepth(redoStackRef.current.length);
    applyMd(entry.md, entry.caret);
  }, [fullMd, currentCaretOffset, applyMd]);

  const redo = useCallback(() => {
    const stack = redoStackRef.current;
    if (stack.length === 0) return;
    const entry = stack.pop()!;
    undoStackRef.current.push({ md: fullMd, caret: currentCaretOffset() });
    setUndoDepth(undoStackRef.current.length);
    setRedoDepth(stack.length);
    applyMd(entry.md, entry.caret);
  }, [fullMd, currentCaretOffset, applyMd]);

  /* ---------------- 编辑事件（所见即所得） ---------------- */
  const handleEditorInput = useCallback(() => {
    const root = editorRef.current;
    if (!root || isRenderingRef.current) return;
    const caret = getCaretInBlock(root);
    if (!caret) return;
    const blockEl = root.querySelector<HTMLElement>(`[data-block-idx="${caret.blockIdx}"]`);
    if (!blockEl) return;
    const newText = blockHtmlToMd(blockEl);
    const prev = blocksRef.current;
    const oldText = prev[caret.blockIdx]?.text ?? '';
    if (newText === oldText) return;
    pushHistory(blocksToMarkdown(prev), prev[caret.blockIdx].start + caret.offset);
    // 增量更新该块 DOM 与状态
    blockEl.innerHTML = renderBlockMd(newText) || '<br>';
    postProcessRendered(blockEl);
    setCaretInBlock(root, caret.blockIdx, caret.offset);
    skipRebuildRef.current = true;
    const next = prev.map((b, i) => (i === caret.blockIdx ? { ...b, text: newText } : b));
    let off = 0;
    const withOffsets = next.map((b, i) => {
      const t = i === caret.blockIdx ? newText : b.text;
      const start = off;
      off += t.length + 2;
      return { ...b, text: t, start, end: start + t.length };
    });
    setBlocks(withOffsets);
  }, [pushHistory, setBlocks]);

  /* ---------------- 格式操作 ---------------- */
  const getSelectionRange = useCallback((): { start: number; end: number } | null => {
    if (mode === 'source') {
      const ta = sourceRef.current;
      return ta ? { start: ta.selectionStart, end: ta.selectionEnd } : null;
    }
    const root = editorRef.current;
    if (!root) return null;
    const sel = getSelectionInBlock(root);
    if (!sel) return null;
    const b = blocksRef.current[sel.blockIdx];
    if (!b) return null;
    return { start: b.start + sel.start, end: b.start + sel.end };
  }, [mode]);

  const formatAction = useCallback(
    (action: IFormatAction) => {
      const sel = getSelectionRange();
      if (!sel) return;
      const result = transformMarkdown(fullMd, sel.start, sel.end, action);
      if (!result) return;
      pushHistory(fullMd, sel.start);
      applyMd(result.md, result.caret);
    },
    [getSelectionRange, fullMd, pushHistory, applyMd],
  );

  /* ---------------- 查找替换 ---------------- */
  const computeMatches = useCallback(
    (query: string, caseSensitive: boolean): IFindMatch[] => {
      if (!query) return [];
      const md = blocksToMarkdown(blocksRef.current);
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      try {
        const re = new RegExp(escaped, caseSensitive ? 'g' : 'gi');
        const out: IFindMatch[] = [];
        let m: RegExpExecArray | null;
        while ((m = re.exec(md)) !== null) {
          out.push({ offset: m.index, length: m[0].length });
          if (m[0].length === 0) re.lastIndex += 1;
        }
        return out;
      } catch {
        return [];
      }
    },
    [],
  );

  const scrollToOffset = useCallback(
    (offset: number) => {
      if (mode === 'source') {
        const ta = sourceRef.current;
        if (ta) ta.setSelectionRange(offset, offset + (find.matches[find.matchIndex]?.length ?? 0));
        return;
      }
      const loc = offsetToBlock(blocksRef.current, offset);
      if (!loc) return;
      const root = editorRef.current;
      const el = root?.querySelector<HTMLElement>(`[data-block-idx="${loc.blockIdx}"]`);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    },
    [mode, find.matches, find.matchIndex],
  );

  const findInput = useCallback(
    (query: string) => {
      const matches = computeMatches(query, find.caseSensitive);
      setFind((prev) => ({
        ...prev,
        query,
        matches,
        matchIndex: matches.length > 0 ? 0 : -1,
      }));
      if (matches.length > 0) scrollToOffset(matches[0].offset);
    },
    [find.caseSensitive, computeMatches, scrollToOffset],
  );

  const findNext = useCallback(() => {
    setFind((prev) => {
      if (prev.matches.length === 0) return prev;
      const nextIdx = (prev.matchIndex + 1) % prev.matches.length;
      return { ...prev, matchIndex: nextIdx };
    });
  }, []);

  const findPrev = useCallback(() => {
    setFind((prev) => {
      if (prev.matches.length === 0) return prev;
      const nextIdx = (prev.matchIndex - 1 + prev.matches.length) % prev.matches.length;
      return { ...prev, matchIndex: nextIdx };
    });
  }, []);

  // 当前匹配变化时滚动定位
  useEffect(() => {
    if (!findOpen || find.matchIndex < 0 || find.matches.length === 0) return;
    scrollToOffset(find.matches[find.matchIndex].offset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [find.matchIndex, findOpen, find.matches]);

  const replaceOne = useCallback(() => {
    const m = find.matches[find.matchIndex];
    if (!m) return;
    const md = blocksToMarkdown(blocksRef.current);
    const next = md.slice(0, m.offset) + find.replaceWith + md.slice(m.offset + m.length);
    pushHistory(md, m.offset);
    applyMd(next);
    const matches = computeMatches(find.query, find.caseSensitive);
    setFind((prev) => ({
      ...prev,
      matches,
      matchIndex: Math.min(prev.matchIndex, Math.max(0, matches.length - 1)),
    }));
  }, [find, pushHistory, applyMd, computeMatches]);

  const replaceAll = useCallback(() => {
    if (!find.query) return;
    const md = blocksToMarkdown(blocksRef.current);
    const escaped = find.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, find.caseSensitive ? 'g' : 'gi');
    const next = md.replace(re, find.replaceWith);
    if (next === md) return;
    pushHistory(md, 0);
    applyMd(next);
    const matches = computeMatches(find.query, find.caseSensitive);
    setFind((prev) => ({ ...prev, matches, matchIndex: matches.length > 0 ? 0 : -1 }));
  }, [find, pushHistory, applyMd, computeMatches]);

  const clearFind = useCallback(() => {
    setFindOpen(false);
    setFind((prev) => ({ ...prev, query: '', matches: [], matchIndex: -1 }));
  }, []);

  /* ---------------- 文件操作 ---------------- */
  /* ---------------- 设置与视图 ---------------- */
  const updateSettings = useCallback((patch: Partial<IEditorSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    store.set('settings', settings);
  }, [settings]);

  const updateRecent = useCallback(
    (name: string) => {
      const recents = [
        { name, path: name, lastOpened: Date.now() },
        ...settings.recentFiles.filter((r) => r.name !== name),
      ].slice(0, 8);
      updateSettings({ recentFiles: recents });
    },
    [settings.recentFiles, updateSettings],
  );

  const loadContent = useCallback(
    (content: string, name: string, handle: IFileHandle | null) => {
      pushHistory(blocksToMarkdown(blocksRef.current), currentCaretOffset());
      setBlocks(splitBlocksWithOffsets(content));
      setFileName(name);
      setFileHandle(handle);
      setCurrentPath('');
      setSavedMd(content);
      store.set('lastFileName', name);
      updateRecent(name);
    },
    [pushHistory, currentCaretOffset, setBlocks, updateRecent],
  );

  const newFile = useCallback(() => {
    loadContent('', '未命名.md', null);
  }, [loadContent]);

  const openFileAction = useCallback(async () => {
    setBusy(true);
    try {
      const res = await openFile();
      if (res) {
        loadContent(res.content, res.name, res.handle ?? null);
        toast.success(`已打开 ${res.name}`);
      }
    } catch (e) {
      toast.error(`打开文件失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }, [loadContent]);

  const openFolderAction = useCallback(async () => {
    setBusy(true);
    try {
      const res = await openFolder();
      if (res) {
        setDirHandle(res.handle);
        setDirRootName(res.rootName);
        setDirTree(res.tree);
        setSidebarOpen(true);
        setSidebarView('files');
        toast.success(`已打开文件夹 ${res.rootName}`);
      } else if (!fsSupported()) {
        toast.error('当前浏览器不支持打开文件夹，请使用 Chrome / Edge');
      }
    } catch {
      toast.error('打开文件夹失败');
    } finally {
      setBusy(false);
    }
  }, []);

  const saveAction = useCallback(async () => {
    const md = blocksToMarkdown(blocksRef.current);
    if (isCapacitor()) {
      // 手机端：有打开文件的原位置则直接覆盖保存，否则走"另存为"对话框选择位置
      if (fileHandle) {
        try {
          await saveToHandle(fileHandle, md);
          setSavedMd(md);
          toast.success('已保存');
          return;
        } catch (e) {
          toast.error(`保存失败：${e instanceof Error ? e.message : String(e)}`);
          return;
        }
      }
      try {
        const h = await saveFileAs(fileName, md);
        if (h) {
          setFileHandle(h);
          setSavedMd(md);
          toast.success('已保存');
        }
      } catch (e) {
        toast.error(`保存失败：${e instanceof Error ? e.message : String(e)}`);
      }
      return;
    }
    if (fileHandle && fsSupported()) {
      try {
        await saveToHandle(fileHandle, md);
        setSavedMd(md);
        toast.success('已保存');
        return;
      } catch {
        toast.error('保存失败');
        return;
      }
    }
    try {
      const h = await saveFileAs(fileName, md);
      if (h) {
        setFileHandle(h);
        setSavedMd(md);
        toast.success('已保存');
      }
    } catch {
      toast.error('另存为失败');
    }
  }, [fileHandle, fileName]);

  const saveAsAction = useCallback(async () => {
    const md = blocksToMarkdown(blocksRef.current);
    if (isCapacitor()) {
      // 手机端：弹出系统"保存到"对话框选择新位置，保存后原位置更新为所选文件
      try {
        const h = await saveFileAs(fileName, md);
        if (h) {
          setFileHandle(h);
          setSavedMd(md);
          toast.success('已另存为');
        }
      } catch (e) {
        toast.error(`另存为失败：${e instanceof Error ? e.message : String(e)}`);
      }
      return;
    }
    try {
      const h = await saveFileAs(fileName, md);
      if (h) {
        setFileHandle(h);
        setSavedMd(md);
        toast.success('已另存为');
      }
    } catch {
      toast.error('另存为失败');
    }
  }, [fileName]);

  /** 手机端分享当前文档 */
  const shareAction = useCallback(async () => {
    const md = blocksToMarkdown(blocksRef.current);
    const ok = await shareFile(fileName, md);
    if (ok) {
      toast.success('已调起分享');
    } else {
      toast.error('当前环境不支持分享');
    }
  }, [fileName]);

  const exportHtmlAction = useCallback(() => {
    const md = blocksToMarkdown(blocksRef.current);
    const css = exportThemeCss(settings.theme);
    const doc = `<!DOCTYPE html>
<html lang="zh-CN" data-theme="${settings.theme}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${fileName.replace(/\.md$/i, '')}</title>
<style>${css}</style>
</head>
<body>
${renderWholeHtml(md)}
</body>
</html>`;
    exportHtml(fileName.replace(/\.md$/i, '') + '.html', doc);
    toast.success('已导出 HTML');
  }, [fileName, settings.theme]);

  const exportPdfAction = useCallback(() => {
    window.print();
  }, []);

  const selectFileInTree = useCallback(
    async (node: IFileNode) => {
      if (node.isDir || !dirHandle) return;
      setBusy(true);
      try {
        const res = await readTreeFile(dirHandle, node.path);
        if (!res) throw new Error('read');
        pushHistory(blocksToMarkdown(blocksRef.current), currentCaretOffset());
        setBlocks(splitBlocksWithOffsets(res.content));
        setFileName(res.name);
        setFileHandle(res.handle);
        setCurrentPath(node.path);
        setSavedMd(res.content);
        store.set('lastFileName', res.name);
        updateRecent(res.name);
        toast.success(`已打开 ${res.name}`);
      } catch {
        toast.error('读取文件失败');
      } finally {
        setBusy(false);
      }
    },
    [dirHandle, pushHistory, currentCaretOffset, setBlocks, updateRecent],
  );

  const refreshTree = useCallback(async () => {
    if (!dirHandle) return;
    try {
      setDirTree(await readDirTree(dirHandle));
    } catch {
      /* 忽略刷新失败 */
    }
  }, [dirHandle]);

  const createFileAction = useCallback(
    async (parentPath: string, name: string) => {
      if (!dirHandle) return null;
      try {
        const dir = await resolveDirHandle(dirHandle, parentPath);
        if (!dir) throw new Error('dir');
        const handle = await createFileInDir(dir, name);
        if (handle) await refreshTree();
        return handle;
      } catch {
        toast.error('新建文件失败');
        return null;
      }
    },
    [dirHandle, refreshTree],
  );

  const createDirAction = useCallback(
    async (parentPath: string, name: string) => {
      if (!dirHandle) return null;
      try {
        const dir = await resolveDirHandle(dirHandle, parentPath);
        if (!dir) throw new Error('dir');
        const handle = await createDirInDir(dir, name);
        if (handle) await refreshTree();
        return handle;
      } catch {
        toast.error('新建文件夹失败');
        return null;
      }
    },
    [dirHandle, refreshTree],
  );

  const removeEntryAction = useCallback(
    async (parentPath: string, name: string) => {
      if (!dirHandle) return;
      try {
        const dir = await resolveDirHandle(dirHandle, parentPath);
        if (!dir) throw new Error('dir');
        await removeEntryFrom(dir, name);
        await refreshTree();
        toast.success(`已删除 ${name}`);
      } catch {
        toast.error('删除失败');
      }
    },
    [dirHandle, refreshTree],
  );

  const renameEntryAction = useCallback(
    async (parentPath: string, oldName: string, newName: string) => {
      if (!dirHandle) return false;
      try {
        const dir = await resolveDirHandle(dirHandle, parentPath);
        if (!dir) throw new Error('dir');
        const ok = await renameEntryIn(dir, oldName, newName);
        if (ok) await refreshTree();
        return ok;
      } catch {
        return false;
      }
    },
    [dirHandle, refreshTree],
  );

  /* ---------------- 设置与视图 ---------------- */
  const sourceValueRef = useRef(sourceValue);
  useLayoutEffect(() => {
    sourceValueRef.current = sourceValue;
  }, [sourceValue]);

  const toggleMode = useCallback(() => {
    if (mode === 'wysiwyg') {
      setSourceValue(blocksToMarkdown(blocksRef.current));
      setMode('source');
    } else {
      setBlocks(splitBlocksWithOffsets(sourceValueRef.current));
      setMode('wysiwyg');
    }
  }, [mode, setBlocks]);

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);
  const openFind = useCallback(() => setFindOpen(true), []);

  const handleSourceChange = useCallback(
    (value: string) => {
      pushHistory(sourceValueRef.current, sourceRef.current?.selectionStart ?? 0);
      setSourceValue(value);
    },
    [pushHistory],
  );

  /* ---------------- 自动保存草稿 ---------------- */
  useEffect(() => {
    const t = setTimeout(() => {
      store.set('draft', { md: fullMd, at: Date.now() });
    }, 600);
    return () => clearTimeout(t);
  }, [fullMd]);

  /* ---------------- 快捷键 ---------------- */
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyHandlerRef.current = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      const shift = e.shiftKey;
      const alt = e.altKey;

      const handle = (fn: () => void) => {
        e.preventDefault();
        fn();
      };

      if (mod && !alt) {
        switch (k) {
          case 'n':
            handle(newFile);
            return;
          case 'o':
            handle(() => void (shift ? openFolderAction() : openFileAction()));
            return;
          case 's':
            handle(() => void (shift ? saveAsAction() : saveAction()));
            return;
          case 'z':
            handle(() => (shift ? redo() : undo()));
            return;
          case 'y':
            handle(redo);
            return;
          case 'f':
            handle(openFind);
            return;
          case 'h':
            handle(openFind);
            return;
          case 'b':
            handle(() => formatAction('bold'));
            return;
          case 'i':
            handle(() => formatAction('italic'));
            return;
          case 'u':
            handle(() => formatAction('underline'));
            return;
          case 'k':
            handle(() => formatAction(shift ? 'image' : 'link'));
            return;
          case '1':
          case '2':
          case '3':
          case '4':
          case '5':
          case '6':
            handle(() => formatAction(`h${k}` as IFormatAction));
            return;
          case '0':
            handle(() => formatAction('paragraph'));
            return;
          case '/':
            handle(toggleMode);
            return;
          case 'l':
            handle(toggleSidebar);
            return;
          case '`':
            handle(() => formatAction('inline-code'));
            return;
          case 'q':
            if (shift) handle(() => formatAction('quote'));
            return;
          case 'c':
            if (shift) handle(() => formatAction('code-block'));
            return;
          case 't':
            if (shift) handle(() => formatAction('table'));
            return;
          case '[':
            if (shift) handle(() => formatAction('ul'));
            return;
          case ']':
            if (shift) handle(() => formatAction('ol'));
            return;
          case 'x':
            if (shift) handle(() => formatAction('task'));
            return;
          case 'm':
            if (shift) handle(() => formatAction('math'));
            return;
          case '-':
            if (shift) handle(() => formatAction('hr'));
            return;
          default:
            break;
        }
      }
      if (alt && shift) {
        if (k === '5') {
          handle(() => formatAction('strike'));
          return;
        }
      }
      if (!mod && k === 'f8') {
        handle(() => updateSettings({ focusMode: !settings.focusMode }));
        return;
      }
      if (!mod && k === 'f9') {
        handle(() => updateSettings({ typewriterMode: !settings.typewriterMode }));
        return;
      }
      if (e.key === 'Escape') {
        clearFind();
      }
    };
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => keyHandlerRef.current(e);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  /* ---------------- 打字机模式跟随 ---------------- */
  useEffect(() => {
    if (!settings.typewriterMode || mode !== 'wysiwyg') return;
    const root = editorRef.current;
    if (!root) return;
    const caret = getCaretInBlock(root);
    if (!caret) return;
    const el = root.querySelector<HTMLElement>(`[data-block-idx="${caret.blockIdx}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [blocks, mode, settings.typewriterMode]);

  return {
    editorRef,
    sourceRef,
    blocks,
    sourceValue,
    fullMd,
    mode,
    fileName,
    dirty,
    settings,
    stats,
    outline,
    dirTree,
    dirRootName,
    currentPath,
    sidebarOpen,
    sidebarView,
    findOpen,
    find,
    undoDepth,
    redoDepth,
    busy,
    setSidebarView,
    setFindOpen,
    setFind,
    setSidebarOpen,
    updateSettings,
    toggleMode,
    toggleSidebar,
    handleEditorInput,
    handleSourceChange,
    formatAction,
    undo,
    redo,
    newFile,
    openFileAction,
    openFolderAction,
    saveAction,
    saveAsAction,
    shareAction,
    exportHtmlAction,
    exportPdfAction,
    selectFileInTree,
    refreshTree,
    createFileAction,
    createDirAction,
    removeEntryAction,
    renameEntryAction,
    findInput,
    findNext,
    findPrev,
    replaceOne,
    replaceAll,
    clearFind,
    scrollToOffset,
  };
}
