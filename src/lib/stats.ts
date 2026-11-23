// EXPORTS: countStats, ITextStats

export interface ITextStats {
  /** 中文字符 + 英文单词数（Typora 的「字数」口径） */
  words: number;
  /** 全部字符数 */
  chars: number;
  /** 段落数（以空行分隔） */
  paragraphs: number;
  /** 行数 */
  lines: number;
}

export function countStats(text: string): ITextStats {
  const trimmed = text.trim();
  // 中文字符（含全角标点按字符计）
  const cjk = (trimmed.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) ?? []).length;
  // 英文单词
  const latinWords = (trimmed.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) ?? []).length;
  const words = cjk + latinWords;
  const chars = trimmed.replace(/\s/g, '').length;
  const paragraphs = trimmed.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;
  const lines = trimmed.length === 0 ? 0 : text.split('\n').length;
  return { words, chars, paragraphs, lines };
}
