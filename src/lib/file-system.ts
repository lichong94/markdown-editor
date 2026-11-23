// EXPORTS: fsSupported, isElectron, isCapacitor, openFile, openFolder, saveToHandle, saveFileAs, downloadBlob, exportHtml, shareFile, readDirTree, resolveDirHandle, readFileFrom, readTreeFile, createFileInDir, createDirInDir, removeEntryFrom, renameEntryIn, IOpenFileResult, IOpenFolderResult, IFileHandle, IDirHandle
import type { IFileNode } from '@/data/types';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/** 本地 SafeStorage 插件：手机端通过系统文件选择器/保存对话框读写文件 */
interface SafeStoragePlugin {
  openDocument(options: { mimeTypes?: string[]; fallbackName?: string }): Promise<{
    uri: string;
    name: string;
    content: string;
  }>;
  saveToUri(options: { uri: string; content: string }): Promise<void>;
  createDocument(options: {
    fileName: string;
    content: string;
    mimeType?: string;
  }): Promise<{ uri: string; name: string }>;
}

const SafeStorage = registerPlugin<SafeStoragePlugin>('SafeStorage');

/* 补齐 File System Access API 中当前 TS lib 缺失的类型 */
declare global {
  interface FileSystemDirectoryHandle {
    values(): AsyncIterableIterator<FileSystemHandle>;
    move(destination: FileSystemDirectoryHandle, newName?: string): Promise<void>;
  }
  interface FileSystemFileHandle {
    move(destination: FileSystemDirectoryHandle, newName?: string): Promise<void>;
  }
  interface Window {
    showOpenFilePicker?: (options?: {
      multiple?: boolean;
      types?: { description?: string; accept: Record<string, string[]> }[];
    }) => Promise<FileSystemFileHandle[]>;
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: { description?: string; accept: Record<string, string[]> }[];
    }) => Promise<FileSystemFileHandle>;
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  }
}

/** 统一文件/目录句柄：浏览器版为 FileSystemHandle，Electron 版为绝对路径字符串 */
export type IFileHandle = FileSystemFileHandle | string;
export type IDirHandle = FileSystemDirectoryHandle | string;

export interface IOpenFileResult {
  name: string;
  content: string;
  handle?: IFileHandle;
}

export interface IOpenFolderResult {
  rootName: string;
  tree: IFileNode[];
  handle: IDirHandle;
}

const MD_TYPES = {
  description: 'Markdown 文件',
  accept: { 'text/markdown': ['.md', '.markdown', '.mdown', '.mkd', '.txt'] },
};

/** 是否运行在 Electron 中（preload 已注入桥接） */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && Boolean(window.editorBridge);
}

/** 是否运行在 Capacitor（Android/iOS 原生容器）中 */
export function isCapacitor(): boolean {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform();
}

/** 是否支持文件系统操作（Electron 或浏览器 File System Access API） */
export function fsSupported(): boolean {
  return isElectron() || (typeof window !== 'undefined' && 'showOpenFilePicker' in window);
}

/** 打开单个 md 文件 */
export async function openFile(): Promise<IOpenFileResult | null> {
  if (isElectron()) {
    try {
      const res = await window.editorBridge!.openFile();
      if (res.canceled || !res.path || res.content === undefined) return null;
      return { name: res.name ?? '', content: res.content, handle: res.path };
    } catch {
      return null;
    }
  }
  if (isCapacitor()) {
    try {
      const res = await SafeStorage.openDocument({
        mimeTypes: ['text/markdown', 'text/plain', 'text/x-markdown', 'application/octet-stream'],
        fallbackName: 'document.md',
      });
      return { name: res.name, content: res.content, handle: res.uri };
    } catch (err) {
      // 用户取消选择不视为错误
      if (err instanceof Error && err.message.startsWith('USER_CANCELLED')) return null;
      throw err;
    }
  }
  if (fsSupported()) {
    try {
      const [handle] = await window.showOpenFilePicker({ types: [MD_TYPES], multiple: false });
      const file = await handle.getFile();
      const content = await file.text();
      return { name: file.name, content, handle };
    } catch (err) {
      if (isAbortError(err)) return null;
      throw err;
    }
  }
  return pickViaInput();
}

function pickViaInput(): Promise<IOpenFileResult | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.mdown,.mkd,.txt';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) {
        resolve(null);
        return;
      }
      resolve({ name: f.name, content: await f.text() });
    };
    input.click();
  });
}

