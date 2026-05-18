import { NotionService } from '../NotionService';
import { WordPressService } from '../WordPressService';
import { LogService } from '../LogService';
import { NotionBlock, NotionPage } from '../../../shared/types/notion';
import { WordPressArticle } from '../../../shared/types/wordpress';
import { SyncState, SyncStatus } from '../../../shared/types/sync';

export interface WordPressSyncFlowContext {
  notionService: NotionService;
  wordPressService: WordPressService | null;
  getCoverImageUrl(page: NotionPage): string;
  convertToWordPressArticle(
    page: NotionPage,
    blocks: NotionBlock[],
    status: 'publish' | 'draft',
    imageUrlMap?: Map<string, string>,
    featuredMediaId?: number
  ): WordPressArticle;
  updateSyncState(articleId: string, status: SyncStatus, error?: string, results?: SyncState['results']): SyncState;
}

export async function syncArticleToWordPressFlow(
  context: WordPressSyncFlowContext,
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
    context.updateSyncState(wpSyncKey, SyncStatus.SYNCING);

    if (!context.notionService) {
      throw new Error('Notion 服务未初始化');
    }
    if (!context.wordPressService) {
      throw new Error('WordPress 服务未初始化，请先配置 WordPress 信息');
    }

    LogService.log('正在获取文章属性...', 'SyncService');
    const page = await context.notionService.getPageProperties(articleId);
    LogService.log(`文章标题: ${page.title}`, 'SyncService');

    if (abortSignal?.aborted) {
      throw new Error('同步已取消');
    }

    LogService.log('正在获取文章内容...', 'SyncService');
    const blocks = await context.notionService.getPageContent(articleId);
    LogService.log(`文章内容块数量: ${blocks.length}`, 'SyncService');

    if (!blocks || blocks.length === 0) {
      throw new Error('文章内容为空');
    }

    if (abortSignal?.aborted) {
      throw new Error('同步已取消');
    }

    const mainImage = context.getCoverImageUrl(page);
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

    let featuredMediaId: number | undefined;
    if (mainImage && context.wordPressService) {
      try {
        LogService.log('正在上传封面图片到 WordPress 媒体库...', 'SyncService');
        LogService.log(`图片 URL: ${mainImage}`, 'SyncService');
        const coverMedia = await context.wordPressService.uploadMedia(mainImage, undefined, abortSignal);
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

    LogService.log('正在转换文章格式...', 'SyncService');
    const wpArticle = context.convertToWordPressArticle(page, blocks, status, undefined, featuredMediaId);
    LogService.log(`转换完成，标题: ${wpArticle.title}`, 'SyncService');
    LogService.log(`文章 featured_media 字段: ${wpArticle.featured_media || '未设置'}`, 'SyncService');

    LogService.log(`========== 开始${status === 'publish' ? '发布' : '保存草稿'}到 WordPress ==========`, 'SyncService');
    const post = await context.wordPressService.publishArticle(wpArticle, abortSignal);

    LogService.success(`========== WordPress ${status === 'publish' ? '发布' : '草稿保存'}成功 ==========`, 'SyncService');
    LogService.log(`文章链接: ${post.link}`, 'SyncService');

    return context.updateSyncState(wpSyncKey, SyncStatus.SUCCESS);
  } catch (error) {
    LogService.error('========== WordPress 同步失败 ==========', 'SyncService');
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    LogService.error(`错误: ${errorMessage}`, 'SyncService');
    return context.updateSyncState(wpSyncKey, SyncStatus.FAILED, errorMessage);
  }
}
