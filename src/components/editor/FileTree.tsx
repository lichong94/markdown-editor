import { useEffect, useRef, useState } from 'react';
import { FileText, Folder, FolderOpen, ChevronRight, ChevronDown, Plus, Trash2 } from 'lucide-react';
import type { EditorApi } from '@/hooks/useEditor';
import type { IFileNode } from '@/data/types';

interface IFileTreeProps {
  api: EditorApi;
  filter: string;
}

interface IContextMenu {
  x: number;
  y: number;
  node: IFileNode;
  parentPath: string;
}

export default function FileTree({ api, filter }: IFileTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [ctx, setCtx] = useState<IContextMenu | null>(null);
  const treeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (treeRef.current && !treeRef.current.contains(e.target as Node)) setCtx(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const openCtx = (e: React.MouseEvent, node: IFileNode, parentPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    setCtx({ x: e.clientX, y: e.clientY, node, parentPath });
  };

  const doCreateFile = async (dirPath: string) => {
    const name = window.prompt('新建文件名：', '新建文档.md');
    if (name) await api.createFileAction(dirPath, name.trim());
    setCtx(null);
  };

  const doCreateDir = async (dirPath: string) => {
    const name = window.prompt('新建文件夹名：', '新建文件夹');
    if (name) await api.createDirAction(dirPath, name.trim());
    setCtx(null);
  };

  const doRename = async (node: IFileNode, parentPath: string) => {
    const name = window.prompt('重命名：', node.name);
    if (name && name !== node.name) {
      const ok = await api.renameEntryAction(parentPath, node.name, name.trim());
      if (!ok) window.alert('重命名失败：当前浏览器不支持移动文件，请手动操作。');
    }
    setCtx(null);
  };

  const doDelete = async (node: IFileNode, parentPath: string) => {
    if (window.confirm(`确定删除「${node.name}」吗？`)) {
      await api.removeEntryAction(parentPath, node.name);
    }
    setCtx(null);
  };

  const filtered = filter
    ? flattenTree(api.dirTree).filter((n) => n.node.name.toLowerCase().includes(filter.toLowerCase()))
    : null;

  const renderNode = (node: IFileNode, depth: number, parentPath: string) => {
    const isOpen = expanded.has(node.path);
    const isActive = !node.isDir && api.currentPath === node.path;
    const isExpanded = !filter && isOpen;
    return (
      <div key={node.path}>
        <div
          className={`ed-file-row ${isActive ? 'active' : ''}`}
          style={{ paddingLeft: 6 + depth * 14 }}
          onClick={() => {
            if (node.isDir) toggle(node.path);
            else void api.selectFileInTree(node);
          }}
          onContextMenu={(e) => openCtx(e, node, parentPath)}
        >
          <span className="ed-file-arrow">
            {node.isDir ? (isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />) : ''}
          </span>
          <span className="ed-file-icon">
            {node.isDir ? (
              isExpanded ? (
                <FolderOpen size={15} />
              ) : (
                <Folder size={15} />
              )
            ) : (
              <FileText size={15} />
            )}
          </span>
          <span className="ed-file-name">{node.name}</span>
          {node.isDir && (
            <span className="ed-file-actions">
              <span
                className="ed-file-action"
                title="新建文件"
                onClick={(e) => {
                  e.stopPropagation();
                  void doCreateFile(node.path);
                }}
              >
                <Plus size={13} />
              </span>
            </span>
          )}
        </div>
        {node.isDir && isExpanded && node.children && (
          <div>
            {node.children.map((c) => renderNode(c, depth + 1, node.path))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={treeRef} className="ed-sidebar-tree">
      {api.dirTree.length === 0 && (
        <div style={{ color: 'var(--ui-sidebar-weak)', fontSize: 13, padding: '12px 8px', lineHeight: 1.7 }}>
          尚未打开文件夹。
          <br />
          点击菜单「文件 → 打开文件夹…」或按 Ctrl+Shift+O 管理你的 Markdown 文件。
        </div>
      )}
      {filtered
        ? filtered.map(({ node, parentPath }) => renderNode(node, 0, parentPath))
        : api.dirTree.map((n) => renderNode(n, 0, '.'))}

      {ctx && (
        <div
          className="ed-menu-panel"
          style={{
            position: 'fixed',
            top: Math.min(ctx.y, window.innerHeight - 150),
            left: Math.min(ctx.x, window.innerWidth - 200),
            minWidth: 160,
          }}
        >
          {ctx.node.isDir && (
            <>
              <div className="ed-menu-item-row" onClick={() => void doCreateFile(ctx.node.path)}>
                <span className="ed-menu-label">
                  <Plus size={13} />
                  新建文件
                </span>
              </div>
              <div className="ed-menu-item-row" onClick={() => void doCreateDir(ctx.node.path)}>
                <span className="ed-menu-label">
                  <Folder size={13} />
                  新建文件夹
                </span>
              </div>
            </>
          )}
          <div className="ed-menu-item-row" onClick={() => doRename(ctx.node, ctx.parentPath)}>
            <span className="ed-menu-label">重命名</span>
          </div>
          <div className="ed-menu-group" />
          <div
            className="ed-menu-item-row"
            style={{ color: 'var(--ed-accent)' }}
            onClick={() => doDelete(ctx.node, ctx.parentPath)}
          >
            <span className="ed-menu-label">
              <Trash2 size={13} />
              删除
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function flattenTree(nodes: IFileNode[]): { node: IFileNode; parentPath: string }[] {
  const out: { node: IFileNode; parentPath: string }[] = [];
  const walk = (list: IFileNode[], parentPath: string) => {
    list.forEach((n) => {
      out.push({ node: n, parentPath });
      if (n.isDir && n.children) walk(n.children, n.path);
    });
  };
  walk(nodes, '.');
  return out;
}
