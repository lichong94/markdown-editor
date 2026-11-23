// EXPORTS: transformMarkdown, ITransformResult
import type { IFormatAction } from '@/data/types';

export interface ITransformResult {
  md: string;
  caret: number;
}

/** 对 markdown 全文执行格式操作（纯函数，返回新 md 与光标位置） */
export function transformMarkdown(
  md: string,
  start: number,
  end: number,
  action: IFormatAction,
): ITransformResult | null {
  switch (action) {
    case 'bold':
      return wrapInline(md, start, end, '**');
    case 'italic':
      return wrapInline(md, start, end, '*');
    case 'underline':
      return wrapInline(md, start, end, '<u>', '</u>');
    case 'strike':
      return wrapInline(md, start, end, '~~');
    case 'highlight':
      return wrapInline(md, start, end, '==');
    case 'superscript':
      return wrapInline(md, start, end, '^');
    case 'subscript':
      return wrapInline(md, start, end, '~');
    case 'inline-code':
      return wrapInline(md, start, end, '`');
    case 'link':
      return wrapLink(md, start, end);
    case 'image':
      return insertAt(md, start, '![]()', 4);
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return setHeading(md, start, Number(action[1]));
    case 'paragraph':
      return clearBlockMarkers(md, start, end);
    case 'quote':
      return prefixLines(md, start, end, '> ');
    case 'ul':
      return prefixLines(md, start, end, '- ');
    case 'ol':
      return prefixLines(md, start, end, '1. ');
    case 'task':
      return taskList(md, start, end);
    case 'code-block':
      return wrapCodeBlock(md, start);
    case 'table':
      return insertAt(md, start, '\n\n| 列 1 | 列 2 | 列 3 |\n| --- | --- | --- |\n|  |  |  |\n\n', 3);
    case 'hr':
      return insertAt(md, start, '\n\n---\n\n', 4);
    case 'footnote':
      return insertFootnote(md, start);
    case 'math':
      return insertAt(md, start, '\n\n$$\n\n$$\n\n', 4);
    case 'clear':
      return clearBlockMarkers(md, start, end);
    default:
      return null;
  }
}

/** 在 pos 处插入字符串，返回光标位于 insert 内 offset 处 */
function insertAt(md: string, pos: number, insert: string, caretInInsert: number): ITransformResult {
  return { md: md.slice(0, pos) + insert + md.slice(pos), caret: pos + caretInInsert };
}

/** 行内包裹（再次操作时解除） */
function wrapInline(
  md: string,
  start: number,
  end: number,
  open: string,
  close = open,
): ITransformResult {
  const sel = md.slice(start, end);
  if (sel.length === 0) {
    return { md: md.slice(0, start) + open + close + md.slice(end), caret: start + open.length };
  }
  const before = md.slice(0, start);
  const after = md.slice(end);
  if (before.endsWith(open) && after.startsWith(close)) {
    return {
      md: before.slice(0, -open.length) + sel + after.slice(close.length),
      caret: start - open.length,
    };
  }
  return { md: before + open + sel + close + after, caret: start + open.length };
}

/** 链接：有选区 → [选区](url)；无选区 → [text](url)，光标落在 url 内 */
function wrapLink(md: string, start: number, end: number): ITransformResult {
  const sel = md.slice(start, end);
  if (sel.length > 0) {
    return {
      md: md.slice(0, start) + `[${sel}](url)` + md.slice(end),
      caret: start + sel.length + 3,
    };
  }
  return { md: md.slice(0, start) + '[text](url)' + md.slice(start), caret: start + 7 };
}

function lineBounds(md: string, pos: number): { ls: number; le: number } {
  const ls = md.lastIndexOf('\n', Math.max(0, pos - 1)) + 1;
  let le = md.indexOf('\n', pos);
  if (le === -1) le = md.length;
  return { ls, le };
}

