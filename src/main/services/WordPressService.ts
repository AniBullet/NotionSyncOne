import axios, { AxiosInstance } from 'axios';
import * as https from 'https';
import * as http from 'http';
import { Jimp } from 'jimp';
import { 
  WordPressConfig, 
  WordPressArticle, 
  WordPressCategory, 
  WordPressTag, 
  WordPressMedia,
  WordPressPost 
} from '../../shared/types/wordpress';
import { ConfigService } from './ConfigService';
import { LogService } from './LogService';
import { logger } from '../utils/logger';

// 最大上传大小限制 (1MB)，超过此大小的图片将被压缩
const MAX_IMAGE_SIZE = 1 * 1024 * 1024;

export class WordPressService {
  private configService: ConfigService;
  private client: AxiosInstance | null = null;
  private baseUrl: string = '';

  constructor(configService: ConfigService) {
    this.configService = configService;
    this.initClient();
  }

  private initClient(): void {
    const config = this.configService.getWordPressConfig();
    if (!config || !config.siteUrl || !config.username || !config.appPassword) {
      logger.log('WordPress 配置不完整，服务未初始化');
      return;
    }

    // 规范化站点 URL
    this.baseUrl = config.siteUrl.replace(/\/+$/, '');
    
    // 创建 Basic Auth 认证头
    const auth = Buffer.from(`${config.username}:${config.appPassword}`).toString('base64');

    this.client = axios.create({
      baseURL: `${this.baseUrl}/wp-json/wp/v2`,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    logger.log('WordPress 客户端初始化成功');
  }

  /**
   * 重新初始化客户端（配置更新后调用）
   */
  reinitialize(): void {
    this.initClient();
  }

  /**
   * 测试 WordPress 连接
   */
  async testConnection(): Promise<{ success: boolean; message: string; user?: any }> {
    try {
      if (!this.client) {
        return { success: false, message: 'WordPress 服务未初始化，请检查配置' };
      }

      LogService.log('正在测试 WordPress 连接...', 'WordPressService');
      
      // 获取当前用户信息来验证连接
      const response = await this.client.get('/users/me');
      
      if (response.data && response.data.id) {
        const userName = response.data.name || response.data.username;
        LogService.success(`WordPress 连接成功！用户: ${userName}`, 'WordPressService');
        return { 
          success: true, 
          message: `连接成功！已登录为: ${userName}`,
          user: response.data 
        };
      }

      return { success: false, message: '无法获取用户信息' };
    } catch (error: any) {
      const errorMsg = this.parseError(error);
      LogService.error(`WordPress 连接测试失败: ${errorMsg}`, 'WordPressService');
      return { success: false, message: errorMsg };
    }
  }

  /**
   * 发布文章到 WordPress
   */
  async publishArticle(
    article: WordPressArticle, 
    abortSignal?: AbortSignal
  ): Promise<WordPressPost> {
    try {
      if (!this.client) {
        throw new Error('WordPress 服务未初始化，请先配置 WordPress 信息');
      }

      // 检查是否已取消
      if (abortSignal?.aborted) {
        throw new Error('同步已取消');
      }

      LogService.log('========== WordPressService: 开始发布文章 ==========', 'WordPressService');
      LogService.log(`文章标题: ${article.title}`, 'WordPressService');
      LogService.log(`发布状态: ${article.status}`, 'WordPressService');

      const config = this.configService.getWordPressConfig();

      // 构建请求数据
      const postData: any = {
        title: article.title,
        content: article.content,
        status: article.status,
        comment_status: 'open',  // 默认开启评论
        ping_status: 'open',     // 默认开启 Pingback
      };

      // 可选字段
      if (article.excerpt) {
        postData.excerpt = article.excerpt;
      }

      if (article.categories && article.categories.length > 0) {
        postData.categories = article.categories;
      } else if (config?.defaultCategory) {
        postData.categories = [config.defaultCategory];
      }

      if (article.tags && article.tags.length > 0) {
        postData.tags = article.tags;
      }

      if (article.featured_media) {
        postData.featured_media = article.featured_media;
        LogService.log(`设置特色图片 (featured_media): ${article.featured_media}`, 'WordPressService');
      } else {
        LogService.warn(`未设置特色图片 (featured_media 为空)`, 'WordPressService');
      }

      if (article.author) {
        postData.author = article.author;
      } else if (config?.defaultAuthor) {
        postData.author = config.defaultAuthor;
      }

      if (article.slug) {
        postData.slug = article.slug;
      }

      if (article.meta && Object.keys(article.meta).length > 0) {
        postData.meta = article.meta;
      }

      // 显示关键字段（不显示完整内容以避免日志过长）
      const logData = {
        title: postData.title,
        status: postData.status,
        featured_media: postData.featured_media || '未设置',
        categories: postData.categories,
        author: postData.author,
        content_length: postData.content?.length || 0,
      };
      LogService.log(`发送数据摘要: ${JSON.stringify(logData, null, 2)}`, 'WordPressService');

      // 检查是否已取消
      if (abortSignal?.aborted) {
        throw new Error('同步已取消');
      }

      const response = await this.client.post<WordPressPost>('/posts', postData, {
        signal: abortSignal,
        timeout: 120000, // 2 分钟超时
      });

      if (response.data && response.data.id) {
        LogService.success(`========== 文章发布成功 ==========`, 'WordPressService');
        LogService.log(`文章 ID: ${response.data.id}`, 'WordPressService');
        LogService.log(`文章链接: ${response.data.link}`, 'WordPressService');
        // 检查特色图片是否设置成功
        if (response.data.featured_media) {
          LogService.success(`✓ 特色图片已设置，media_id: ${response.data.featured_media}`, 'WordPressService');
        } else if (postData.featured_media) {
          LogService.warn(`⚠ 请求中包含 featured_media (${postData.featured_media})，但响应中未返回`, 'WordPressService');
        }
        return response.data;
      }

      throw new Error('发布失败：未返回文章 ID');
    } catch (error: any) {
      // 如果是取消错误，直接抛出
      if (abortSignal?.aborted || (error instanceof Error && error.message.includes('已取消'))) {
        throw new Error('同步已取消');
      }

      const errorMsg = this.parseError(error);
      LogService.error(`========== 文章发布失败 ==========`, 'WordPressService');
      LogService.error(`错误: ${errorMsg}`, 'WordPressService');
      throw new Error(`发布到 WordPress 失败: ${errorMsg}`);
    }
  }

  /**
   * 上传媒体文件到 WordPress
   */
  async uploadMedia(
    imageUrl: string, 
    filename?: string,
    abortSignal?: AbortSignal
  ): Promise<WordPressMedia> {
    try {
      if (!this.client) {
        throw new Error('WordPress 服务未初始化');
      }

      // 检查是否已取消
      if (abortSignal?.aborted) {
        throw new Error('同步已取消');
      }

      LogService.log(`正在上传图片到 WordPress: ${imageUrl.substring(0, 60)}...`, 'WordPressService');

      // 下载图片
      let imageBuffer = await this.downloadImage(imageUrl, abortSignal);
      const originalSize = imageBuffer.length;
      LogService.log(`原始图片大小: ${(originalSize / 1024).toFixed(1)} KB`, 'WordPressService');
      
      // 检查是否已取消
      if (abortSignal?.aborted) {
        throw new Error('同步已取消');
      }

      // 确定文件名和类型
      let finalFilename = filename || this.extractFilename(imageUrl) || `image_${Date.now()}.jpg`;
      let contentType = this.getContentType(finalFilename);

      // 如果图片太大，进行压缩
      if (originalSize > MAX_IMAGE_SIZE) {
        LogService.log(`图片大小 (${(originalSize / 1024).toFixed(1)} KB) 超过限制 (${(MAX_IMAGE_SIZE / 1024).toFixed(0)} KB)，正在压缩...`, 'WordPressService');
        try {
          const compressed = await this.compressImage(imageBuffer, finalFilename);
          imageBuffer = compressed.buffer;
          finalFilename = compressed.filename;
          contentType = compressed.contentType;
          LogService.success(`压缩完成: ${(originalSize / 1024).toFixed(1)} KB → ${(imageBuffer.length / 1024).toFixed(1)} KB (节省 ${((1 - imageBuffer.length / originalSize) * 100).toFixed(0)}%)`, 'WordPressService');
        } catch (compressError) {
          LogService.warn(`图片压缩失败: ${compressError instanceof Error ? compressError.message : String(compressError)}`, 'WordPressService');
          LogService.warn(`将尝试上传原始图片，可能会因文件过大而失败`, 'WordPressService');
        }
      }

      // 获取配置重新创建带有正确 headers 的请求
      const config = this.configService.getWordPressConfig();
      if (!config) {
        throw new Error('WordPress 配置不存在');
      }

      const auth = Buffer.from(`${config.username}:${config.appPassword}`).toString('base64');
      
      const response = await axios.post<WordPressMedia>(
        `${this.baseUrl}/wp-json/wp/v2/media`,
        imageBuffer,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="${finalFilename}"`,
          },
          timeout: 120000, // 图片上传可能需要更长时间
          signal: abortSignal,
        }
      );

      if (response.data && response.data.id) {
        LogService.success(`图片上传成功，media_id: ${response.data.id}`, 'WordPressService');
        return response.data;
      }

      throw new Error('上传失败：未返回媒体 ID');
    } catch (error: any) {
      // 如果是取消错误，直接抛出
      if (abortSignal?.aborted || (error instanceof Error && error.message.includes('已取消'))) {
        throw new Error('同步已取消');
      }

      const errorMsg = this.parseError(error);
      LogService.error(`图片上传失败: ${errorMsg}`, 'WordPressService');
      throw new Error(`上传图片到 WordPress 失败: ${errorMsg}`);
    }
  }

  /**
   * 使用 Jimp 压缩图片（纯 JavaScript，无需原生模块）
   * 采用渐进式压缩策略，确保最终大小在限制以内
   */
  private async compressImage(
    buffer: Buffer,
    originalFilename: string
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    // 目标大小：800KB（留一些余量，确保不超过服务器限制）
    const targetSize = 800 * 1024;
    
    // 使用 Jimp 读取图片
    let image = await Jimp.read(buffer);
    
    const originalWidth = image.width;
    const originalHeight = image.height;
    LogService.log(`原始图片尺寸: ${originalWidth}x${originalHeight}`, 'WordPressService');

    // 渐进式压缩参数
    const compressionLevels = [
      { maxWidth: 1920, quality: 80 },
      { maxWidth: 1280, quality: 70 },
      { maxWidth: 1024, quality: 60 },
      { maxWidth: 800, quality: 50 },
    ];

    let compressedBuffer: Buffer = buffer;
    let finalWidth = originalWidth;
    let finalHeight = originalHeight;

    for (const level of compressionLevels) {
      // 重新读取原图（避免多次压缩导致质量严重下降）
      image = await Jimp.read(buffer);
      
      // 调整尺寸
      if (image.width > level.maxWidth) {
        const scale = level.maxWidth / image.width;
        const newHeight = Math.round(image.height * scale);
        image.resize({ w: level.maxWidth, h: newHeight });
        finalWidth = level.maxWidth;
        finalHeight = newHeight;
      } else {
        finalWidth = image.width;
        finalHeight = image.height;
      }

      // 设置 JPEG 质量
      image.quality = level.quality;

      // 导出为 JPEG 格式的 Buffer
      compressedBuffer = await image.getBuffer('image/jpeg');

      LogService.log(`压缩尝试: ${level.maxWidth}px, 质量${level.quality}% → ${(compressedBuffer.length / 1024).toFixed(0)} KB`, 'WordPressService');

      // 如果大小已经满足要求，停止压缩
      if (compressedBuffer.length <= targetSize) {
        LogService.log(`✓ 达到目标大小，最终尺寸: ${finalWidth}x${finalHeight}`, 'WordPressService');
        break;
      }
    }

    // 如果仍然超过目标，输出警告但继续使用
    if (compressedBuffer.length > targetSize) {
      LogService.warn(`压缩后仍有 ${(compressedBuffer.length / 1024).toFixed(0)} KB，可能仍会上传失败`, 'WordPressService');
    }

    // 更新文件名为 .jpg 扩展名
    const newFilename = originalFilename.replace(/\.[^.]+$/, '.jpg');

    return {
      buffer: compressedBuffer,
      filename: newFilename,
      contentType: 'image/jpeg',
    };
  }

  /**
   * 获取所有分类
   */
  async getCategories(): Promise<WordPressCategory[]> {
    try {
      if (!this.client) {
        throw new Error('WordPress 服务未初始化');
      }

      const response = await this.client.get<WordPressCategory[]>('/categories', {
        params: { per_page: 100 }
      });

      return response.data || [];
    } catch (error: any) {
      const errorMsg = this.parseError(error);
      LogService.error(`获取分类失败: ${errorMsg}`, 'WordPressService');
      throw new Error(`获取 WordPress 分类失败: ${errorMsg}`);
    }
  }

  /**
   * 获取所有标签
   */
  async getTags(): Promise<WordPressTag[]> {
    try {
      if (!this.client) {
        throw new Error('WordPress 服务未初始化');
      }

      const response = await this.client.get<WordPressTag[]>('/tags', {
        params: { per_page: 100 }
      });

      return response.data || [];
    } catch (error: any) {
      const errorMsg = this.parseError(error);
      LogService.error(`获取标签失败: ${errorMsg}`, 'WordPressService');
      throw new Error(`获取 WordPress 标签失败: ${errorMsg}`);
    }
  }

  /**
   * 创建分类
   */
  async createCategory(name: string, parent?: number): Promise<WordPressCategory> {
    try {
      if (!this.client) {
        throw new Error('WordPress 服务未初始化');
      }

      const data: any = { name };
      if (parent) {
        data.parent = parent;
      }

      const response = await this.client.post<WordPressCategory>('/categories', data);
      return response.data;
    } catch (error: any) {
      const errorMsg = this.parseError(error);
      throw new Error(`创建分类失败: ${errorMsg}`);
    }
  }

  /**
   * 创建标签
   */
  async createTag(name: string): Promise<WordPressTag> {
    try {
      if (!this.client) {
        throw new Error('WordPress 服务未初始化');
      }

      const response = await this.client.post<WordPressTag>('/tags', { name });
      return response.data;
    } catch (error: any) {
      const errorMsg = this.parseError(error);
      throw new Error(`创建标签失败: ${errorMsg}`);
    }
  }

  /**
   * 根据名称查找或创建标签
   */
  async findOrCreateTag(name: string): Promise<number> {
    try {
      // 先搜索是否已存在
      if (!this.client) {
        throw new Error('WordPress 服务未初始化');
      }

      const response = await this.client.get<WordPressTag[]>('/tags', {
        params: { search: name }
      });

      const existingTag = response.data?.find(
        tag => tag.name.toLowerCase() === name.toLowerCase()
      );

      if (existingTag) {
        return existingTag.id;
      }

      // 不存在则创建
      const newTag = await this.createTag(name);
      return newTag.id;
    } catch (error: any) {
      LogService.warn(`查找或创建标签 "${name}" 失败: ${this.parseError(error)}`, 'WordPressService');
      throw error;
    }
  }

  /**
   * 下载图片
   */
  private async downloadImage(imageUrl: string, abortSignal?: AbortSignal): Promise<Buffer> {
    try {
      // 检查是否已取消
      if (abortSignal?.aborted) {
        throw new Error('同步已取消');
      }
      
      // 使用 axios 下载图片
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 60000,
        signal: abortSignal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/*,*/*;q=0.8',
        },
      });

      return Buffer.from(response.data);
    } catch (error: any) {
      // 如果是取消错误，直接抛出
      if (abortSignal?.aborted || error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
        throw new Error('同步已取消');
      }
      
      // 如果直接下载失败，尝试使用代理
      LogService.warn('直接下载失败，尝试使用代理...', 'WordPressService');
      
      const proxiedUrl = `https://www.notion.so/image/${encodeURIComponent(imageUrl)}`;
      const response = await axios.get(proxiedUrl, {
        responseType: 'arraybuffer',
        timeout: 60000,
        signal: abortSignal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      return Buffer.from(response.data);
    }
  }

  /**
   * 从 URL 提取文件名
   */
  private extractFilename(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const segments = pathname.split('/');
      const lastSegment = segments[segments.length - 1];
      
      if (lastSegment && lastSegment.includes('.')) {
        return lastSegment;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 获取文件的 Content-Type
   */
  private getContentType(filename: string): string {
    const ext = filename.toLowerCase().split('.').pop();
    const mimeTypes: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'bmp': 'image/bmp',
    };
    return mimeTypes[ext || ''] || 'image/jpeg';
  }

  /**
   * 解析错误信息
   */
  private parseError(error: any): string {
    if (error.response) {
      // 服务器返回了错误响应
      const data = error.response.data;
      if (data?.message) {
        return data.message;
      }
      if (data?.code) {
        // WordPress REST API 错误码
        const errorCodes: Record<string, string> = {
          'rest_cannot_create': '没有创建文章的权限',
          'rest_cannot_edit': '没有编辑文章的权限',
          'rest_forbidden': '访问被拒绝，请检查应用密码权限',
          'rest_invalid_param': '参数无效',
          'rest_no_route': 'API 路由不存在，请检查站点 URL',
          'invalid_username': '用户名无效',
          'incorrect_password': '密码错误',
          'rest_user_invalid_id': '用户 ID 无效',
        };
        return errorCodes[data.code] || `${data.code}: ${data.message || '未知错误'}`;
      }
      return `HTTP ${error.response.status}: ${error.response.statusText}`;
    }
    
    if (error.code === 'ECONNREFUSED') {
      return '无法连接到 WordPress 站点，请检查站点 URL';
    }
    if (error.code === 'ENOTFOUND') {
      return '找不到 WordPress 站点，请检查站点 URL';
    }
    if (error.code === 'ETIMEDOUT') {
      return '连接超时，请检查网络或稍后重试';
    }

    return error.message || '未知错误';
  }
}
