import { NotionService } from './NotionService';
import { WeChatService } from './WeChatService';
import { WordPressService } from './WordPressService';
import { BilibiliService } from './BilibiliService';
import { ConfigService } from './ConfigService';
import { LogService } from './LogService';
import { NotionPage, NotionBlock } from '../../shared/types/notion';
import { WeChatArticle } from '../../shared/types/wechat';
import { WordPressArticle } from '../../shared/types/wordpress';
import { BilibiliVideo, BilibiliMetadata, BilibiliUploadOptions } from '../../shared/types/bilibili';
import { SyncState, SyncStatus } from '../../shared/types/sync';
import { themes, ThemeStyles } from '../../shared/types/theme';
import {
  convertRichTextToHtml as convertRichTextToHtmlHelper,
  cutWeChatTitle as cutWeChatTitleHelper,
  escapeHtml as escapeHtmlHelper,
  filterWeChatUnsupportedChars as filterWeChatUnsupportedCharsHelper,
  SyncRichText,
} from './sync/html';
import {
  extractImageUrls as extractImageUrlsHelper,
  getCoverImageUrl as getCoverImageUrlHelper,
} from './sync/images';
import {
  convertBlockToHtml as convertBlockToHtmlHelper,
  convertBlocksToHtml as convertBlocksToHtmlHelper,
} from './sync/notionToHtml';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export class SyncService {
  private notionService: NotionService;
  private weChatService: WeChatService;
  private wordPressService: WordPressService | null = null;
  private bilibiliService: BilibiliService | null = null;
  private configService: ConfigService;
  private syncStates: { [key: string]: SyncState } = {};
  private syncStateFile: string;
  // 跟踪正在进行的同步操作，用于取消
  private activeSyncControllers: Map<string, AbortController> = new Map();

  constructor(
    notionService: NotionService, 
    weChatService: WeChatService, 
    configService: ConfigService,
    wordPressService?: WordPressService | null,
    bilibiliService?: BilibiliService | null
  ) {
    this.notionService = notionService;
    this.weChatService = weChatService;
    this.configService = configService;
    this.wordPressService = wordPressService || null;
    this.bilibiliService = bilibiliService || null;
    this.syncStateFile = path.join(app.getPath('userData'), 'sync-states.json');
    this.loadSyncStates();
  }

  /**
   * 设置 WordPress 服务（用于后续初始化）
   */
  setWordPressService(service: WordPressService | null): void {
    this.wordPressService = service;
  }

  /**
   * 获取 WordPress 服务
   */
  getWordPressService(): WordPressService | null {
    return this.wordPressService;
  }

  /**
   * 设置 Bilibili 服务（用于后续初始化）
   */
  setBilibiliService(service: BilibiliService | null): void {
    this.bilibiliService = service;
  }

  /**
   * 获取 Bilibili 服务
   */
  getBilibiliService(): BilibiliService | null {
    return this.bilibiliService;
  }

  /**
   * 按微信接口要求限制标题长度（按字符数截断）
   * 并过滤不支持的特殊字符和emoji
   * 说明：微信图文标题限制为 64 字符（按字符数，非字节），与 WeChatService.cutTextForWeChat 一致
   */
  private cutWeChatTitle(rawTitle: string, maxChars: number = 64): string {
    return cutWeChatTitleHelper(rawTitle, maxChars);
  }

  /**
   * 过滤微信公众号不支持的特殊字符和emoji
   * 微信公众号标题不支持大部分emoji和特殊符号
   */
  private filterWeChatUnsupportedChars(text: string): string {
    return filterWeChatUnsupportedCharsHelper(text);
  }

  // 转义 HTML 特殊字符
  private escapeHtml(text: string): string {
    return escapeHtmlHelper(text);
  }

  // 调整颜色亮度（用于创建渐变效果）
  // amount: 正数变亮，负数变暗（-100 到 100）
  private adjustColor(color: string, amount: number): string {
    // 移除 # 符号
    const hex = color.replace('#', '');
    
    // 解析 RGB 值
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    // 调整亮度
    const adjust = (c: number) => {
      const adjusted = c + Math.round((amount / 100) * 255);
      return Math.max(0, Math.min(255, adjusted));
    };
    
    const newR = adjust(r);
    const newG = adjust(g);
    const newB = adjust(b);
    
    // 转换回十六进制
    const toHex = (n: number) => {
      const hex = n.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    
    return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
  }

  // 将 rich_text 数组转换为 HTML
  private convertRichTextToHtml(richText: SyncRichText[], _theme?: ThemeStyles): string {
    return convertRichTextToHtmlHelper(richText);
  }

  // 获取封面图片 URL（优先使用页面 cover，然后 Cover 属性，最后 MainImage）
  private getCoverImageUrl(page: NotionPage): string {
    return getCoverImageUrlHelper(page);
  }

  // 加载同步状态
  private loadSyncStates() {
    try {
      if (fs.existsSync(this.syncStateFile)) {
        const data = fs.readFileSync(this.syncStateFile, 'utf8');
        this.syncStates = JSON.parse(data);
        
        const totalStates = Object.keys(this.syncStates).length;
        console.log(`已加载 ${totalStates} 个同步状态`);
        
        // 启动时自动重置所有 SYNCING 状态为 FAILED（程序重启意味着之前的同步已中断）
        let resetCount = 0;
        for (const [articleId, state] of Object.entries(this.syncStates)) {
          if (state.status === SyncStatus.SYNCING) {
            this.syncStates[articleId] = {
              ...state,
              status: SyncStatus.FAILED,
              error: '同步中断：程序重启',
              lastSyncTime: Date.now()
            };
            resetCount++;
          }
        }
        if (resetCount > 0) {
          console.log(`已重置 ${resetCount} 个卡住的同步状态`);
          this.saveSyncStates();
        }
      }
    } catch (error) {
      console.error('加载同步状态失败:', error);
      this.syncStates = {};
    }
  }

  // 保存同步状态
  private saveSyncStates() {
    try {
      fs.writeFileSync(this.syncStateFile, JSON.stringify(this.syncStates, null, 2));
      // 精简日志：只在开发模式下输出详细信息
      if (process.env.NODE_ENV === 'development') {
        console.log('同步状态已保存');
      }
    } catch (error) {
      console.error('保存同步状态失败:', error);
    }
  }

  // 更新同步状态
  private updateSyncState(articleId: string, status: SyncStatus, error?: string, results?: SyncState['results']): SyncState {
    // 保留之前的 results，如果有新的 results 则合并
    const existingState = this.syncStates[articleId];
    const state: SyncState = {
      articleId,
      status,
      lastSyncTime: Date.now(),
      error,
      results: results ? { ...existingState?.results, ...results } : existingState?.results
    };
    this.syncStates[articleId] = state;
    this.saveSyncStates();
    return state;
  }

  // 获取同步状态
  getSyncState(articleId: string): SyncState | undefined {
    return this.syncStates[articleId];
  }

  // 获取所有同步状态
  getAllSyncStates(): { [key: string]: SyncState } {
    return this.syncStates;
  }

  // 重置卡住的同步状态（如果同步时间超过3分钟，自动重置为失败）
  resetStuckSyncStates(): void {
    const stuckTimeout = 3 * 60 * 1000; // 3分钟
    const now = Date.now();
    
    for (const [articleId, state] of Object.entries(this.syncStates)) {
      if (state.status === SyncStatus.SYNCING && state.lastSyncTime) {
        const elapsed = now - state.lastSyncTime;
        if (elapsed > stuckTimeout) {
          LogService.warn(`检测到卡住的同步状态，文章ID: ${articleId}，已重置为失败`, 'SyncService');
          this.updateSyncState(articleId, SyncStatus.FAILED, '同步超时：操作时间过长，已自动重置');
          // 清理可能残留的 controller
          this.activeSyncControllers.delete(articleId);
        }
      }
    }
  }

  // 手动重置指定文章的同步状态
  resetSyncState(articleId: string): void {
    LogService.log(`手动重置文章同步状态: ${articleId}`, 'SyncService');
    delete this.syncStates[articleId];
    this.saveSyncStates();
  }

  async syncArticle(articleId: string, publishMode: 'publish' | 'draft' = 'publish'): Promise<SyncState> {
    // 如果已经有正在进行的同步，先取消它
    if (this.activeSyncControllers.has(articleId)) {
      LogService.warn(`文章 ${articleId} 已有正在进行的同步，先取消旧同步`, 'SyncService');
      this.cancelSync(articleId);
    }

    // 创建新的 AbortController
    const abortController = new AbortController();
    this.activeSyncControllers.set(articleId, abortController);

    // 添加超时机制（5分钟）
    const timeout = 5 * 60 * 1000; // 5 分钟
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<SyncState>((_, reject) => {
      timeoutId = setTimeout(() => {
        LogService.warn(`微信同步超时，正在取消...`, 'SyncService');
        abortController.abort(); // 超时时也触发取消
        reject(new Error('同步超时：操作时间超过5分钟，请检查网络连接或重试'));
      }, timeout);
    });

    const syncPromise = this._syncArticleInternal(articleId, publishMode, abortController.signal);
    
    try {
      // 使用 Promise.race 实现超时
      const result = await Promise.race([syncPromise, timeoutPromise]);
      // 同步完成，清理定时器和 controller
      clearTimeout(timeoutId!);
      this.activeSyncControllers.delete(articleId);
      return result;
    } catch (error) {
      // 清理定时器和 controller
      clearTimeout(timeoutId!);
      this.activeSyncControllers.delete(articleId);
      
      // 如果是取消或超时错误，确保状态被更新为失败
      if (error instanceof Error && (error.message.includes('同步超时') || error.message.includes('已取消'))) {
        const failedState = this.updateSyncState(articleId, SyncStatus.FAILED, error.message);
        LogService.error(`========== ${error.message.includes('已取消') ? '同步已取消' : '同步超时'}，状态已更新为失败 ==========`, 'SyncService');
        return failedState;
      }
      throw error;
    }
  }

  // 取消指定文章的同步
  cancelSync(articleId: string): boolean {
    LogService.log(`尝试取消文章 ${articleId} 的同步`, 'SyncService');
    LogService.log(`当前活跃的同步操作: ${Array.from(this.activeSyncControllers.keys()).join(', ') || '无'}`, 'SyncService');
    
    const controller = this.activeSyncControllers.get(articleId);
    if (controller) {
      try {
        controller.abort();
        this.activeSyncControllers.delete(articleId);
        LogService.log(`已取消文章 ${articleId} 的同步`, 'SyncService');
        this.updateSyncState(articleId, SyncStatus.FAILED, '同步已取消');
        return true;
      } catch (error) {
        LogService.error(`取消同步时出错: ${error instanceof Error ? error.message : String(error)}`, 'SyncService');
        // 即使出错也删除 controller 并更新状态
        this.activeSyncControllers.delete(articleId);
        this.updateSyncState(articleId, SyncStatus.FAILED, '同步已取消');
        return true;
      }
    }
    
    // 如果没有找到 controller，检查同步状态
    const currentState = this.syncStates[articleId];
    if (currentState && currentState.status === SyncStatus.SYNCING) {
      // 状态显示正在同步，但没有 controller，可能是状态不同步
      LogService.warn(`文章 ${articleId} 状态显示为同步中，但未找到对应的 controller，强制更新状态为已取消`, 'SyncService');
      this.updateSyncState(articleId, SyncStatus.FAILED, '同步已取消（状态已强制更新）');
      return true;
    }
    
    LogService.warn(`未找到文章 ${articleId} 的同步操作`, 'SyncService');
    return false;
  }

  private async _syncArticleInternal(articleId: string, publishMode: 'publish' | 'draft' = 'publish', abortSignal?: AbortSignal): Promise<SyncState> {
    try {
      // 在开始前检查是否已取消
      if (abortSignal?.aborted) {
        throw new Error('同步已取消');
      }
      
      LogService.log('========== 开始同步文章 ==========', 'SyncService');
      LogService.log(`文章ID: ${articleId}`, 'SyncService');
      LogService.log(`发布模式: ${publishMode}`, 'SyncService');
      this.updateSyncState(articleId, SyncStatus.SYNCING);
      
      // 再次检查是否已取消（在设置状态后）
      if (abortSignal?.aborted) {
        throw new Error('同步已取消');
      }

      // 验证服务是否初始化
      if (!this.notionService || !this.weChatService) {
        const error = '服务未初始化，请先保存正确的配置';
        LogService.error(error, 'SyncService');
        throw new Error(error);
      }

      // 获取 Notion 文章内容
      LogService.log('正在获取文章属性...', 'SyncService');
      let page;
      try {
        page = await this.notionService.getPageProperties(articleId);
        LogService.log(`文章标题: ${page.title}`, 'SyncService');
      } catch (error) {
        const errorMsg = '获取文章属性失败，请检查 Notion API Key 和数据库 ID 是否正确';
        LogService.error(errorMsg, 'SyncService');
        LogService.error(error instanceof Error ? error.message : String(error), 'SyncService');
        throw new Error(errorMsg);
      }

      if (!page || !page.properties) {
        throw new Error('无法获取文章属性，请检查数据库 ID 是否正确');
      }

      // 记录文章属性信息（仅记录关键信息）
      const linkStart = page.properties.LinkStart?.url || page.properties.LinkStart?.rich_text?.[0]?.plain_text || '';
      // 获取封面图片（优先使用页面 cover，然后 Cover 属性，最后 MainImage）
      const mainImage = this.getCoverImageUrl(page);
      if (mainImage) {
        LogService.log(`封面图片: ${mainImage.substring(0, 60)}...`, 'SyncService');
      }

      // 检查是否已取消
      if (abortSignal?.aborted) {
        throw new Error('同步已取消');
      }

      // 获取文章内容
      LogService.log('正在获取文章内容...', 'SyncService');
      let blocks;
      try {
        blocks = await this.notionService.getPageContent(articleId);
        LogService.log(`文章内容块数量: ${blocks.length}`, 'SyncService');
      } catch (error) {
        const errorMsg = '获取文章内容失败，请检查文章权限设置';
        LogService.error(errorMsg, 'SyncService');
        LogService.error(error instanceof Error ? error.message : String(error), 'SyncService');
        throw new Error(errorMsg);
      }

      if (!blocks || blocks.length === 0) {
        throw new Error('文章内容为空');
      }

      // 转换文章格式
      LogService.log('正在转换文章格式...', 'SyncService');
      LogService.log(`需要转换的块数量: ${blocks.length}`, 'SyncService');
      
      // **新增：提取所有图片URL**
      const imageUrls = this.extractImageUrls(blocks, mainImage);
      LogService.log(`提取到 ${imageUrls.length} 张图片`, 'SyncService');
      
      // **新增：批量上传图片到微信素材库**
      const imageUrlMap = new Map<string, string>(); // 原始URL -> 微信服务器URL
      const failedImages: string[] = []; // 记录失败的图片
      
      if (imageUrls.length > 0) {
        LogService.log(`开始上传 ${imageUrls.length} 张图片到微信素材库`, 'SyncService');
        for (let i = 0; i < imageUrls.length; i++) {
          if (abortSignal?.aborted) {
            throw new Error('同步已取消');
          }
          
          const imageUrl = imageUrls[i];
          try {
            // 只显示进度，不显示每张图片的详细URL
            LogService.log(`上传进度: ${i + 1}/${imageUrls.length}`, 'SyncService');
            const filename = `content_image_${i + 1}.png`;
            const uploadResult = await this.weChatService.uploadImage(imageUrl, abortSignal, filename);
            
            if (uploadResult.url) {
              imageUrlMap.set(imageUrl, uploadResult.url);
            } else {
              failedImages.push(imageUrl);
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            LogService.warn(`图片 ${i + 1} 上传失败: ${errorMsg}`, 'SyncService');
            failedImages.push(imageUrl);
          }
        }
        
        LogService.success(`图片上传完成: ${imageUrlMap.size}/${imageUrls.length} 成功`, 'SyncService');
        
        // 如果有失败的图片，给出简要提示
        if (failedImages.length > 0) {
          LogService.warn(`${failedImages.length} 张图片上传失败，建议检查图片URL是否可访问`, 'SyncService');
        }
      }
      
      // 使用之前已经获取的 linkStart 和 mainImage，以及图片URL映射
      const weChatArticle = this.convertToWeChatArticle(page, blocks, mainImage, linkStart, imageUrlMap);
      LogService.log(`转换完成，标题: ${weChatArticle.title}`, 'SyncService');
      LogService.log(`内容长度: ${weChatArticle.content.length} 字符`, 'SyncService');
      LogService.log(`原文链接: ${weChatArticle.contentSourceUrl || '无'}`, 'SyncService');
      
      // 如果内容为空，记录详细信息
      if (!weChatArticle.content || weChatArticle.content.trim().length === 0) {
        LogService.warn('警告：转换后的内容为空', 'SyncService');
        LogService.warn(`块详情: ${JSON.stringify(blocks.map(b => ({ type: b.type, has_children: b.has_children, content_keys: Object.keys(b.content || {}) })))}`, 'SyncService');
      }

      if (!weChatArticle.title) {
        throw new Error('文章标题不能为空');
      }

      // 检查内容是否为空（去除 HTML 标签后）
      const contentWithoutTags = weChatArticle.content.replace(/<[^>]*>/g, '').trim();
      if (!contentWithoutTags) {
        LogService.warn('文章内容为空，但可能包含媒体内容（视频、文件等）', 'SyncService');
        // 如果内容为空但有块，说明可能是纯媒体内容，添加提示
        if (blocks.length > 0) {
          const blockTypes = blocks.map(b => b.type).join(', ');
          LogService.warn(`块类型: ${blockTypes}`, 'SyncService');
          // 对于纯媒体内容，添加一个提示文本
          weChatArticle.content = '<p>本文包含媒体内容，请查看原文链接。</p>' + weChatArticle.content;
        } else {
          throw new Error('文章内容不能为空');
        }
      }

      // 发布到微信公众号
      LogService.log(`========== 开始${publishMode === 'publish' ? '发布' : '保存草稿'}到微信公众号 ==========`, 'SyncService');
      LogService.log(`文章标题: ${weChatArticle.title}`, 'SyncService');
      LogService.log(`文章作者: ${weChatArticle.author || '未设置'}`, 'SyncService');
      LogService.log(`文章摘要: ${weChatArticle.digest || '未设置'}`, 'SyncService');
      
      try {
        await this.weChatService.publishArticle(weChatArticle, publishMode, abortSignal);
        LogService.success(`========== 文章${publishMode === 'publish' ? '发布' : '保存草稿'}成功 ==========`, 'SyncService');
      } catch (error) {
        LogService.error(`========== ${publishMode === 'publish' ? '发布' : '保存草稿'}到微信失败 ==========`, 'SyncService');
        // 保留原始错误信息
        const errorMessage = error instanceof Error ? error.message : String(error);
        LogService.error(`错误: ${errorMessage}`, 'SyncService');
        throw new Error(`${publishMode === 'publish' ? '发布' : '保存草稿'}到微信失败: ${errorMessage}`);
      }

      // 更新 Notion 中的添加时间（如果需要）
      try {
        const currentAddedTime = page.properties.AddedTime?.date?.start;
        if (!currentAddedTime) {
          await this.notionService.updatePageProperties(articleId, {
            AddedTime: {
              date: {
                start: new Date().toISOString()
              }
            }
          });
        }
      } catch (error) {
        console.error('更新 Notion 时间失败:', error);
        // 不抛出错误，因为文章已经发布成功
      }

      const successState = this.updateSyncState(articleId, SyncStatus.SUCCESS);
      LogService.success('========== 同步完成，状态: 成功 ==========', 'SyncService');
      return successState;
    } catch (error) {
      LogService.error('========== 同步文章失败 ==========', 'SyncService');
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      LogService.error(`错误: ${errorMessage}`, 'SyncService');
      if (error instanceof Error && error.stack) {
        LogService.error(`堆栈: ${error.stack}`, 'SyncService');
      }
      const failedState = this.updateSyncState(articleId, SyncStatus.FAILED, errorMessage);
      LogService.log('========== 同步完成，状态: 失败 ==========', 'SyncService');
      return failedState;
    }
  }

  convertToWeChatArticleForPreview(
    page: NotionPage,
    blocks: NotionBlock[]
  ): WeChatArticle {
    const linkStart = page.properties.LinkStart?.url || page.properties.LinkStart?.rich_text?.[0]?.plain_text || '';
    
    // 获取封面图片（优先使用页面 cover，然后 Cover 属性，最后 MainImage）
    const mainImage = this.getCoverImageUrl(page);
    
    return this.convertToWeChatArticle(page, blocks, mainImage, linkStart);
  }

  /**
   * 从blocks中提取所有图片URL（不包括封面图，封面图会单独上传）
   */
  private extractImageUrls(blocks: NotionBlock[], _coverImageUrl?: string): string[] {
    return extractImageUrlsHelper(blocks, _coverImageUrl);
  }

  /**
   * 获取当前主题样式
   */
  private getCurrentTheme(): ThemeStyles {
    const wechatConfig = this.configService.getWeChatConfig();
    const themeName = wechatConfig.theme || 'default';
    return themes[themeName] || themes.default;
  }

  private convertToWeChatArticle(
    page: NotionPage,
    blocks: NotionBlock[],
    mainImageUrl?: string,
    linkStart?: string,
    imageUrlMap?: Map<string, string>
  ): WeChatArticle {
    // 获取配置
    const wechatConfig = this.configService.getWeChatConfig();
    
    // 构建文章内容，需要处理列表项的分组，传入图片URL映射
    let articleContent = this.convertBlocksToHtml(blocks, imageUrlMap);
    
    // 构建文章开头部分（顶部提示语 + 文章属性信息 + 封面图片）
    let articleHeader = '';
    
    // 如果有顶部提示语配置，添加到文章顶部
    if (wechatConfig.topNotice && wechatConfig.topNotice.trim()) {
      const topNoticeHtml = this.createTopNotice(wechatConfig.topNotice.trim());
      articleHeader = topNoticeHtml;
    }
    
    // 添加文章属性信息（在顶部提示语下方）
    const articleInfoHtml = this.createArticleInfo(page);
    if (articleInfoHtml) {
      if (articleHeader) {
        articleHeader = articleHeader + '\n\n' + articleInfoHtml;
      } else {
        articleHeader = articleInfoHtml;
      }
    }
    
    // 如果有封面图片，在文章属性信息下方插入封面图片
    if (mainImageUrl) {
      const coverImageHtml = this.createCoverImageHtml(mainImageUrl);
      if (articleHeader) {
        articleHeader = articleHeader + '\n\n' + coverImageHtml;
      } else {
        articleHeader = coverImageHtml;
      }
    }
    
    // 将文章开头部分和正文内容合并
    if (articleHeader) {
      articleContent = articleHeader + '\n\n' + articleContent;
    }
    
    // 添加微信文章样式包装 - 使用微信编辑器兼容的格式
    // 简化样式，避免被编辑器过滤，使用微信默认字体和样式
    const content = '<section style="font-size: 16px; line-height: 1.75; color: #333; word-wrap: break-word; box-sizing: border-box;">' +
      articleContent +
      '</section>';

    const authorProperty = page.properties.Author;
    const fromProperty = page.properties.From;
    // 使用 From 作为摘要，如果没有则使用标题
    const digest = fromProperty?.rich_text?.[0]?.plain_text || page.title;

    // 获取配置中的作者，如果配置中没有则从文章属性获取
    const author = wechatConfig.author || authorProperty?.rich_text?.[0]?.plain_text || '';

    // 应用标题模板（如果配置了）
    let finalTitle = page.title;
    if (wechatConfig.titleTemplate && wechatConfig.titleTemplate.trim()) {
      finalTitle = wechatConfig.titleTemplate.replace(/\{title\}/g, page.title);
      LogService.log(`应用标题模板: ${page.title} -> ${finalTitle}`, 'SyncService');
    }

    const safeTitle = this.cutWeChatTitle(finalTitle);

    return {
      title: safeTitle,
      content,
      author: author,
      digest: digest,
      showCoverPic: true,
      needOpenComment: true,
      contentSourceUrl: linkStart || '',
      coverImageUrl: mainImageUrl || '',
    };
  }

  // 创建顶部提示语 HTML
  private createTopNotice(noticeText: string): string {
    const theme = this.getCurrentTheme();
    // 处理换行：将换行符转换为 <br>
    const processedText = this.escapeHtml(noticeText).replace(/\n/g, '<br>');
    
    // 使用主题的提示语样式，加粗显示
    return `<section style="margin: 0 0 1.2em 0; padding: 0.8em 1em; background-color: ${theme.notice.background}; border-left: 4px solid ${theme.notice.borderColor}; border-radius: 4px; box-sizing: border-box;">
      <p style="margin: 0; padding: 0; color: ${theme.notice.color}; font-size: 14px; line-height: 1.6; font-weight: bold;">
        ${processedText}
      </p>
    </section>`;
  }

  // 创建文章属性信息 HTML
  private createArticleInfo(page: NotionPage): string {
    const infoRows: string[] = [];
    
    // 标题
    if (page.title) {
      infoRows.push(`<tr><td style="padding: 4px 8px; vertical-align: top; width: 80px; color: #666;"><strong>标题</strong></td><td style="padding: 4px 8px; color: #333;">${this.escapeHtml(page.title)}</td></tr>`);
    }
    
    // LinkStart
    const linkStart = page.properties.LinkStart?.url || page.properties.LinkStart?.rich_text?.[0]?.plain_text || '';
    if (linkStart) {
      infoRows.push(`<tr><td style="padding: 4px 8px; vertical-align: top; width: 80px; color: #666;"><strong>链接</strong></td><td style="padding: 4px 8px; color: #333;"><span style="display: inline-block; padding: 2px 6px; background-color: #e6f2ff; border: 1px solid #1890ff; border-radius: 3px; box-sizing: border-box;"><a href="${linkStart}" style="color: #1890ff; text-decoration: none; font-weight: 500; box-sizing: border-box;">${this.escapeHtml(linkStart)}</a></span></td></tr>`);
    }
    
    // From
    const from = page.properties.From?.rich_text?.[0]?.plain_text || '';
    if (from) {
      infoRows.push(`<tr><td style="padding: 4px 8px; vertical-align: top; width: 80px; color: #666;"><strong>来源</strong></td><td style="padding: 4px 8px; color: #333;">${this.escapeHtml(from)}</td></tr>`);
    }
    
    // Author
    const author = page.properties.Author?.rich_text?.[0]?.plain_text || '';
    if (author) {
      infoRows.push(`<tr><td style="padding: 4px 8px; vertical-align: top; width: 80px; color: #666;"><strong>作者</strong></td><td style="padding: 4px 8px; color: #333;">${this.escapeHtml(author)}</td></tr>`);
    }
    
    // FeatureTag
    const featureTag = page.properties.FeatureTag;
    if (featureTag) {
      let tagValue = '';
      if (featureTag.type === 'select' && featureTag.select) {
        tagValue = featureTag.select.name;
      } else if (featureTag.type === 'multi_select' && featureTag.multi_select) {
        tagValue = featureTag.multi_select.map((tag: any) => tag.name).join(', ');
      }
      if (tagValue) {
        infoRows.push(`<tr><td style="padding: 4px 8px; vertical-align: top; width: 80px; color: #666;"><strong>标签特色</strong></td><td style="padding: 4px 8px; color: #333;">${this.escapeHtml(tagValue)}</td></tr>`);
      }
    }
    
    // ExpectationsRate - 显示为 X/10 格式
    const expectationsRate = page.properties.ExpectationsRate?.number;
    if (expectationsRate !== undefined && expectationsRate !== null) {
      infoRows.push(`<tr><td style="padding: 4px 8px; vertical-align: top; width: 80px; color: #666;"><strong>个人期望</strong></td><td style="padding: 4px 8px; color: #333;">${expectationsRate}/10</td></tr>`);
    }
    
    // Engine
    const engine = page.properties.Engine?.select?.name || '';
    if (engine) {
      infoRows.push(`<tr><td style="padding: 4px 8px; vertical-align: top; width: 80px; color: #666;"><strong>使用引擎</strong></td><td style="padding: 4px 8px; color: #333;">${this.escapeHtml(engine)}</td></tr>`);
    }
    
    // AddedTime - 添加日期（支持 date 和 created_time 类型）
    const addedTimeProperty = page.properties.AddedTime;
    let addedTime = '';
    if (addedTimeProperty) {
      if (addedTimeProperty.type === 'date' && addedTimeProperty.date) {
        addedTime = addedTimeProperty.date.start;
      } else if (addedTimeProperty.type === 'created_time' && addedTimeProperty.created_time) {
        addedTime = addedTimeProperty.created_time;
      }
    }
    // 如果上面都没有，尝试从 page.addedTime 获取
    if (!addedTime && page.addedTime) {
      addedTime = page.addedTime;
    }
    
    if (addedTime) {
      const date = new Date(addedTime);
      const formattedDate = date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
      infoRows.push(`<tr><td style="padding: 4px 8px; vertical-align: top; width: 80px; color: #666;"><strong>添加日期</strong></td><td style="padding: 4px 8px; color: #333;">${formattedDate}</td></tr>`);
    }
    
    if (infoRows.length === 0) {
      return '';
    }
    
    // 使用表格格式，确保对齐美观
    return `<section style="margin: 0 0 1.2em 0; padding: 0.8em 1em; background-color: #f8f9fa; border-left: 4px solid #576b95; border-radius: 4px; box-sizing: border-box;">
      <table style="width: 100%; border-collapse: collapse; margin: 0; padding: 0; font-size: 14px; line-height: 1.6;">
        <tbody>
          ${infoRows.join('')}
        </tbody>
      </table>
    </section>`;
  }

  // 创建封面图片 HTML（在文章开头插入）
  private createCoverImageHtml(imageUrl: string): string {
    // 微信编辑器支持外部图片URL，使用标准的img标签格式
    // 确保URL是完整的，包含协议
    const fullUrl = imageUrl.startsWith('http') ? imageUrl : `https://${imageUrl}`;
    return `<p style="text-align: center; margin: 1em 0 1.5em 0;">
      <img src="${this.escapeHtml(fullUrl)}" alt="封面图片" style="max-width: 100%; height: auto; border-radius: 4px; display: block; margin: 0 auto;" />
    </p>`;
  }

  // 将块数组转换为HTML，处理列表项的分组
  // forWeChat: 是否为微信公众号生成HTML（微信不支持iframe和video标签）
  private convertBlocksToHtml(blocks: NotionBlock[], imageUrlMap?: Map<string, string>, forWeChat: boolean = true): string {
    return convertBlocksToHtmlHelper(blocks, imageUrlMap, forWeChat, this.getCurrentTheme());
  }

  private convertBlockToHtml(block: NotionBlock, imageUrlMap?: Map<string, string>, theme?: ThemeStyles, forWeChat: boolean = true): string {
    return convertBlockToHtmlHelper(block, imageUrlMap, theme || this.getCurrentTheme(), forWeChat);
  }

  // ==================== WordPress 同步方法 ====================

  /**
   * 同步文章到 WordPress
   */
  async syncArticleToWordPress(
    articleId: string, 
    status: 'publish' | 'draft' = 'draft'
  ): Promise<SyncState> {
    // 如果已经有正在进行的同步，先取消它
    const wpSyncKey = `wp_${articleId}`;
    if (this.activeSyncControllers.has(wpSyncKey)) {
      LogService.warn(`文章 ${articleId} 已有正在进行的 WordPress 同步，先取消旧同步`, 'SyncService');
      this.cancelSync(wpSyncKey);
    }

    // 创建新的 AbortController
    const abortController = new AbortController();
    this.activeSyncControllers.set(wpSyncKey, abortController);

    // 添加超时机制（5分钟）
    const timeout = 5 * 60 * 1000; // 5 分钟
    let timeoutId: NodeJS.Timeout;
    const timeoutPromise = new Promise<SyncState>((_, reject) => {
      timeoutId = setTimeout(() => {
        LogService.warn(`WordPress 同步超时，正在取消...`, 'SyncService');
        abortController.abort();
        reject(new Error('WordPress 同步超时：操作时间超过5分钟'));
      }, timeout);
    });

    const syncPromise = this._syncArticleToWordPressInternal(articleId, status, abortController.signal);

    try {
      const result = await Promise.race([syncPromise, timeoutPromise]);
      clearTimeout(timeoutId!);
      this.activeSyncControllers.delete(wpSyncKey);
      return result;
    } catch (error) {
      clearTimeout(timeoutId!);
      this.activeSyncControllers.delete(wpSyncKey);
      if (error instanceof Error && (error.message.includes('超时') || error.message.includes('已取消'))) {
        const failedState = this.updateSyncState(wpSyncKey, SyncStatus.FAILED, error.message);
        LogService.error(`WordPress 同步失败: ${error.message}`, 'SyncService');
        return failedState;
      }
      throw error;
    }
  }

  private async _syncArticleToWordPressInternal(
    articleId: string,
    status: 'publish' | 'draft',
    abortSignal?: AbortSignal
  ): Promise<SyncState> {
    const wpSyncKey = `wp_${articleId}`;
    
    try {
      if (abortSignal?.aborted) {
        throw new Error('同步已取消');
      }

      LogService.log('========== 开始同步文章到 WordPress ==========', 'SyncService');
      LogService.log(`文章ID: ${articleId}`, 'SyncService');
      LogService.log(`发布状态: ${status}`, 'SyncService');
      this.updateSyncState(wpSyncKey, SyncStatus.SYNCING);

      // 验证服务是否初始化
      if (!this.notionService) {
        throw new Error('Notion 服务未初始化');
      }
      if (!this.wordPressService) {
        throw new Error('WordPress 服务未初始化，请先配置 WordPress 信息');
      }

      // 获取 Notion 文章内容
      LogService.log('正在获取文章属性...', 'SyncService');
      const page = await this.notionService.getPageProperties(articleId);
      LogService.log(`文章标题: ${page.title}`, 'SyncService');

      if (abortSignal?.aborted) {
        throw new Error('同步已取消');
      }

      // 获取文章内容
      LogService.log('正在获取文章内容...', 'SyncService');
      const blocks = await this.notionService.getPageContent(articleId);
      LogService.log(`文章内容块数量: ${blocks.length}`, 'SyncService');

      if (!blocks || blocks.length === 0) {
        throw new Error('文章内容为空');
      }

      if (abortSignal?.aborted) {
        throw new Error('同步已取消');
      }

      // 获取封面图片
      const mainImage = this.getCoverImageUrl(page);
      LogService.log(`========== WordPress 封面图片处理 ==========`, 'SyncService');
      if (mainImage) {
        LogService.log(`找到封面图片 URL: ${mainImage.substring(0, 80)}...`, 'SyncService');
      } else {
        LogService.warn(`未找到封面图片！请检查 Notion 页面是否设置了封面（Cover）`, 'SyncService');
        LogService.warn(`支持的封面来源：1. 页面封面 2. Cover 属性 3. MainImage 属性`, 'SyncService');
      }

      if (abortSignal?.aborted) {
        throw new Error('同步已取消');
      }

      // 只上传封面图作为 WordPress 特色图片，文章内容使用外部图片链接
      let featuredMediaId: number | undefined;
      if (mainImage && this.wordPressService) {
        try {
          LogService.log('正在上传封面图片到 WordPress 媒体库...', 'SyncService');
          LogService.log(`图片 URL: ${mainImage}`, 'SyncService');
          const coverMedia = await this.wordPressService.uploadMedia(mainImage, undefined, abortSignal);
          if (coverMedia && coverMedia.id) {
            featuredMediaId = coverMedia.id;
            LogService.success(`✓ 封面图片上传成功！`, 'SyncService');
            LogService.success(`  media_id: ${coverMedia.id}`, 'SyncService');
            LogService.success(`  source_url: ${coverMedia.source_url || '未返回'}`, 'SyncService');
          } else {
            LogService.error(`✗ 封面图片上传异常：API 返回数据缺少 id`, 'SyncService');
            LogService.error(`  返回数据: ${JSON.stringify(coverMedia)}`, 'SyncService');
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          LogService.error(`✗ 封面图片上传失败: ${errorMsg}`, 'SyncService');
          LogService.warn('文章将不设置特色图片（featured image）', 'SyncService');
          // 如果是 Notion 临时 URL 过期，给出提示
          if (mainImage.includes('secure.notion-static.com') || mainImage.includes('s3.us-west')) {
            LogService.warn('提示：Notion 文件类型的图片 URL 有时效性，建议使用外部图片链接', 'SyncService');
          }
        }
      } else if (!mainImage) {
        LogService.warn('文章没有封面图片，将使用 WordPress 默认特色图片', 'SyncService');
      }
      
      LogService.log(`featuredMediaId 最终值: ${featuredMediaId || '未设置'}`, 'SyncService');

      if (abortSignal?.aborted) {
        throw new Error('同步已取消');
      }

      // 转换文章格式（文章内图片直接使用外部 URL，不上传）
      LogService.log('正在转换文章格式...', 'SyncService');
      const wpArticle = this.convertToWordPressArticle(page, blocks, status, undefined, featuredMediaId);
      LogService.log(`转换完成，标题: ${wpArticle.title}`, 'SyncService');
      LogService.log(`文章 featured_media 字段: ${wpArticle.featured_media || '未设置'}`, 'SyncService');

      // 发布到 WordPress
      LogService.log(`========== 开始${status === 'publish' ? '发布' : '保存草稿'}到 WordPress ==========`, 'SyncService');
      const post = await this.wordPressService.publishArticle(wpArticle, abortSignal);
      
      LogService.success(`========== WordPress ${status === 'publish' ? '发布' : '草稿保存'}成功 ==========`, 'SyncService');
      LogService.log(`文章链接: ${post.link}`, 'SyncService');

      const successState = this.updateSyncState(wpSyncKey, SyncStatus.SUCCESS);
      return successState;
    } catch (error) {
      LogService.error('========== WordPress 同步失败 ==========', 'SyncService');
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      LogService.error(`错误: ${errorMessage}`, 'SyncService');
      const failedState = this.updateSyncState(wpSyncKey, SyncStatus.FAILED, errorMessage);
      return failedState;
    }
  }

  /**
   * 同时同步文章到微信和 WordPress
   */
  async syncArticleToBoth(
    articleId: string,
    wechatMode: 'publish' | 'draft' = 'draft',
    wpStatus: 'publish' | 'draft' = 'draft'
  ): Promise<{ wechat: SyncState; wordpress: SyncState }> {
    LogService.log('========== 开始同时同步到微信和 WordPress ==========', 'SyncService');
    
    // 并行执行两个同步任务
    const [wechatResult, wpResult] = await Promise.allSettled([
      this.syncArticle(articleId, wechatMode),
      this.syncArticleToWordPress(articleId, wpStatus),
    ]);

    const wechatState: SyncState = wechatResult.status === 'fulfilled' 
      ? wechatResult.value 
      : { articleId, status: SyncStatus.FAILED, lastSyncTime: Date.now(), error: String(wechatResult.reason) };

    const wpState: SyncState = wpResult.status === 'fulfilled'
      ? wpResult.value
      : { articleId: `wp_${articleId}`, status: SyncStatus.FAILED, lastSyncTime: Date.now(), error: String(wpResult.reason) };

    LogService.log(`微信同步结果: ${wechatState.status}`, 'SyncService');
    LogService.log(`WordPress 同步结果: ${wpState.status}`, 'SyncService');

    return { wechat: wechatState, wordpress: wpState };
  }

  /**
   * 将 Notion 内容转换为 WordPress 文章格式
   */
  private convertToWordPressArticle(
    page: NotionPage,
    blocks: NotionBlock[],
    status: 'publish' | 'draft',
    imageUrlMap?: Map<string, string>,
    featuredMediaId?: number
  ): WordPressArticle {
    // 获取 WordPress 配置
    const wpConfig = this.configService.getWordPressConfig();
    
    // 构建文章内容 HTML（WordPress 支持 iframe/video，不使用微信格式）
    let articleContent = this.convertBlocksToHtml(blocks, imageUrlMap, false);

    // 获取文章属性
    const linkStart = page.properties.LinkStart?.url || page.properties.LinkStart?.rich_text?.[0]?.plain_text || '';
    const from = page.properties.From?.rich_text?.[0]?.plain_text || '';
    const author = page.properties.Author?.rich_text?.[0]?.plain_text || '';

    // 构建文章头部（顶部提示语 + 文章信息）
    let articleHeader = '';
    
    // 如果有 WordPress 顶部提示语配置，添加到文章顶部
    if (wpConfig?.topNotice && wpConfig.topNotice.trim()) {
      const topNoticeHtml = this.createWordPressTopNotice(wpConfig.topNotice.trim());
      articleHeader = topNoticeHtml;
    }

    // 创建文章信息头部（简化版，WordPress 通常不需要太多内联样式）
    const articleInfoHtml = this.createWordPressArticleInfo(page, linkStart, from, author);
    if (articleInfoHtml) {
      if (articleHeader) {
        articleHeader = articleHeader + '\n\n' + articleInfoHtml;
      } else {
        articleHeader = articleInfoHtml;
      }
    }
    
    // 合并头部和正文
    if (articleHeader) {
      articleContent = articleHeader + '\n\n' + articleContent;
    }

    // 应用标题模板（如果配置了）
    let finalTitle = page.title;
    if (wpConfig?.titleTemplate && wpConfig.titleTemplate.trim()) {
      finalTitle = wpConfig.titleTemplate.replace(/\{title\}/g, page.title);
      LogService.log(`应用标题模板: ${page.title} -> ${finalTitle}`, 'SyncService');
    }

    // 获取摘要
    const excerpt = from || page.title.substring(0, 150);

    // 获取标签（从 FeatureTag 属性）
    const featureTag = page.properties.FeatureTag;
    const tagNames: string[] = [];
    if (featureTag) {
      if (featureTag.type === 'select' && featureTag.select) {
        tagNames.push(featureTag.select.name);
      } else if (featureTag.type === 'multi_select' && featureTag.multi_select) {
        tagNames.push(...featureTag.multi_select.map((tag: any) => tag.name));
      }
    }

    return {
      title: finalTitle,
      content: articleContent,
      status,
      excerpt,
      featured_media: featuredMediaId,
      meta: {
        // 可以添加 SEO 相关的元数据
        _source_url: linkStart,
        _source_author: author,
        _source_from: from,
      },
    };
  }

  /**
   * 创建 WordPress 顶部提示语 HTML
   */
  private createWordPressTopNotice(noticeText: string): string {
    // 处理换行：将换行符转换为 <br>
    const processedText = this.escapeHtml(noticeText).replace(/\n/g, '<br>');
    
    // 使用 WordPress 友好的样式
    return `<div class="top-notice" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 15px 20px; margin-bottom: 20px; border-radius: 8px; font-weight: bold; text-align: center; box-shadow: 0 2px 10px rgba(102, 126, 234, 0.3);">
  <p style="margin: 0; line-height: 1.6;">${processedText}</p>
</div>`;
  }

  /**
   * 创建 WordPress 文章信息头部（与微信保持一致的完整信息）
   */
  private createWordPressArticleInfo(
    page: NotionPage,
    linkStart: string,
    from: string,
    author: string
  ): string {
    const infoRows: string[] = [];

    // 标题
    if (page.title) {
      infoRows.push(`<tr><td style="padding: 6px 10px; vertical-align: top; width: 90px; color: #666; font-weight: 600;">标题</td><td style="padding: 6px 10px; color: #333;">${this.escapeHtml(page.title)}</td></tr>`);
    }

    // 链接
    if (linkStart) {
      infoRows.push(`<tr><td style="padding: 6px 10px; vertical-align: top; width: 90px; color: #666; font-weight: 600;">链接</td><td style="padding: 6px 10px;"><a href="${linkStart}" target="_blank" style="color: #0073aa; text-decoration: none;">${this.escapeHtml(linkStart)}</a></td></tr>`);
    }

    // 来源
    if (from) {
      infoRows.push(`<tr><td style="padding: 6px 10px; vertical-align: top; width: 90px; color: #666; font-weight: 600;">来源</td><td style="padding: 6px 10px; color: #333;">${this.escapeHtml(from)}</td></tr>`);
    }

    // 作者
    if (author) {
      infoRows.push(`<tr><td style="padding: 6px 10px; vertical-align: top; width: 90px; color: #666; font-weight: 600;">作者</td><td style="padding: 6px 10px; color: #333;">${this.escapeHtml(author)}</td></tr>`);
    }

    // FeatureTag - 标签特色
    const featureTag = page.properties.FeatureTag;
    if (featureTag) {
      let tagValue = '';
      if (featureTag.type === 'select' && featureTag.select) {
        tagValue = featureTag.select.name;
      } else if (featureTag.type === 'multi_select' && featureTag.multi_select) {
        tagValue = featureTag.multi_select.map((tag: any) => tag.name).join(', ');
      }
      if (tagValue) {
        infoRows.push(`<tr><td style="padding: 6px 10px; vertical-align: top; width: 90px; color: #666; font-weight: 600;">标签特色</td><td style="padding: 6px 10px; color: #333;">${this.escapeHtml(tagValue)}</td></tr>`);
      }
    }

    // ExpectationsRate - 个人期望
    const expectationsRate = page.properties.ExpectationsRate?.number;
    if (expectationsRate !== undefined && expectationsRate !== null) {
      infoRows.push(`<tr><td style="padding: 6px 10px; vertical-align: top; width: 90px; color: #666; font-weight: 600;">个人期望</td><td style="padding: 6px 10px; color: #333;">${expectationsRate}/10</td></tr>`);
    }

    // Engine - 使用引擎
    const engine = page.properties.Engine?.select?.name || '';
    if (engine) {
      infoRows.push(`<tr><td style="padding: 6px 10px; vertical-align: top; width: 90px; color: #666; font-weight: 600;">使用引擎</td><td style="padding: 6px 10px; color: #333;">${this.escapeHtml(engine)}</td></tr>`);
    }

    // AddedTime - 添加日期
    const addedTimeProperty = page.properties.AddedTime;
    let addedTime = '';
    if (addedTimeProperty) {
      if (addedTimeProperty.type === 'date' && addedTimeProperty.date) {
        addedTime = addedTimeProperty.date.start;
      } else if (addedTimeProperty.type === 'created_time' && addedTimeProperty.created_time) {
        addedTime = addedTimeProperty.created_time;
      }
    }
    if (!addedTime && page.addedTime) {
      addedTime = page.addedTime;
    }
    if (addedTime) {
      const date = new Date(addedTime);
      const formattedDate = date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
      infoRows.push(`<tr><td style="padding: 6px 10px; vertical-align: top; width: 90px; color: #666; font-weight: 600;">添加日期</td><td style="padding: 6px 10px; color: #333;">${formattedDate}</td></tr>`);
    }

    if (infoRows.length === 0) {
      return '';
    }

    // 使用表格格式,与微信保持一致的风格
    return `<div class="article-meta" style="margin: 0 0 20px 0; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #0073aa; border-radius: 4px;">
  <table style="width: 100%; border-collapse: collapse; font-size: 14px; line-height: 1.6;">
    <tbody>
      ${infoRows.join('\n      ')}
    </tbody>
  </table>
</div>`;
  }

  /**
   * 同步视频到B站
   */
  async syncVideoToBilibili(
    articleId: string,
    metadata: BilibiliMetadata,
    publishMode: 'draft' | 'publish' = 'draft',
    autoCompress: boolean = true
  ): Promise<SyncState> {
    const biliSyncKey = `bili_${articleId}`;
    
    LogService.log('========== syncVideoToBilibili 被调用 ==========', 'SyncService');
    LogService.log(`  - articleId: ${articleId}`, 'SyncService');
    LogService.log(`  - publishMode: ${publishMode}`, 'SyncService');
    LogService.log(`  - metadata.title: ${metadata?.title}`, 'SyncService');
    LogService.log(`  - metadata.tid: ${metadata?.tid}`, 'SyncService');
    LogService.log(`  - metadata.tags: [${(metadata?.tags || []).join(', ')}]`, 'SyncService');
    
    try {
      if (!this.bilibiliService) {
        throw new Error('Bilibili 服务未初始化');
      }

      // 创建 AbortController 用于取消
      const abortController = new AbortController();
      this.activeSyncControllers.set(biliSyncKey, abortController);

      LogService.log('========== SyncService: 开始同步视频到B站 ==========', 'SyncService');
      this.updateSyncState(biliSyncKey, SyncStatus.SYNCING);

      // 1. 获取文章页面
      const page = await this.notionService.getPageProperties(articleId);
      LogService.log(`文章标题: ${page.title}`, 'SyncService');

      // 2. 从 Notion 获取更多文章属性（用于简介模板）
      const linkStart = page.properties.LinkStart?.url || page.properties.LinkStart?.rich_text?.[0]?.plain_text || '';
      const from = page.properties.From?.rich_text?.[0]?.plain_text || '';
      const author = page.properties.Author?.rich_text?.[0]?.plain_text || '';
      const engine = page.properties.Engine?.select?.name || '';
      const expectationsRate = page.properties.ExpectationsRate?.number;
      
      // 提取标签
      const featureTag = page.properties.FeatureTag;
      let tags: string[] = [];
      if (featureTag) {
        if (featureTag.type === 'select' && featureTag.select) {
          tags = [featureTag.select.name];
        } else if (featureTag.type === 'multi_select' && featureTag.multi_select) {
          tags = featureTag.multi_select.map((tag: any) => tag.name);
        }
      }
      
      // 获取添加时间
      const addedTimeProperty = page.properties.AddedTime;
      let addedTime = '';
      if (addedTimeProperty) {
        if (addedTimeProperty.type === 'date' && addedTimeProperty.date) {
          addedTime = addedTimeProperty.date.start;
        } else if (addedTimeProperty.type === 'created_time' && addedTimeProperty.created_time) {
          addedTime = addedTimeProperty.created_time;
        }
      }
      if (!addedTime && page.addedTime) {
        addedTime = page.addedTime;
      }
      
      LogService.log(`文章属性 - 来源: ${from}, 作者: ${author}, 链接: ${linkStart}`, 'SyncService');
      
      // 如果 metadata 中没有指定 source，使用 Notion 中的 LinkStart
      if (linkStart && !metadata.source) {
        metadata.source = linkStart;
      }
      
      // 自动获取封面图片（如果 metadata 中没有指定 cover）
      if (!metadata.cover) {
        const coverUrl = this.getCoverImageUrl(page);
        if (coverUrl) {
          metadata.cover = coverUrl;
          LogService.log(`已自动获取封面图片: ${coverUrl.substring(0, 50)}...`, 'SyncService');
        } else {
          LogService.log('未找到封面图片', 'SyncService');
        }
      } else {
        LogService.log(`使用指定的封面图片: ${metadata.cover.substring(0, 50)}...`, 'SyncService');
      }
      
      // 将 Notion 属性添加到 metadata 中（用于简介模板）
      if (!metadata.notionProps) {
        metadata.notionProps = {};
      }
      metadata.notionProps = {
        from,
        author,
        engine,
        expectationsRate: expectationsRate ?? undefined,
        tags,
        addedTime,
        linkStart
      };

      // 应用标题模板（如果配置了）
      const biliConfig = this.configService.getBilibiliConfig();
      if (biliConfig.titleTemplate && biliConfig.titleTemplate.trim()) {
        const originalTitle = metadata.title;
        metadata.title = biliConfig.titleTemplate.replace(/\{title\}/g, metadata.title);
        LogService.log(`应用标题模板: ${originalTitle} -> ${metadata.title}`, 'SyncService');
      }

      // 3. 提取视频
      LogService.log('正在提取视频...', 'SyncService');
      const videoInfos = await this.notionService.extractVideos(articleId);
      
      if (videoInfos.length === 0) {
        throw new Error('文章中没有找到视频');
      }

      LogService.log(`找到 ${videoInfos.length} 个视频`, 'SyncService');

      // 4. 下载视频
      const videos: BilibiliVideo[] = [];
      for (let i = 0; i < videoInfos.length; i++) {
        const videoInfo = videoInfos[i];
        LogService.log(`正在下载视频 ${i + 1}/${videoInfos.length}...`, 'SyncService');
        
        const video: BilibiliVideo = {
          url: videoInfo.url,
          caption: videoInfo.caption,
          type: videoInfo.type
        };

        const localPath = await this.bilibiliService.downloadVideo(
          video,
          abortController.signal,
          articleId  // 传递 articleId 用于进度追踪
        );
        
        video.localPath = localPath;
        videos.push(video);
      }

      // 5. 准备上传选项
      const uploadOptions: BilibiliUploadOptions = {
        publishMode,
        metadata,
        videos,
        autoCompress,
        compressionQuality: 23,
        articleId  // 添加 articleId 用于进度追踪
      };

      // 5. 上传到B站
      LogService.log(`开始上传到B站，模式: ${publishMode}`, 'SyncService');
      const result = await this.bilibiliService.uploadVideo(
        uploadOptions,
        abortController.signal
      );

      LogService.success('========== B站同步成功 ==========', 'SyncService');
      if (result.link) {
        LogService.log(`稿件链接: ${result.link}`, 'SyncService');
      }
      if (result.bvid) {
        LogService.log(`稿件BV号: ${result.bvid}`, 'SyncService');
      }

      // 清理控制器
      this.activeSyncControllers.delete(biliSyncKey);

      // 保存B站上传结果到同步状态（包含标题用于后续验证）
      const successState = this.updateSyncState(biliSyncKey, SyncStatus.SUCCESS, undefined, {
        bilibili: {
          bvid: result.bvid,
          link: result.link,
          aid: result.aid,
          title: metadata.title  // 保存视频标题
        }
      });
      return successState;
    } catch (error) {
      LogService.error('========== B站同步失败 ==========', 'SyncService');
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      LogService.error(`错误: ${errorMessage}`, 'SyncService');
      
      // 清理控制器
      this.activeSyncControllers.delete(biliSyncKey);
      
      const failedState = this.updateSyncState(biliSyncKey, SyncStatus.FAILED, errorMessage);
      return failedState;
    }
  }

  /**
   * 检查文章是否包含视频
   */
  async hasVideos(articleId: string): Promise<boolean> {
    try {
      return await this.notionService.hasVideos(articleId);
    } catch {
      LogService.error('检查视频失败', 'SyncService');
      return false;
    }
  }
}
