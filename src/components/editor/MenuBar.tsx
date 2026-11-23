import { useEffect, useRef, useState } from 'react';
import { Menu } from 'lucide-react';
import type { EditorApi } from '@/hooks/useEditor';
import type { IThemeId } from '@/data/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface IMenuItem {
  label?: string;
  shortcut?: string;
  action?: () => void;
  divider?: boolean;
  disabled?: boolean;
  checked?: boolean;
  radio?: string;
}

interface IMenuGroup {
  key: string;
  title: string;
  items: IMenuItem[];
}

const THEMES: { id: IThemeId; label: string }[] = [
  { id: 'github', label: 'GitHub' },
  { id: 'newsprint', label: 'Newsprint' },
  { id: 'night', label: 'Night' },
  { id: 'night-plus', label: 'Night+' },
];

export default function MenuBar({ api, isMobile = false }: { api: EditorApi; isMobile?: boolean }) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [helpDialog, setHelpDialog] = useState<'shortcuts' | 'about' | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  };

  const groups: IMenuGroup[] = [
    {
      key: 'file',
      title: '文件',
      items: isMobile
        ? [
            { label: '新建', action: api.newFile },
            { label: '打开文件…', action: () => void api.openFileAction() },
            { divider: true },
            { label: '保存 / 导出', action: () => void api.saveAction() },
            { label: '另存为…', action: () => void api.saveAsAction() },
            { label: '分享…', action: () => void api.shareAction() },
            { divider: true },
            { label: '导出 HTML…', action: api.exportHtmlAction },
            { label: '导出 PDF…', action: api.exportPdfAction },
          ]
        : [
            { label: '新建', shortcut: 'Ctrl+N', action: api.newFile },
            { label: '打开文件…', shortcut: 'Ctrl+O', action: () => void api.openFileAction() },
            { label: '打开文件夹…', shortcut: 'Ctrl+Shift+O', action: () => void api.openFolderAction() },
            { divider: true },
            { label: '保存', shortcut: 'Ctrl+S', action: () => void api.saveAction() },
            { label: '另存为…', shortcut: 'Ctrl+Shift+S', action: () => void api.saveAsAction() },
            { divider: true },
            { label: '导出 HTML…', action: api.exportHtmlAction },
            { label: '导出 PDF…', action: api.exportPdfAction },
          ],
    },
    {
      key: 'edit',
      title: '编辑',
      items: [
        { label: '撤销', shortcut: 'Ctrl+Z', action: api.undo, disabled: api.undoDepth === 0 },
        { label: '重做', shortcut: 'Ctrl+Y', action: api.redo, disabled: api.redoDepth === 0 },
        { divider: true },
        { label: '查找', shortcut: 'Ctrl+F', action: () => api.setFindOpen(true) },
        { label: '替换', shortcut: 'Ctrl+H', action: () => api.setFindOpen(true) },
        { divider: true },
        {
          label: '全选',
          shortcut: 'Ctrl+A',
          action: () => {
            if (api.mode === 'source') {
              api.sourceRef.current?.focus();
              api.sourceRef.current?.select();
            } else {
              api.editorRef.current?.focus();
              document.execCommand('selectAll');
            }
          },
        },
      ],
    },
    {
      key: 'paragraph',
      title: '段落',
      items: [
        { label: '一级标题', shortcut: 'Ctrl+1', action: () => api.formatAction('h1') },
        { label: '二级标题', shortcut: 'Ctrl+2', action: () => api.formatAction('h2') },
        { label: '三级标题', shortcut: 'Ctrl+3', action: () => api.formatAction('h3') },
        { label: '四级标题', shortcut: 'Ctrl+4', action: () => api.formatAction('h4') },
        { label: '五级标题', shortcut: 'Ctrl+5', action: () => api.formatAction('h5') },
        { label: '六级标题', shortcut: 'Ctrl+6', action: () => api.formatAction('h6') },
        { label: '正文', shortcut: 'Ctrl+0', action: () => api.formatAction('paragraph') },
        { divider: true },
        { label: '引用块', shortcut: 'Ctrl+Shift+Q', action: () => api.formatAction('quote') },
        { label: '代码块', shortcut: 'Ctrl+Shift+C', action: () => api.formatAction('code-block') },
        { label: '无序列表', shortcut: 'Ctrl+Shift+]', action: () => api.formatAction('ul') },
        { label: '有序列表', shortcut: 'Ctrl+Shift+[', action: () => api.formatAction('ol') },
        { label: '任务列表', shortcut: 'Ctrl+Shift+X', action: () => api.formatAction('task') },
        { divider: true },
        { label: '表格', shortcut: 'Ctrl+Shift+T', action: () => api.formatAction('table') },
        { label: '分割线', shortcut: 'Ctrl+Shift+-', action: () => api.formatAction('hr') },
        { label: '脚注', action: () => api.formatAction('footnote') },
        { label: '数学公式', shortcut: 'Ctrl+Shift+M', action: () => api.formatAction('math') },
      ],
    },
    {
      key: 'format',
      title: '格式',
      items: [
        { label: '粗体', shortcut: 'Ctrl+B', action: () => api.formatAction('bold') },
        { label: '斜体', shortcut: 'Ctrl+I', action: () => api.formatAction('italic') },
        { label: '下划线', shortcut: 'Ctrl+U', action: () => api.formatAction('underline') },
        { label: '删除线', shortcut: 'Alt+Shift+5', action: () => api.formatAction('strike') },
        { divider: true },
        { label: '高亮', action: () => api.formatAction('highlight') },
        { label: '上标', action: () => api.formatAction('superscript') },
        { label: '下标', action: () => api.formatAction('subscript') },
        { label: '行内代码', shortcut: 'Ctrl+Shift+`', action: () => api.formatAction('inline-code') },
        { divider: true },
        { label: '链接', shortcut: 'Ctrl+K', action: () => api.formatAction('link') },
        { label: '图片', shortcut: 'Ctrl+Shift+K', action: () => api.formatAction('image') },
        { divider: true },
        { label: '清除格式', action: () => api.formatAction('clear') },
      ],
    },
    {
      key: 'view',
      title: '视图',
      items: [
        { label: '源码模式', shortcut: 'Ctrl+/', action: api.toggleMode, checked: api.mode === 'source' },
        { divider: true },
        { label: '侧边栏', shortcut: 'Ctrl+Shift+L', action: api.toggleSidebar, checked: api.sidebarOpen },
        { label: '文件树', radio: 'files', checked: api.sidebarView === 'files', action: () => api.setSidebarView('files') },
        { label: '大纲', radio: 'outline', checked: api.sidebarView === 'outline', action: () => api.setSidebarView('outline') },
        { divider: true },
        { label: '专注模式', shortcut: 'F8', checked: api.settings.focusMode, action: () => api.updateSettings({ focusMode: !api.settings.focusMode }) },
        { label: '打字机模式', shortcut: 'F9', checked: api.settings.typewriterMode, action: () => api.updateSettings({ typewriterMode: !api.settings.typewriterMode }) },
        { divider: true },
        { label: '全屏', shortcut: 'F11', action: toggleFullscreen },
      ],
    },
    {
      key: 'theme',
      title: '主题',
      items: THEMES.map((t) => ({
        label: t.label,
        checked: api.settings.theme === t.id,
        radio: 'theme',
        action: () => api.updateSettings({ theme: t.id }),
      })),
    },
    {
      key: 'help',
      title: '帮助',
      items: [
        { label: '快捷键', action: () => setHelpDialog('shortcuts') },
        { label: '关于', action: () => setHelpDialog('about') },
      ],
    },
  ];

  const runAction = (item: IMenuItem) => {
    setOpenMenu(null);
    if (item.action) item.action();
  };

  /* ---- 移动端：汉堡按钮 + 全屏菜单面板 ---- */
  if (isMobile) {
    return (
      <div className="ed-menubar ed-menubar--mobile" ref={barRef}>
        <button
          className="ed-menu-burger"
          onClick={() => setOpenMenu((v) => (v === 'mobile' ? null : 'mobile'))}
        >
          <Menu size={17} />
          <span>菜单</span>
        </button>
        <span className="ed-menu-title">{api.dirty ? '●' : ''}</span>

        {openMenu === 'mobile' && (
          <div className="ed-menu-mobile" onClick={() => setOpenMenu(null)}>
            <div className="ed-menu-mobile-panel" onClick={(e) => e.stopPropagation()}>
              {groups.map((g) => (
                <div key={g.key} className="ed-menu-mobile-group">
                  <div className="ed-menu-mobile-title">{g.title}</div>
                  {g.items.map((item, i) =>
                    item.divider ? (
                      <div key={`d${i}`} className="ed-menu-group" />
                    ) : (
                      <div
                        key={i}
                        className={`ed-menu-item-row ${item.disabled ? 'disabled' : ''}`}
                        onClick={() => !item.disabled && runAction(item)}
                      >
                        <span className="ed-menu-label">
                          {item.radio ? (
                            <span className="ed-radio-dot" style={{ width: 12 }}>
                              {item.checked ? '•' : ''}
                            </span>
                          ) : item.checked ? (
                            <span style={{ width: 12 }}>✓</span>
                          ) : (
                            <span style={{ width: 12 }} />
                          )}
                          {item.label}
                        </span>
                        {item.shortcut && <span className="ed-menu-shortcut">{item.shortcut}</span>}
                      </div>
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <Dialog open={helpDialog === 'shortcuts'} onOpenChange={(o) => !o && setHelpDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>快捷键</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px] max-h-[60vh] overflow-y-auto pr-2">
              {[
                ['新建 / 打开', 'Ctrl+N / Ctrl+O'],
                ['保存 / 另存为', 'Ctrl+S / Ctrl+Shift+S'],
                ['撤销 / 重做', 'Ctrl+Z / Ctrl+Y'],
                ['查找 / 替换', 'Ctrl+F / Ctrl+H'],
                ['粗体 / 斜体 / 下划线', 'Ctrl+B / I / U'],
                ['删除线', 'Alt+Shift+5'],
                ['链接 / 图片', 'Ctrl+K / Ctrl+Shift+K'],
                ['标题 1–6 / 正文', 'Ctrl+1–6 / Ctrl+0'],
                ['引用 / 代码块', 'Ctrl+Shift+Q / C'],
                ['无序 / 有序列表', 'Ctrl+Shift+] / ['],
                ['任务列表', 'Ctrl+Shift+X'],
                ['表格 / 分割线', 'Ctrl+Shift+T / -'],
                ['数学公式', 'Ctrl+Shift+M'],
                ['源码模式', 'Ctrl+/'],
                ['侧边栏', 'Ctrl+Shift+L'],
                ['专注 / 打字机模式', 'F8 / F9'],
                ['全屏', 'F11'],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <span>{k}</span>
                  <span className="text-muted-foreground whitespace-nowrap">{v}</span>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={helpDialog === 'about'} onOpenChange={(o) => !o && setHelpDialog(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>关于 Markdown 编辑器</DialogTitle>
            </DialogHeader>
            <div className="text-[13px] space-y-2 leading-relaxed">
              <p>
                一款参照 <strong>Typora</strong> 的所见即所得 Markdown 编辑器。
              </p>
              <p>支持：GFM 语法、数学公式、Mermaid 图、代码高亮、脚注、大纲、查找替换、多主题与 HTML / PDF 导出。</p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="ed-menubar" ref={barRef}>
      {groups.map((g) => (
        <div key={g.key} className="relative">
          <div
            className={`ed-menu-item ${openMenu === g.key ? 'open' : ''}`}
            onClick={() => setOpenMenu((v) => (v === g.key ? null : g.key))}
          >
            {g.title}
          </div>
          {openMenu === g.key && (
            <div className="ed-menu-panel" style={{ left: 0 }}>
              {g.items.map((item, i) =>
                item.divider ? (
                  <div key={`d${i}`} className="ed-menu-group" />
                ) : (
                  <div
                    key={i}
                    className={`ed-menu-item-row ${item.disabled ? 'disabled' : ''}`}
                    onClick={() => !item.disabled && runAction(item)}
                  >
                    <span className="ed-menu-label">
                      {item.radio ? (
                        <span className="ed-radio-dot" style={{ width: 12 }}>
                          {item.checked ? '•' : ''}
                        </span>
                      ) : item.checked ? (
                        <span style={{ width: 12 }}>✓</span>
                      ) : (
                        <span style={{ width: 12 }} />
                      )}
                      {item.label}
                    </span>
                    {item.shortcut && <span className="ed-menu-shortcut">{item.shortcut}</span>}
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      ))}

      <span className="ed-menu-title">{api.dirty ? '●' : ''}</span>

      <Dialog open={helpDialog === 'shortcuts'} onOpenChange={(o) => !o && setHelpDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>快捷键</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px] max-h-[60vh] overflow-y-auto pr-2">
            {[
              ['新建 / 打开', 'Ctrl+N / Ctrl+O'],
              ['保存 / 另存为', 'Ctrl+S / Ctrl+Shift+S'],
              ['撤销 / 重做', 'Ctrl+Z / Ctrl+Y'],
              ['查找 / 替换', 'Ctrl+F / Ctrl+H'],
              ['粗体 / 斜体 / 下划线', 'Ctrl+B / I / U'],
              ['删除线', 'Alt+Shift+5'],
              ['链接 / 图片', 'Ctrl+K / Ctrl+Shift+K'],
              ['标题 1–6 / 正文', 'Ctrl+1–6 / Ctrl+0'],
              ['引用 / 代码块', 'Ctrl+Shift+Q / C'],
              ['无序 / 有序列表', 'Ctrl+Shift+] / ['],
              ['任务列表', 'Ctrl+Shift+X'],
              ['表格 / 分割线', 'Ctrl+Shift+T / -'],
              ['数学公式', 'Ctrl+Shift+M'],
              ['源码模式', 'Ctrl+/'],
              ['侧边栏', 'Ctrl+Shift+L'],
              ['专注 / 打字机模式', 'F8 / F9'],
              ['全屏', 'F11'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <span>{k}</span>
                <span className="text-muted-foreground whitespace-nowrap">{v}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={helpDialog === 'about'} onOpenChange={(o) => !o && setHelpDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>关于 Markdown 编辑器</DialogTitle>
          </DialogHeader>
          <div className="text-[13px] space-y-2 leading-relaxed">
            <p>
              一款参照 <strong>Typora</strong> 的所见即所得 Markdown 编辑器，在浏览器中运行。
            </p>
            <p>支持：GFM 语法、数学公式、Mermaid 图、代码高亮、脚注、文件树、查找替换、多主题与 HTML / PDF 导出。</p>
            <p className="text-muted-foreground">
              数据保存在当前浏览器中；打开本地文件夹需使用 Chrome / Edge。
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
