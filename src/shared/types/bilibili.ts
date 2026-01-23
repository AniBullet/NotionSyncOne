/**
 * Bilibili 相关类型定义
 */

export interface BilibiliConfig {
  // Cookie 登录信息（JSON格式）
  cookieFile?: string;
  // 默认分区 tid
  defaultTid?: number;
  // 默认标签
  defaultTags?: string[];
  // 是否启用
  enabled?: boolean;
  
  // 简介模板（支持变量：{title}, {url}, {date}, {from}, {author}, {engine}, {rate}, {tags}）
  descTemplate?: string;
  // 标题模板（支持 {title} 变量），例如：【转载】{title}
  titleTemplate?: string;
  
  // 上传参数
  copyright?: 1 | 2;  // 1-自制 2-转载
  noReprint?: 0 | 1;  // 0-允许转载 1-禁止转载
  openElec?: 0 | 1;  // 0-关闭充电 1-开启充电
  upCloseReply?: boolean;  // 是否关闭评论
  upCloseDanmu?: boolean;  // 是否关闭弹幕
}

export interface BilibiliVideo {
  // 视频URL（从Notion提取）
  url: string;
  // 视频标题（可从caption获取）
  caption?: string;
  // 视频类型（uploaded/external）
  type: 'uploaded' | 'external';
  // 本地文件路径（下载后）
  localPath?: string;
  // 文件大小（字节）
  fileSize?: number;
  // 是否需要压缩
  needsCompression?: boolean;
}

export interface BilibiliMetadata {
  // 视频标题（必填）
  title: string;
  // 分区ID（可选，未指定时使用配置中的 defaultTid）
  tid?: number;
  // 标签（可选，未指定或为空时使用配置中的 defaultTags）
  tags?: string[];
  // 简介（可选，未指定时使用配置中的 descTemplate）
  desc?: string;
  // 封面图片URL
  cover?: string;
  // 视频来源
  source?: string;
  // 是否开启充电面板
  openElec?: 0 | 1;
  // 禁止转载
  noReprint?: 0 | 1;
  // 动态内容
  dynamic?: string;
  // 版权类型
  copyright?: 1 | 2;
  // 关闭评论
  upCloseReply?: boolean;
  // 关闭弹幕
  upCloseDanmu?: boolean;
  // Notion 页面属性（用于简介模板）
  notionProps?: {
    from?: string;         // 来源
    author?: string;       // 作者
    engine?: string;       // 使用引擎
    expectationsRate?: number;  // 个人期望
    tags?: string[];       // 标签特色
    addedTime?: string;    // 添加时间
    linkStart?: string;    // 链接
  };
}

export interface BilibiliUploadOptions {
  // 发布模式
  publishMode: 'draft' | 'publish';
  // 视频元数据
  metadata: BilibiliMetadata;
  // 视频列表（支持多P）
  videos: BilibiliVideo[];
  // 是否自动压缩超大视频
  autoCompress?: boolean;
  // 压缩质量（18-28，默认23）
  compressionQuality?: number;
  // 文章ID（用于进度追踪）
  articleId?: string;
}

export interface BilibiliUploadResult {
  // 稿件ID（aid）
  aid?: number;
  // 稿件BV号
  bvid?: string;
  // 是否为草稿
  isDraft: boolean;
  // 稿件链接
  link?: string;
  // 错误信息
  error?: string;
}

/**
 * B站分区映射
 */
export const BILIBILI_ZONES = {
  // 动画
  ANIME: {
    MAD: 24,
    MMD: 25,
    HANDDRAWN: 47,
    VOICE: 257,
    COLLECTION: 210,
    OTHER: 27
  },
  // 游戏
  GAME: {
    STANDALONE: 17,
    ESPORTS: 171,
    MOBILE: 172,
    ONLINE: 65,
    BOARD: 173,
    GMV: 121,
    MUSIC: 136,
    MUGEN: 19,
    OTHER: 121
  },
  // 知识
  KNOWLEDGE: {
    SCIENCE: 201,
    TECH: 122,
    HUMANITIES: 228,
    FINANCE: 207,
    CAMPUS: 208,
    CAREER: 209,
    DESIGN: 229,
    OTHER: 124
  },
  // 生活
  LIFE: {
    FUNNY: 138,
    DAILY: 21,
    FOOD: 76,
    ANIMAL: 75,
    AUTO: 223,
    FASHION: 155,
    SPORTS: 163,
    TRAVEL: 176,
    OTHER: 174
  },
  // 科技
  TECH: {
    DIGITAL: 95,
    SOFTWARE: 230,
    COMPUTER: 231,
    MAKER: 233,
    INDUSTRY: 232,
    OTHER: 122
  }
} as const;

export type BilibiliZone = typeof BILIBILI_ZONES;
