import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import { join } from 'path';
import { ConfigService } from './services/ConfigService';
import { NotionService } from './services/NotionService';
import { WeChatService } from './services/WeChatService';
import { WordPressService } from './services/WordPressService';
import { BilibiliService } from './services/BilibiliService';
import { SyncService } from './services/SyncService';
import { setupIpcHandlers } from './ipc/handlers';

// 判断是否为开发环境
const isDev = process.env.NODE_ENV === 'development';

// 获取图标路径（兼容开发和生产环境）
function getIconPath(): string {
  let iconPath: string;
  if (isDev) {
    // 开发环境：从项目根目录的 assets 文件夹
    iconPath = join(process.cwd(), 'assets', 'icon.ico');
  } else {
    // 生产环境：从打包后的 resources 目录
    iconPath = join(process.resourcesPath, 'icon.ico');
  }
  console.log('图标路径:', iconPath);
  return iconPath;
}

// 全局变量
let mainWindow: BrowserWindow | null = null;
let configService: ConfigService | null = null;
let notionService: NotionService | null = null;
let weChatService: WeChatService | null = null;
let wordPressService: WordPressService | null = null;
let bilibiliService: BilibiliService | null = null;
let syncService: SyncService | null = null;

// 初始化服务
async function initServices() {
  try {
    // 初始化配置服务
    configService = new ConfigService();
    await configService.init(); // 确保配置已加载
    const notionConfig = configService.getNotionConfig();
    const wpConfig = configService.getWordPressConfig();
    const biliConfig = configService.getBilibiliConfig();
    
    // ⚠️ 安全：不记录包含API key的配置信息
    console.log('配置加载状态: apiKey已配置:', !!notionConfig.apiKey, ', databaseId已配置:', !!notionConfig.databaseId);
    console.log('WordPress 配置状态: siteUrl已配置:', !!wpConfig?.siteUrl, ', username已配置:', !!wpConfig?.username);
    console.log('Bilibili 配置状态: enabled:', !!biliConfig?.enabled);
    
    // 初始化 Notion 服务
    if (notionConfig.apiKey && notionConfig.databaseId) {
      try {
        notionService = new NotionService(notionConfig);
        weChatService = new WeChatService(configService);
        
        // 初始化 WordPress 服务（如果配置了）
        if (wpConfig?.siteUrl && wpConfig?.username && wpConfig?.appPassword) {
          wordPressService = new WordPressService(configService);
          console.log('WordPress 服务初始化成功');
        } else {
          console.log('WordPress 配置未完成，服务未初始化');
        }
        
        // 初始化 Bilibili 服务（如果启用了）
        if (biliConfig?.enabled) {
          bilibiliService = new BilibiliService(configService);
          console.log('Bilibili 服务初始化成功');
        } else {
          console.log('Bilibili 未启用，服务未初始化');
        }
        
        syncService = new SyncService(notionService, weChatService, configService, wordPressService, bilibiliService);
        console.log('服务初始化成功');
      } catch (error) {
        console.error('服务初始化失败:', error);
      }
    } else {
      console.log('Notion 配置未完成，等待用户设置...');
    }
  } catch (error) {
    console.error('初始化服务失败:', error);
  }
}

// 处理渲染进程异常崩溃，尝试自动刷新主窗口
app.on('render-process-gone', (_event, details) => {
  console.log('渲染进程崩溃:', details);
  if (mainWindow) {
    mainWindow.reload();
  }
});

// 创建窗口
async function createWindow() {
  try {
    const iconPath = getIconPath();
    // 创建窗口
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 900,   // 最小宽度：确保界面不会过于拥挤
      minHeight: 650,  // 最小高度：确保所有内容可见
      title: 'NotionSyncOne',
      icon: iconPath,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, '../preload/index.js'),
        // 允许加载外部图片（Notion 封面图等）
        webSecurity: true
      }
    });
    
    // 设置 CSP（内容安全策略）
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; " +
            "script-src 'self' 'unsafe-inline'; " +  // React 需要 unsafe-inline
            "style-src 'self' 'unsafe-inline'; " +   // CSS-in-JS 需要 unsafe-inline
            "img-src 'self' data: blob: https: http:; " +
            "media-src 'self' data: blob: https: http:; " +
            "connect-src 'self' https: http: ws: wss:; " +
            "font-src 'self' data:; " +
            "object-src 'none'; " +
            "base-uri 'self';"
          ]
        }
      });
    });
    
    // Windows 特定设置：为任务栏设置图标
    if (process.platform === 'win32' && mainWindow) {
      mainWindow.setIcon(iconPath);
    }
    
    // 加载页面
    if (isDev) {
      // 开发环境
      await mainWindow.loadURL('http://localhost:5173');
    } else {
      // 生产环境
      await mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
    }
    
    // 隐藏菜单栏
    Menu.setApplicationMenu(null);

    // 开发者工具（开发模式下自动打开）
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  } catch (error) {
    console.error('创建窗口失败:', error);
  }
}

// 在内置浏览器窗口中打开 Notion 页面
ipcMain.handle('open-notion-url', async (_event, url: string) => {
  try {
    if (!url) return;

    const iconPath = getIconPath();
    const notionWindow = new BrowserWindow({
      width: 1100,
      height: 800,
      minWidth: 800,   // Notion预览窗口最小宽度
      minHeight: 600,  // Notion预览窗口最小高度
      title: 'Notion 预览',
      icon: iconPath,
      parent: mainWindow ?? undefined,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      }
    });

    await notionWindow.loadURL(url);
  } catch (error) {
    console.error('打开 Notion 页面失败:', error);
  }
});

// 在系统默认浏览器中打开 URL
ipcMain.handle('open-external-url', async (_event, url: string) => {
  try {
    if (!url) return;
    await shell.openExternal(url);
  } catch (error) {
    console.error('在系统浏览器中打开链接失败:', error);
  }
});

// 应用准备就绪时初始化服务和创建窗口
app.whenReady().then(async () => {
  // ⚠️ 关键：Windows 任务栏图标和名称设置（必须在这里设置）
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.notionsyncone.NotionSyncOne');
  }
  
  console.log('应用准备就绪，初始化服务...');
  await initServices();
  
  // 设置 IPC 处理器
  if (configService) {
    setupIpcHandlers(configService, notionService, weChatService, syncService, wordPressService, bilibiliService);
    
    // 检查并重置卡住的同步状态
    if (syncService) {
      syncService.resetStuckSyncStates();
      console.log('已检查并重置卡住的同步状态');
    }
  }
  
  await createWindow();
});

// 所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 激活应用时创建窗口
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
}); 