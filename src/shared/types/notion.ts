import { PageObjectResponse, BlockObjectResponse, RichTextItemResponse } from '@notionhq/client/build/src/api-endpoints';

export interface NotionConfig {
  apiKey: string;
  databaseId: string;
}

export interface NotionPage {
  id: string;
  url: string;
  title: string;
  lastEditedTime: string;
  properties: {
    [key: string]: {
      type: string;
      rich_text?: Array<{ plain_text: string }>;
      title?: Array<{ plain_text: string }>;
      select?: { name: string };
      multi_select?: Array<{ name: string }>;
      date?: { start: string };
      number?: number;
      url?: string;
      files?: Array<{
        type: 'file' | 'external';
        file?: { url: string };
        external?: { url: string };
      }>;
    };
  };
  // 页面封面图片
  cover?: {
    type: 'external' | 'file';
    external?: { url: string };
    file?: { url: string; expiry_time?: string };
  } | null;
  linkStart?: string;
  from?: string;
  author?: string;
  featureTag?: string | string[];
  expectationsRate?: number;
  engine?: string;
  addedTime?: string;
}

export interface NotionBlock {
  id: string;
  type: string;
  has_children?: boolean;
  content: {
    rich_text?: Array<{
      plain_text: string;
      href?: string | null;
      annotations?: {
        bold?: boolean;
        italic?: boolean;
        strikethrough?: boolean;
        underline?: boolean;
        code?: boolean;
        color?: string;
      };
    }>;
    url?: string;
    caption?: Array<{
      plain_text: string;
      href?: string | null;
    }>;
  };
} 