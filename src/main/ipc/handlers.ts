import { ipcMain, dialog, Notification } from 'electron';
import { ConfigService } from '../services/ConfigService';
import { NotionService } from '../services/NotionService';
import { SyncService } from '../services/SyncService';
import { WeChatService } from '../services/WeChatService';
import { WordPressService } from '../services/WordPressService';
import { LogService } from '../services/LogService';
import { Config } from '../../shared/types/config';

let notionService: NotionService | null = null;
let weChatService: WeChatService | null = null;
let wordPressService: WordPressService | null = null;
let syncService: SyncService | null = null;

export function setupIpcHandlers(
  configService: ConfigService,
  _notionService: NotionService | null,
  _weChatService: WeChatService | null,
  _syncService: SyncService | null,
  _wordPressService?: WordPressService | null
) {
  notionService = _notionService;
  weChatService = _weChatService;
  syncService = _syncService;
  wordPressService = _wordPressService || null;

  // 配置相关
  ipcMain.handle('get-config', async () => {
    return configService.getConfig();
  });

  ipcMain.handle('show-notification', async (event, { title, body }) => {
    try {
      console.log('主进程 - 收到显示通知请求');
      console.log('参数:', { title, body });
      
      // 尝试使用系统通知
      try {
        const notification = new Notification({
          title: title,
          body: body,
          silent: false
        });
        
        notification.show();
      } catch (error) {
        console.warn('系统通知失败，使用对话框:', error);
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

  ipcMain.handle('save-config', async (event, config: any) => {
    try {
      // ⚠️ 安全：不记录包含API密钥的完整配置
      console.log('收到配置保存请求 - Notion:', !!config.notion?.apiKey, 'WeChat:', !!config.wechat?.appId, 'WordPress:', !!config.wordpress?.siteUrl);
      
      // 直接使用传入的配置对象
      const configToSave: Config = {
        notion: {
          apiKey: config.notion.apiKey,
          databaseId: config.notion.databaseId
        },
        wechat: {
          appId: config.wechat.appId,
          appSecret: config.wechat.appSecret,
          author: config.wechat.author,
          topNotice: config.wechat.topNotice
        },
        // WordPress 配置（可选）
        wordpress: config.wordpress ? {
          siteUrl: config.wordpress.siteUrl,
          username: config.wordpress.username,
          appPassword: config.wordpress.appPassword,
          defaultCategory: config.wordpress.defaultCategory,
          defaultAuthor: config.wordpress.defaultAuthor
        } : undefined
      };
      
      // 验证配置
      if (!configToSave.notion.apiKey || !configToSave.notion.databaseId) {
        throw new Error('Notion API Key 和数据库 ID 不能为空');
      }
      
      if (!configToSave.wechat.appId || !configToSave.wechat.appSecret) {
        throw new Error('微信 AppID 和 AppSecret 不能为空');
      }
      
      // 保存配置
      console.log('正在保存配置到文件...');
      await configService.saveConfig(configToSave);
      console.log('配置已保存到文件');
      
      // 重新初始化服务
      console.log('正在重新初始化服务...');
      notionService = new NotionService(configToSave.notion);
      weChatService = new WeChatService(configService);
      
      // 初始化 WordPress 服务（如果配置了）
      if (configToSave.wordpress?.siteUrl && configToSave.wordpress?.username && configToSave.wordpress?.appPassword) {
        wordPressService = new WordPressService(configService);
        console.log('WordPress 服务初始化成功');
      } else {
        wordPressService = null;
        console.log('WordPress 配置不完整，服务未初始化');
      }
      
      syncService = new SyncService(notionService, weChatService, configService, wordPressService);
      console.log('服务重新初始化成功');
      
      return true;
    } catch (error) {
      console.error('保存配置失败:', error);
      throw error;
    }
  });

  // Notion 相关
  ipcMain.handle('get-notion-pages', async () => {
    if (!notionService) {
      throw new Error('Notion 服务未初始化，请先设置 API Key 和数据库 ID');
    }
    // 减少日志输出，避免日志过多
    const pages = await notionService.getArticles();
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

  // ==================== WordPress 相关 ====================

  // 测试 WordPress 连接
  ipcMain.handle('test-wordpress-connection', async () => {
    if (!wordPressService) {
      return { success: false, message: 'WordPress 服务未初始化，请先配置 WordPress 信息' };
    }
    return wordPressService.testConnection();
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
} 