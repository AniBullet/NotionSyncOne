import { Client } from '@notionhq/client';
import { NotionConfig, NotionPage, NotionBlock } from '../../shared/types/notion';
import { PageObjectResponse, BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints';

export class NotionService {
  private client: Client | null = null;
  private config: NotionConfig;

  constructor(config: NotionConfig) {
    this.config = config;
    this.initClient();
  }

  private initClient() {
    try {
      if (!this.config.apiKey) {
        console.error('Notion API Key 未配置');
        return;
      }
      this.client = new Client({
        auth: this.config.apiKey
      });
      console.log('Notion 客户端初始化成功');
    } catch (error) {
      console.error('Notion 客户端初始化失败:', error);
      this.client = null;
    }
  }

  async getArticles(): Promise<NotionPage[]> {
    // 验证客户端和配置
    if (!this.client) {
      throw new Error('Notion 客户端未初始化，请检查 API Key');
    }
    if (!this.config.databaseId) {
      throw new Error('数据库 ID 未配置');
    }
    
    // 添加重试机制处理网络错误
    const maxRetries = 3;
    let retryCount = 0;
    let lastError: any = null;
    
    while (retryCount < maxRetries) {
      try {
        // 使用分页获取所有文章（Notion API 默认限制100条）
        let allResults: PageObjectResponse[] = [];
        let hasMore = true;
        let startCursor: string | undefined = undefined;

        while (hasMore) {
          const response = await this.client.databases.query({
            database_id: this.config.databaseId,
            sorts: [
              {
                property: 'AddedTime',
                direction: 'descending'
              }
            ],
            page_size: 100, // 每页最多100条
            start_cursor: startCursor
          });

          allResults = allResults.concat(response.results as PageObjectResponse[]);
          hasMore = response.has_more;
          startCursor = response.next_cursor || undefined;
        }

        console.log(`已获取 ${allResults.length} 篇文章`);

        const articles = allResults.map((page: PageObjectResponse) => {
          // 查找标题属性
          const titleProperty = Object.entries(page.properties).find(
            ([_, prop]) => prop.type === 'title'
          );

          let title = '未命名';
          if (titleProperty) {
            const titleValue = titleProperty[1] as { title: Array<{ plain_text: string }> };
            title = titleValue.title[0]?.plain_text || '未命名';
          }

          // 获取新属性
          const properties = page.properties as any;
          const linkStart = properties.LinkStart?.url || properties.LinkStart?.rich_text?.[0]?.plain_text || '';
          const from = properties.From?.rich_text?.[0]?.plain_text || '';
          const author = properties.Author?.rich_text?.[0]?.plain_text || '';
          const featureTag = properties.FeatureTag?.select?.name || 
                            (properties.FeatureTag?.multi_select?.map((item: any) => item.name) || []);
          const expectationsRate = properties.ExpectationsRate?.number || 0;
          const engine = properties.Engine?.select?.name || '';
          const addedTime = properties.AddedTime?.date?.start || '';

          // 移除详细日志输出，避免日志过多
          // 只在调试模式下输出详细信息

          // 提取页面封面图片（每个页面可能有自己的 cover）
          const cover = (page as any).cover || null;

          return {
            id: page.id,
            url: page.url,
            title,
            properties: page.properties,
            lastEditedTime: page.last_edited_time,
            cover: cover,
            linkStart,
            from,
            author,
            featureTag,
            expectationsRate,
            engine,
            addedTime
          };
        });

        return articles;
      } catch (error: any) {
        lastError = error;
        
        // 处理特定的 Notion API 错误（这些错误不需要重试）
        if (error.code === 'object_not_found') {
          throw new Error('找不到指定的数据库，请检查数据库 ID 是否正确');
        } else if (error.code === 'unauthorized') {
          throw new Error('无权访问该数据库，请检查 API Key 权限');
        } else if (error.status === 400) {
          throw new Error('数据库 ID 格式不正确');
        }
        
        // 检查是否是网络错误（需要重试）
        const isNetworkError = 
          error.message?.includes('ECONNRESET') ||
          error.message?.includes('ETIMEDOUT') ||
          error.message?.includes('ENOTFOUND') ||
          error.message?.includes('network') ||
          error.message?.includes('FetchError') ||
          error.code === 'ECONNRESET' ||
          error.code === 'ETIMEDOUT';
        
        if (isNetworkError && retryCount < maxRetries - 1) {
          retryCount++;
          const delay = retryCount * 1000; // 递增延迟：1秒、2秒
          console.log(`网络错误，${delay}ms 后重试 (${retryCount}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue; // 重试
        }
        
        // 如果不是网络错误，或者已经重试了最大次数，直接抛出错误
        throw error;
      }
    }
    
    // 如果所有重试都失败了，抛出最后一个错误
    if (lastError) {
      const errorMessage = lastError.message || String(lastError);
      if (errorMessage.includes('ECONNRESET') || errorMessage.includes('network') || errorMessage.includes('FetchError')) {
        throw new Error(`网络连接失败，已重试 ${maxRetries} 次。请检查网络连接后重试。`);
      }
      throw lastError;
    }
    
    throw new Error('获取文章列表失败：未知错误');
  }

  /**
   * 获取数据库信息（包括数据库的封面图）
   */
  async getDatabaseInfo(): Promise<{ cover?: any; icon?: any } | null> {
    try {
      if (!this.client) {
        throw new Error('Notion 客户端未初始化');
      }
      if (!this.config.databaseId) {
        return null;
      }

      const response = await this.client.databases.retrieve({
        database_id: this.config.databaseId
      });

      // 提取数据库的 cover 和 icon
      const database = response as any;
      return {
        cover: database.cover || null,
        icon: database.icon || null
      };
    } catch (error: any) {
      if (error.code === 'object_not_found') {
        throw new Error('找不到指定的数据库');
      }
      throw error;
    }
  }

  async getPageProperties(pageId: string): Promise<NotionPage> {
    try {
      if (!this.client) {
        throw new Error('Notion 客户端未初始化');
      }

      const response = await this.client.pages.retrieve({ page_id: pageId });
      const page = response as PageObjectResponse;

      // 查找标题属性
      const titleProperty = Object.entries(page.properties).find(
        ([_, prop]) => prop.type === 'title'
      );

      const title = titleProperty
        ? (titleProperty[1] as { title: Array<{ plain_text: string }> }).title[0]?.plain_text
        : '未命名';

      // 提取封面图片
      const cover = (page as any).cover || null;

      return {
        id: page.id,
        url: page.url,
        title,
        properties: page.properties,
        lastEditedTime: page.last_edited_time,
        cover: cover
      };
    } catch (error: any) {
      if (error.code === 'object_not_found') {
        throw new Error('找不到指定的页面');
      }
      throw error;
    }
  }

  async getPageContent(pageId: string): Promise<NotionBlock[]> {
    try {
      if (!this.client) {
        throw new Error('Notion 客户端未初始化');
      }

      const allBlocks: NotionBlock[] = [];
      
      // 递归获取所有块（包括子块）
      const fetchBlocks = async (blockId: string): Promise<void> => {
        let hasMore = true;
        let startCursor: string | undefined = undefined;

        while (hasMore) {
          const response = await this.client!.blocks.children.list({
            block_id: blockId,
            start_cursor: startCursor
          });

          for (const block of response.results as BlockObjectResponse[]) {
            const blockTypeData = (block as any)[block.type] || {};
            
            // 处理不同类型的 URL 获取方式
            let url: string | undefined;
            if (block.type === 'video') {
              // 视频块可能有 file 或 external 类型
              if (blockTypeData.type === 'file') {
                url = blockTypeData.file?.url;
              } else if (blockTypeData.type === 'external') {
                url = blockTypeData.external?.url;
              }
            } else if (block.type === 'image') {
              // 图片块也可能有 file 或 external 类型
              if (blockTypeData.type === 'file') {
                url = blockTypeData.file?.url;
              } else if (blockTypeData.type === 'external') {
                url = blockTypeData.external?.url;
              } else {
                url = blockTypeData.url;
              }
            } else if (block.type === 'file' || block.type === 'pdf') {
              // 文件和 PDF 块
              if (blockTypeData.type === 'file') {
                url = blockTypeData.file?.url;
              } else if (blockTypeData.type === 'external') {
                url = blockTypeData.external?.url;
              }
            } else if (block.type === 'embed') {
              // Embed 块：优先使用 url，如果没有则尝试从 embed 对象中提取
              url = blockTypeData.url || (blockTypeData as any).embed?.url;
            } else {
              // 其他类型直接获取 url
              url = blockTypeData.url;
            }
            
            // 处理 rich_text，提取链接和格式信息
            const richText = (blockTypeData.rich_text || []).map((rt: any) => ({
              plain_text: rt.plain_text || '',
              href: rt.href || null,
              annotations: rt.annotations || {}
            }));

            // 处理 caption，提取链接信息
            const caption = (blockTypeData.caption || []).map((cap: any) => ({
              plain_text: cap.plain_text || '',
              href: cap.href || null
            }));

            const blockData: NotionBlock = {
              id: block.id,
              type: block.type,
              has_children: block.has_children,
              content: {
                rich_text: richText,
                url: url,
                caption: caption
              }
            };

            allBlocks.push(blockData);

            // 如果块有子块，递归获取
            if (block.has_children) {
              await fetchBlocks(block.id);
            }
          }

          hasMore = response.has_more;
          startCursor = response.next_cursor || undefined;
        }
      };

      await fetchBlocks(pageId);
      return allBlocks;
    } catch (error: any) {
      if (error.code === 'object_not_found') {
        throw new Error('找不到指定的页面内容');
      }
      throw error;
    }
  }

  async updatePageProperties(pageId: string, properties: any): Promise<void> {
    try {
      if (!this.client) {
        throw new Error('Notion 客户端未初始化');
      }

      await this.client.pages.update({
        page_id: pageId,
        properties
      });
    } catch (error: any) {
      if (error.code === 'object_not_found') {
        throw new Error('找不到指定的页面');
      } else if (error.code === 'validation_error') {
        throw new Error('属性更新格式不正确');
      }
      throw error;
    }
  }
} 