/** 应用/切换标题级别 */
function setHeading(md: string, start: number, level: number): ITransformResult {
  const { ls, le } = lineBounds(md, start);
  const line = md.slice(ls, le);
  const clean = line.replace(/^#{1,6}\s*/, '');
  const removed = line.length - clean.length;
  const prefix = '#'.repeat(level) + ' ';
  const rel = start - ls;
  const caret = ls + prefix.length + Math.max(0, rel - removed);
  return { md: md.slice(0, ls) + prefix + clean + md.slice(le), caret };
}

/** 给选区涉及的行加前缀（已全部有该前缀则移除） */
function prefixLines(md: string, start: number, end: number, prefix: string): ITransformResult {
  const sLs = lineBounds(md, start).ls;
  const eLe = lineBounds(md, Math.max(start, end - 1)).le;
  const chunk = md.slice(sLs, eLe);
  const lines = chunk.split('\n');
  const allPrefixed = lines.length > 0 && lines.every((l) => l.startsWith(prefix));
  const nextLines = lines.map((l) => (allPrefixed ? l.slice(prefix.length) : prefix + l));
  const next = md.slice(0, sLs) + nextLines.join('\n') + md.slice(eLe);
  const caret = Math.max(0, start + (allPrefixed ? -prefix.length : prefix.length));
  return { md: next, caret };
}

/** 任务列表切换 */
function taskList(md: string, start: number, end: number): ITransformResult {
  const sLs = lineBounds(md, start).ls;
  const eLe = lineBounds(md, Math.max(start, end - 1)).le;
  const chunk = md.slice(sLs, eLe);
  const lines = chunk.split('\n');
  const isTask = (l: string) => /^-\s+\[[ xX]\]\s*/.test(l);
  const allTask = lines.length > 0 && lines.every(isTask);
  const nextLines = lines.map((l) => {
    if (allTask) return l.replace(/^-\s+\[[ xX]\]\s*/, '');
    if (isTask(l)) return l;
    return `- [ ] ${l}`;
  });
  const next = md.slice(0, sLs) + nextLines.join('\n') + md.slice(eLe);
  const caret = Math.max(0, start + (allTask ? -6 : 6));
  return { md: next, caret };
}

/** 包裹/解除围栏代码块（以空行分隔的当前块） */
function wrapCodeBlock(md: string, start: number): ITransformResult {
  const { ls } = lineBounds(md, start);
  const blockStart = md.lastIndexOf('\n\n', Math.max(0, ls - 1)) + 2;
  let blockEnd = md.indexOf('\n\n', ls);
  if (blockEnd === -1) blockEnd = md.length;
  const block = md.slice(blockStart, blockEnd);
  const fenceMatch = block.match(/^```\w*\n([\s\S]*?)\n```$/);
  if (fenceMatch) {
    const inner = fenceMatch[1];
    const next = md.slice(0, blockStart) + inner + md.slice(blockEnd);
    const caret = Math.min(start, blockStart + inner.length);
    return { md: next, caret };
  }
  const next = md.slice(0, blockStart) + '```\n' + block + '\n```' + md.slice(blockEnd);
  const caret = blockStart + 4 + (start - blockStart);
  return { md: next, caret };
}

/** 插入脚注引用（编号自动递增） */
function insertFootnote(md: string, pos: number): ITransformResult {
  const ids = Array.from(md.matchAll(/\[\^(\d+)\]/g), (m) => Number(m[1]));
  const next = ids.length > 0 ? Math.max(...ids) + 1 : 1;
  return { md: md.slice(0, pos) + `[^${next}]` + md.slice(pos), caret: pos + 3 + String(next).length };
}

/** 清除选区行的块级标记（标题/引用/列表/任务） */
function clearBlockMarkers(md: string, start: number, end: number): ITransformResult {
  const sLs = lineBounds(md, start).ls;
  const eLe = lineBounds(md, Math.max(start, end - 1)).le;
  const chunk = md.slice(sLs, eLe);
  const pattern = /^(#{1,6}\s*|>\s*|-\s+\[[ xX]\]\s*|[-*+]\s+|\d+\.\s+)/;
  const lines = chunk.split('\n').map((l) => l.replace(pattern, ''));
  const next = md.slice(0, sLs) + lines.join('\n') + md.slice(eLe);
  return { md: next, caret: start };
}
