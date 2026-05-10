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

export interface SyncFailureGuidance {
  intent: 'settings' | 'retry';
  primaryText: string;
  secondaryText: string;
  retryLabel: string;
  settingsLabel: string;
}

export interface SyncFailureReadiness {
  configured: boolean;
  summary: string;
}

export const getSyncFailureGuidance = (
  platform: SyncPlatform,
  error: string,
  readiness?: SyncFailureReadiness
): SyncFailureGuidance => {
  const platformLabel = PLATFORM_LABELS[platform];
  const normalizedError = error.toLowerCase();
  const retryLabel = '重试草稿';
  const settingsLabel = '打开设置';

  if (readiness && !readiness.configured) {
    return {
      intent: 'settings',
      primaryText: `先补齐 ${platformLabel} 配置`,
      secondaryText: readiness.summary,
      retryLabel,
      settingsLabel
    };
  }

  if (
    normalizedError.includes('401') ||
    normalizedError.includes('403') ||
    normalizedError.includes('unauthorized') ||
    normalizedError.includes('forbidden') ||
    normalizedError.includes('token') ||
    normalizedError.includes('权限') ||
    normalizedError.includes('认证') ||
    normalizedError.includes('登录')
  ) {
    return {
      intent: 'settings',
      primaryText: `${platformLabel} 授权可能失效`,
      secondaryText: '检查账号、密钥或登录状态后再重试。',
      retryLabel,
      settingsLabel
    };
  }

  if (
    normalizedError.includes('config') ||
    normalizedError.includes('missing') ||
    normalizedError.includes('required') ||
    normalizedError.includes('未配置') ||
    normalizedError.includes('未启用') ||
    normalizedError.includes('缺少')
  ) {
    return {
      intent: 'settings',
      primaryText: `检查 ${platformLabel} 配置`,
      secondaryText: readiness?.summary || '有必填项缺失或平台未启用。',
      retryLabel,
      settingsLabel
    };
  }

  if (
    normalizedError.includes('timeout') ||
    normalizedError.includes('timed out') ||
    normalizedError.includes('network') ||
    normalizedError.includes('econn') ||
    normalizedError.includes('超时') ||
    normalizedError.includes('网络')
  ) {
    return {
      intent: 'retry',
      primaryText: '网络超时，建议稍后重试',
      secondaryText: `${platformLabel} 服务或本机网络可能暂时不稳定。`,
      retryLabel,
      settingsLabel
    };
  }

  return {
    intent: 'retry',
    primaryText: '可以先重试草稿',
    secondaryText: `如果 ${platformLabel} 仍失败，再检查配置或平台侧状态。`,
    retryLabel,
    settingsLabel
  };
};

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
