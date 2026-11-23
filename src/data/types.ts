// EXPORTS: IThemeId, ISourceMode, ISidebarView, IFileNode, IRecentFile, IEditorSettings, IBlock, ICaretPos, IOutlineItem, IFindMatch, IFindState, IFormatAction

export type IThemeId = 'github' | 'newsprint' | 'night' | 'night-plus';

export type ISourceMode = 'wysiwyg' | 'source';

export type ISidebarView = 'files' | 'outline';

export interface IFileNode {
  name: string;
  /** 目录内相对路径，根目录用 '.' */
  path: string;
  isDir: boolean;
  children?: IFileNode[];
}

export interface IRecentFile {
  name: string;
  path: string;
  lastOpened: number;
}

export interface IEditorSettings {
  theme: IThemeId;
  fontSize: number;
  sidebarWidth: number;
  /** 专注模式：隐藏侧边栏与状态栏 */
  focusMode: boolean;
  /** 打字机模式：光标所在段落垂直居中 */
  typewriterMode: boolean;
  spellcheck: boolean;
  /** 最近一次打开的文件名（用于欢迎页提示） */
  lastFileName?: string;
  /** 最近访问过的文件句柄不可跨会话保留，仅记录路径用于展示 */
  recentFiles: IRecentFile[];
}

export interface IBlock {
  /** 块的 markdown 源码（不含分隔空行） */
  text: string;
  /** 块在全文 md 中的起始偏移 */
  start: number;
  /** 块在全文 md 中的结束偏移（不含尾部空行） */
  end: number;
}

export interface ICaretPos {
  blockIdx: number;
  /** 在块文本中的字符偏移 */
  offset: number;
}

export interface IOutlineItem {
  level: number;
  text: string;
  blockIdx: number;
}

export interface IFindMatch {
  offset: number;
  length: number;
}

export interface IFindState {
  query: string;
  replaceWith: string;
  caseSensitive: boolean;
  matchIndex: number;
  matches: IFindMatch[];
}

/** 格式操作类型（菜单 / 快捷键共用） */
export type IFormatAction =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'highlight'
  | 'superscript'
  | 'subscript'
  | 'inline-code'
  | 'link'
  | 'image'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'h4'
  | 'h5'
  | 'h6'
  | 'paragraph'
  | 'quote'
  | 'code-block'
  | 'ul'
  | 'ol'
  | 'task'
  | 'table'
  | 'hr'
  | 'footnote'
  | 'math'
  | 'clear';
