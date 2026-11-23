import type { RefObject } from 'react';
import type { IEditorSettings } from '@/data/types';

interface ISourceEditorProps {
  sourceRef: RefObject<HTMLTextAreaElement | null>;
  sourceValue: string;
  handleSourceChange: (v: string) => void;
  settings: IEditorSettings;
}

export default function SourceEditor({ sourceRef, sourceValue, handleSourceChange, settings }: ISourceEditorProps) {
  return (
    <div className="ed-source-editor">
      <textarea
        ref={sourceRef}
        value={sourceValue}
        onChange={(e) => handleSourceChange(e.target.value)}
        spellCheck={settings.spellcheck}
        style={{ ['--ed-font-size' as string]: `${settings.fontSize}px` } as React.CSSProperties}
        placeholder="在此输入 Markdown 源码…"
      />
    </div>
  );
}
