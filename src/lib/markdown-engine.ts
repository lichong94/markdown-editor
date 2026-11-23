// EXPORTS: escapeHtml, renderBlockMd, renderWholeHtml, blockHtmlToMd, postProcessRendered, exportThemeCss

import {
  marked,
  type RendererObject,
  type Tokens,
  type TokenizerAndRendererExtension,
} from 'marked';
import TurndownService from 'turndown';
import DOMPurify from 'dompurify';
import katex from 'katex';
import 'katex/dist/katex.min.css';
// 按需注册常用语言，避免全量 highlight.js（900KB+）拖慢启动
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import sql from 'highlight.js/lib/languages/sql';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import php from 'highlight.js/lib/languages/php';
import markdown from 'highlight.js/lib/languages/markdown';
import yaml from 'highlight.js/lib/languages/yaml';
import ini from 'highlight.js/lib/languages/ini';
import diff from 'highlight.js/lib/languages/diff';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import powershell from 'highlight.js/lib/languages/powershell';
import ruby from 'highlight.js/lib/languages/ruby';
import swift from 'highlight.js/lib/languages/swift';
import kotlin from 'highlight.js/lib/languages/kotlin';
import lua from 'highlight.js/lib/languages/lua';
import perl from 'highlight.js/lib/languages/perl';
import r from 'highlight.js/lib/languages/r';
import objectivec from 'highlight.js/lib/languages/objectivec';
import dart from 'highlight.js/lib/languages/dart';
import scala from 'highlight.js/lib/languages/scala';
import haskell from 'highlight.js/lib/languages/haskell';
import plaintext from 'highlight.js/lib/languages/plaintext';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('java', java);
hljs.registerLanguage('c', c);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('css', css);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('php', php);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('ini', ini);
hljs.registerLanguage('diff', diff);
hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('powershell', powershell);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('swift', swift);
hljs.registerLanguage('kotlin', kotlin);
hljs.registerLanguage('lua', lua);
hljs.registerLanguage('perl', perl);
hljs.registerLanguage('r', r);
hljs.registerLanguage('objectivec', objectivec);
hljs.registerLanguage('dart', dart);
hljs.registerLanguage('scala', scala);
hljs.registerLanguage('haskell', haskell);
hljs.registerLanguage('plaintext', plaintext);

/** HTML 转义 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ---------- MathML 标签（KaTeX 输出，需放行） ---------- */
const MATHML_TAGS = [
  'math', 'annotation', 'semantics', 'mtext', 'mn', 'mo', 'mi', 'msub', 'msup',
  'msubsup', 'mfrac', 'msqrt', 'mroot', 'mrow', 'mtd', 'mtr', 'mtable', 'mspace',
  'mphantom', 'mpadded', 'menclose', 'merror', 'mfenced', 'mglyph', 'mlabeledtr',
  'mmultiscripts', 'mover', 'munder', 'munderover', 'mstyle', 'mprescripts', 'none',
];

type IExtToken = { type: string; raw: string; text?: string | string[]; id?: string };

/* ---------- 数学公式扩展（块级 $$...$$ 与行内 $...$，输出占位供 KaTeX 后渲染） ---------- */
const blockMathExt: TokenizerAndRendererExtension = {
  name: 'math-block',
  level: 'block',
  start(src: string) {
    const m = /^\$\$/.exec(src);
    return m ? m.index : undefined;
  },
  tokenizer(src: string) {
    const cap = /^\$\$([\s\S]+?)\$\$/.exec(src);
    if (cap) {
      return { type: 'math-block', raw: cap[0], text: cap[1].trim() };
    }
    return undefined;
  },
  renderer(token: Tokens.Generic) {
    const text = (token as IExtToken).text ?? '';
    return `<div class="math-block" data-src="${escapeHtml(String(text))}">${escapeHtml(String(text))}</div>`;
  },
};