/** 打开文件夹并构建文件树 */
export async function openFolder(): Promise<IOpenFolderResult | null> {
  if (isElectron()) {
    try {
      const res = await window.editorBridge!.openFolder();
      if (res.canceled || !res.rootPath) return null;
      return { rootName: res.rootName ?? '', tree: res.tree ?? [], handle: res.rootPath };
    } catch {
      return null;
    }
  }
  if (!fsSupported()) return null;
  try {
    const handle = await window.showDirectoryPicker();
    const tree = await readDirTree(handle);
    return { rootName: handle.name, tree, handle };
  } catch (err) {
    if (isAbortError(err)) return null;
    throw err;
  }
}

/** 递归读取目录树（最多 5 层，忽略隐藏目录与常见依赖目录） */
export async function readDirTree(dir: IDirHandle): Promise<IFileNode[]> {
  if (isElectron()) {
    try {
      return await window.editorBridge!.readDirTree(dir as string);
    } catch {
      return [];
    }
  }
  return readDirTreeBrowser(dir as FileSystemDirectoryHandle, '', 0);
}

async function readDirTreeBrowser(
  dir: FileSystemDirectoryHandle,
  prefix: string,
  depth: number,
): Promise<IFileNode[]> {
  if (depth > 5) return [];
  const nodes: IFileNode[] = [];
  for await (const entry of dir.values()) {
    const name = entry.name;
    if (name.startsWith('.') || name === 'node_modules') continue;
    const path = prefix ? `${prefix}/${name}` : name;
    if (entry.kind === 'directory') {
      const children = await readDirTreeBrowser(entry as FileSystemDirectoryHandle, path, depth + 1);
      nodes.push({ name, path, isDir: true, children });
    } else if (/\.(md|markdown|mdown|mkd|txt)$/i.test(name)) {
      nodes.push({ name, path, isDir: false });
    }
  }
  nodes.sort((a, b) =>
    a.isDir === b.isDir ? a.name.localeCompare(b.name, 'zh-Hans-CN') : a.isDir ? -1 : 1,
  );
  return nodes;
}

/** 沿相对路径向下解析目录（Electron 为路径拼接，浏览器为句柄导航） */
export async function resolveDirHandle(
  root: IDirHandle,
  relPath: string,
): Promise<IDirHandle | null> {
  const parts = relPath === '.' ? [] : String(relPath).split('/');
  if (isElectron()) {
    try {
      let dir = root as string;
      for (const p of parts) dir = `${dir.replace(/[\\/]+$/, '')}/${p}`;
      return dir;
    } catch {
      return null;
    }
  }
  try {
    let dir = root as FileSystemDirectoryHandle;
    for (const p of parts) dir = await dir.getDirectoryHandle(p);
    return dir;
  } catch {
    return null;
  }
}

/** 在目录树中解析文件并读取内容 */
export async function readFileFrom(
  handle: IFileHandle,
): Promise<{ name: string; content: string } | null> {
  if (isElectron()) {
    try {
      return await window.editorBridge!.readFile(handle as string);
    } catch {
      return null;
    }
  }
  try {
    const file = await (handle as FileSystemFileHandle).getFile();
    return { name: file.name, content: await file.text() };
  } catch {
    return null;
  }
}

/** 按相对路径从目录树直接读取文件（含句柄/路径返回） */
export async function readTreeFile(
  root: IDirHandle,
  relPath: string,
): Promise<{ handle: IFileHandle; name: string; content: string } | null> {
  const parts = String(relPath).split('/');
  const fileName = parts[parts.length - 1];
  const parent = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
  const dir = await resolveDirHandle(root, parent);
  if (!dir) return null;
  let handle: IFileHandle;
  if (isElectron()) {
    handle = `${String(dir).replace(/[\\/]+$/, '')}/${fileName}`;
  } else {
    try {
      handle = await (dir as FileSystemDirectoryHandle).getFileHandle(fileName);
    } catch {
      return null;
    }
  }
  const res = await readFileFrom(handle);
  if (!res) return null;
  return { handle, name: res.name, content: res.content };
}

/** 写回文件句柄（手机端：向打开时记录的 URI 覆盖写回） */
export async function saveToHandle(handle: IFileHandle, content: string): Promise<void> {
  if (isElectron()) {
    await window.editorBridge!.saveFile(handle as string, content);
    return;
  }
  if (isCapacitor()) {
    await SafeStorage.saveToUri({ uri: String(handle), content });
    return;
  }
  const writable = await (handle as FileSystemFileHandle).createWritable();
  await writable.write(content);
  await writable.close();
}

