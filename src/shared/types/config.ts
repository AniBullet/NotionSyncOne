import { NotionConfig } from './notion';
import { WeChatConfig } from './wechat';

export interface Config {
  notion: NotionConfig;
  wechat: WeChatConfig;
} 