const inlineMathExt: TokenizerAndRendererExtension = {
  name: 'math-inline',
  level: 'inline',
  start(src: string) {
    const m = /\$/.exec(src);
    return m ? m.index : undefined;
  },
  tokenizer(src: string) {
    const cap = /^\$([^$\n]+?)\$/.exec(src);
    if (cap) {
      return { type: 'math-inline', raw: cap[0], text: cap[1].trim() };
    }
    return undefined;
  },
  renderer(token: Tokens.Generic) {
    const text = (token as IExtToken).text ?? '';
    return `<span class="math-inline" data-src="${escapeHtml(String(text))}">${escapeHtml(String(text))}</span>`;
  },
};

/* ---------- Typora 扩展语法：上标 ^x^ / 下标 ~x~ / 高亮 ==x== ---------- */
const superscriptExt: TokenizerAndRendererExtension = {
  name: 'superscript',
  level: 'inline',
  start(src: string) {
    const m = /\^/.exec(src);
    return m ? m.index : undefined;
  },
  tokenizer(src: string) {
    const cap = /^\^([^^\n]+)\^/.exec(src);
    if (cap) {
      return { type: 'superscript', raw: cap[0], text: cap[1] };
    }
    return undefined;
  },
  renderer(token: Tokens.Generic) {
    const text = (token as IExtToken).text ?? '';
    return `<sup>${escapeHtml(String(text))}</sup>`;
  },
};

const subscriptExt: TokenizerAndRendererExtension = {
  name: 'subscript',
  level: 'inline',
  start(src: string) {
    const m = /(?<![~])~/.exec(src);
    return m ? m.index : undefined;
  },
  tokenizer(src: string) {
    const cap = /^(?<![~])~([^~\n]+)~(?![~])/.exec(src);
    if (cap) {
      return { type: 'subscript', raw: cap[0], text: cap[1] };
    }
    return undefined;
  },
  renderer(token: Tokens.Generic) {
    const text = (token as IExtToken).text ?? '';
    return `<sub>${escapeHtml(String(text))}</sub>`;
  },
};

const highlightExt: TokenizerAndRendererExtension = {
  name: 'highlight',
  level: 'inline',
  start(src: string) {
    const m = /==/.exec(src);
    return m ? m.index : undefined;
  },
  tokenizer(src: string) {
    const cap = /^==([^=\n]+)==/.exec(src);
    if (cap) {
      return { type: 'highlight', raw: cap[0], text: cap[1] };
    }
    return undefined;
  },
  renderer(token: Tokens.Generic) {
    const text = (token as IExtToken).text ?? '';
    return `<mark>${escapeHtml(String(text))}</mark>`;
  },
};

/* ---------- 脚注扩展 ---------- */
const footnoteRefExt: TokenizerAndRendererExtension = {
  name: 'footnote-ref',
  level: 'inline',
  start(src: string) {
    const m = /\[\^/.exec(src);
    return m ? m.index : undefined;
  },
  tokenizer(src: string) {
    const cap = /^\[\^([^\]]+)\]/.exec(src);
    if (cap) {
      return { type: 'footnote-ref', raw: cap[0], id: cap[1] };
    }
    return undefined;
  },
  renderer(token: Tokens.Generic) {
    const id = escapeHtml((token as IExtToken).id ?? '');
    return `<sup><a href="#fn-${id}" id="fnref-${id}" class="footnote-ref" data-footnote-id="${id}">${id}</a></sup>`;
  },
};

const footnoteDefExt: TokenizerAndRendererExtension = {
  name: 'footnote-def',
  level: 'block',
  start(src: string) {
    const m = /^\[\^[^\]]+\]:/.exec(src);
    return m ? m.index : undefined;
  },
  tokenizer(src: string) {
    const lines = src.split('\n');
    const matched: string[] = [];
    let i = 0;
    while (i < lines.length && /^\[\^[^\]]+\]:/.test(lines[i])) {
      matched.push(lines[i]);
      i += 1;
    }
    if (matched.length === 0) {
      return undefined;
    }
    return { type: 'footnote-def', raw: matched.join('\n'), text: matched };
  },
  renderer(token: Tokens.Generic) {
    const lines = (token as IExtToken).text as string[];
    const raw = token.raw;
    const items = (lines ?? [])
      .map((line: string) => {
        const m = /^\[\^([^\]]+)\]:\s*(.*)$/.exec(line);
        if (!m) return '';
        const id = escapeHtml(m[1]);
        const content = marked.parseInline(m[2]) as string;
        return `<li id="fn-${id}">${content}<a href="#fnref-${id}" class="footnote-backref" aria-label="Back to reference">↩</a></li>`;
      })
      .join('');
    return `<div class="footnotes" data-src="${escapeHtml(raw)}"><hr class="footnotes-sep"><ol>${items}</ol></div>`;
  },
};

