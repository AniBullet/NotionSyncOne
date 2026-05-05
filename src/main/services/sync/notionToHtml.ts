import { NotionBlock } from '../../../shared/types/notion';
import { themes, ThemeStyles } from '../../../shared/types/theme';
import { LogService } from '../LogService';
import { convertRichTextToHtml, escapeHtml } from './html';
import { resolveImageUrl } from './images';

export function convertBlocksToHtml(blocks: NotionBlock[], imageUrlMap?: Map<string, string>, forWeChat: boolean = true, theme: ThemeStyles = themes.default): string {
    const htmlParts: string[] = [];
    let currentList: { type: 'bulleted' | 'numbered'; items: string[] } | null = null;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const html = convertBlockToHtml(block, imageUrlMap, theme, forWeChat);

      // 处理列表项
      if (block.type === 'bulleted_list_item') {
        if (!currentList || currentList.type !== 'bulleted') {
          // 结束上一个列表
          if (currentList) {
            htmlParts.push(currentList.type === 'bulleted' ? `<ul style="margin: 1em 0; padding-left: 2em; list-style-type: disc;">${currentList.items.join('')}</ul>` : `<ol style="margin: 1em 0; padding-left: 2em;">${currentList.items.join('')}</ol>`);
          }
          // 开始新列表
          currentList = { type: 'bulleted', items: [] };
        }
        currentList.items.push(html);
      } else if (block.type === 'numbered_list_item') {
        if (!currentList || currentList.type !== 'numbered') {
          // 结束上一个列表
          if (currentList) {
            htmlParts.push(currentList.type === 'bulleted' ? `<ul style="margin: 1em 0; padding-left: 2em; list-style-type: disc;">${currentList.items.join('')}</ul>` : `<ol style="margin: 1em 0; padding-left: 2em;">${currentList.items.join('')}</ol>`);
          }
          // 开始新列表
          currentList = { type: 'numbered', items: [] };
        }
        currentList.items.push(html);
      } else {
        // 非列表项，结束当前列表
        if (currentList) {
          htmlParts.push(currentList.type === 'bulleted' ? `<ul style="margin: 1em 0; padding-left: 2em; list-style-type: disc;">${currentList.items.join('')}</ul>` : `<ol style="margin: 1em 0; padding-left: 2em;">${currentList.items.join('')}</ol>`);
          currentList = null;
        }
        if (html.trim() !== '') {
          htmlParts.push(html);
        }
      }
    }

    // 处理最后一个列表
    if (currentList) {
      htmlParts.push(currentList.type === 'bulleted' ? `<ul style="margin: 1em 0; padding-left: 2em; list-style-type: disc;">${currentList.items.join('')}</ul>` : `<ol style="margin: 1em 0; padding-left: 2em;">${currentList.items.join('')}</ol>`);
    }

    return htmlParts.join('\n\n');
  }

