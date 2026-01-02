export interface WordPressConfig {
  siteUrl: string;        // WordPress 站点 URL (例如: https://example.com)
  username: string;       // 用户名
  appPassword: string;    // 应用密码 (WordPress 5.6+)
  defaultCategory?: number;  // 默认分类 ID
  defaultAuthor?: number;    // 默认作者 ID
  topNotice?: string;        // 顶部提示语
}

export interface WordPressArticle {
  title: string;
  content: string;
  status: 'publish' | 'draft' | 'pending' | 'private';
  excerpt?: string;           // 摘要
  categories?: number[];      // 分类 ID 数组
  tags?: number[];            // 标签 ID 数组
  featured_media?: number;    // 特色图片 media ID
  meta?: Record<string, any>; // 自定义字段/SEO 元数据
  slug?: string;              // URL 别名
  author?: number;            // 作者 ID
}

export interface WordPressCategory {
  id: number;
  name: string;
  slug: string;
  parent: number;
  count: number;
}

export interface WordPressTag {
  id: number;
  name: string;
  slug: string;
  count: number;
}

export interface WordPressMedia {
  id: number;
  source_url: string;
  title: { rendered: string };
  media_type: string;
}

export interface WordPressPost {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  status: string;
  link: string;
  featured_media: number;
  categories: number[];
  tags: number[];
}

export interface WordPressResponse<T = any> {
  data?: T;
  code?: string;
  message?: string;
}
