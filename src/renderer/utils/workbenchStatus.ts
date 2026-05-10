import { Config } from '../../shared/types/config';
import { SyncTarget } from '../components/SyncButton';
import { PLATFORM_COLORS } from './platformColors';

export type WorkbenchPlatformKey = 'wechat' | 'wordpress' | 'bilibili' | 'both';

export interface PlatformReadiness {
  key: WorkbenchPlatformKey;
  label: string;
  shortLabel: string;
  configured: boolean;
  missingFields: string[];
  summary: string;
  settingsTab: 'wechat' | 'wordpress' | 'bilibili';
  accentColor: string;
}

export type WorkbenchReadiness = Record<WorkbenchPlatformKey, PlatformReadiness>;

const compact = (value?: string | number | null): boolean => {
  if (typeof value === 'number') return Number.isFinite(value);
  return !!value?.trim();
};

const summaryFor = (missingFields: string[]): string => (
  missingFields.length > 0 ? `缺 ${missingFields.join('、')}` : '可同步'
);

export const getPlatformReadiness = (config: Config): WorkbenchReadiness => {
  const wechatMissing = [
    compact(config.wechat?.appId) ? '' : 'AppID',
    compact(config.wechat?.appSecret) ? '' : 'AppSecret'
  ].filter(Boolean);

  const wordpressMissing = [
    compact(config.wordpress?.siteUrl) ? '' : '站点 URL',
    compact(config.wordpress?.username) ? '' : '用户名',
    compact(config.wordpress?.appPassword) ? '' : '应用密码'
  ].filter(Boolean);

  const bilibiliMissing = config.bilibili?.enabled ? [] : ['未启用'];
  const bothMissing = [
    ...wechatMissing.map(field => `微信 ${field}`),
    ...wordpressMissing.map(field => `WordPress ${field}`)
  ];

  return {
    wechat: {
      key: 'wechat',
      label: '微信',
      shortLabel: '微信',
      configured: wechatMissing.length === 0,
      missingFields: wechatMissing,
      summary: summaryFor(wechatMissing),
      settingsTab: 'wechat',
      accentColor: PLATFORM_COLORS.wechat
    },
    wordpress: {
      key: 'wordpress',
      label: 'WordPress',
      shortLabel: 'WP',
      configured: wordpressMissing.length === 0,
      missingFields: wordpressMissing,
      summary: summaryFor(wordpressMissing),
      settingsTab: 'wordpress',
      accentColor: PLATFORM_COLORS.wordpress
    },
    bilibili: {
      key: 'bilibili',
      label: 'Bilibili',
      shortLabel: 'B站',
      configured: bilibiliMissing.length === 0,
      missingFields: bilibiliMissing,
      summary: bilibiliMissing.length > 0 ? bilibiliMissing.join('、') : '可同步',
      settingsTab: 'bilibili',
      accentColor: PLATFORM_COLORS.bilibili
    },
    both: {
      key: 'both',
      label: '全部平台',
      shortLabel: '全平台',
      configured: bothMissing.length === 0,
      missingFields: bothMissing,
      summary: summaryFor(bothMissing),
      settingsTab: 'wechat',
      accentColor: PLATFORM_COLORS.wechat
    }
  };
};

export const getSyncActionState = (
  target: SyncTarget,
  readiness: WorkbenchReadiness,
  selectedCount: number
): { disabled: boolean; reason: string } => {
  if (selectedCount === 0) {
    return { disabled: true, reason: '请先选择文章' };
  }

  const platform = readiness[target];
  if (!platform.configured) {
    return {
      disabled: true,
      reason: `${platform.label} ${platform.summary}`
    };
  }

  return { disabled: false, reason: '' };
};

export const getSyncTargetDisplay = (
  target: SyncTarget
): { compactLabel: string; ariaLabel: string } => {
  const display = {
    wechat: { compactLabel: '微信', ariaLabel: '同步到微信' },
    wordpress: { compactLabel: 'WP', ariaLabel: '同步到 WordPress' },
    bilibili: { compactLabel: 'B站', ariaLabel: '同步到 B站' },
    both: { compactLabel: '全部', ariaLabel: '同步到微信和 WordPress' }
  } satisfies Record<SyncTarget, { compactLabel: string; ariaLabel: string }>;

  return display[target];
};
