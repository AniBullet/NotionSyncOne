import axios from 'axios';
import * as https from 'https';
import * as http from 'http';
import * as zlib from 'zlib';
import * as fs from 'fs';
import * as path from 'path';
import { WeChatConfig, WeChatArticle, WeChatResponse } from '../../shared/types/wechat';
import { ConfigService } from './ConfigService';
import { LogService } from './LogService';
import { logger } from '../utils/logger';

export class WeChatService {
  private configService: ConfigService;
  private baseUrl = 'https://api.weixin.qq.com/cgi-bin';

  constructor(configService: ConfigService) {
    this.configService = configService;
  }

  /**
   * 按微信接口要求限制标题/摘要长度（按字符数截断）
   * 官方限制：
   * - 标题 (title): 64 字符
   * - 摘要 (digest): 120 字符
   * 来源：微信公众平台官方规定
   */
  private cutTextForWeChat(raw: string, maxChars: number = 64, fieldName: string = 'title'): string {
    if (!raw) return '';

    // 微信限制是按字符数，不是字节数
    if (raw.length <= maxChars) {
      return raw;
    }

    // 截断到指定字符数
    const result = raw.substring(0, maxChars);

    LogService.warn(
      `字段 "${fieldName}" 长度超出微信限制，已自动截断。原始长度: ${raw.length} 字符，截断后: ${result.length} 字符（限制: ${maxChars}）`,
      'WeChatService'
    );

    return result;
  }

  /**
   * 截断文章内容，确保不超过微信公众号限制
   * 官方限制：单篇图文消息正文不能超过 20,000 字符（纯文字，不含HTML标签）
   * 来源：微信公众平台官方规定
   */
  /**
   * 直接截断HTML内容到指定长度（按HTML字符数，不是纯文本）
   */
  private truncateHtml(htmlContent: string, maxLength: number): string {
    if (!htmlContent || htmlContent.length <= maxLength) {
      return htmlContent;
    }

    // 截断到安全长度（留足够空间给闭合标签和提示文字）
    const safeLength = Math.floor(maxLength * 0.80); // 80%的空间给原内容，20%给闭合和提示
    let truncated = htmlContent.substring(0, safeLength);
    
    // 确保不会在标签中间截断
    const lastTagStart = truncated.lastIndexOf('<');
    const lastTagEnd = truncated.lastIndexOf('>');
    if (lastTagStart > lastTagEnd) {
      // 在标签中间截断了，回退到上一个完整标签
      truncated = truncated.substring(0, lastTagStart);
    }
    
    // 移除末尾可能不完整的内容（比如半个词或句子）
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > truncated.length - 100) {
      truncated = truncated.substring(0, lastSpace);
    }
    
    // 确保 HTML 标签闭合
    truncated = this.ensureHtmlClosed(truncated);
    
    // 添加简洁的截断提示
    truncated += '\n<hr style="margin:2em 0;border:0;height:1px;background:#e0e0e0;" />';
    truncated += '\n<p style="text-align:center;color:#999;font-size:14px;">内容过长已自动截断，完整内容请点击原文链接查看</p>';

