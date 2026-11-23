import { ChevronDown, ChevronUp, X } from 'lucide-react';
import type { EditorApi } from '@/hooks/useEditor';

export default function FindBar({ api }: { api: EditorApi }) {
  const { find } = api;
  const count = find.matches.length;
  const current = count > 0 ? find.matchIndex + 1 : 0;

  const onQueryKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) api.findPrev();
      else api.findNext();
    } else if (e.key === 'Escape') {
      api.clearFind();
    }
  };

  return (
    <div className="ed-findbar">
      <div className="ed-find-row">
        <input
          autoFocus
          value={find.query}
          onChange={(e) => api.findInput(e.target.value)}
          onKeyDown={onQueryKey}
          placeholder="查找"
          style={{ flex: 1 }}
        />
        <span className="ed-find-count">
          {count > 0 ? `${current} / ${count}` : '无结果'}
        </span>
        <button className="ed-find-btn" title="上一个 (Shift+Enter)" onClick={api.findPrev}>
          <ChevronUp size={14} />
        </button>
        <button className="ed-find-btn" title="下一个 (Enter)" onClick={api.findNext}>
          <ChevronDown size={14} />
        </button>
        <span className="ed-find-close" onClick={api.clearFind} title="关闭 (Esc)">
          <X size={15} />
        </span>
      </div>
      <div className="ed-find-row">
        <input
          value={find.replaceWith}
          onChange={(e) => api.setFind({ ...find, replaceWith: e.target.value })}
          onKeyDown={onQueryKey}
          placeholder="替换为"
          style={{ flex: 1 }}
        />
        <button
          className="ed-find-btn"
          disabled={count === 0}
          onClick={api.replaceOne}
          style={{ opacity: count === 0 ? 0.5 : 1 }}
        >
          替换
        </button>
        <button
          className="ed-find-btn primary"
          disabled={count === 0}
          onClick={api.replaceAll}
          style={{ opacity: count === 0 ? 0.5 : 1 }}
        >
          全部替换
        </button>
        <label className="ed-find-opt" style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={find.caseSensitive}
            onChange={(e) => api.setFind({ ...find, caseSensitive: e.target.checked })}
          />
          区分大小写
        </label>
      </div>
    </div>
  );
}
