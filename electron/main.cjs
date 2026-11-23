// Electron 主进程：创建窗口并提供文件系统 IPC 服务
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const MD_EXT = /\.(md|markdown|mdown|mkd|txt)$/i;
const MD_FILTER = [
  { name: 'Markdown 文件', extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'] },
];

/** 递归构建目录树（最多 5 层，忽略隐藏目录与 node_modules） */
async function buildDirTree(dirPath, prefix, depth) {
  if (depth > 5) return [];
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
  const nodes = [];
  for (const entry of entries) {
    const name = entry.name;
    if (name.startsWith('.') || name === 'node_modules') continue;
    const p = prefix ? `${prefix}/${name}` : name;
    if (entry.isDirectory()) {
      const children = await buildDirTree(path.join(dirPath, name), p, depth + 1);
      nodes.push({ name, path: p, isDir: true, children });
    } else if (MD_EXT.test(name)) {
      nodes.push({ name, path: p, isDir: false });
    }
  }
  nodes.sort((a, b) =>
    a.isDir === b.isDir ? a.name.localeCompare(b.name, 'zh-Hans-CN') : a.isDir ? -1 : 1,
  );
  return nodes;
}

/** 将相对路径解析到根目录下，并校验不越界 */
function resolveUnder(root, relPath) {
  const base = path.resolve(root);
  const target = path.resolve(base, ...String(relPath).split('/'));
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new Error('路径越界');
  }
  return target;
}

function ensureMdName(name) {
  let n = name.trim();
  if (!n) return '未命名.md';
  return MD_EXT.test(n) ? n : `${n}.md`;
}

function getWindow() {
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
}

/* ---------------- IPC：文件打开 / 保存 ---------------- */

ipcMain.handle('fs:openFile', async () => {
  const win = getWindow();
  const res = await dialog.showOpenDialog(win, {
    title: '打开 Markdown 文件',
    properties: ['openFile'],
    filters: MD_FILTER,
  });
  if (res.canceled || !res.filePaths[0]) return { canceled: true };
  const filePath = res.filePaths[0];
  const content = await fs.readFile(filePath, 'utf-8');
  return { canceled: false, name: path.basename(filePath), path: filePath, content };
});

ipcMain.handle('fs:openFolder', async () => {
  const win = getWindow();
  const res = await dialog.showOpenDialog(win, {
    title: '打开文件夹',
    properties: ['openDirectory'],
  });
  if (res.canceled || !res.filePaths[0]) return { canceled: true };
  const rootPath = res.filePaths[0];
  const tree = await buildDirTree(rootPath, '', 0);
  return { canceled: false, rootName: path.basename(rootPath), rootPath, tree };
});

ipcMain.handle('fs:readFile', async (_e, filePath) => {
  const content = await fs.readFile(filePath, 'utf-8');
  return { name: path.basename(filePath), content };
});

/** 原子写：先写临时文件再替换，避免中途断电损坏 */
ipcMain.handle('fs:saveFile', async (_e, filePath, content) => {
  const tmp = `${filePath}.tmp-${Date.now()}`;
  await fs.writeFile(tmp, content, 'utf-8');
  await fs.rename(tmp, filePath);
  return { ok: true };
});

ipcMain.handle('fs:saveFileDialog', async (_e, suggestedName) => {
  const win = getWindow();
  const res = await dialog.showSaveDialog(win, {
    title: '另存为',
    defaultPath: ensureMdName(suggestedName || '未命名.md'),
    filters: MD_FILTER,
  });
  if (res.canceled || !res.filePath) return { canceled: true };
  return { canceled: false, path: res.filePath };
});

ipcMain.handle('fs:saveHtmlDialog', async (_e, suggestedName) => {
  const win = getWindow();
  const res = await dialog.showSaveDialog(win, {
    title: '导出 HTML',
    defaultPath: suggestedName || 'export.html',
    filters: [{ name: 'HTML 文件', extensions: ['html'] }],
  });
  if (res.canceled || !res.filePath) return { canceled: true };
  return { canceled: false, path: res.filePath };
});

/* ---------------- IPC：文件夹管理 ---------------- */

ipcMain.handle('fs:readDirTree', async (_e, rootPath) => buildDirTree(rootPath, '', 0));

ipcMain.handle('fs:createFile', async (_e, rootPath, relPath, name) => {
  const dir = resolveUnder(rootPath, relPath);
  const fileName = ensureMdName(name);
  const target = path.join(dir, fileName);
  const handle = await fs.open(target, 'wx');
  await handle.close();
  return { path: target };
});

ipcMain.handle('fs:createDir', async (_e, rootPath, relPath, name) => {
  const dir = resolveUnder(rootPath, relPath);
  const target = path.join(dir, String(name).trim());
  if (!String(name).trim()) throw new Error('空名称');
  await fs.mkdir(target);
  return { path: target };
});

ipcMain.handle('fs:removeEntry', async (_e, rootPath, relPath, name) => {
  const dir = resolveUnder(rootPath, relPath);
  const target = path.join(dir, name);
  await fs.rm(target, { recursive: true, force: true });
  return { ok: true };
});

ipcMain.handle('fs:renameEntry', async (_e, rootPath, relPath, oldName, newName) => {
  const dir = resolveUnder(rootPath, relPath);
  const from = path.join(dir, oldName);
  const to = path.join(dir, String(newName).trim());
  if (!String(newName).trim()) throw new Error('空名称');
  await fs.rename(from, to);
  return { ok: true };
});

/* ---------------- 窗口 ---------------- */

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#fafafa',
    title: 'Markdown 编辑器',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  win.once('ready-to-show', () => win.show());

  if (process.env.VITE_DEV_SERVER_URL) {
    void win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void win.loadFile(path.join(__dirname, '..', 'dist-electron', 'renderer', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
