import { Config } from '../../shared/types/config';
import { NOTION_SOURCE_COLOR, PLATFORM_COLORS } from './platformColors';

export type SettingsSectionKey = 'notion' | 'wechat' | 'wordpress' | 'bilibili';

export interface SettingsSectionStatus {
  key: SettingsSectionKey;
  label: string;
  ready: boolean;
  optional: boolean;
  missingFields: string[];
  summary: string;
  accentColor: string;
}

export type SettingsSections = Record<SettingsSectionKey, SettingsSectionStatus>;

const hasValue = (value?: string | null): boolean => !!value?.trim();

const summarize = (missingFields: string[], readyText: string): string => (
  missingFields.length > 0 ? `缺 ${missingFields.join('、')}` : readyText
);

export const getSettingsSections = (config: Config): SettingsSections => {
  const notionMissing = [
    hasValue(config.notion?.apiKey) ? '' : 'API Key',
    hasValue(config.notion?.databaseId) ? '' : '数据库 ID'
  ].filter(Boolean);

  const wechatMissing = [
    hasValue(config.wechat?.appId) ? '' : 'AppID',
    hasValue(config.wechat?.appSecret) ? '' : 'AppSecret'
  ].filter(Boolean);

  const wordpressMissing = [
    hasValue(config.wordpress?.siteUrl) ? '' : '站点 URL',
    hasValue(config.wordpress?.username) ? '' : '用户名',
    hasValue(config.wordpress?.appPassword) ? '' : '应用密码'
  ].filter(Boolean);

  const bilibiliMissing = config.bilibili?.enabled ? [] : ['未启用'];

  return {
    notion: {
      key: 'notion',
      label: 'Notion',
      ready: notionMissing.length === 0,
      optional: false,
      missingFields: notionMissing,
      summary: summarize(notionMissing, '已配置'),
      accentColor: NOTION_SOURCE_COLOR
    },
    wechat: {
      key: 'wechat',
      label: '微信',
      ready: wechatMissing.length === 0,
      optional: false,
      missingFields: wechatMissing,
      summary: summarize(wechatMissing, '可同步'),
      accentColor: PLATFORM_COLORS.wechat
    },
    wordpress: {
      key: 'wordpress',
      label: 'WordPress',
      ready: wordpressMissing.length === 0,
      optional: true,
      missingFields: wordpressMissing,
      summary: summarize(wordpressMissing, '可同步'),
      accentColor: PLATFORM_COLORS.wordpress
    },
    bilibili: {
      key: 'bilibili',
      label: 'B站',
      ready: bilibiliMissing.length === 0,
      optional: true,
      missingFields: bilibiliMissing,
      summary: bilibiliMissing.length > 0 ? '未启用' : '可同步',
      accentColor: PLATFORM_COLORS.bilibili
    }
  };
};

export const getSectionStatusText = (section: SettingsSectionStatus): string => section.summary;
