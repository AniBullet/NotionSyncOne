import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import { join } from 'path';
import { ConfigService } from './services/ConfigService';
import { NotionService } from './services/NotionService';
import { WeChatService } from './services/WeChatService';
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
let syncService: SyncService | null = null;

// 初始化服务
async function initServices() {
  try {
    // 初始化配置服务
    configService = new ConfigService();
    await configService.init(); // 确保配置已加载
    const notionConfig = configService.getNotionConfig();
    
    // ⚠️ 安全：不记录包含API key的配置信息
    console.log('配置加载状态: apiKey已配置:', !!notionConfig.apiKey, ', databaseId已配置:', !!notionConfig.databaseId);
    
    // 初始化 Notion 服务
    if (notionConfig.apiKey && notionConfig.databaseId) {
      try {
        notionService = new NotionService(notionConfig);
        weChatService = new WeChatService(configService);
        syncService = new SyncService(notionService, weChatService, configService);
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
      title: 'NotionSyncWechat',
      icon: iconPath,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: join(__dirname, '../preload/index.js')
      }
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
    
    // 开发者工具（调试时启用）
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
    app.setAppUserModelId('com.notionsyncwechat.NotionSyncWechat');
  }
  
  console.log('应用准备就绪，初始化服务...');
  await initServices();
  
  // 设置 IPC 处理器
  if (configService) {
    setupIpcHandlers(configService, notionService, weChatService, syncService);
    
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