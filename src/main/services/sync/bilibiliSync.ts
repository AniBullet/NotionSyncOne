import { BilibiliService } from '../BilibiliService';
import { ConfigService } from '../ConfigService';
import { NotionService } from '../NotionService';
import { LogService } from '../LogService';
import { NotionPage } from '../../../shared/types/notion';
import { BilibiliMetadata, BilibiliUploadOptions, BilibiliVideo } from '../../../shared/types/bilibili';
import { SyncState, SyncStatus } from '../../../shared/types/sync';
import { getNotionProperty, readDateValue, readPlainText, readSelectNames } from './notionFields';

export interface BilibiliSyncFlowContext {
  notionService: NotionService;
  bilibiliService: BilibiliService | null;
  configService: ConfigService;
  getCoverImageUrl(page: NotionPage): string;
  setActiveController(syncKey: string, controller: AbortController): void;
  deleteActiveController(syncKey: string): void;
  updateSyncState(articleId: string, status: SyncStatus, error?: string, results?: SyncState['results']): SyncState;
}

export async function syncVideoToBilibiliFlow(
  context: BilibiliSyncFlowContext,
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
    if (!context.bilibiliService) {
      throw new Error('Bilibili 服务未初始化');
    }

    const abortController = new AbortController();
    context.setActiveController(biliSyncKey, abortController);

    LogService.log('========== SyncService: 开始同步视频到B站 ==========', 'SyncService');
    context.updateSyncState(biliSyncKey, SyncStatus.SYNCING);

    const page = await context.notionService.getPageProperties(articleId);
    LogService.log(`文章标题: ${page.title}`, 'SyncService');

    const notionConfig = context.configService.getNotionConfig();
    const linkStart = readPlainText(getNotionProperty(page, notionConfig, 'linkStart'));
    const from = readPlainText(getNotionProperty(page, notionConfig, 'from'));
    const author = readPlainText(getNotionProperty(page, notionConfig, 'author'));
    const engineProperty = getNotionProperty(page, notionConfig, 'engine');
    const engine = readSelectNames(engineProperty)[0] || readPlainText(engineProperty);
    const expectationsRate = getNotionProperty(page, notionConfig, 'expectationsRate')?.number;

    const tags = readSelectNames(getNotionProperty(page, notionConfig, 'featureTag'));

    let addedTime = readDateValue(getNotionProperty(page, notionConfig, 'addedTime'));
    if (!addedTime && page.addedTime) {
      addedTime = page.addedTime;
    }

    LogService.log(`文章属性 - 来源平台: ${from}, 原作者: ${author}, 链接: ${linkStart}`, 'SyncService');

    if (linkStart && !metadata.source) {
      metadata.source = linkStart;
    }

    if (!metadata.cover) {
      const coverUrl = context.getCoverImageUrl(page);
      if (coverUrl) {
        metadata.cover = coverUrl;
        LogService.log(`已自动获取封面图片: ${coverUrl.substring(0, 50)}...`, 'SyncService');
      } else {
        LogService.log('未找到封面图片', 'SyncService');
      }
    } else {
      LogService.log(`使用指定的封面图片: ${metadata.cover.substring(0, 50)}...`, 'SyncService');
    }

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
      linkStart,
    };

    const biliConfig = context.configService.getBilibiliConfig();
    if (biliConfig.titleTemplate && biliConfig.titleTemplate.trim()) {
      const originalTitle = metadata.title;
      metadata.title = biliConfig.titleTemplate.replace(/\{title\}/g, metadata.title);
      LogService.log(`应用标题模板: ${originalTitle} -> ${metadata.title}`, 'SyncService');
    }

    LogService.log('正在提取视频...', 'SyncService');
    const videoInfos = await context.notionService.extractVideos(articleId);

    if (videoInfos.length === 0) {
      throw new Error('文章中没有找到视频');
    }

    LogService.log(`找到 ${videoInfos.length} 个视频`, 'SyncService');

    const videos: BilibiliVideo[] = [];
    for (let i = 0; i < videoInfos.length; i++) {
      const videoInfo = videoInfos[i];
      LogService.log(`正在下载视频 ${i + 1}/${videoInfos.length}...`, 'SyncService');

      const video: BilibiliVideo = {
        url: videoInfo.url,
        caption: videoInfo.caption,
        type: videoInfo.type,
      };

      const localPath = await context.bilibiliService.downloadVideo(
        video,
        abortController.signal,
        articleId
      );

      video.localPath = localPath;
      videos.push(video);
    }

    const uploadOptions: BilibiliUploadOptions = {
      publishMode,
      metadata,
      videos,
      autoCompress,
      compressionQuality: 23,
      articleId,
    };

    LogService.log(`开始上传到B站，模式: ${publishMode}`, 'SyncService');
    const result = await context.bilibiliService.uploadVideo(
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

    context.deleteActiveController(biliSyncKey);

    return context.updateSyncState(biliSyncKey, SyncStatus.SUCCESS, undefined, {
      bilibili: {
        bvid: result.bvid,
        link: result.link,
        aid: result.aid,
        title: metadata.title,
      },
    });
  } catch (error) {
    LogService.error('========== B站同步失败 ==========', 'SyncService');
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    LogService.error(`错误: ${errorMessage}`, 'SyncService');

    context.deleteActiveController(biliSyncKey);

    return context.updateSyncState(biliSyncKey, SyncStatus.FAILED, errorMessage);
  }
}