/** 另存为（Electron 走系统对话框；手机端走系统"保存到"对话框；浏览器降级为下载） */
export async function saveFileAs(
  suggestedName: string,
  content: string,
): Promise<IFileHandle | null> {
  if (isElectron()) {
    try {
      const res = await window.editorBridge!.saveFileDialog(suggestedName);
      if (res.canceled || !res.path) return null;
      await window.editorBridge!.saveFile(res.path, content);
      return res.path;
    } catch {
      return null;
    }
  }
  if (isCapacitor()) {
    try {
      const res = await SafeStorage.createDocument({
        fileName: suggestedName,
        content,
        mimeType: 'text/markdown',
      });
      return res.uri;
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('USER_CANCELLED')) return null;
      throw err;
    }
  }
  if (fsSupported()) {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName, types: [MD_TYPES] });
      await saveToHandle(handle, content);
      return handle;
    } catch (err) {
      if (isAbortError(err)) return null;
      throw err;
    }
  }
  downloadBlob(new Blob([content], { type: 'text/markdown;charset=utf-8' }), suggestedName);
  return null;
}

/** Blob 下载 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Capacitor 分享面板：写入缓存目录并唤起系统分享（手机端"分享"功能） */
async function saveViaSharePanel(name: string, content: string): Promise<boolean> {
  try {
    await Filesystem.writeFile({
      path: name,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    const uri = await Filesystem.getUri({ path: name, directory: Directory.Cache });
    await Share.share({
      title: name,
      text: content,
      files: [uri.uri],
      dialogTitle: `分享 ${name}`,
    });
    return true;
  } catch {
    return false;
  }
}

/** 分享当前文档（手机端调系统分享面板；桌面/浏览器不支持时返回 false） */
export async function shareFile(name: string, content: string): Promise<boolean> {
  if (!isCapacitor()) return false;
  return saveViaSharePanel(name, content);
}

/** 导出 HTML 文件（Electron 走系统对话框；手机端走系统"保存到"；浏览器直接下载） */
export function exportHtml(filename: string, html: string): void {
  if (isElectron()) {
    void (async () => {
      try {
        const res = await window.editorBridge!.saveHtmlDialog(filename);
        if (res.canceled || !res.path) return;
        await window.editorBridge!.saveFile(res.path, html);
      } catch {
        /* 用户取消或失败时静默 */
      }
    })();
    return;
  }
  if (isCapacitor()) {
    void (async () => {
      try {
        await SafeStorage.createDocument({ fileName: filename, content: html, mimeType: 'text/html' });
      } catch {
        /* 用户取消或失败时静默 */
      }
    })();
    return;
  }
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), filename);
}

/** 在目录中新建文件 */
export async function createFileInDir(
  dir: IDirHandle,
  name: string,
): Promise<IFileHandle | null> {
  if (isElectron()) {
    try {
      const res = await window.editorBridge!.createFile(dir as string, '.', name);
      return res?.path ?? null;
    } catch {
      return null;
    }
  }
  let n = name;
  if (!/\.(md|markdown|mdown|mkd|txt)$/i.test(n)) n = `${n}.md`;
  try {
    return await (dir as FileSystemDirectoryHandle).getFileHandle(n, { create: true });
  } catch {
    return null;
  }
}

/** 在目录中新建文件夹 */
export async function createDirInDir(
  dir: IDirHandle,
  name: string,
): Promise<IDirHandle | null> {
  if (isElectron()) {
    try {
      const res = await window.editorBridge!.createDir(dir as string, '.', name);
      return res?.path ?? null;
    } catch {
      return null;
    }
  }
  try {
    return await (dir as FileSystemDirectoryHandle).getDirectoryHandle(name, { create: true });
  } catch {
    return null;
  }
}

/** 删除目录条目（递归） */
export async function removeEntryFrom(dir: IDirHandle, name: string): Promise<void> {
  if (isElectron()) {
    await window.editorBridge!.removeEntry(dir as string, '.', name);
    return;
  }
  await (dir as FileSystemDirectoryHandle).removeEntry(name, { recursive: true });
}

/** 重命名目录条目 */
export async function renameEntryIn(
  dir: IDirHandle,
  oldName: string,
  newName: string,
): Promise<boolean> {
  if (isElectron()) {
    try {
      await window.editorBridge!.renameEntry(dir as string, '.', oldName, newName);
      return true;
    } catch {
      return false;
    }
  }
  try {
    let entry: FileSystemHandle | null = null;
    try {
      entry = await (dir as FileSystemDirectoryHandle).getDirectoryHandle(oldName);
    } catch {
      entry = await (dir as FileSystemDirectoryHandle).getFileHandle(oldName);
    }
    const movable = entry as FileSystemHandle & {
      move?: (target: FileSystemDirectoryHandle, name?: string) => Promise<void>;
    };
    if (typeof movable.move === 'function') {
      await movable.move(dir as FileSystemDirectoryHandle, newName);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && (err.name === 'AbortError' || err.name === 'SecurityError');
}
