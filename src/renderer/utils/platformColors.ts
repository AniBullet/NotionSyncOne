export type SyncPlatform = 'wechat' | 'wordpress' | 'bilibili';

export const NOTION_SOURCE_COLOR = '#64748B';

export const PLATFORM_COLORS: Record<SyncPlatform, string> = {
  wechat: '#07C160',
  wordpress: '#21759B',
  bilibili: '#FB7299'
};

export const PLATFORM_LABELS: Record<SyncPlatform, string> = {
  wechat: '微信',
  wordpress: 'WordPress',
  bilibili: 'B站'
};
