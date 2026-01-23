import { ipcMain, dialog, Notification, BrowserWindow } from 'electron';
import { ConfigService } from '../services/ConfigService';
import { NotionService } from '../services/NotionService';
import { SyncService } from '../services/SyncService';
import { WeChatService } from '../services/WeChatService';
import { WordPressService } from '../services/WordPressService';
import { BilibiliService } from '../services/BilibiliService';
import { LogService } from '../services/LogService';
import { Config } from '../../shared/types/config';
import { BilibiliMetadata } from '../../shared/types/bilibili';

let notionService: NotionService | null = null;
let weChatService: WeChatService | null = null;
let wordPressService: WordPressService | null = null;
let bilibiliService: BilibiliService | null = null;
let syncService: SyncService | null = null;

export function setupIpcHandlers(
  configService: ConfigService,
  _notionService: NotionService | null,
  _weChatService: WeChatService | null,
  _syncService: SyncService | null,
  _wordPressService?: WordPressService | null,
  _bilibiliService?: BilibiliService | null
) {
  notionService = _notionService;
  weChatService = _weChatService;
  syncService = _syncService;
  wordPressService = _wordPressService || null;
  bilibiliService = _bilibiliService || null;

  // 配置相关
  ipcMain.handle('get-config', async () => {
    return configService.getConfig();
  });

  ipcMain.handle('show-notification', async (event, { title, body }) => {
    try {
      // 尝试使用系统通知
      try {
        const notification = new Notification({
          title: title,
          body: body,
          silent: false
        });
        
        notification.show();
      } catch (error) {
        // 使用对话框作为备选
        await dialog.showMessageBox({
          type: 'info',
          title: title,
          message: body,
          buttons: ['确定']
        });
      }
      
      return true;
    } catch (error) {
      console.error('显示通知失败:', error);
      throw error;
    }
  });

  ipcMain.handle('save-config', async (event, config: Config) => {
    try {
      // 验证配置
      if (!config.notion?.apiKey || !config.notion?.databaseId) {
        throw new Error('Notion API Key 和数据库 ID 不能为空');
      }
      
      if (!config.wechat?.appId || !config.wechat?.appSecret) {
        throw new Error('微信 AppID 和 AppSecret 不能为空');
      }
      
      // 直接透传配置，不再手动列举字段（ConfigService 会处理）
      await configService.saveConfig(config);
      
      // 重新初始化服务
      notionService = new NotionService(config.notion);
      weChatService = new WeChatService(configService);
      
      // 初始化 WordPress 服务（如果配置了）
      if (config.wordpress?.siteUrl && config.wordpress?.username && config.wordpress?.appPassword) {
        wordPressService = new WordPressService(configService);
      } else {
        wordPressService = null;
      }
      
      // 初始化 Bilibili 服务（如果启用了）
      if (config.bilibili?.enabled) {
        bilibiliService = new BilibiliService(configService);
      } else {
        bilibiliService = null;
      }
      
      syncService = new SyncService(notionService, weChatService, configService, wordPressService, bilibiliService);
      
      return true;
    } catch (error) {
      console.error('保存配置失败:', error);
      throw error;
    }
  });

  // Notion 相关
  ipcMain.handle('get-notion-pages', async (event, forceRefresh: boolean = false) => {
    if (!notionService) {
      throw new Error('Notion 服务未初始化，请先设置 API Key 和数据库 ID');
    }
    // 支持缓存和强制刷新
    const pages = await notionService.getArticles(forceRefresh);
    return pages;
  });

  ipcMain.handle('get-page-content', async (event, pageId: string) => {
    if (!notionService) {
      throw new Error('Notion 服务未初始化，请先设置 API Key 和数据库 ID');
    }
    console.log('正在获取页面内容:', pageId);
    const blocks = await notionService.getPageContent(pageId);
    console.log('获取到内容块数量:', blocks.length);
    return blocks;
  });

  // 同步相关
  ipcMain.handle('sync-article', async (event, pageId: string, publishMode: 'publish' | 'draft' = 'draft') => {
    if (!syncService) {
      throw new Error('同步服务未初始化，请先设置 API Key 和数据库 ID');
    }
    return syncService.syncArticle(pageId, publishMode);
  });

  // 预览文章
  ipcMain.handle('preview-article', async (event, pageId: string) => {
    if (!notionService || !syncService) {
      throw new Error('服务未初始化，请先设置 API Key 和数据库 ID');
    }
    try {
      const page = await notionService.getPageProperties(pageId);
      const blocks = await notionService.getPageContent(pageId);
      // 使用 SyncService 的转换方法
      const weChatArticle = (syncService as any).convertToWeChatArticleForPreview(page, blocks);
      return weChatArticle;
    } catch (error) {
      console.error('预览文章失败:', error);
      throw error;
    }
  });

  ipcMain.handle('get-sync-status', async (event, articleId: string) => {
    if (!syncService) {
      return {
        articleId,
        status: 'pending',
        error: '同步服务未初始化，请先设置 API Key 和数据库 ID'
      };
    }
    // 检查并重置卡住的同步状态
    syncService.resetStuckSyncStates();
    const state = syncService.getSyncState(articleId);
    return state || {
      articleId,
      status: 'pending'
    };
  });

  // 重置指定文章的同步状态
  ipcMain.handle('reset-sync-state', async (event, articleId: string) => {
    if (!syncService) {
      throw new Error('同步服务未初始化');
    }
    syncService.resetSyncState(articleId);
    return true;
  });

  // 取消指定文章的同步
  ipcMain.handle('cancel-sync', async (event, articleId: string) => {
    if (!syncService) {
      throw new Error('同步服务未初始化');
    }
    const cancelled = syncService.cancelSync(articleId);
    return cancelled;
  });

  ipcMain.handle('get-all-sync-states', async () => {
    if (!syncService) {
      return {};
    }
    return syncService.getAllSyncStates();
  });

  // 日志相关
  ipcMain.handle('get-logs', async (event, filter?: { level?: string, source?: string, keyword?: string }) => {
    return LogService.getLogs(filter);
  });

  ipcMain.handle('clear-logs', async () => {
    LogService.clearLogs();
    return true;
  });

  // 订阅日志更新
  const logSubscriptions = new Map<string, () => void>();
  
  ipcMain.handle('subscribe-logs', (event) => {
    const id = event.sender.id.toString();
    
    // 如果已经订阅，先取消
    if (logSubscriptions.has(id)) {
      logSubscriptions.get(id)?.();
    }
    
    // 创建新订阅
    const unsubscribe = LogService.subscribe((log) => {
      event.sender.send('log-update', log);
    });
    
    logSubscriptions.set(id, unsubscribe);
    
    // 当渲染进程关闭时清理
    event.sender.on('destroyed', () => {
      unsubscribe();
      logSubscriptions.delete(id);
    });
    
    return true;
  });

  // ==================== 测试连接 ====================

  // 测试微信连接
  ipcMain.handle('test-wechat-connection', async (event, appId: string, appSecret: string) => {
    try {
      const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.errcode) {
        throw new Error(`微信错误 ${data.errcode}: ${data.errmsg}`);
      }
      
      if (!data.access_token) {
        throw new Error('未能获取 access_token');
      }
      
      return { success: true, message: '连接成功' };
    } catch (error) {
      throw error instanceof Error ? error : new Error('连接失败');
    }
  });

  // 测试 WordPress 连接
  ipcMain.handle('test-wordpress-connection', async (event, siteUrl: string, username: string, appPassword: string) => {
    try {
      // 清理 URL
      const cleanUrl = siteUrl.replace(/\/+$/, '');
      const apiUrl = `${cleanUrl}/wp-json/wp/v2/users/me`;
      
      const auth = Buffer.from(`${username}:${appPassword}`).toString('base64');
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('认证失败，请检查用户名和应用密码');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (!data.id) {
        throw new Error('无法验证用户身份');
      }
      
      return { success: true, message: `连接成功，用户: ${data.name || data.slug}` };
    } catch (error) {
      throw error instanceof Error ? error : new Error('连接失败');
    }
  });

  // 同步文章到 WordPress
  ipcMain.handle('sync-to-wordpress', async (event, pageId: string, status: 'publish' | 'draft' = 'draft') => {
    if (!syncService) {
      throw new Error('同步服务未初始化');
    }
    if (!wordPressService) {
      throw new Error('WordPress 服务未初始化，请先配置 WordPress 信息');
    }
    return syncService.syncArticleToWordPress(pageId, status);
  });

  // 同时同步到微信和 WordPress
  ipcMain.handle('sync-to-both', async (
    event, 
    pageId: string, 
    wechatMode: 'publish' | 'draft' = 'draft',
    wpStatus: 'publish' | 'draft' = 'draft'
  ) => {
    if (!syncService) {
      throw new Error('同步服务未初始化');
    }
    return syncService.syncArticleToBoth(pageId, wechatMode, wpStatus);
  });

  // 获取 WordPress 分类
  ipcMain.handle('get-wp-categories', async () => {
    if (!wordPressService) {
      throw new Error('WordPress 服务未初始化');
    }
    return wordPressService.getCategories();
  });

  // 获取 WordPress 标签
  ipcMain.handle('get-wp-tags', async () => {
    if (!wordPressService) {
      throw new Error('WordPress 服务未初始化');
    }
    return wordPressService.getTags();
  });

  // 获取 WordPress 同步状态
  ipcMain.handle('get-wp-sync-status', async (event, articleId: string) => {
    if (!syncService) {
      return {
        articleId: `wp_${articleId}`,
        status: 'pending',
        error: '同步服务未初始化'
      };
    }
    const wpSyncKey = `wp_${articleId}`;
    const state = syncService.getSyncState(wpSyncKey);
    return state || {
      articleId: wpSyncKey,
      status: 'pending'
    };
  });

  // ==================== Bilibili 相关 ====================

  // 检查 biliup 是否安装 - 允许在服务未初始化时检查
  ipcMain.handle('check-biliup-installed', async () => {
    if (!bilibiliService) {
      // 临时创建服务来检查
      const { BilibiliService } = await import('../services/BilibiliService');
      const tempBiliService = new BilibiliService(configService!);
      return tempBiliService.checkBiliupInstalled();
    }
    return bilibiliService.checkBiliupInstalled();
  });

  // 检查 FFmpeg 是否安装 - 允许在服务未初始化时检查
  ipcMain.handle('check-ffmpeg-installed', async () => {
    if (!bilibiliService) {
      // 临时创建服务来检查
      const { BilibiliService } = await import('../services/BilibiliService');
      const tempBiliService = new BilibiliService(configService!);
      return tempBiliService.checkFFmpegInstalled();
    }
    return bilibiliService.checkFFmpegInstalled();
  });

  // 获取B站用户信息
  ipcMain.handle('get-bilibili-user', async () => {
    if (!bilibiliService) {
      return null;
    }
    try {
      return await bilibiliService.getUserInfo();
    } catch (error) {
      LogService.error('获取B站用户信息失败', 'IpcHandlers', error);
      return null;
    }
  });

  // B站登录 - 允许在未启用时也能登录（登录后再启用）
  ipcMain.handle('bilibili-login', async (event, method: 'qrcode' | 'sms' | 'password' = 'qrcode') => {
    // 如果服务未初始化，临时创建一个用于登录
    if (!bilibiliService) {
      const { BilibiliService } = await import('../services/BilibiliService');
      const tempBiliService = new BilibiliService(configService!);
      return tempBiliService.login(method);
    }
    return bilibiliService.login(method);
  });

  // B站退出登录
  ipcMain.handle('bilibili-logout', async () => {
    if (!bilibiliService) {
      const { BilibiliService } = await import('../services/BilibiliService');
      const tempBiliService = new BilibiliService(configService!);
      return tempBiliService.logout();
    }
    return bilibiliService.logout();
  });

  // 监听B站同步进度更新（从 BilibiliService 发送）
  ipcMain.on('bilibili-progress-update', (event, data: { phase: string; progress: number; title: string }) => {
    // 转发进度更新到所有渲染进程
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('bilibili-sync-progress', data);
    });
  });

  // 检查文章是否包含视频
  ipcMain.handle('check-has-videos', async (event, articleId: string) => {
    if (!syncService) {
      return false;
    }
    return syncService.hasVideos(articleId);
  });

  // 同步视频到B站
  ipcMain.handle('sync-to-bilibili', async (
    event,
    articleId: string,
    metadata: BilibiliMetadata,
    publishMode: 'draft' | 'publish' = 'draft',
    autoCompress: boolean = true
  ) => {
    if (!syncService) {
      throw new Error('同步服务未初始化');
    }
    if (!bilibiliService) {
      throw new Error('Bilibili 服务未初始化，请先启用 Bilibili 功能');
    }
    return syncService.syncVideoToBilibili(articleId, metadata, publishMode, autoCompress);
  });

  // 获取 B站 同步状态
  ipcMain.handle('get-bilibili-sync-status', async (event, articleId: string) => {
    if (!syncService) {
      return {
        articleId: `bili_${articleId}`,
        status: 'pending',
        error: '同步服务未初始化'
      };
    }
    const biliSyncKey = `bili_${articleId}`;
    const state = syncService.getSyncState(biliSyncKey);
    return state || {
      articleId: biliSyncKey,
      status: 'pending'
    };
  });

  // 清理 Bilibili 临时文件
  ipcMain.handle('bilibili-cleanup', async () => {
    if (!bilibiliService) {
      return false;
    }
    bilibiliService.cleanup();
    return true;
  });
} 