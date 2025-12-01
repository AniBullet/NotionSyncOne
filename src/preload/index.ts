import { contextBridge, ipcRenderer } from 'electron';
import { SyncState } from '../shared/types/sync';

// 定义 API 类型
interface IElectronAPI {
  getConfig: () => Promise<{
    apiKey: string;
    databaseId: string;
  }>;
  saveConfig: (config: {
    apiKey: string;
    databaseId: string;
  }) => Promise<void>;
  getNotionPages: () => Promise<any[]>;
  syncArticle: (pageId: string, publishMode?: 'publish' | 'draft') => Promise<SyncState>;
  previewArticle: (pageId: string) => Promise<any>;
  getSyncStatus: (articleId: string) => Promise<SyncState>;
  cancelSync: (articleId: string) => Promise<boolean>;
  showNotification: (title: string, body: string) => Promise<void>;
  onSyncStateChanged: (callback: (state: SyncState) => void) => void;
}

// 暴露 API 到渲染进程
contextBridge.exposeInMainWorld('electron', {
  // IPC 通信
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
    on: (channel: string, func: (...args: any[]) => void) => {
      ipcRenderer.on(channel, (_, ...args) => func(...args));
    },
    removeListener: (channel: string, func: (...args: any[]) => void) => {
      ipcRenderer.removeListener(channel, func);
    }
  },
  
  // 配置相关
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  
  // Notion 相关
  getNotionPages: () => ipcRenderer.invoke('get-notion-pages'),
  
  // 同步相关
  syncArticle: (pageId, publishMode) => ipcRenderer.invoke('sync-article', pageId, publishMode),
  previewArticle: (pageId) => ipcRenderer.invoke('preview-article', pageId),
  getSyncStatus: (articleId) => ipcRenderer.invoke('get-sync-status', articleId),
  cancelSync: (articleId) => ipcRenderer.invoke('cancel-sync', articleId),
  showNotification: (title, body) => ipcRenderer.invoke('show-notification', { title, body }),
  onSyncStateChanged: (callback) => {
    ipcRenderer.on('syncStateChanged', (_, state) => callback(state));
  }
}); 