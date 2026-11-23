// EXPORTS: getCaretInBlock, setCaretInBlock, getSelectionInBlock, setSelectionInBlock, getBlockIndexAtNode
import type { ICaretPos } from '@/data/types';

const BLOCK_SELECTOR = '[data-block-idx]';

/** 获取某个节点所在块索引 */
export function getBlockIndexAtNode(node: Node): number | null {
  const el =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as HTMLElement)
      : (node.parentElement as HTMLElement | null);
  const blockEl = el?.closest<HTMLElement>(BLOCK_SELECTOR) ?? null;
  if (!blockEl) return null;
  const idx = blockEl.getAttribute('data-block-idx');
  return idx === null ? null : Number(idx);
}

/** 读取当前光标（折叠）所在块与块内字符偏移 */
export function getCaretInBlock(root: HTMLElement): ICaretPos | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.anchorNode || !root.contains(sel.anchorNode)) {
    return null;
  }
  const blockIdx = getBlockIndexAtNode(sel.anchorNode);
  if (blockIdx === null) return null;
  const blockEl = root.querySelector<HTMLElement>(`${BLOCK_SELECTOR}="${blockIdx}"`);
  if (!blockEl) return null;
  const offset = textOffsetTo(blockEl, sel.anchorNode, sel.anchorOffset);
  return { blockIdx, offset };
}

/** 读取当前选区（起止）所在块与块内字符偏移 */
export function getSelectionInBlock(
  root: HTMLElement,
): { blockIdx: number; start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.anchorNode || !root.contains(sel.anchorNode)) {
    return null;
  }
  const blockIdx = getBlockIndexAtNode(sel.anchorNode);
  if (blockIdx === null) return null;
  const blockEl = root.querySelector<HTMLElement>(`${BLOCK_SELECTOR}="${blockIdx}"`);
  if (!blockEl) return null;
  const start = textOffsetTo(blockEl, sel.anchorNode, sel.anchorOffset);
  const end = textOffsetTo(blockEl, sel.focusNode, sel.focusOffset);
  return { blockIdx, start: Math.min(start, end), end: Math.max(start, end) };
}

/** 计算 root 到 (node, offset) 的文本长度（含嵌套） */
function textOffsetTo(root: Node, node: Node, offsetInNode: number): number {
  const range = document.createRange();
  range.setStart(root, 0);
  try {
    range.setEnd(node, offsetInNode);
  } catch {
    return 0;
  }
  return range.toString().length;
}

/** 将光标恢复到 (blockIdx, offset) */
export function setCaretInBlock(root: HTMLElement, blockIdx: number, offset: number): boolean {
  const blockEl = root.querySelector<HTMLElement>(`${BLOCK_SELECTOR}="${blockIdx}"`);
  if (!blockEl) return false;
  const range = createRangeAtOffset(blockEl, offset);
  const sel = window.getSelection();
  if (!sel) return false;
  sel.removeAllRanges();
  sel.addRange(range);
  return true;
}

/** 将选区恢复到 (blockIdx, start, end) */
export function setSelectionInBlock(
  root: HTMLElement,
  blockIdx: number,
  start: number,
  end: number,
): boolean {
  const blockEl = root.querySelector<HTMLElement>(`${BLOCK_SELECTOR}="${blockIdx}"`);
  if (!blockEl) return false;
  const sel = window.getSelection();
  if (!sel) return false;
  sel.removeAllRanges();
  const rangeStart = createRangeAtOffset(blockEl, start);
  sel.addRange(rangeStart);
  if (end !== start) {
    const rangeEnd = createRangeAtOffset(blockEl, end);
    sel.removeAllRanges();
    sel.addRange(rangeStart);
    sel.extend(rangeEnd.startContainer, rangeEnd.startOffset);
  }
  return true;
}

/** 在块元素内按字符偏移创建折叠 range */
function createRangeAtOffset(blockEl: HTMLElement, offset: number): Range {
  const walker = document.createTreeWalker(blockEl, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let node: Node | null = walker.nextNode();
  let acc = 0;
  while (node) {
    const len = node.textContent?.length ?? 0;
    if (acc + len >= offset) {
      range.setStart(node, Math.min(offset - acc, len));
      range.collapse(true);
      return range;
    }
    acc += len;
    node = walker.nextNode();
  }
  // 无文本或偏移超界：放到末尾
  range.selectNodeContents(blockEl);
  range.collapse(false);
  return range;
}
