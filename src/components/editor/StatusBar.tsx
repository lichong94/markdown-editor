import { Maximize2, Minimize2 } from 'lucide-react';
import type { EditorApi } from '@/hooks/useEditor';

const THEME_LABEL: Record<string, string> = {
  github: 'GitHub',
  newsprint: 'Newsprint',
  night: 'Night',
  'night-plus': 'Night+',
};

export default function StatusBar({ api }: { api: EditorApi }) {
  return (
    <div className="ed-statusbar">
      <span className="ed-status-item">字数：{api.stats.words}</span>
      <span className="ed-status-item">字符：{api.stats.chars}</span>
      <span className="ed-status-item">段落：{api.stats.paragraphs}</span>
      <span className="ed-status-item">行数：{api.stats.lines}</span>
      <span className="ed-status-item" style={{ color: 'var(--ed-accent)' }}>
        {api.dirty ? '未保存' : '已保存'}
      </span>
      <span className="ed-status-item">{THEME_LABEL[api.settings.theme] ?? api.settings.theme}</span>
      <span
        className="ed-status-item"
        style={{ cursor: 'pointer' }}
        title="专注模式（F8）"
        onClick={() => api.updateSettings({ focusMode: !api.settings.focusMode })}
      >
        {api.settings.focusMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
      </span>
    </div>
  );
}
