import { NotionService } from './NotionService';
import { WeChatService } from './WeChatService';
import { WordPressService } from './WordPressService';
import { ConfigService } from './ConfigService';
import { LogService } from './LogService';
import { NotionPage, NotionBlock } from '../../shared/types/notion';
import { WeChatArticle } from '../../shared/types/wechat';
import { WordPressArticle } from '../../shared/types/wordpress';
import { SyncState, SyncStatus } from '../../shared/types/sync';
import { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { themes, ThemeStyles } from '../../shared/types/theme';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

interface RichText {
  plain_text: string;
}

export class SyncService {
  private notionService: NotionService;
  private weChatService: WeChatService;
  private wordPressService: WordPressService | null = null;
  private configService: ConfigService;
  private syncStates: { [key: string]: SyncState } = {};
  private syncStateFile: string;
  // 跟踪正在进行的同步操作，用于取消
  private activeSyncControllers: Map<string, AbortController> = new Map();

  constructor(
    notionService: NotionService, 
    weChatService: WeChatService, 
    configService: ConfigService,
    wordPressService?: WordPressService | null
  ) {
    this.notionService = notionService;
    this.weChatService = weChatService;
    this.configService = configService;
    this.wordPressService = wordPressService || null;
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
   * 按微信接口要求限制标题长度（按 UTF-8 字节数截断）
   * 说明：微信图文标题限制大约 64 字节，这里使用 64 作为安全上限
   */
  private cutWeChatTitle(rawTitle: string, maxBytes: number = 64): string {
    if (!rawTitle) return '';

    let bytes = 0;
    let result = '';

    for (const ch of rawTitle) {
      const len = Buffer.byteLength(ch, 'utf8');
      if (bytes + len > maxBytes) {
        break;
      }
      bytes += len;
      result += ch;
    }

    // 如果被截断，可以在日志里记录一下方便排查
    if (result.length < rawTitle.length) {
      LogService.warn(
        `标题长度超出微信限制，已自动截断。原始长度: ${rawTitle.length} 字符，截断后: ${result.length} 字符`,
        'SyncService'
      );
    }

    return result;
  }

  // 转义 HTML 特殊字符
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // 将 rich_text 数组转换为 HTML
  private convertRichTextToHtml(richText: Array<{ plain_text: string; href?: string | null; annotations?: any }>, theme?: ThemeStyles): string {
    if (richText.length === 0) {
      return '';
    }
    const currentTheme = theme || this.getCurrentTheme();
    
    const parts: string[] = [];
    
    for (const text of richText) {
      let content = this.escapeHtml(text.plain_text);
      
      // 如果有链接，用独立的块级div包裹（两行显示）
      if (text.href) {
        // 应用格式到链接文字
        if (text.annotations?.bold) {
          content = `<strong>${content}</strong>`;
        }
        if (text.annotations?.italic) {
          content = `<em>${content}</em>`;
        }
        // 独立的链接块：第一行蓝色文字，第二行灰色URL
        parts.push(`<span style="display: inline-block; margin: 0.3em 0; vertical-align: top;"><a href="${text.href}" style="color: #576b95; text-decoration: none; border-bottom: 1px solid #576b95; font-weight: 500; display: block;">${content}</a><span style="color: #999; font-size: 12px; display: block; margin-top: 0.2em; line-height: 1.4;">${text.href}</span></span>`);
        continue;
      }
      
      // 非链接文本的格式处理
      if (text.annotations?.bold) {
        content = `<strong>${content}</strong>`;
      }
      if (text.annotations?.italic) {
        content = `<em>${content}</em>`;
      }
      if (text.annotations?.code) {
        content = `<code style="background-color: #f5f5f5; padding: 3px 6px; border-radius: 3px; font-family: 'SF Mono', Consolas, Monaco, monospace; font-size: 0.9em; color: #d73a49;">${content}</code>`;
      }
      
      parts.push(content);
    }
    
    return parts.join('');
  }

  // 获取封面图片 URL（优先使用页面 cover，然后 Cover 属性，最后 MainImage）
  private getCoverImageUrl(page: NotionPage): string {
    LogService.log(`[getCoverImageUrl] 开始查找封面图片...`, 'SyncService');
    
    // 1. 优先使用页面的 cover 属性（Notion API 直接提供的封面）
    if (page.cover) {
      LogService.log(`[getCoverImageUrl] 找到页面 cover 属性，类型: ${page.cover.type}`, 'SyncService');
      if (page.cover.type === 'external' && page.cover.external) {
        const url = page.cover.external.url;
        LogService.log(`[getCoverImageUrl] ✓ 使用外部封面图片: ${url.substring(0, 80)}...`, 'SyncService');
        return url;
      } else if (page.cover.type === 'file' && page.cover.file) {
        const url = page.cover.file.url;
        LogService.log(`[getCoverImageUrl] ✓ 使用 Notion 文件封面图片: ${url.substring(0, 80)}...`, 'SyncService');
        // 提醒：Notion 文件 URL 有时效性
        if (url.includes('secure.notion-static.com') || url.includes('s3.us-west')) {
          LogService.warn(`[getCoverImageUrl] 注意：Notion 文件 URL 有时效性，可能会过期`, 'SyncService');
        }
        return url;
      } else {
        LogService.warn(`[getCoverImageUrl] cover 类型不支持: ${page.cover.type}`, 'SyncService');
      }
    } else {
      LogService.log('[getCoverImageUrl] 页面没有 cover 属性，查找自定义属性...', 'SyncService');
    }

    // 2. 查找 Cover 属性（自定义属性）
    let coverProp = page.properties.Cover || page.properties['Cover'];
    let propSource = 'Cover';
    if (!coverProp) {
      // 3. 如果没有 Cover，查找 MainImage
      coverProp = page.properties.MainImage || page.properties['Main Image'];
      propSource = 'MainImage';
    }
    
    if (!coverProp) {
      LogService.warn('[getCoverImageUrl] ✗ 未找到 Cover 或 MainImage 属性', 'SyncService');
      return '';
    }
    
    LogService.log(`[getCoverImageUrl] 找到 ${propSource} 属性，类型: ${coverProp.type}`, 'SyncService');
    
    // 处理不同类型的属性
    if (coverProp.type === 'files' && Array.isArray(coverProp.files)) {
      // files 类型，取第一个文件的 URL
      const firstFile = coverProp.files[0];
      if (firstFile) {
        if (firstFile.type === 'file' && firstFile.file) {
          LogService.log(`[getCoverImageUrl] ✓ 从 ${propSource} files 属性获取封面`, 'SyncService');
          return firstFile.file.url;
        } else if (firstFile.type === 'external' && firstFile.external) {
          LogService.log(`[getCoverImageUrl] ✓ 从 ${propSource} files(external) 属性获取封面`, 'SyncService');
          return firstFile.external.url;
        }
      }
      LogService.warn(`[getCoverImageUrl] ${propSource} files 属性为空`, 'SyncService');
    } else if (coverProp.type === 'url') {
      if (coverProp.url) {
        LogService.log(`[getCoverImageUrl] ✓ 从 ${propSource} url 属性获取封面`, 'SyncService');
        return coverProp.url;
      }
    } else if ((coverProp as any).url) {
      LogService.log(`[getCoverImageUrl] ✓ 从 ${propSource} 直接 url 获取封面`, 'SyncService');
      return (coverProp as any).url;
    } else if (coverProp.rich_text?.[0]?.plain_text) {
      LogService.log(`[getCoverImageUrl] ✓ 从 ${propSource} rich_text 获取封面 URL`, 'SyncService');
      return coverProp.rich_text[0].plain_text;
    }
    
    LogService.warn(`[getCoverImageUrl] ✗ ${propSource} 属性存在但无法提取 URL`, 'SyncService');
    return '';
  }

  // 加载同步状态
  private loadSyncStates() {
    try {
      if (fs.existsSync(this.syncStateFile)) {
        const data = fs.readFileSync(this.syncStateFile, 'utf8');
        this.syncStates = JSON.parse(data);
        console.log('已加载同步状态:', this.syncStates);
        
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
      console.log('已保存同步状态');
    } catch (error) {
      console.error('保存同步状态失败:', error);
    }
  }

  // 更新同步状态
  private updateSyncState(articleId: string, status: SyncStatus, error?: string): SyncState {
    const state: SyncState = {
      articleId,
      status,
      lastSyncTime: Date.now(),
      error
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
      const from = page.properties.From?.rich_text?.[0]?.plain_text || '';
      const author = page.properties.Author?.rich_text?.[0]?.plain_text || '';
      // 获取封面图片（优先使用页面 cover，然后 Cover 属性，最后 MainImage）
      let mainImage = this.getCoverImageUrl(page);
      LogService.log(`封面图片: ${mainImage || '未找到'}`, 'SyncService');
      // 移除详细日志，避免日志过多

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
        LogService.log('========== 开始批量上传图片到微信素材库 ==========', 'SyncService');
        for (let i = 0; i < imageUrls.length; i++) {
          if (abortSignal?.aborted) {
            throw new Error('同步已取消');
          }
          
          const imageUrl = imageUrls[i];
          try {
            LogService.log(`[${i + 1}/${imageUrls.length}] 正在上传: ${imageUrl.substring(0, 50)}...`, 'SyncService');
            // 为正文图片生成有意义的文件名
            const filename = `content_image_${i + 1}.png`;
            const uploadResult = await this.weChatService.uploadImage(imageUrl, abortSignal, filename);
            
            if (uploadResult.url) {
              imageUrlMap.set(imageUrl, uploadResult.url);
              LogService.success(`✓ 上传成功`, 'SyncService');
            } else {
              LogService.error(`✗ 上传成功但未返回URL`, 'SyncService');
              failedImages.push(imageUrl);
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            LogService.error(`✗ 上传失败: ${errorMsg}`, 'SyncService');
            failedImages.push(imageUrl);
          }
        }
        
        LogService.success(`========== 图片上传完成: ${imageUrlMap.size}/${imageUrls.length} 成功 ==========`, 'SyncService');
        
        // 如果有失败的图片，给出明确提示
        if (failedImages.length > 0) {
          LogService.warn(`\n以下 ${failedImages.length} 张图片上传失败：`, 'SyncService');
          failedImages.forEach((url, index) => {
            LogService.warn(`  ${index + 1}. ${url.substring(0, 80)}`, 'SyncService');
          });
          LogService.warn(`\n建议：`, 'SyncService');
          LogService.warn(`  1. 检查图片URL是否可访问`, 'SyncService');
          LogService.warn(`  2. 某些网站的图片可能需要登录才能访问`, 'SyncService');
          LogService.warn(`  3. 可以手动下载图片后上传到 Notion`, 'SyncService');
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
    let mainImage = this.getCoverImageUrl(page);
    
    return this.convertToWeChatArticle(page, blocks, mainImage, linkStart);
  }

  /**
   * 从blocks中提取所有图片URL（不包括封面图，封面图会单独上传）
   */
  private extractImageUrls(blocks: NotionBlock[], coverImageUrl?: string): string[] {
    const urls = new Set<string>();
    
    // 不添加封面图到这里，因为封面图会在 publishArticle 时单独上传
    // 这样可以避免重复上传封面图
    
    // 遍历blocks提取图片URL
    for (const block of blocks) {
      if (block.type === 'image' && block.content?.url) {
        urls.add(block.content.url);
      }
    }
    
    return Array.from(urls);
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

    const safeTitle = this.cutWeChatTitle(page.title);

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
  private convertBlocksToHtml(blocks: NotionBlock[], imageUrlMap?: Map<string, string>): string {
    const htmlParts: string[] = [];
    let currentList: { type: 'bulleted' | 'numbered'; items: string[] } | null = null;
    const theme = this.getCurrentTheme();

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const html = this.convertBlockToHtml(block, imageUrlMap, theme);

      // 处理列表项
      if (block.type === 'bulleted_list_item') {
        if (!currentList || currentList.type !== 'bulleted') {
          // 结束上一个列表
          if (currentList) {
            htmlParts.push(currentList.type === 'bulleted' ? `<ul style="margin: 1em 0; padding-left: 2em; list-style-type: disc;">${currentList.items.join('')}</ul>` : `<ol style="margin: 1em 0; padding-left: 2em;">${currentList.items.join('')}</ol>`);
          }
          // 开始新列表
          currentList = { type: 'bulleted', items: [] };
        }
        currentList.items.push(html);
      } else if (block.type === 'numbered_list_item') {
        if (!currentList || currentList.type !== 'numbered') {
          // 结束上一个列表
          if (currentList) {
            htmlParts.push(currentList.type === 'bulleted' ? `<ul style="margin: 1em 0; padding-left: 2em; list-style-type: disc;">${currentList.items.join('')}</ul>` : `<ol style="margin: 1em 0; padding-left: 2em;">${currentList.items.join('')}</ol>`);
          }
          // 开始新列表
          currentList = { type: 'numbered', items: [] };
        }
        currentList.items.push(html);
      } else {
        // 非列表项，结束当前列表
        if (currentList) {
          htmlParts.push(currentList.type === 'bulleted' ? `<ul style="margin: 1em 0; padding-left: 2em; list-style-type: disc;">${currentList.items.join('')}</ul>` : `<ol style="margin: 1em 0; padding-left: 2em;">${currentList.items.join('')}</ol>`);
          currentList = null;
        }
        if (html.trim() !== '') {
          htmlParts.push(html);
        }
      }
    }

    // 处理最后一个列表
    if (currentList) {
      htmlParts.push(currentList.type === 'bulleted' ? `<ul style="margin: 1em 0; padding-left: 2em; list-style-type: disc;">${currentList.items.join('')}</ul>` : `<ol style="margin: 1em 0; padding-left: 2em;">${currentList.items.join('')}</ol>`);
    }

    return htmlParts.join('\n\n');
  }

  private convertBlockToHtml(block: NotionBlock, imageUrlMap?: Map<string, string>, theme?: ThemeStyles): string {
    const currentTheme = theme || this.getCurrentTheme();
    
    // 处理不同类型的块
    switch (block.type) {
      case 'paragraph': {
        const richText = block.content?.rich_text || [];
        if (richText.length === 0) {
          return `<p style="margin: 1em 0; line-height: 1.8;">&nbsp;</p>`;
        }
        const htmlContent = this.convertRichTextToHtml(richText, currentTheme);
        return `<p style="margin: 1em 0; line-height: 1.8; letter-spacing: 0.5px; color: #333; font-size: 15px;">${htmlContent}</p>`;
      }
      case 'heading_1': {
        const richText = block.content?.rich_text || [];
        const htmlContent = this.convertRichTextToHtml(richText, currentTheme);
        return `<h1 style="margin: 1.5em 0 0.8em 0; padding: 0.5em 0 0.5em 0.8em; font-size: 1.75em; font-weight: 700; line-height: 1.3; color: #2c3e50; border-left: 6px solid #3498db; background: linear-gradient(to right, #ebf5fb 0%, transparent 100%);">${htmlContent}</h1>`;
      }
      case 'heading_2': {
        const richText = block.content?.rich_text || [];
        const htmlContent = this.convertRichTextToHtml(richText, currentTheme);
        return `<h2 style="margin: 1.3em 0 0.7em 0; padding-left: 0.6em; font-size: 1.4em; font-weight: 600; line-height: 1.4; color: #34495e; border-left: 4px solid #3498db;">${htmlContent}</h2>`;
      }
      case 'heading_3': {
        const richText = block.content?.rich_text || [];
        const htmlContent = this.convertRichTextToHtml(richText, currentTheme);
        return `<h3 style="margin: 1.1em 0 0.6em 0; font-size: 1.2em; font-weight: 600; line-height: 1.4; color: #555; padding-left: 0.4em; border-left: 3px solid #95a5a6;">${htmlContent}</h3>`;
      }
      case 'image': {
        let url = block.content?.url || '';
        const caption = block.content?.caption?.[0]?.plain_text || '';
        
        // **使用微信服务器URL替换原始URL**
        if (url && imageUrlMap && imageUrlMap.has(url)) {
          const wechatUrl = imageUrlMap.get(url)!;
          LogService.log(`图片URL替换: ${url.substring(0, 40)}... -> ${wechatUrl.substring(0, 40)}...`, 'SyncService');
          url = wechatUrl;
        }
        
        if (url) {
          // 转义URL中的特殊字符
          const escapedUrl = this.escapeHtml(url);
          // 如果有标题，在图片下方显示
          if (caption) {
            return `<figure style="margin: 2em 0; text-align: center;"><img src="${escapedUrl}" alt="${this.escapeHtml(caption)}" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); display: block; margin: 0 auto;" /><figcaption style="margin-top: 1em; padding: 0.5em 1em; font-size: 14px; color: #7f8c8d; background-color: #f8f9fa; border-radius: 4px; display: inline-block;">${this.escapeHtml(caption)}</figcaption></figure>`;
          } else {
            return `<p style="text-align: center; margin: 2em 0;"><img src="${escapedUrl}" alt="图片" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); display: inline-block;" /></p>`;
          }
        }
        // 如果没有URL但有标题，至少显示标题
        if (caption) {
          LogService.warn(`图片块没有URL，仅显示标题: ${caption}`, 'SyncService');
          return `<p style="margin: 1em 0; line-height: 1.8; text-align: center; color: #999; font-size: 0.9em;"><em>${this.escapeHtml(caption)}</em></p>`;
        }
        // 如果既没有URL也没有标题，记录警告
        LogService.warn('图片块既没有URL也没有标题', 'SyncService');
        return '';
      }
      case 'video': {
        const url = block.content?.url || '';
        const caption = block.content?.caption?.[0]?.plain_text || '';
        if (url) {
          // 蓝色加粗下划线链接
          if (caption) {
            return `<p style="margin: 1.2em 0; line-height: 1.8;"><strong>🎬 ${this.escapeHtml(caption)}</strong><br/><a href="${url}" style="color: rgb(0, 82, 255); text-decoration: underline; font-weight: bold;">${url}</a></p>`;
          } else {
            return `<p style="margin: 1.2em 0; line-height: 1.8;"><a href="${url}" style="color: rgb(0, 82, 255); text-decoration: underline; font-weight: bold;">🎬 ${url}</a></p>`;
          }
        } else {
          const captionText = caption || '视频内容';
          return `<p style="margin: 1em 0; padding: 1em; background-color: #f7f7f7; border-radius: 6px; color: #666; text-align: center;">[视频: ${this.escapeHtml(captionText)}]</p>`;
        }
      }
      case 'file': {
        const url = block.content?.url || '';
        const caption = block.content?.caption?.[0]?.plain_text || '';
        if (url) {
          return `<p style="margin: 1.2em 0; padding: 0.8em 1em; background-color: #f0f7ff; border-left: 4px solid #1890ff; border-radius: 4px;"><a href="${url}" style="color: #1890ff; text-decoration: none; font-weight: 500;">📎 ${this.escapeHtml(caption || '文件下载')}</a></p>`;
        }
        return '';
      }
      case 'pdf': {
        const url = block.content?.url || '';
        const caption = block.content?.caption?.[0]?.plain_text || '';
        if (url) {
          return `<p style="margin: 1.2em 0; padding: 0.8em 1em; background-color: #fff3e0; border-left: 4px solid #ff9800; border-radius: 4px;"><a href="${url}" style="color: #ff6f00; text-decoration: none; font-weight: 500;">📄 ${this.escapeHtml(caption || 'PDF 文档')}</a></p>`;
        }
        return '';
      }
      case 'embed': {
        const url = block.content?.url || '';
        const caption = block.content?.caption?.[0]?.plain_text || '';
        if (url) {
          // 确保 URL 是可访问的
          let actualUrl = url;
          if (url.includes('youtube-nocookie.com/embed/') || url.includes('youtube.com/embed/')) {
            const videoIdMatch = url.match(/embed\/([^?]+)/);
            if (videoIdMatch) {
              actualUrl = `https://www.youtube.com/watch?v=${videoIdMatch[1]}`;
            }
          }
          
          // 简化为卡片样式
          if (caption) {
            return `<div style="margin: 1.5em 0; padding: 1.2em; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"><p style="margin: 0 0 0.8em 0; font-weight: 600; color: #fff; font-size: 1.05em;">📌 ${this.escapeHtml(caption)}</p><p style="margin: 0;"><a href="${actualUrl}" style="color: #fff; text-decoration: none; background-color: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 4px; display: inline-block; font-size: 14px;">查看内容 →</a></p></div>`;
          } else {
            return `<p style="margin: 1.2em 0; padding: 0.8em 1em; background-color: #f0f7ff; border-left: 4px solid #1890ff; border-radius: 4px;"><a href="${actualUrl}" style="color: #1890ff; text-decoration: none; font-weight: 500;">🔗 ${actualUrl}</a></p>`;
          }
        }
        return caption ? `<p style="margin: 1em 0; line-height: 1.8;">${this.escapeHtml(caption)}</p>` : '';
      }
      case 'bookmark': {
        const url = block.content?.url || '';
        const caption = block.content?.caption?.[0]?.plain_text || '';
        if (url) {
          return `<p style="margin: 1.2em 0; padding: 0.8em 1em; background-color: #fff9e6; border-left: 4px solid #faad14; border-radius: 4px;"><a href="${url}" style="color: #d48806; text-decoration: none; font-weight: 500;">🔖 ${this.escapeHtml(caption || url)}</a></p>`;
        }
        return '';
      }
      case 'link_preview': {
        const url = block.content?.url || '';
        if (url) {
          return `<p style="margin: 1.2em 0; padding: 0.8em 1em; background-color: #f0f7ff; border-left: 4px solid #1890ff; border-radius: 4px;"><a href="${url}" style="color: #1890ff; text-decoration: none; font-weight: 500;">🔗 ${url}</a></p>`;
        }
        return '';
      }
      case 'bulleted_list_item': {
        const richText = block.content?.rich_text || [];
        const htmlContent = this.convertRichTextToHtml(richText, currentTheme);
        return `<li style="margin: 0.5em 0; line-height: 1.8; color: #555;">${htmlContent}</li>`;
      }
      case 'numbered_list_item': {
        const richText = block.content?.rich_text || [];
        const htmlContent = this.convertRichTextToHtml(richText, currentTheme);
        return `<li style="margin: 0.5em 0; line-height: 1.8; color: #555;">${htmlContent}</li>`;
      }
      case 'quote': {
        const richText = block.content?.rich_text || [];
        const htmlContent = this.convertRichTextToHtml(richText, currentTheme);
        return `<blockquote style="margin: 1.2em 0; padding: 1em 1.2em; background-color: #fef9e7; border-left: 4px solid #f39c12; border-radius: 4px; color: #7f8c8d; font-style: italic; line-height: 1.8; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">${htmlContent}</blockquote>`;
      }
      case 'code': {
        const richText = block.content?.rich_text || [];
        const textContent = richText.map(text => text.plain_text).join('');
        const language = (block.content as any)?.language || '';
        
        // 转义 HTML 特殊字符
        const escapedContent = textContent
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
        
        // 带行号的代码块样式（参考微信公众号常见样式）
        const lines = escapedContent.split('\n');
        const lineNumberHtml = lines.map((_, i) => `<li style="list-style: none; padding: 0 10px 0 0; margin: 0; color: #999; user-select: none; text-align: right; min-width: 30px;">${i + 1}</li>`).join('');
        const codeHtml = lines.map(line => `<code style="display: block; padding: 0; margin: 0;">${line || ' '}</code>`).join('');
        
        return `<section style="margin: 16px 0; background: #f6f8fa; border-radius: 6px; overflow: hidden; font-size: 14px; border: 1px solid #e1e4e8;">
${language ? `<div style="padding: 8px 12px; background: #e8eaed; color: #666; font-size: 12px; border-bottom: 1px solid #e1e4e8; font-family: Consolas, Monaco, monospace;">${this.escapeHtml(language)}</div>` : ''}
<div style="display: flex; overflow-x: auto;">
<ul style="margin: 0; padding: 10px 0; list-style: none; background: #f0f0f0; border-right: 1px solid #e1e4e8;">${lineNumberHtml}</ul>
<pre style="margin: 0; padding: 10px 12px; flex: 1; overflow-x: auto; font-family: Consolas, Monaco, 'Courier New', monospace; line-height: 1.6; color: #24292e; white-space: pre;"><code style="font-family: inherit;">${codeHtml}</code></pre>
</div>
        </section>`;
      }
      case 'divider':
        return '<hr style="margin: 2em 0; border: 0; height: 1px; background: linear-gradient(to right, transparent, #cbd5e0, transparent);" />';
      case 'to_do': {
        const richText = block.content?.rich_text || [];
        const htmlContent = this.convertRichTextToHtml(richText, currentTheme);
        const checked = (block.content as any)?.checked || false;
        
        const checkboxStyle = checked 
          ? `background-color: #e8f5e9; border-left: 3px solid #4caf50;`
          : `background-color: #fff3e0; border-left: 3px solid #ff9800;`;
        
        const checkboxIcon = checked ? '✓' : '○';
        const iconColor = checked ? '#4caf50' : '#ff9800';
        
        return `<div style="margin: 0.8em 0; padding: 0.8em 1em; ${checkboxStyle} border-radius: 4px; display: flex; align-items: flex-start;">
          <span style="display: inline-block; width: 20px; height: 20px; margin-right: 0.8em; text-align: center; line-height: 20px; font-size: 14px; font-weight: bold; flex-shrink: 0; color: ${iconColor};">${checkboxIcon}</span>
          <span style="${checked ? 'text-decoration: line-through; color: #999;' : 'color: #555;'} line-height: 1.6;">${htmlContent}</span>
        </div>`;
      }
      default: {
        // 对于未知类型，尝试提取文本内容
        const richText = block.content?.rich_text || [];
        if (richText.length > 0) {
          const textContent = richText.map(text => text.plain_text).join('');
          if (textContent.trim()) {
            return `<p>${textContent}</p>`;
          }
        }
        // 如果块有子块但没有内容，返回提示
        if (block.has_children) {
          return `<p>[包含子内容的 ${block.type} 块，需要递归处理]</p>`;
        }
        return '';
      }
    }
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
    
    // 构建文章内容 HTML
    let articleContent = this.convertBlocksToHtml(blocks, imageUrlMap);

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
      title: page.title,
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

    // 使用表格格式，与微信保持一致的风格
    return `<div class="article-meta" style="margin: 0 0 20px 0; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #0073aa; border-radius: 4px;">
  <table style="width: 100%; border-collapse: collapse; font-size: 14px; line-height: 1.6;">
    <tbody>
      ${infoRows.join('\n      ')}
    </tbody>
  </table>
</div>`;
  }
} 