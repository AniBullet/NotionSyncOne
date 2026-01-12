import { NotionConfig } from './notion';
import { WeChatConfig } from './wechat';
import { WordPressConfig } from './wordpress';
import { BilibiliConfig } from './bilibili';

export interface Config {
  notion: NotionConfig;
  wechat: WeChatConfig;
  wordpress?: WordPressConfig;
  bilibili?: BilibiliConfig;
} 