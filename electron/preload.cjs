// Preload：通过 contextBridge 暴露最小文件系统 API 给渲染进程
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('editorBridge', {
  isElectron: true,
  openFile: () => ipcRenderer.invoke('fs:openFile'),
  openFolder: () => ipcRenderer.invoke('fs:openFolder'),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  saveFile: (filePath, content) => ipcRenderer.invoke('fs:saveFile', filePath, content),
  saveFileDialog: (suggestedName) => ipcRenderer.invoke('fs:saveFileDialog', suggestedName),
  saveHtmlDialog: (suggestedName) => ipcRenderer.invoke('fs:saveHtmlDialog', suggestedName),
  readDirTree: (rootPath) => ipcRenderer.invoke('fs:readDirTree', rootPath),
  createFile: (rootPath, relPath, name) => ipcRenderer.invoke('fs:createFile', rootPath, relPath, name),
  createDir: (rootPath, relPath, name) => ipcRenderer.invoke('fs:createDir', rootPath, relPath, name),
  removeEntry: (rootPath, relPath, name) => ipcRenderer.invoke('fs:removeEntry', rootPath, relPath, name),
  renameEntry: (rootPath, relPath, oldName, newName) =>
    ipcRenderer.invoke('fs:renameEntry', rootPath, relPath, oldName, newName),
});