/* ---------- 自定义 renderer ---------- */
const customRenderer: RendererObject = {
  code(token: Tokens.Code) {
    const lang = token.lang || '';
    if (lang === 'mermaid') {
      const body = escapeHtml(token.text);
      return `<pre class="mermaid-host" data-src="${escapeHtml(token.text)}" data-lang="mermaid"><div class="mermaid">${body}</div></pre>`;
    }
    let content = escapeHtml(token.text);
    // 超长代码块跳过语法高亮，避免阻塞输入
    if (lang && hljs.getLanguage(lang) && token.text.length <= 5000) {
      try {
        content = hljs.highlight(token.text, { language: lang }).value;
      } catch {
        /* 高亮失败退回原文 */
      }
    }
    const langLabel = lang ? `<span class="code-lang">${escapeHtml(lang)}</span>` : '';
    return `<pre data-lang="${escapeHtml(lang)}"><code class="language-${escapeHtml(lang || 'plaintext')}">${content}</code>${langLabel}</pre>`;
  },

  listitem(token: Tokens.ListItem) {
    if (token.task) {
      const checked = token.checked ? 'checked' : '';
      const marker = `<span class="task-check" data-checked="${token.checked ? '1' : '0'}"></span>`;
      return `<li class="task-list-item ${checked}">${marker}${this.parser.parse(token.tokens)}</li>\n`;
    }
    return `<li>${this.parser.parse(token.tokens)}</li>\n`;
  },

  image(token: Tokens.Image) {
    const alt = escapeHtml(token.text || '');
    const src = escapeHtml(token.href);
    if (token.title) {
      return `<figure><img src="${src}" alt="${alt}" title="${escapeHtml(token.title)}"><figcaption>${escapeHtml(token.title)}</figcaption></figure>`;
    }
    return `<img src="${src}" alt="${alt}">`;
  },
};

marked.use({
  gfm: true,
  breaks: true,
  extensions: [
    blockMathExt,
    inlineMathExt,
    superscriptExt,
    subscriptExt,
    highlightExt,
    footnoteRefExt,
    footnoteDefExt,
  ],
  renderer: customRenderer,
});

const turndown = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  fence: '```',
  emDelimiter: '*',
  strongDelimiter: '**',
});

/* ---------- Turndown 自定义规则（还原 Typora 扩展语法） ---------- */
turndown.addRule('mathInline', {
  filter: (node) => node.nodeName === 'SPAN' && (node as HTMLElement).classList.contains('math-inline'),
  replacement: (_content, node) => `$${(node as HTMLElement).dataset.src ?? ''}$`,
});

turndown.addRule('mathBlock', {
  filter: (node) => node.nodeName === 'DIV' && (node as HTMLElement).classList.contains('math-block'),
  replacement: (_content, node) => `\n\n$$\n${(node as HTMLElement).dataset.src ?? ''}\n$$\n\n`,
});

turndown.addRule('mermaidHost', {
  filter: (node) => node.nodeName === 'PRE' && (node as HTMLElement).classList.contains('mermaid-host'),
  replacement: (_content, node) => `\n\n\`\`\`mermaid\n${(node as HTMLElement).dataset.src ?? ''}\n\`\`\`\n\n`,
});

turndown.addRule('footnotesBlock', {
  filter: (node) => node.nodeName === 'DIV' && (node as HTMLElement).classList.contains('footnotes'),
  replacement: (_content, node) => `\n\n${(node as HTMLElement).dataset.src ?? ''}\n\n`,
});

