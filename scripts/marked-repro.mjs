// 复现 marked "Token with 'list' type was not found" 并验证修复
import { marked } from 'marked';

const customRendererOld = {
  listitem(token) {
    if (token.task) {
      return `<li class="task-list-item">${this.parser.parseInline(token.tokens)}</li>\n`;
    }
    return `<li>${this.parser.parseInline(token.tokens)}</li>\n`;
  },
};

const customRendererNew = {
  listitem(token) {
    if (token.task) {
      return `<li class="task-list-item">${this.parser.parse(token.tokens)}</li>\n`;
    }
    return `<li>${this.parser.parse(token.tokens)}</li>\n`;
  },
};

const cases = [
  '- 外层列表项\n  - 嵌套列表项',
  '- 第一项\n\n  第二段内容',
  '- [x] 已完成任务\n- [ ] 未完成任务',
  '- 简单列表\n- 第二项',
  '> 引用\n>\n> - 引用内列表',
  '1. 有序\n2. 列表\n   - 嵌套无序',
];

function tryParse(renderer, md) {
  try {
    const m = marked.use({ gfm: true, breaks: true, renderer });
    return m.parse(md);
  } catch (e) {
    return `ERROR: ${e.message}`;
  }
}

for (const md of cases) {
  const old = tryParse({ ...customRendererOld }, md);
  const neu = tryParse({ ...customRendererNew }, md);
  console.log('CASE:', JSON.stringify(md.split('\n')[0]));
  console.log('  OLD(parseInline):', old.startsWith('ERROR') ? old : 'OK ' + old.slice(0, 60).replace(/\n/g, ' '));
  console.log('  NEW(parse):     ', neu.startsWith('ERROR') ? neu : 'OK ' + neu.slice(0, 60).replace(/\n/g, ' '));
}
