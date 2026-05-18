export interface NotionConfig {
  apiKey: string;
  databaseId: string;
  fieldMap?: Partial<Record<NotionFieldKey, string>>;
}

export type NotionFieldKey =
  | 'linkStart'
  | 'from'
  | 'author'
  | 'featureTag'
  | 'expectationsRate'
  | 'engine'
  | 'addedTime';

export interface NotionPage {
  id: string;
  url: string;
  title: string;
  lastEditedTime: string;
  properties: {
    [key: string]: {
      type: string;
      rich_text?: Array<Record<string, unknown> & { plain_text: string }>;
      title?: Array<Record<string, unknown> & { plain_text: string }>;
      select?: { name: string } | null;
      multi_select?: Array<{ name: string }>;
      date?: { start: string } | null;
      number?: number | null;
      url?: string | null;
      created_time?: string;
      files?: Array<{
        type?: 'file' | 'external';
        file?: { url: string; expiry_time?: string };
        external?: { url: string };
        name?: string;
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
    language?: string;
    checked?: boolean;
    caption?: Array<{
      plain_text: string;
      href?: string | null;
    }>;
  };
}