export function convertBlockToHtml(block: NotionBlock, imageUrlMap?: Map<string, string>, _theme: ThemeStyles = themes.default, forWeChat: boolean = true): string {
    // 处理不同类型的块
    switch (block.type) {
      case 'paragraph': {
        const richText = block.content?.rich_text || [];
        if (richText.length === 0) {
          return `<p style="margin: 1em 0; line-height: 1.8;">&nbsp;</p>`;
        }
        const htmlContent = convertRichTextToHtml(richText);
        return `<p style="margin: 1em 0; line-height: 1.8; letter-spacing: 0.5px; color: #333; font-size: 15px;">${htmlContent}</p>`;
      }
      case 'heading_1': {
        const richText = block.content?.rich_text || [];
        const htmlContent = convertRichTextToHtml(richText);
        return `<h1 style="margin: 1.5em 0 0.8em 0; padding: 0.5em 0 0.5em 0.8em; font-size: 1.75em; font-weight: 700; line-height: 1.3; color: #2c3e50; border-left: 6px solid #3498db; background: linear-gradient(to right, #ebf5fb 0%, transparent 100%);">${htmlContent}</h1>`;
      }
      case 'heading_2': {
        const richText = block.content?.rich_text || [];
        const htmlContent = convertRichTextToHtml(richText);
        return `<h2 style="margin: 1.3em 0 0.7em 0; padding-left: 0.6em; font-size: 1.4em; font-weight: 600; line-height: 1.4; color: #34495e; border-left: 4px solid #3498db;">${htmlContent}</h2>`;
      }
      case 'heading_3': {
        const richText = block.content?.rich_text || [];
        const htmlContent = convertRichTextToHtml(richText);
        return `<h3 style="margin: 1.1em 0 0.6em 0; font-size: 1.2em; font-weight: 600; line-height: 1.4; color: #555; padding-left: 0.4em; border-left: 3px solid #95a5a6;">${htmlContent}</h3>`;
      }
      case 'image': {
        const url = resolveImageUrl(block.content?.url || '', imageUrlMap);
        const caption = block.content?.caption?.[0]?.plain_text || '';
        
        if (url) {
          // 转义URL中的特殊字符
          const escapedUrl = escapeHtml(url);
          // 如果有标题，在图片下方显示
          if (caption) {
            return `<figure style="margin: 2em 0; text-align: center;"><img src="${escapedUrl}" alt="${escapeHtml(caption)}" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); display: block; margin: 0 auto;" /><figcaption style="margin-top: 1em; padding: 0.5em 1em; font-size: 14px; color: #7f8c8d; background-color: #f8f9fa; border-radius: 4px; display: inline-block;">${escapeHtml(caption)}</figcaption></figure>`;
          } else {
            return `<p style="text-align: center; margin: 2em 0;"><img src="${escapedUrl}" alt="图片" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); display: inline-block;" /></p>`;
          }
        }
        // 如果没有URL但有标题，至少显示标题
        if (caption) {
          LogService.warn(`图片块没有URL，仅显示标题: ${caption}`, 'SyncService');
          return `<p style="margin: 1em 0; line-height: 1.8; text-align: center; color: #999; font-size: 0.9em;"><em>${escapeHtml(caption)}</em></p>`;
        }
        // 如果既没有URL也没有标题，记录警告
        LogService.warn('图片块既没有URL也没有标题', 'SyncService');
        return '';
      }
      case 'video': {
        const url = block.content?.url || '';
        const caption = block.content?.caption?.[0]?.plain_text || '';
        
        if (url) {
          // 微信公众号不支持 iframe 和 video 标签，使用简洁的链接卡片样式
          if (forWeChat) {
            // 提取视频平台信息
            let platformName = '视频';
            let platformIcon = '▶️';
            
            if (url.includes('youtube.com') || url.includes('youtu.be')) {
              platformName = 'YouTube';
              platformIcon = '▶️';
            } else if (url.includes('bilibili.com')) {
              platformName = '哔哩哔哩';
              platformIcon = '▶️';
            } else if (url.includes('vimeo.com')) {
              platformName = 'Vimeo';
              platformIcon = '▶️';
            } else if (url.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i)) {
              platformName = '视频';
              platformIcon = '▶️';
            }
            
            // 创建简洁的视频链接卡片
            const displayText = caption || platformName;
            return `<section style="margin: 1.5em 0; padding: 16px 20px; background: #f8f9fa; border-left: 4px solid #576b95; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
  <div style="display: flex; align-items: flex-start; gap: 12px;">
    <span style="font-size: 24px; flex-shrink: 0; margin-top: 2px;">${platformIcon}</span>
    <div style="flex: 1; min-width: 0;">
      <div style="font-size: 15px; font-weight: 500; color: #333; margin-bottom: 8px; line-height: 1.4;">
        ${escapeHtml(displayText)}
      </div>
      <div style="font-size: 13px; color: #576b95; word-break: break-all; line-height: 1.5;">
        ${escapeHtml(url)}
      </div>
    </div>
  </div>
</section>`;
          }
          
          // WordPress 等其他平台：保持原有的 iframe/video 嵌入逻辑
          let videoHtml = '';
          
          // YouTube 视频检测
          const youtubeMatch = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\s]{11})/);
          if (youtubeMatch) {
            const videoId = youtubeMatch[1];
            videoHtml = `<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; margin: 1.5em 0;">
              <iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
                src="https://www.youtube.com/embed/${videoId}" 
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen>
              </iframe>
            </div>`;
          }
          // Vimeo 视频检测
          else if (url.includes('vimeo.com')) {
            const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
            if (vimeoMatch) {
              const videoId = vimeoMatch[1];
              videoHtml = `<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; margin: 1.5em 0;">
                <iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
                  src="https://player.vimeo.com/video/${videoId}" 
                  frameborder="0" 
                  allow="autoplay; fullscreen; picture-in-picture" 
                  allowfullscreen>
                </iframe>
              </div>`;
            }
          }
          // Bilibili 视频检测
          else if (url.includes('bilibili.com')) {
            const bvMatch = url.match(/BV[a-zA-Z0-9]+/);
            const avMatch = url.match(/av(\d+)/);
            if (bvMatch) {
              videoHtml = `<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; margin: 1.5em 0;">
                <iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
                  src="https://player.bilibili.com/player.html?bvid=${bvMatch[0]}&page=1" 
                  scrolling="no" 
                  border="0" 
                  frameborder="no" 
                  framespacing="0" 
                  allowfullscreen="true">
                </iframe>
              </div>`;
            } else if (avMatch) {
              videoHtml = `<div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; margin: 1.5em 0;">
                <iframe style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" 
                  src="https://player.bilibili.com/player.html?aid=${avMatch[1]}&page=1" 
                  scrolling="no" 
                  border="0" 
                  frameborder="no" 
                  framespacing="0" 
                  allowfullscreen="true">
                </iframe>
              </div>`;
            }
          }
          // 通用视频文件（mp4, webm, ogg 等）
          else if (url.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i)) {
            videoHtml = `<div style="margin: 1.5em 0; text-align: center;">
              <video controls style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <source src="${escapeHtml(url)}" type="video/${url.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i)?.[1] || 'mp4'}">
                您的浏览器不支持 HTML5 视频播放。
                <a href="${escapeHtml(url)}" style="color: #0073aa;">下载视频</a>
              </video>
            </div>`;
          }
          // 如果无法识别视频类型，使用 WordPress 的 [video] 短代码
          else {
            videoHtml = `<p style="margin: 1.2em 0; padding: 1em; background-color: #f0f7ff; border-left: 4px solid #1890ff; border-radius: 4px;">
              [video src="${escapeHtml(url)}"]
            </p>`;
          }
          
          // 添加标题（如果有）
          if (caption) {
            return `<div style="margin: 1.5em 0;">
              ${videoHtml}
              <p style="text-align: center; margin-top: 0.8em; color: #666; font-size: 14px;">🎬 ${escapeHtml(caption)}</p>
            </div>`;
          }
          
          return videoHtml;
        } else {
          const captionText = caption || '视频内容';
          return `<p style="margin: 1em 0; padding: 1em; background-color: #f7f7f7; border-radius: 6px; color: #666; text-align: center;">[视频: ${escapeHtml(captionText)}]</p>`;
        }
      }
      case 'file': {
        const url = block.content?.url || '';
        const caption = block.content?.caption?.[0]?.plain_text || '';
        if (url) {
          return `<p style="margin: 1.2em 0; padding: 0.8em 1em; background-color: #f0f7ff; border-left: 4px solid #1890ff; border-radius: 4px;"><a href="${url}" style="color: #1890ff; text-decoration: none; font-weight: 500;">📎 ${escapeHtml(caption || '文件下载')}</a></p>`;
        }
        return '';
      }
      case 'pdf': {
        const url = block.content?.url || '';
        const caption = block.content?.caption?.[0]?.plain_text || '';
        if (url) {
          return `<p style="margin: 1.2em 0; padding: 0.8em 1em; background-color: #fff3e0; border-left: 4px solid #ff9800; border-radius: 4px;"><a href="${url}" style="color: #ff6f00; text-decoration: none; font-weight: 500;">📄 ${escapeHtml(caption || 'PDF 文档')}</a></p>`;
        }
        return '';
      }
      case 'embed': {
        const url = block.content?.url || '';
        const caption = block.content?.caption?.[0]?.plain_text || '';
        if (url) {
          // 确保 URL 是可访问的
          let actualUrl = url;
          if (url.includes('youtube-nocookie.com/embed/') || url.includes('youtube.com/embed/')) {
            const videoIdMatch = url.match(/embed\/([^?]+)/);
            if (videoIdMatch) {
              actualUrl = `https://www.youtube.com/watch?v=${videoIdMatch[1]}`;
            }
          }
          
          // 简化为卡片样式
          if (caption) {
            return `<div style="margin: 1.5em 0; padding: 1.2em; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);"><p style="margin: 0 0 0.8em 0; font-weight: 600; color: #fff; font-size: 1.05em;">📌 ${escapeHtml(caption)}</p><p style="margin: 0;"><a href="${actualUrl}" style="color: #fff; text-decoration: none; background-color: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 4px; display: inline-block; font-size: 14px;">查看内容 →</a></p></div>`;
          } else {
            return `<p style="margin: 1.2em 0; padding: 0.8em 1em; background-color: #f0f7ff; border-left: 4px solid #1890ff; border-radius: 4px;"><a href="${actualUrl}" style="color: #1890ff; text-decoration: none; font-weight: 500;">🔗 ${actualUrl}</a></p>`;
          }
        }
        return caption ? `<p style="margin: 1em 0; line-height: 1.8;">${escapeHtml(caption)}</p>` : '';
      }
      case 'bookmark': {
        const url = block.content?.url || '';
        const caption = block.content?.caption?.[0]?.plain_text || '';
        if (url) {
          return `<p style="margin: 1.2em 0; padding: 0.8em 1em; background-color: #fff9e6; border-left: 4px solid #faad14; border-radius: 4px;"><a href="${url}" style="color: #d48806; text-decoration: none; font-weight: 500;">🔖 ${escapeHtml(caption || url)}</a></p>`;
        }
        return '';
      }
      case 'link_preview': {
        const url = block.content?.url || '';
        if (url) {
          return `<p style="margin: 1.2em 0; padding: 0.8em 1em; background-color: #f0f7ff; border-left: 4px solid #1890ff; border-radius: 4px;"><a href="${url}" style="color: #1890ff; text-decoration: none; font-weight: 500;">🔗 ${url}</a></p>`;
        }
        return '';
      }
      case 'bulleted_list_item': {
        const richText = block.content?.rich_text || [];
        const htmlContent = convertRichTextToHtml(richText);
        return `<li style="margin: 0.5em 0; line-height: 1.8; color: #555;">${htmlContent}</li>`;
      }
      case 'numbered_list_item': {
        const richText = block.content?.rich_text || [];
        const htmlContent = convertRichTextToHtml(richText);
        return `<li style="margin: 0.5em 0; line-height: 1.8; color: #555;">${htmlContent}</li>`;
      }
      case 'quote': {
        const richText = block.content?.rich_text || [];
        const htmlContent = convertRichTextToHtml(richText);
        return `<blockquote style="margin: 1.2em 0; padding: 1em 1.2em; background-color: #fef9e7; border-left: 4px solid #f39c12; border-radius: 4px; color: #7f8c8d; font-style: italic; line-height: 1.8; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">${htmlContent}</blockquote>`;
      }
      case 'code': {
        const richText = block.content?.rich_text || [];
        const textContent = richText.map(text => text.plain_text).join('');
        const language = (block.content as any)?.language || '';
        
        // 转义 HTML 特殊字符
        const escapedContent = textContent
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
        
        // 带行号的代码块样式（参考微信公众号常见样式）
        const lines = escapedContent.split('\n');
        const lineNumberHtml = lines.map((_, i) => `<li style="list-style: none; padding: 0 10px 0 0; margin: 0; color: #999; user-select: none; text-align: right; min-width: 30px;">${i + 1}</li>`).join('');
        const codeHtml = lines.map(line => `<code style="display: block; padding: 0; margin: 0;">${line || ' '}</code>`).join('');
        
        return `<section style="margin: 16px 0; background: #f6f8fa; border-radius: 6px; overflow: hidden; font-size: 14px; border: 1px solid #e1e4e8;">
${language ? `<div style="padding: 8px 12px; background: #e8eaed; color: #666; font-size: 12px; border-bottom: 1px solid #e1e4e8; font-family: Consolas, Monaco, monospace;">${escapeHtml(language)}</div>` : ''}
<div style="display: flex; overflow-x: auto;">
<ul style="margin: 0; padding: 10px 0; list-style: none; background: #f0f0f0; border-right: 1px solid #e1e4e8;">${lineNumberHtml}</ul>
<pre style="margin: 0; padding: 10px 12px; flex: 1; overflow-x: auto; font-family: Consolas, Monaco, 'Courier New', monospace; line-height: 1.6; color: #24292e; white-space: pre;"><code style="font-family: inherit;">${codeHtml}</code></pre>
</div>
        </section>`;
      }
      case 'divider':
        return '<hr style="margin: 2em 0; border: 0; height: 1px; background: linear-gradient(to right, transparent, #cbd5e0, transparent);" />';
      case 'to_do': {
        const richText = block.content?.rich_text || [];
        const htmlContent = convertRichTextToHtml(richText);
        const checked = (block.content as any)?.checked || false;
        
        const checkboxStyle = checked 
          ? `background-color: #e8f5e9; border-left: 3px solid #4caf50;`
          : `background-color: #fff3e0; border-left: 3px solid #ff9800;`;
        
        const checkboxIcon = checked ? '✓' : '○';
        const iconColor = checked ? '#4caf50' : '#ff9800';
        
        return `<div style="margin: 0.8em 0; padding: 0.8em 1em; ${checkboxStyle} border-radius: 4px; display: flex; align-items: flex-start;">
          <span style="display: inline-block; width: 20px; height: 20px; margin-right: 0.8em; text-align: center; line-height: 20px; font-size: 14px; font-weight: bold; flex-shrink: 0; color: ${iconColor};">${checkboxIcon}</span>
          <span style="${checked ? 'text-decoration: line-through; color: #999;' : 'color: #555;'} line-height: 1.6;">${htmlContent}</span>
        </div>`;
      }
      default: {
        // 对于未知类型，尝试提取文本内容
        const richText = block.content?.rich_text || [];
        if (richText.length > 0) {
          const textContent = richText.map(text => text.plain_text).join('');
          if (textContent.trim()) {
            return `<p>${textContent}</p>`;
          }
        }
        // 如果块有子块但没有内容，返回提示
        if (block.has_children) {
          return `<p>[包含子内容的 ${block.type} 块，需要递归处理]</p>`;
        }
        return '';
      }
    }
  }
