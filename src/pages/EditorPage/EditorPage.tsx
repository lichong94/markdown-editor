import { useLayoutEffect } from 'react';
import { Toaster } from 'sonner';
import { useEditor } from '@/hooks/useEditor';
import { useIsMobile } from '@/hooks/use-mobile';
import MenuBar from '@/components/editor/MenuBar';
import Sidebar from '@/components/editor/Sidebar';
import EditorArea from '@/components/editor/EditorArea';
import SourceEditor from '@/components/editor/SourceEditor';
import StatusBar from '@/components/editor/StatusBar';
import FindBar from '@/components/editor/FindBar';

export default function EditorPage() {
  const api = useEditor();
  const isMobile = useIsMobile();

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = api.settings.theme;
  }, [api.settings.theme]);

  return (
    <div
      className="h-screen w-screen flex flex-col overflow-hidden"
      style={{
        ['--ed-sidebar-width' as string]: isMobile
          ? 'min(82vw, 320px)'
          : `${api.settings.sidebarWidth}px`,
      } as React.CSSProperties}
    >
      <MenuBar api={api} isMobile={isMobile} />
      <div className="flex flex-1 min-h-0">
        {isMobile && api.sidebarOpen && !api.settings.focusMode && (
          <div className="ed-mask" onClick={() => api.setSidebarOpen(false)} />
        )}
        {api.sidebarOpen && !api.settings.focusMode && (
          <Sidebar api={api} isMobile={isMobile} />
        )}
        <div className="relative flex-1 min-w-0 flex flex-col">
          {api.mode === 'wysiwyg' ? (
            <EditorArea
              editorRef={api.editorRef}
              blocks={api.blocks}
              settings={api.settings}
              handleEditorInput={api.handleEditorInput}
            />
          ) : (
            <SourceEditor
              sourceRef={api.sourceRef}
              sourceValue={api.sourceValue}
              handleSourceChange={api.handleSourceChange}
              settings={api.settings}
            />
          )}
        </div>
      </div>
      {!api.settings.focusMode && <StatusBar api={api} />}
      {api.findOpen && <FindBar api={api} />}
      <Toaster position="bottom-right" theme={api.settings.theme.startsWith('night') ? 'dark' : 'light'} />
    </div>
  );
}
