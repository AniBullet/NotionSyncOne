import { NotionService } from '../NotionService';
import { WeChatService } from '../WeChatService';
import { LogService } from '../LogService';
import { NotionBlock, NotionPage } from '../../../shared/types/notion';
import { WeChatArticle } from '../../../shared/types/wechat';
import { SyncState, SyncStatus } from '../../../shared/types/sync';

export interface WeChatSyncFlowContext {
  notionService: NotionService;
  weChatService: WeChatService;
  getCoverImageUrl(page: NotionPage): string;
  extractImageUrls(blocks: NotionBlock[], coverImageUrl?: string): string[];
  convertToWeChatArticle(
    page: NotionPage,
    blocks: NotionBlock[],
    mainImageUrl?: string,
    linkStart?: string,
    imageUrlMap?: Map<string, string>
  ): WeChatArticle;
  updateSyncState(articleId: string, status: SyncStatus, error?: string, results?: SyncState['results']): SyncState;
}

export async function syncArticleToWeChat(
  context: WeChatSyncFlowContext,
  articleId: string,
  publishMode: 'publish' | 'draft' = 'publish',
  abortSignal?: AbortSignal
): Promise<SyncState> {
  try {
    if (abortSignal?.aborted) {
      throw new Error('同步已取消');
    }

    LogService.log('========== 开始同步文章 ==========', 'SyncService');
    LogService.log(`文章ID: ${articleId}`, 'SyncService');
    LogService.log(`发布模式: ${publishMode}`, 'SyncService');
    context.updateSyncState(articleId, SyncStatus.SYNCING);

    if (abortSignal?.aborted) {
      throw new Error('同步已取消');
    }

    if (!context.notionService || !context.weChatService) {
      const error = '服务未初始化，请先保存正确的配置';
      LogService.error(error, 'SyncService');
      throw new Error(error);
    }

    LogService.log('正在获取文章属性...', 'SyncService');
    let page;
    try {
      page = await context.notionService.getPageProperties(articleId);
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

    const linkStart = page.properties.LinkStart?.url || page.properties.LinkStart?.rich_text?.[0]?.plain_text || '';
    const mainImage = context.getCoverImageUrl(page);
    if (mainImage) {
      LogService.log(`封面图片: ${mainImage.substring(0, 60)}...`, 'SyncService');
    }

    if (abortSignal?.aborted) {
      throw new Error('同步已取消');
    }

    LogService.log('正在获取文章内容...', 'SyncService');
    let blocks;
    try {
      blocks = await context.notionService.getPageContent(articleId);
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

    LogService.log('正在转换文章格式...', 'SyncService');
    LogService.log(`需要转换的块数量: ${blocks.length}`, 'SyncService');

    const imageUrls = context.extractImageUrls(blocks, mainImage);
    LogService.log(`提取到 ${imageUrls.length} 张图片`, 'SyncService');

    const imageUrlMap = new Map<string, string>();
    const failedImages: string[] = [];

    if (imageUrls.length > 0) {
      LogService.log(`开始上传 ${imageUrls.length} 张图片到微信素材库`, 'SyncService');
      for (let i = 0; i < imageUrls.length; i++) {
        if (abortSignal?.aborted) {
          throw new Error('同步已取消');
        }

        const imageUrl = imageUrls[i];
        try {
          LogService.log(`上传进度: ${i + 1}/${imageUrls.length}`, 'SyncService');
          const filename = `content_image_${i + 1}.png`;
          const uploadResult = await context.weChatService.uploadImage(imageUrl, abortSignal, filename);

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

      if (failedImages.length > 0) {
        LogService.warn(`${failedImages.length} 张图片上传失败，建议检查图片URL是否可访问`, 'SyncService');
      }
    }

    const weChatArticle = context.convertToWeChatArticle(page, blocks, mainImage, linkStart, imageUrlMap);
    LogService.log(`转换完成，标题: ${weChatArticle.title}`, 'SyncService');
    LogService.log(`内容长度: ${weChatArticle.content.length} 字符`, 'SyncService');
    LogService.log(`原文链接: ${weChatArticle.contentSourceUrl || '无'}`, 'SyncService');

    if (!weChatArticle.content || weChatArticle.content.trim().length === 0) {
      LogService.warn('警告：转换后的内容为空', 'SyncService');
      LogService.warn(`块详情: ${JSON.stringify(blocks.map(b => ({ type: b.type, has_children: b.has_children, content_keys: Object.keys(b.content || {}) })))}`, 'SyncService');
    }

    if (!weChatArticle.title) {
      throw new Error('文章标题不能为空');
    }

    const contentWithoutTags = weChatArticle.content.replace(/<[^>]*>/g, '').trim();
    if (!contentWithoutTags) {
      LogService.warn('文章内容为空，但可能包含媒体内容（视频、文件等）', 'SyncService');
      if (blocks.length > 0) {
        const blockTypes = blocks.map(b => b.type).join(', ');
        LogService.warn(`块类型: ${blockTypes}`, 'SyncService');
        weChatArticle.content = '<p>本文包含媒体内容，请查看原文链接。</p>' + weChatArticle.content;
      } else {
        throw new Error('文章内容不能为空');
      }
    }

    LogService.log(`========== 开始${publishMode === 'publish' ? '发布' : '保存草稿'}到微信公众号 ==========`, 'SyncService');
    LogService.log(`文章标题: ${weChatArticle.title}`, 'SyncService');
    LogService.log(`文章作者: ${weChatArticle.author || '未设置'}`, 'SyncService');
    LogService.log(`文章摘要: ${weChatArticle.digest || '未设置'}`, 'SyncService');

    try {
      await context.weChatService.publishArticle(weChatArticle, publishMode, abortSignal);
      LogService.success(`========== 文章${publishMode === 'publish' ? '发布' : '保存草稿'}成功 ==========`, 'SyncService');
    } catch (error) {
      LogService.error(`========== ${publishMode === 'publish' ? '发布' : '保存草稿'}到微信失败 ==========`, 'SyncService');
      const errorMessage = error instanceof Error ? error.message : String(error);
      LogService.error(`错误: ${errorMessage}`, 'SyncService');
      throw new Error(`${publishMode === 'publish' ? '发布' : '保存草稿'}到微信失败: ${errorMessage}`);
    }

    try {
      const currentAddedTime = page.properties.AddedTime?.date?.start;
      if (!currentAddedTime) {
        await context.notionService.updatePageProperties(articleId, {
          AddedTime: {
            date: {
              start: new Date().toISOString(),
            },
          },
        });
      }
    } catch (error) {
      console.error('更新 Notion 时间失败:', error);
    }

    const successState = context.updateSyncState(articleId, SyncStatus.SUCCESS);
    LogService.success('========== 同步完成，状态: 成功 ==========', 'SyncService');
    return successState;
  } catch (error) {
    LogService.error('========== 同步文章失败 ==========', 'SyncService');
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    LogService.error(`错误: ${errorMessage}`, 'SyncService');
    if (error instanceof Error && error.stack) {
      LogService.error(`堆栈: ${error.stack}`, 'SyncService');
    }
    const failedState = context.updateSyncState(articleId, SyncStatus.FAILED, errorMessage);
    LogService.log('========== 同步完成，状态: 失败 ==========', 'SyncService');
    return failedState;
  }
}
