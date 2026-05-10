import { NotionPage } from '../../shared/types/notion';
import { SyncState, SyncStatus } from '../../shared/types/sync';
import { PLATFORM_COLORS, PLATFORM_LABELS } from './platformColors';
import type { SyncPlatform } from './platformColors';

export { PLATFORM_COLORS, PLATFORM_LABELS };
export type { SyncPlatform };

export interface SyncBadgePresentation {
  color: string;
  backgroundColor: string;
  borderColor: string;
  statusText: string;
  reason?: string;
}

export interface SyncFailureDetail {
  articleId: string;
  title: string;
  platform: SyncPlatform;
  platformLabel: string;
  error: string;
}

export const getSyncBadgePresentation = (
  platform: SyncPlatform,
  state?: SyncState
): SyncBadgePresentation | null => {
  if (!state) return null;

  if (state.status === SyncStatus.SUCCESS) {
    const color = PLATFORM_COLORS[platform];
    return {
      color,
      backgroundColor: `${color}22`,
      borderColor: `${color}55`,
      statusText: '已同步'
    };
  }

  if (state.status === SyncStatus.FAILED) {
    return {
      color: '#94A3B8',
      backgroundColor: 'rgba(148, 163, 184, 0.16)',
      borderColor: '#EF4444',
      statusText: '失败',
      reason: state.error || '未知错误'
    };
  }

  if (state.status === SyncStatus.SYNCING) {
    return {
      color: '#F59E0B',
      backgroundColor: 'rgba(245, 158, 11, 0.14)',
      borderColor: 'rgba(245, 158, 11, 0.45)',
      statusText: '同步中',
      reason: state.error
    };
  }

  return {
    color: '#94A3B8',
    backgroundColor: 'var(--bg-tertiary)',
    borderColor: 'var(--border-light)',
    statusText: '等待',
    reason: state.error
  };
};

export const collectSyncFailures = (
  articles: Pick<NotionPage, 'id' | 'title'>[],
  wechatStates: Record<string, SyncState>,
  wpSyncStates: Record<string, SyncState>,
  biliSyncStates: Record<string, SyncState>
): SyncFailureDetail[] => {
  const sources: Array<{
    platform: SyncPlatform;
    states: Record<string, SyncState>;
  }> = [
    { platform: 'wechat', states: wechatStates },
    { platform: 'wordpress', states: wpSyncStates },
    { platform: 'bilibili', states: biliSyncStates }
  ];

  return articles.flatMap(article => (
    sources.flatMap(({ platform, states }) => {
      const state = states[article.id];
      if (state?.status !== SyncStatus.FAILED) return [];

      return [{
        articleId: article.id,
        title: article.title || article.id,
        platform,
        platformLabel: PLATFORM_LABELS[platform],
        error: state.error || '未知错误'
      }];
    })
  ));
};
