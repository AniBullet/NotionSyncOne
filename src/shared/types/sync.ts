export enum SyncStatus {
  PENDING = 'pending',
  SYNCING = 'syncing',
  SUCCESS = 'success',
  FAILED = 'failed',
}

export interface SyncState {
  articleId: string;
  status: SyncStatus;
  progress?: number;
  error?: string;
  lastSyncTime?: number;
  // 同步结果信息
  results?: {
    bilibili?: {
      bvid?: string;
      link?: string;
      aid?: number;
      title?: string;  // 记录视频标题，用于验证
    };
    wechat?: {
      mediaId?: string;
      url?: string;
    };
    wordpress?: {
      postId?: number;
      url?: string;
    };
  };
}

export interface SyncConfig {
  autoSync: boolean;
  syncInterval: number; // 分钟
  lastSyncTime?: number;
} 