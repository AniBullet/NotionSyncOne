import { contextBridge, ipcRenderer } from 'electron';
import { SyncState } from '../shared/types/sync';
import { Config } from '../shared/types/config';

// 定义 API 类型
interface IElectronAPI {
  ipcRenderer: {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>;
    on(channel: string, func: (...args: unknown[]) => void): void;
    removeListener(channel: string, func: (...args: unknown[]) => void): void;
  };
  getConfig: () => Promise<Config>;
  saveConfig: (config: Config) => Promise<void>;
  getNotionPages: () => Promise<unknown[]>;
  syncArticle: (pageId: string, publishMode?: 'publish' | 'draft') => Promise<SyncState>;
  previewArticle: (pageId: string) => Promise<unknown>;
  getSyncStatus: (articleId: string) => Promise<SyncState>;
  cancelSync: (articleId: string) => Promise<boolean>;
  openNotionPage: (url: string) => Promise<void>;
  openExternal: (url: string) => Promise<void>;
  showNotification: (title: string, body: string) => Promise<void>;
  minimizeWindow: () => Promise<void>;
  toggleMaximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  onSyncStateChanged: (callback: (state: SyncState) => void) => void;
  testWechatConnection: (appId: string, appSecret: string) => Promise<void>;
  testWordPressConnection: (siteUrl: string, username: string, appPassword: string) => Promise<void>;
}

const ipcListenerWrappers = new WeakMap<(...args: unknown[]) => void, (...args: unknown[]) => void>();

const electronApi: IElectronAPI = {
  // IPC 通信
  ipcRenderer: {
    invoke: (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args),
    on: (channel: string, func: (...args: unknown[]) => void) => {
      const wrapper = (_event: unknown, ...args: unknown[]) => func(...args);
      ipcListenerWrappers.set(func, wrapper);
      ipcRenderer.on(channel, wrapper);
    },
    removeListener: (channel: string, func: (...args: unknown[]) => void) => {
      const wrapper = ipcListenerWrappers.get(func);
      ipcRenderer.removeListener(channel, wrapper || func);
      ipcListenerWrappers.delete(func);
    }
  },
  
  // 配置相关
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  
  // Notion 相关
  getNotionPages: () => ipcRenderer.invoke('get-notion-pages'),
  openNotionPage: (url: string) => ipcRenderer.invoke('open-notion-url', url),
  openExternal: (url: string) => ipcRenderer.invoke('open-external-url', url),
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window-toggle-maximize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  
  // 同步相关
  syncArticle: (pageId, publishMode) => ipcRenderer.invoke('sync-article', pageId, publishMode),
  previewArticle: (pageId) => ipcRenderer.invoke('preview-article', pageId),
  getSyncStatus: (articleId) => ipcRenderer.invoke('get-sync-status', articleId),
  cancelSync: (articleId) => ipcRenderer.invoke('cancel-sync', articleId),
  showNotification: (title, body) => ipcRenderer.invoke('show-notification', { title, body }),
  onSyncStateChanged: (callback) => {
    ipcRenderer.on('syncStateChanged', (_, state) => callback(state));
  },
  
  // 测试连接
  testWechatConnection: (appId: string, appSecret: string) => ipcRenderer.invoke('test-wechat-connection', appId, appSecret),
  testWordPressConnection: (siteUrl: string, username: string, appPassword: string) => ipcRenderer.invoke('test-wordpress-connection', siteUrl, username, appPassword)
};

// 暴露 API 到渲染进程
contextBridge.exposeInMainWorld('electron', electronApi);