    return truncated;
  }

  /**
   * 截断文章内容（按纯文本字符数）
   * @deprecated 使用 truncateHtml 代替
   */
  private truncateContent(content: string, maxLength: number = 20000): string {
    if (!content) return '';
    
    // 移除 HTML 标签计算实际文字长度
    const textContent = content.replace(/<[^>]*>/g, '');
    
    if (textContent.length <= maxLength) {
      return content;
    }

    LogService.warn(
      `文章内容过长（${textContent.length} 字符），将截断至 ${maxLength} 字符`,
      'WeChatService'
    );

    // 智能截断：尝试在段落或句子边界截断
    let truncated = content;
    let currentLength = 0;
    const parser = /<[^>]+>|[^<]+/g;
    const parts: string[] = [];
    let match;

    while ((match = parser.exec(content)) !== null) {
      const part = match[0];
      const isTag = part.startsWith('<');
      
      if (!isTag) {
        // 纯文本，计入长度
        if (currentLength + part.length > maxLength) {
          // 需要截断
          const remaining = maxLength - currentLength;
          if (remaining > 0) {
            parts.push(part.substring(0, remaining) + '...');
          }
          break;
        }
        currentLength += part.length;
      }
      parts.push(part);
    }

    truncated = parts.join('');
    
    // 确保 HTML 标签闭合
    truncated = this.ensureHtmlClosed(truncated);
    
    // 添加提示信息
    truncated += '<hr style="margin: 2em 0; border: 0; height: 1px; background: #e0e0e0;" />';
    truncated += '<p style="text-align: center; color: #999; font-size: 14px;">✂️ 内容过长已自动截断，完整内容请点击原文链接查看</p>';

    return truncated;
  }

  /**
   * 确保 HTML 标签正确闭合
   */
  private ensureHtmlClosed(html: string): string {
    const openTags: string[] = [];
    const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g;
    let match;

    while ((match = tagPattern.exec(html)) !== null) {
      const fullTag = match[0];
      const tagName = match[1].toLowerCase();
      
      // 跳过自闭合标签
      if (['img', 'br', 'hr', 'input', 'meta', 'link'].includes(tagName)) {
        continue;
      }

      if (fullTag.startsWith('</')) {
        // 闭合标签
        const index = openTags.lastIndexOf(tagName);
        if (index !== -1) {
          openTags.splice(index, 1);
        }
      } else if (!fullTag.endsWith('/>')) {
        // 开放标签
        openTags.push(tagName);
      }
    }

    // 闭合所有未闭合的标签
    while (openTags.length > 0) {
      const tagName = openTags.pop();
      html += `</${tagName}>`;
    }

    return html;
  }

  async publishArticle(article: WeChatArticle, publishMode: 'publish' | 'draft' = 'publish', abortSignal?: AbortSignal): Promise<void> {
    try {
      LogService.log('========== WeChatService: 开始发布文章 ==========', 'WeChatService');
      LogService.log(`发布模式: ${publishMode}`, 'WeChatService');
      LogService.log(`文章标题: ${article.title}`, 'WeChatService');

      const accessToken = await this.getAccessToken();
      LogService.log('获取到访问令牌', 'WeChatService');

      // 获取封面图片的 media_id 和 URL
      LogService.log('正在上传封面图片...', 'WeChatService');
      let thumbMediaId: string | null = null;
      let uploadedImageUrl: string | null = null;
      
      // 优先使用文章中的封面图片（Cover 或 MainImage），如果没有则使用 Unsplash 随机图片
      let imageUrl: string | undefined = article.coverImageUrl;
      
      if (!imageUrl) {
        LogService.log('未找到封面图片，使用默认占位图片...', 'WeChatService');
        // 使用公开的占位图片服务（无需 API Key）
        // 可选方案：picsum.photos（免费、无需 API Key）
        const placeholderUrl = `https://picsum.photos/1200/630?random=${Date.now()}`;
        LogService.log('正在获取占位图片...', 'WeChatService');
        try {
          imageUrl = placeholderUrl;
          LogService.log(`获取到占位图片: ${imageUrl.substring(0, 50)}...`, 'WeChatService');
        } catch (error) {
          LogService.warn('获取占位图片失败，跳过封面图片', 'WeChatService');
          imageUrl = undefined;
        }
      } else {
        LogService.log(`使用封面图片: ${imageUrl.substring(0, 50)}...`, 'WeChatService');
      }

      // 如果有封面图片，尝试上传
      if (imageUrl) {
        // 检查是否已取消
        if (abortSignal?.aborted) {
          throw new Error('同步已取消');
        }

        LogService.log(`开始上传封面图片: ${imageUrl.substring(0, 80)}...`, 'WeChatService');
        try {
          const uploadResult = await this.uploadImage(imageUrl, abortSignal, 'cover.png');
          thumbMediaId = uploadResult.mediaId;
          uploadedImageUrl = uploadResult.url || null;
          if (!thumbMediaId) {
            throw new Error('封面图片上传失败: 未返回 media_id');
          }
          LogService.log(`封面图片上传成功，media_id: ${thumbMediaId}`, 'WeChatService');
          if (uploadedImageUrl) {
            LogService.log(`封面图片URL: ${uploadedImageUrl}`, 'WeChatService');
          } else {
            LogService.warn('警告: 未获取到封面图片URL，文章内容中的图片可能无法显示', 'WeChatService');
          }
        } catch (uploadError) {
          // 如果是取消错误，直接抛出
          if (abortSignal?.aborted || (uploadError instanceof Error && uploadError.message.includes('已取消'))) {
            throw new Error('同步已取消');
          }
          // 封面图片上传失败不应该阻止草稿创建，但需要记录详细错误
          const errorMsg = uploadError instanceof Error ? uploadError.message : String(uploadError);
          LogService.error(`封面图片上传失败: ${errorMsg}`, 'WeChatService');
          if (uploadError instanceof Error && uploadError.stack) {
            LogService.error(`封面图片上传失败堆栈: ${uploadError.stack}`, 'WeChatService');
          }
          LogService.warn('将继续创建无封面的草稿', 'WeChatService');
          thumbMediaId = null;
          uploadedImageUrl = null;
        }
      } else {
        LogService.warn('未找到封面图片，将创建无封面的草稿', 'WeChatService');
      }

      // 检查是否已取消
      if (abortSignal?.aborted) {
        throw new Error('同步已取消');
      }

      // 创建草稿
      LogService.log('========== 开始创建草稿 ==========', 'WeChatService');
      const draftUrl = `${this.baseUrl}/draft/add?access_token=${accessToken}`;
      LogService.log(`草稿API地址: ${draftUrl}`, 'WeChatService');

      // 处理文章内容：如果上传了封面图片，将内容中的原始图片URL替换为上传后的URL
      let processedContent = article.content;
      if (uploadedImageUrl && imageUrl) {
        // 在文章内容中查找并替换封面图片的原始URL
        // 需要处理多种可能的URL格式（完整URL、转义后的URL等）
        const escapedOriginalUrl = imageUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // 匹配 img 标签中的 src 属性，支持单引号和双引号
        const imgTagRegex1 = new RegExp(`(<img[^>]*src=["'])${escapedOriginalUrl}(["'][^>]*>)`, 'gi');
        const imgTagRegex2 = new RegExp(`(<img[^>]*src=['"])${escapedOriginalUrl}(['"][^>]*>)`, 'gi');
        processedContent = processedContent.replace(imgTagRegex1, `$1${uploadedImageUrl}$2`);
        processedContent = processedContent.replace(imgTagRegex2, `$1${uploadedImageUrl}$2`);
        
        // 也尝试替换转义后的URL（HTML实体编码）
        const htmlEscapedUrl = imageUrl.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        if (htmlEscapedUrl !== imageUrl) {
          const escapedHtmlEscapedUrl = htmlEscapedUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const imgTagRegex3 = new RegExp(`(<img[^>]*src=["'])${escapedHtmlEscapedUrl}(["'][^>]*>)`, 'gi');
          processedContent = processedContent.replace(imgTagRegex3, `$1${uploadedImageUrl}$2`);
        }
        
        LogService.log(`已将文章内容中的封面图片URL替换为微信服务器URL`, 'WeChatService');
        LogService.log(`原始URL: ${imageUrl.substring(0, 60)}...`, 'WeChatService');
        LogService.log(`新URL: ${uploadedImageUrl.substring(0, 60)}...`, 'WeChatService');
      }

      // 检查并截断内容（微信公众号限制）
      // 微信对content字段的限制：根据测试，HTML总长度不能超过约20000-30000字符
      // 采用保守策略：限制HTML总长度为20000字符
      const htmlLength = processedContent.length;
      const textLength = processedContent.replace(/<[^>]*>/g, '').length;
      LogService.log(`文章内容 - HTML总长度: ${htmlLength} 字符, 纯文本长度: ${textLength} 字符`, 'WeChatService');
      
      const MAX_HTML_LENGTH = 18000; // 更保守的限制：18000字符（微信实际限制约20000）
      if (htmlLength > MAX_HTML_LENGTH) {
        LogService.warn(`⚠️ HTML内容过长（${htmlLength} > ${MAX_HTML_LENGTH}），将截断`, 'WeChatService');
        // 直接截断HTML字符串到安全长度
        processedContent = this.truncateHtml(processedContent, MAX_HTML_LENGTH);
        LogService.log(`截断后 - HTML: ${processedContent.length} 字符, 纯文本: ${processedContent.replace(/<[^>]*>/g, '').length} 字符`, 'WeChatService');
      }
      
      // 构建文章数据对象（按微信官方限制截断标题和摘要）
      // 官方限制：标题64字符，摘要120字符
      const safeTitle = this.cutTextForWeChat(article.title, 64, 'title');
      const safeDigest = this.cutTextForWeChat(article.digest || article.title, 120, 'digest');

      const articleItem: any = {
        title: safeTitle,
        author: article.author || '匿名',
        digest: safeDigest,
        content: processedContent,
        content_source_url: article.contentSourceUrl || '', // 原文链接
        need_open_comment: article.needOpenComment ? 1 : 0,
        only_fans_can_comment: 0
      };
      
      // 只有在成功获取封面图片时才添加 thumb_media_id
      if (thumbMediaId) {
        articleItem.thumb_media_id = thumbMediaId;
        LogService.log(`已设置封面图片 media_id: ${thumbMediaId}`, 'WeChatService');
      } else {
        LogService.warn('未设置封面图片，草稿将使用默认封面', 'WeChatService');
      }

      const articleData: any = {
        articles: [articleItem]
      };

      LogService.log(`准备创建草稿 - 标题: ${article.title}, 作者: ${article.author || '匿名'}, 原文链接: ${article.contentSourceUrl || '无'}`, 'WeChatService');
      LogService.log(`最终发送内容 - HTML长度: ${processedContent.length} 字符, 纯文本长度: ${processedContent.replace(/<[^>]*>/g, '').length} 字符`, 'WeChatService');
      LogService.log(`发送到微信的完整数据: ${JSON.stringify(articleData, null, 2)}`, 'WeChatService');

      // 检查是否已取消
      if (abortSignal?.aborted) {
        throw new Error('同步已取消');
      }

      LogService.log('正在发送创建草稿请求...', 'WeChatService');
      let draftResponse;
      try {
        draftResponse = await axios.post<WeChatResponse & { media_id?: string }>(draftUrl, articleData);
        LogService.log(`创建草稿请求已发送，HTTP状态码: ${draftResponse.status}`, 'WeChatService');
      } catch (axiosError: any) {
        // axios 请求失败（网络错误、超时等）
        const errorMsg = axiosError?.response?.data 
          ? JSON.stringify(axiosError.response.data)
          : (axiosError instanceof Error ? axiosError.message : String(axiosError));
        LogService.error(`创建草稿请求失败: ${errorMsg}`, 'WeChatService');
        if (axiosError?.response?.data) {
          LogService.error(`微信API响应: ${JSON.stringify(axiosError.response.data, null, 2)}`, 'WeChatService');
        }
        if (axiosError instanceof Error && axiosError.stack) {
          LogService.error(`请求失败堆栈: ${axiosError.stack}`, 'WeChatService');
        }
        throw new Error(`创建草稿请求失败: ${errorMsg}`);
      }

      LogService.log(`创建草稿响应状态码: ${draftResponse.status}`, 'WeChatService');
      LogService.log(`创建草稿响应数据: ${JSON.stringify(draftResponse.data, null, 2)}`, 'WeChatService');

      // 检查是否已取消
      if (abortSignal?.aborted) {
        throw new Error('同步已取消');
      }

      // 检查是否有错误码
      if (draftResponse.data.errcode && draftResponse.data.errcode !== 0) {
        const errorMsg = draftResponse.data.errmsg || '未知错误';
        LogService.error(`创建草稿失败 - 错误码: ${draftResponse.data.errcode}, 错误信息: ${errorMsg}`, 'WeChatService');
        throw new Error(`创建草稿失败: ${errorMsg} (错误码: ${draftResponse.data.errcode})`);
      }

      // 严格检查 media_id
      if (!draftResponse.data.media_id) {
        const responseStr = JSON.stringify(draftResponse.data);
        LogService.error(`创建草稿失败: 未返回 media_id`, 'WeChatService');
        LogService.error(`完整响应: ${responseStr}`, 'WeChatService');
        throw new Error(`创建草稿失败: 未返回 media_id。响应: ${responseStr}`);
      }

      const draftMediaId = draftResponse.data.media_id;
      LogService.success('========== 草稿创建成功 ==========', 'WeChatService');
      LogService.log(`草稿 media_id: ${draftMediaId}`, 'WeChatService');
      LogService.log(`草稿标题: ${article.title}`, 'WeChatService');
      LogService.log(`草稿内容长度: ${article.content.length} 字符`, 'WeChatService');

      // 如果只是保存草稿，直接返回
      if (publishMode === 'draft') {
        LogService.success('========== 文章已保存为草稿，流程完成 ==========', 'WeChatService');
        return;
      }

      // 等待1秒确保草稿保存完成
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 发布草稿
      await this.publishDraft(draftMediaId);
      logger.log('文章发布流程完成');
      return;
    } catch (error) {
      LogService.error('========== WeChatService: 发布文章失败 ==========', 'WeChatService');
      const errorMessage = error instanceof Error ? error.message : String(error);
      LogService.error(`错误: ${errorMessage}`, 'WeChatService');
      if (error instanceof Error && error.stack) {
        LogService.error(`堆栈: ${error.stack}`, 'WeChatService');
      }
      throw error;
    }
  }

  private async getAccessToken(): Promise<string> {
    try {
      logger.log('开始获取访问令牌...');
      const config = this.configService.getWeChatConfig();
      logger.log('配置状态: appId已配置:', !!config.appId, ', appSecret已配置:', !!config.appSecret);

      const cachedToken = config.accessToken;
      const tokenExpiresAt = config.tokenExpiresAt || 0;

      // 如果令牌未过期，直接返回
      if (cachedToken && tokenExpiresAt > Date.now()) {
        logger.log('使用缓存的访问令牌');
        return cachedToken;
      }

      logger.log('获取新的访问令牌...');
      const url = `${this.baseUrl}/token?grant_type=client_credential&appid=${config.appId}&secret=${config.appSecret}`;
      
      const response = await axios.get<WeChatResponse & { access_token: string; expires_in: number }>(url);
      logger.log('访问令牌获取成功，过期时间:', response.data.expires_in, '秒');

      if (response.data.errcode !== 0 && !response.data.access_token) {
        logger.error('获取访问令牌失败:', response.data);
        throw new Error(`获取访问令牌失败: ${response.data.errmsg}`);
      }

      // 更新配置
      const currentConfig = await this.configService.getConfig();
      await this.configService.saveConfig({
        ...currentConfig,
        wechat: {
          ...currentConfig.wechat,
          accessToken: response.data.access_token,
          tokenExpiresAt: Date.now() + (response.data.expires_in * 1000)
        }
      });

      logger.log('访问令牌获取成功');
      return response.data.access_token;
    } catch (error) {
      logger.error('获取访问令牌失败:', error);
      throw error;
    }
  }

  // 使用 Node.js 原生模块下载图片，更好的网络控制
  private async downloadImage(imageUrl: string, abortSignal?: AbortSignal, maxRetries: number = 3): Promise<Buffer> {
    // 优先使用 axios 下载（支持更好的重定向和 cookie 处理）
    try {
      return await this.downloadImageWithAxios(imageUrl, abortSignal, maxRetries);
    } catch (axiosError) {
      // 如果 axios 失败，回退到原生 http
      LogService.warn('axios 下载失败，尝试使用原生 http', 'WeChatService');
      return await this.downloadImageWithHttp(imageUrl, abortSignal, maxRetries);
    }
  }

  /**
   * 通过代理服务下载图片（解决防盗链问题）
   * 类似 Notion 的做法，使用第三方图片代理
   */
  private getProxiedImageUrl(originalUrl: string, proxyIndex: number = 0): string {
    const encodedUrl = encodeURIComponent(originalUrl);
    
    // 多个备用代理服务
    const proxies = [
      `https://images.weserv.nl/?url=${encodedUrl}&output=webp&q=85`,  // weserv.nl - 主要选择
      `https://wsrv.nl/?url=${encodedUrl}&output=webp&q=85`,           // wsrv.nl - 备用
      `https://imageproxy.pimg.tw/resize?url=${encodedUrl}`,           // imageproxy - 备用2
    ];
    
    return proxies[proxyIndex % proxies.length];
  }

  // 使用 axios 下载图片（更好的兼容性）
  private async downloadImageWithAxios(imageUrl: string, abortSignal?: AbortSignal, maxRetries: number = 3): Promise<Buffer> {
    const url = new URL(imageUrl);
    const hostname = url.hostname.toLowerCase();
    
    const headers: { [key: string]: string } = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'image/*,*/*;q=0.8',
    };
    
    // 判断是否需要代理
    const needsProxy = !hostname.includes('notion.so') && !hostname.includes('qpic.cn');
    
    if (needsProxy) {
      // 使用 Notion 官方代理服务（最快最稳定）
      const proxiedUrl = `https://www.notion.so/image/${encodeURIComponent(imageUrl)}`;
      
      try {
        const response = await axios.get(proxiedUrl, {
          headers,
          responseType: 'arraybuffer',
          timeout: 15000,
          maxRedirects: 5,
        });
        
        const buffer = Buffer.from(response.data);
        LogService.log(`✓ 图片下载成功: ${buffer.length} 字节`, 'WeChatService');
        return buffer;
      } catch (proxyError) {
        // 代理失败，尝试直接下载一次
        LogService.warn(`代理失败，尝试直接下载...`, 'WeChatService');
      }
    }
    
    // 直接下载（Notion 图片或代理失败后的尝试）
    try {
      const response = await axios.get(imageUrl, {
        headers,
        responseType: 'arraybuffer',
        timeout: 15000,
        maxRedirects: 5,
      });
      
      const buffer = Buffer.from(response.data);
      LogService.log(`✓ 图片下载成功: ${buffer.length} 字节`, 'WeChatService');
      return buffer;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`图片下载失败: ${errorMsg}`);
    }
  }

  // 使用原生 HTTP 下载图片（备用方案）
  private async downloadImageWithHttp(imageUrl: string, abortSignal?: AbortSignal, maxRetries: number = 3): Promise<Buffer> {
    const url = new URL(imageUrl);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;
    
    // 构建请求头
    const headers: { [key: string]: string } = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate',
      'Connection': 'keep-alive',
      'Referer': `${url.protocol}//${url.hostname}/`
    }
    
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      headers: headers,
      timeout: 30000, // 30秒超时
      rejectUnauthorized: true
    };

    let retryCount = 0;
    while (retryCount < maxRetries) {
      // 检查是否已取消
      if (abortSignal?.aborted) {
        throw new Error('同步已取消');
      }

      try {
        LogService.log(`正在下载图片（第${retryCount + 1}次尝试）: ${imageUrl.substring(0, 60)}...`, 'WeChatService');
        
        const buffer = await new Promise<Buffer>((resolve, reject) => {
          // 检查是否已取消
          if (abortSignal?.aborted) {
            reject(new Error('同步已取消'));
            return;
          }
          const chunks: Buffer[] = [];
          let timeoutId: NodeJS.Timeout;
          
          // 监听取消信号
          const abortHandler = () => {
            req.destroy();
            clearTimeout(timeoutId);
            reject(new Error('同步已取消'));
          };
          
          if (abortSignal) {
            abortSignal.addEventListener('abort', abortHandler);
          }

          const req = client.request(options, (res) => {
            // 检查是否已取消
            if (abortSignal?.aborted) {
              req.destroy();
              clearTimeout(timeoutId);
              if (abortSignal) {
                abortSignal.removeEventListener('abort', abortHandler);
              }
              reject(new Error('同步已取消'));
              return;
            }

            // 处理重定向
            if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
              const redirectUrl = res.headers.location;
              if (redirectUrl) {
                clearTimeout(timeoutId);
                req.destroy();
                // 递归处理重定向
                this.downloadImage(redirectUrl.startsWith('http') ? redirectUrl : `${url.protocol}//${url.host}${redirectUrl}`, abortSignal, 1)
                  .then(resolve)
                  .catch(reject);
                return;
              }
            }
            
            if (res.statusCode !== 200) {
              clearTimeout(timeoutId);
              reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
              return;
            }
            
            // 处理压缩响应
            const contentEncoding = res.headers['content-encoding'];
            let stream: NodeJS.ReadableStream = res;
            
            if (contentEncoding === 'gzip') {
              const gunzip = zlib.createGunzip();
              res.pipe(gunzip);
              stream = gunzip;
              LogService.log('检测到 gzip 压缩，正在解压...', 'WeChatService');
            } else if (contentEncoding === 'deflate') {
              const inflate = zlib.createInflate();
              res.pipe(inflate);
              stream = inflate;
              LogService.log('检测到 deflate 压缩，正在解压...', 'WeChatService');
            }
            
            stream.on('data', (chunk: Buffer) => {
              chunks.push(chunk);
            });
            
            stream.on('end', () => {
              clearTimeout(timeoutId);
              if (abortSignal) {
                abortSignal.removeEventListener('abort', abortHandler);
              }
              // 再次检查是否已取消
              if (abortSignal?.aborted) {
                reject(new Error('同步已取消'));
                return;
              }
              const buffer = Buffer.concat(chunks);
              LogService.log(`图片下载成功，大小: ${buffer.length} 字节`, 'WeChatService');
              resolve(buffer);
            });
            
            stream.on('error', (error) => {
              clearTimeout(timeoutId);
              reject(error);
            });
            
            res.on('error', (error) => {
              clearTimeout(timeoutId);
              reject(error);
            });
          });
          
          req.on('error', (error) => {
            clearTimeout(timeoutId);
            if (abortSignal) {
              abortSignal.removeEventListener('abort', abortHandler);
            }
            reject(error);
          });
          
          req.on('timeout', () => {
            clearTimeout(timeoutId);
            if (abortSignal) {
              abortSignal.removeEventListener('abort', abortHandler);
            }
            req.destroy();
            reject(new Error('下载超时'));
          });
          
          // 设置超时
          timeoutId = setTimeout(() => {
            if (abortSignal) {
              abortSignal.removeEventListener('abort', abortHandler);
            }
            req.destroy();
            reject(new Error('下载超时'));
          }, options.timeout);
          
          req.end();
        });
        
        return buffer;
      } catch (error) {
        retryCount++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        LogService.warn(`图片下载失败（第${retryCount}次尝试）: ${errorMsg}`, 'WeChatService');
        
        if (retryCount >= maxRetries) {
          throw new Error(`图片下载失败（已重试${maxRetries}次）: ${errorMsg}`);
        }
        
        // 等待后重试，每次等待时间递增
        const waitTime = retryCount * 2000; // 2秒、4秒、6秒...
        LogService.log(`等待 ${waitTime / 1000} 秒后重试...`, 'WeChatService');
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    throw new Error('图片下载失败：重试次数已用完');
  }

  async uploadImage(imageUrl: string, abortSignal?: AbortSignal, filename?: string): Promise<{ mediaId: string; url?: string }> {
    try {
      logger.log('开始上传图片:', imageUrl.substring(0, 50) + '...');
      const accessToken = await this.getAccessToken();
      const url = `${this.baseUrl}/material/add_material?access_token=${accessToken}&type=image`;
      logger.log('正在上传图片到微信素材库...');

      // 检查是否已取消
      if (abortSignal?.aborted) {
        throw new Error('同步已取消');
      }

      // 使用改进的下载方法
      const buffer = await this.downloadImage(imageUrl, abortSignal);
      logger.log('图片下载完成，大小:', buffer.length, '字节');
      
      // 再次检查是否已取消
      if (abortSignal?.aborted) {
        throw new Error('同步已取消');
      }

      // 确定文件名：优先使用提供的文件名，否则从URL提取，最后使用默认值
      let finalFilename = filename;
      if (!finalFilename) {
        // 从URL中提取文件名
        const urlPath = imageUrl.split('?')[0]; // 移除查询参数
        const parts = urlPath.split('/');
        const urlFilename = parts[parts.length - 1];
        // 如果URL文件名有效（包含扩展名），使用它；否则生成一个
        if (urlFilename && /\.(jpg|jpeg|png|gif|webp)$/i.test(urlFilename)) {
          finalFilename = urlFilename;
        } else {
          finalFilename = `image_${Date.now()}.png`;
        }
      }

      // 创建 FormData
      const formData = new FormData();
      // 将 Buffer 转换为 Uint8Array，然后创建 Blob
      const uint8Array = new Uint8Array(buffer);
      const blob = new Blob([uint8Array], { type: 'image/png' });
      formData.append('media', blob, finalFilename);
      // 添加描述信息
      formData.append('description', JSON.stringify({
        title: finalFilename.replace(/\.(jpg|jpeg|png|gif|webp)$/i, ''),
        introduction: `Uploaded from: ${imageUrl.substring(0, 100)}`
      }));

      // 上传到微信
      logger.log('正在上传永久图片到微信...');
      const response = await axios.post<WeChatResponse & { media_id: string; url?: string }>(
        url,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      // 检查上传结果
      if (response.data.errcode !== 0 && !response.data.media_id) {
        logger.error('上传图片失败，错误码:', response.data.errcode, '错误信息:', response.data.errmsg);
        throw new Error(`上传图片失败: ${response.data.errmsg}`);
      }

      logger.log('永久图片上传成功，media_id:', response.data.media_id);
      const uploadedUrl = response.data.url;
      if (uploadedUrl) {
        logger.log('图片URL:', uploadedUrl);
        LogService.log(`图片上传成功，URL: ${uploadedUrl}`, 'WeChatService');
      } else {
        LogService.warn('警告: 图片上传成功但未返回URL字段', 'WeChatService');
      }
      // 返回 media_id 和 url
      return {
        mediaId: response.data.media_id,
        url: uploadedUrl
      };
    } catch (error) {
      logger.error('上传图片失败:', error);
      throw error;
    }
  }

  // 添加获取发布状态描述的辅助方法
  private getPublishStatus(status: number): string {
    const statusMap: { [key: number]: string } = {
      0: '发布成功',
      1: '待发布',
      2: '发布失败',
      3: '已删除',
      4: '内容违规',
      5: '图片违规',
      6: '视频违规',
      7: '标题违规',
      8: '其他违规'
    };
    return statusMap[status] || '未知状态';
  }

  // 添加发布草稿的方法
  async publishDraft(mediaId: string): Promise<void> {
    try {
      logger.log('开始发布草稿...');
      const accessToken = await this.getAccessToken();
      const publishUrl = `${this.baseUrl}/freepublish/submit?access_token=${accessToken}`;
      
      // 构建发布请求数据
      const publishData: any = {
        media_id: mediaId
      };
      
      LogService.log(`正在提交发布请求...`, 'WeChatService');
      LogService.log(`media_id: ${mediaId}`, 'WeChatService');
      const publishResponse = await axios.post<WeChatResponse>(publishUrl, publishData);
   
      logger.log('发布草稿响应 - 错误码:', publishResponse.data.errcode);
      
      // 检查是否有错误码
      if (publishResponse.data.errcode && publishResponse.data.errcode !== 0) {
        const errorMsg = publishResponse.data.errmsg || '未知错误';
        const errorCode = publishResponse.data.errcode;
        LogService.error(`发布失败 - 错误码: ${errorCode}, 错误信息: ${errorMsg}`, 'WeChatService');
        
        // 提供明显的错误提示
        if (errorCode === 48001) {
          throw new Error(
            '❌ 发布失败：公众号没有发布权限！\n\n' +
            '📋 可能原因：\n' +
            '  1. 公众号未认证\n' +
            '  2. 未开通「发布能力」接口权限\n' +
            '  3. 公众号类型不支持（如个人订阅号）\n\n' +
            '✅ 解决方案：\n' +
            '  1. 登录微信公众平台 https://mp.weixin.qq.com/\n' +
            '  2. 进入「开发」→「接口权限」，查看并申请「发布能力」\n' +
            '  3. 或进入「设置」→「认证详情」，完成公众号认证\n\n' +
            '💡 临时方案：\n' +
            '  可以选择「保存草稿」，然后在微信公众平台后台手动发布'
          );
        } else if (errorCode === 88000) {
          throw new Error('❌ 发布失败：内容包含违规信息，请检查文章内容是否符合微信公众平台规范');
        } else if (errorCode === 88001) {
          throw new Error('❌ 发布失败：文章内容包含不支持的 HTML 标签或格式');
        } else if (errorCode === 200002) {
          throw new Error('❌ 发布失败：图文消息包含外链，请移除或使用原文链接功能');
        } else if (errorCode === 200011) {
          throw new Error('❌ 发布失败：频繁发布，请稍后再试');
        }
        
        throw new Error(`❌ 发布草稿失败：${errorMsg}（错误码：${errorCode}）`);
      }
      
      if (publishResponse.data.errcode === 0 && publishResponse.data.publish_id) {
        logger.log('文章提交发布成功，publish_id:', publishResponse.data.publish_id);
        
        // 等待发布完成
        let retryCount = 0;
        const maxRetries = 10;
        const retryInterval = 2000; // 2秒

        while (retryCount < maxRetries) {
          // 检查发布状态
          logger.log('正在检查发布状态...');
          const statusUrl = `${this.baseUrl}/freepublish/get?access_token=${accessToken}`;
          const statusResponse = await axios.post<WeChatResponse>(statusUrl, {
            publish_id: publishResponse.data.publish_id
          });
          
          const publishStatus = statusResponse.data.publish_status;
          logger.log('文章状态:', this.getPublishStatus(publishStatus));

          if (publishStatus === 0) {
            logger.always('文章发布成功，可在公众号查看');
            return;
          } else if (publishStatus > 1) { // 状态大于1表示发布失败
            const statusMsg = this.getPublishStatus(publishStatus);
            LogService.error(`发布失败: ${statusMsg}`, 'WeChatService');
            
            // 提供更详细的错误提示
            if (publishStatus === 4 || publishStatus === 5 || publishStatus === 6 || publishStatus === 7 || publishStatus === 8) {
              throw new Error(`发布失败: ${statusMsg}。建议：1) 检查文章内容是否符合规范 2) 尝试保存为草稿后在微信后台手动发布`);
            }
            
            throw new Error(`发布失败: ${statusMsg}`);
          }

          // 如果状态是1(待发布)，继续等待
          retryCount++;
          if (retryCount < maxRetries) {
            logger.log(`等待发布完成，第 ${retryCount} 次检查...`);
            await new Promise(resolve => setTimeout(resolve, retryInterval));
          }
        }

        throw new Error('发布超时，请在公众号后台检查发布状态');
      } else {
        throw new Error(`发布草稿失败: ${publishResponse.data.errmsg || '未知错误'}`);
      }
    } catch (error) {
      logger.error('发布草稿失败:', error);
      throw error;
    }
  }
} 