export interface WeChatConfig {
  appId: string;
  appSecret: string;
  accessToken?: string;
  tokenExpiresAt?: number;
  // 作者：如果为空，则从文章属性获取
  author?: string;
  // 文章顶部提示语（可选）
  topNotice?: string;
  // 主题样式：default, wechat, hongfei, jianhei, shanchui, chengxin
  theme?: string;
  // 标题模板（支持 {title} 变量），例如：【转载】{title}
  titleTemplate?: string;
}

export interface WeChatArticle {
  title: string;
  content: string;
  author?: string;
  digest?: string;
  showCoverPic?: boolean;
  thumbMediaId?: string;
  needOpenComment?: boolean;
  onlyFansCanComment?: boolean;
  // 原文链接
  contentSourceUrl?: string;
  // 封面图片 URL（用于上传）
  coverImageUrl?: string;
}

export interface WeChatResponse {
  errcode: number;
  errmsg: string;
  [key: string]: any;
} 