// EXPORTS: splitBlocks, blocksToMarkdown, splitBlocksWithOffsets
import type { IBlock } from '@/data/types';

/**
 * 将 markdown 源码切分为块：
 * - 以空行分隔（保护围栏代码块与 $$ 数学块内部的空行）
 * - 块之间用 '\n\n' 规范化分隔
 */
export function splitBlocks(md: string): IBlock[] {
  const lines = md.split('\n');
  const blocks: IBlock[] = [];
  let buf: string[] = [];
  let fence: string | null = null;
  let mathOpen = false;

  const flush = () => {
    if (buf.length > 0) {
      blocks.push({ text: buf.join('\n'), start: 0, end: 0 });
      buf = [];
    }
  };

  for (const line of lines) {
    const t = line.trim();
    if (fence !== null) {
      buf.push(line);
      if (t.startsWith(fence)) fence = null;
      continue;
    }
    if (mathOpen) {
      buf.push(line);
      if (t === '$$') mathOpen = false;
      continue;
    }
    if (/^(```|~~~)/.test(t)) {
      flush();
      fence = t.slice(0, 3);
      buf.push(line);
      continue;
    }
    if (t === '$$') {
      flush();
      mathOpen = true;
      buf.push(line);
      continue;
    }
    if (t === '') {
      flush();
      continue;
    }
    buf.push(line);
  }
  flush();
  return blocks;
}

/** 将块列表拼接为规范化的 markdown 全文 */
export function blocksToMarkdown(blocks: IBlock[]): string {
  return blocks.map((b) => b.text).join('\n\n');
}

/** 切分并计算每个块在拼接全文中的 start/end 偏移 */
export function splitBlocksWithOffsets(md: string): IBlock[] {
  const blocks = splitBlocks(md);
  let offset = 0;
  return blocks.map((b) => {
    const start = offset;
    offset += b.text.length;
    const end = offset;
    offset += 2; // '\n\n' 分隔
    return { text: b.text, start, end };
  });
}
