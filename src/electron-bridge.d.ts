// Electron preload 桥接的类型声明（渲染进程侧）
import type { IFileNode } from '@/data/types';

interface IElectronBridge {
  isElectron: boolean;
  openFile(): Promise<{ canceled: boolean; name?: string; path?: string; content?: string }>;
  openFolder(): Promise<{ canceled: boolean; rootName?: string; rootPath?: string; tree?: IFileNode[] }>;
  readFile(filePath: string): Promise<{ name: string; content: string }>;
  saveFile(filePath: string, content: string): Promise<{ ok: boolean }>;
  saveFileDialog(suggestedName: string): Promise<{ canceled: boolean; path?: string }>;
  saveHtmlDialog(suggestedName: string): Promise<{ canceled: boolean; path?: string }>;
  readDirTree(rootPath: string): Promise<IFileNode[]>;
  createFile(
    rootPath: string,
    relPath: string,
    name: string,
  ): Promise<{ path?: string } | null>;
  createDir(
    rootPath: string,
    relPath: string,
    name: string,
  ): Promise<{ path?: string } | null>;
  removeEntry(rootPath: string, relPath: string, name: string): Promise<{ ok: boolean }>;
  renameEntry(
    rootPath: string,
    relPath: string,
    oldName: string,
    newName: string,
  ): Promise<{ ok: boolean }>;
}

declare global {
  interface Window {
    editorBridge?: IElectronBridge;
  }
}

export {};