turndown.addRule('footnoteRef', {
  filter: (node) => node.nodeName === 'A' && (node as HTMLElement).classList.contains('footnote-ref'),
  replacement: (_content, node) => {
    const href = (node as HTMLElement).getAttribute('href') ?? '';
    const id = href.replace(/^#fn-/, '');
    return `[^${id}]`;
  },
});

turndown.addRule('figureImage', {
  filter: 'figure',
  replacement: (_content, node) => {
    const figure = node as HTMLElement;
    const img = figure.querySelector('img');
    const caption = figure.querySelector('figcaption');
    if (!img) return '';
    const alt = img.getAttribute('alt') ?? '';
    const src = img.getAttribute('src') ?? '';
    const title = caption ? caption.textContent ?? '' : img.getAttribute('title') ?? '';
    return `![${alt}](${src}${title ? ` "${title}"` : ''})`;
  },
});

turndown.addRule('taskCheck', {
  filter: (node) => node.nodeName === 'SPAN' && (node as HTMLElement).classList.contains('task-check'),
  replacement: (_content, node) => ((node as HTMLElement).dataset.checked === '1' ? '[x] ' : '[ ] '),
});

turndown.addRule('underline', {
  filter: 'u',
  replacement: (content) => `<u>${content}</u>`,
});

turndown.addRule('markKeep', {
  filter: 'mark',
  replacement: (content) => `==${content}==`,
});

turndown.addRule('superscriptKeep', {
  filter: 'sup',
  replacement: (content) => `^${content}^`,
});

turndown.addRule('subscriptKeep', {
  filter: 'sub',
  replacement: (content) => `~${content}~`,
});

turndown.addRule('kbdKeep', {
  filter: 'kbd',
  replacement: (content) => `<kbd>${content}</kbd>`,
});

turndown.addRule('codeLangLabel', {
  filter: (node) => node.nodeName === 'SPAN' && (node as HTMLElement).classList.contains('code-lang'),
  replacement: () => '',
});

/* ---------- 渲染管线 ---------- */

/** 单个 markdown 块 → 净化后的 HTML */
export function renderBlockMd(md: string): string {
  const rawHtml = marked.parse(md) as string;
  return DOMPurify.sanitize(rawHtml, {
    ADD_TAGS: MATHML_TAGS,
    ADD_ATTR: ['data-src', 'data-lang', 'data-checked', 'target', 'rel'],
  });
}

/** 整个文档 → HTML（用于导出） */
export function renderWholeHtml(md: string): string {
  const body = renderBlockMd(md);
  return `<div class="ed-editor-body md-export-root">${body}</div>`;
}

/** 将块 DOM 还原为 markdown 源码 */
export function blockHtmlToMd(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement;
  return turndown.turndown(clone).trim();
}

/** 渲染后处理：KaTeX 公式 + Mermaid 图（在 DOM 插入后调用） */
export function postProcessRendered(root: HTMLElement): void {
  const mathEls = root.querySelectorAll<HTMLElement>('.math-inline, .math-block');
  mathEls.forEach((el) => {
    const src = el.dataset.src ?? '';
    try {
      katex.render(src, el, {
        throwOnError: false,
        displayMode: el.classList.contains('math-block'),
      });
    } catch {
      el.textContent = src;
    }
  });

  const mermaidNodes = root.querySelectorAll<HTMLElement>('.mermaid-host .mermaid');
  if (mermaidNodes.length > 0) {
    void import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
      void mermaid
        .run({ nodes: Array.from(mermaidNodes) })
        .catch(() => {
          /* 图表语法错误时保留源码 */
        });
    });
  }
}

/** 供导出使用的当前主题 CSS 文本（由 vite ?inline 注入） */
import themesCss from '@/editor-themes.css?inline';
import katexCssText from 'katex/dist/katex.min.css?inline';

export function exportThemeCss(_theme: string): string {
  return `${themesCss}\n${katexCssText}`;
}
