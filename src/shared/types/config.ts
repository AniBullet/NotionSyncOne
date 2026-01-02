import { NotionConfig } from './notion';
import { WeChatConfig } from './wechat';
import { WordPressConfig } from './wordpress';

export interface Config {
  notion: NotionConfig;
  wechat: WeChatConfig;
  wordpress?: WordPressConfig;
} 