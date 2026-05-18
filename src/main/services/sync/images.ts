import { NotionBlock, NotionPage } from '../../../shared/types/notion';
import { LogService } from '../LogService';

export function getCoverImageUrl(page: NotionPage): string {
  if (page.cover) {
    if (page.cover.type === 'external' && page.cover.external) {
      return page.cover.external.url;
    } else if (page.cover.type === 'file' && page.cover.file) {
      const url = page.cover.file.url;
      if (url.includes('secure.notion-static.com') || url.includes('s3.us-west')) {
        LogService.warn('封面使用 Notion 临时 URL，可能会过期', 'SyncService');
      }
      return url;
    }
  }

  let coverProp = page.properties.Cover || page.properties['Cover'];
  if (!coverProp) {
    coverProp = page.properties.MainImage || page.properties['Main Image'];
  }

  if (!coverProp) {
    return '';
  }

  if (coverProp.type === 'files' && Array.isArray(coverProp.files)) {
    const firstFile = coverProp.files[0];
    if (firstFile) {
      if (firstFile.type === 'file' && firstFile.file) {
        return firstFile.file.url;
      } else if (firstFile.type === 'external' && firstFile.external) {
        return firstFile.external.url;
      }
    }
  } else if (coverProp.type === 'url' && coverProp.url) {
    return coverProp.url;
  } else if ((coverProp as { url?: string | null }).url) {
    return (coverProp as { url: string }).url;
  } else if (coverProp.rich_text?.[0]?.plain_text) {
    return coverProp.rich_text[0].plain_text;
  }

  return '';
}

export function extractImageUrls(blocks: NotionBlock[], _coverImageUrl?: string): string[] {
  const urls = new Set<string>();

  for (const block of blocks) {
    if (block.type === 'image' && block.content?.url) {
      urls.add(block.content.url);
    }
  }

  return Array.from(urls);
}

export function resolveImageUrl(originalUrl: string, imageUrlMap?: Map<string, string>): string {
  if (originalUrl && imageUrlMap?.has(originalUrl)) {
    return imageUrlMap.get(originalUrl)!;
  }

  return originalUrl;
}
