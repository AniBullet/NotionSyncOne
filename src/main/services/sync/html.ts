import { LogService } from '../LogService';

export interface SyncRichText {
  plain_text: string;
  href?: string | null;
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    code?: boolean;
    [key: string]: unknown;
  };
}

export function filterWeChatUnsupportedChars(text: string): string {
  if (!text) return '';

  let filtered = text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/gu, '');

  // eslint-disable-next-line no-control-regex
  filtered = filtered.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

  filtered = filtered.replace(/[\u{1F3AC}\u{1F3A5}\u{1F4FA}\u{1F4F9}\u{1F3A6}\u{1F3AD}\u{1F3AA}\u{1F3A8}\u{1F3AF}\u{1F3B2}\u{1F3B0}\u{1F3B3}]\uFE0F?/gu, '');
  filtered = filtered.replace(/\s+/g, ' ').trim();

  return filtered;
}

export function cutWeChatTitle(rawTitle: string, maxChars: number = 64): string {
  if (!rawTitle) return '';

  const cleanedTitle = filterWeChatUnsupportedChars(rawTitle);
  const result = cleanedTitle.length <= maxChars
    ? cleanedTitle
    : cleanedTitle.substring(0, maxChars);

  if (result.length < rawTitle.length || cleanedTitle.length < rawTitle.length) {
    LogService.warn(
      `标题已处理。原始: "${rawTitle}"，处理后: "${result}"`,
      'SyncService'
    );
  }

  return result;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function convertRichTextToHtml(richText: SyncRichText[]): string {
  if (richText.length === 0) {
    return '';
  }

  const parts: string[] = [];

  for (const text of richText) {
    let content = escapeHtml(text.plain_text);

    if (text.href) {
      if (text.annotations?.bold) {
        content = `<strong>${content}</strong>`;
      }
      if (text.annotations?.italic) {
        content = `<em>${content}</em>`;
      }
      parts.push(`<span style="display: inline-block; margin: 0.3em 0; vertical-align: top;"><a href="${text.href}" style="color: #576b95; text-decoration: none; border-bottom: 1px solid #576b95; font-weight: 500; display: block;">${content}</a><span style="color: #999; font-size: 12px; display: block; margin-top: 0.2em; line-height: 1.4;">${text.href}</span></span>`);
      continue;
    }

    if (text.annotations?.bold) {
      content = `<strong>${content}</strong>`;
    }
    if (text.annotations?.italic) {
      content = `<em>${content}</em>`;
    }
    if (text.annotations?.code) {
      content = `<code style="background-color: #f5f5f5; padding: 3px 6px; border-radius: 3px; font-family: 'SF Mono', Consolas, Monaco, monospace; font-size: 0.9em; color: #d73a49;">${content}</code>`;
    }

    parts.push(content);
  }

  return parts.join('');
}
