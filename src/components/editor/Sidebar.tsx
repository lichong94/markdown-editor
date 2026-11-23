import { useState } from 'react';
import { Search, X } from 'lucide-react';
import type { EditorApi } from '@/hooks/useEditor';
import FileTree from './FileTree';

export default function Sidebar({ api, isMobile = false }: { api: EditorApi; isMobile?: boolean }) {
  const [filter, setFilter] = useState('');

  return (
    <div className={`ed-sidebar ${isMobile ? 'ed-sidebar--mobile' : ''}`}>
      <div className="ed-sidebar-tabs">
        <div
          className={`ed-sidebar-tab ${api.sidebarView === 'files' ? 'active' : ''}`}
          onClick={() => api.setSidebarView('files')}
        >
          文件
        </div>
        <div
          className={`ed-sidebar-tab ${api.sidebarView === 'outline' ? 'active' : ''}`}
          onClick={() => api.setSidebarView('outline')}
        >
          大纲
        </div>
        {isMobile && (
          <span
            className="ed-sidebar-close"
            title="关闭侧边栏"
            onClick={() => api.setSidebarOpen(false)}
          >
            <X size={15} />
          </span>
        )}
      </div>

      <div className="ed-sidebar-search">
        <Search size={13} />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={api.sidebarView === 'files' ? '搜索文件' : '搜索大纲'}
        />
      </div>

      {api.sidebarView === 'files' ? (
        api.dirTree.length === 0 ? (
          <div className="ed-sidebar-tree">
            <div style={{ color: 'var(--ui-sidebar-weak)', fontSize: 13, padding: '12px 8px', lineHeight: 1.7 }}>
              尚未打开文件夹。
              <br />
              手机端可通过「文件 → 打开文件…」导入 .md 文档，或切换到「大纲」视图。
            </div>
          </div>
        ) : (
          <FileTree api={api} filter={filter} />
        )
      ) : (
        <div className="ed-sidebar-tree">
          {api.outline.length === 0 && (
            <div style={{ color: 'var(--ui-sidebar-weak)', fontSize: 13, padding: '12px 8px' }}>
              暂无标题
            </div>
          )}
          {api.outline.map((item, i) => (
            <div
              key={i}
              className="ed-outline-item"
              style={{ paddingLeft: 8 + (item.level - 1) * 14 }}
              onClick={() => {
                const b = api.blocks[item.blockIdx];
                if (b) api.scrollToOffset(b.start);
              }}
              title={item.text}
            >
              <span
                className="ed-outline-text"
                style={{ fontWeight: item.level <= 2 ? 600 : 400 }}
              >
                {item.text}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
