import { useState } from 'react';
import type { RefObject } from 'react';
import type { IBlock, IEditorSettings } from '@/data/types';

interface IEditorAreaProps {
  editorRef: RefObject<HTMLDivElement | null>;
  blocks: IBlock[];
  settings: IEditorSettings;
  handleEditorInput: () => void;
}

export default function EditorArea({ editorRef, blocks, settings, handleEditorInput }: IEditorAreaProps) {
  const [dragging, setDragging] = useState(false);

  const isEmpty = blocks.length === 0 || (blocks.length === 1 && blocks[0].text.trim() === '');

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;
    const root = editorRef.current;
    if (root) root.focus();
    files.forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== 'string') return;
        const md = `![${f.name}](${reader.result})`;
        document.execCommand('insertText', false, md);
      };
      reader.readAsDataURL(f);
    });
  };

  return (
    <div
      className={`ed-editor-scroll ${dragging ? 'ed-dragging' : ''}`}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
    >
      <div
        ref={editorRef}
        className="ed-editor-body"
        contentEditable
        suppressContentEditableWarning
        spellCheck={settings.spellcheck}
        onInput={handleEditorInput}
        style={{ ['--ed-font-size' as string]: `${settings.fontSize}px` } as React.CSSProperties}
      />
      {isEmpty && (
        <div className="ed-empty-hint">
          开始写作…
          <br />
          <span style={{ fontSize: 13 }}>
            输入 # 加空格创建标题，Ctrl+/ 切换源码模式，Ctrl+S 保存
          </span>
        </div>
      )}
    </div>
  );
}
