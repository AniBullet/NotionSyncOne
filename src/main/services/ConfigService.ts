import { app } from 'electron';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { NotionConfig } from '../../shared/types/notion';
import { WeChatConfig } from '../../shared/types/wechat';
import { WordPressConfig } from '../../shared/types/wordpress';
import { Config } from '../../shared/types/config';
import { logger } from '../utils/logger';

export class ConfigService {
  private configPath: string;
  private config: Config;

  constructor() {
    const userDataPath = app.getPath('userData');
    const configDir = join(userDataPath, 'config');
    
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }
    
    this.configPath = join(configDir, 'config.json');
    this.config = {
      notion: { apiKey: '', databaseId: '' },
      wechat: { appId: '', appSecret: '' }
    };

    // 初始化配置
    this.init().catch(error => {
      logger.error('初始化配置失败:', error);
    });
  }

  async init(): Promise<void> {
    try {
      await this.loadConfig();
    } catch (error) {
      logger.error('加载配置失败，使用默认配置:', error);
      // 确保配置文件存在
      const configDir = dirname(this.configPath);
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
      }
      await this.saveConfig(this.config);
    }
  }

  private async loadConfig(): Promise<Config> {
    try {
      if (!existsSync(this.configPath)) {
        logger.log('配置文件不存在，创建默认配置');
        await this.saveConfig(this.config);
        return this.config;
      }
      
      const data = await fs.readFile(this.configPath, 'utf-8');
      const loadedConfig = JSON.parse(data);
      
      // 确保配置对象包含所有必要的字段
      this.config = {
        notion: {
          apiKey: loadedConfig.notion?.apiKey || '',
          databaseId: loadedConfig.notion?.databaseId || '',
        },
        wechat: {
          appId: loadedConfig.wechat?.appId || '',
          appSecret: loadedConfig.wechat?.appSecret || '',
          author: loadedConfig.wechat?.author,
          topNotice: loadedConfig.wechat?.topNotice,
          // 保留已有的 token 信息
          accessToken: loadedConfig.wechat?.accessToken,
          tokenExpiresAt: loadedConfig.wechat?.tokenExpiresAt,
        },
        // WordPress 配置（可选）
        wordpress: loadedConfig.wordpress ? {
          siteUrl: loadedConfig.wordpress.siteUrl || '',
          username: loadedConfig.wordpress.username || '',
          appPassword: loadedConfig.wordpress.appPassword || '',
          defaultCategory: loadedConfig.wordpress.defaultCategory,
          defaultAuthor: loadedConfig.wordpress.defaultAuthor,
          topNotice: loadedConfig.wordpress.topNotice,
        } : undefined,
      };
      return this.config;
    } catch (error) {
      logger.error('加载配置失败:', error);
      throw error;
    }
  }

  async getConfig(): Promise<Config> {
    return this.config;
  }

  async saveConfig(newConfig: Config): Promise<void> {
    try {
      // 验证并格式化配置
      this.validateConfig(newConfig);
      
      // 合并配置，保留已有的 token 等信息
      this.config = {
        ...this.config,
        notion: newConfig.notion,
        wechat: {
          ...this.config.wechat,
          ...newConfig.wechat,
          // 确保保留 token 信息
          accessToken: this.config.wechat?.accessToken || newConfig.wechat?.accessToken,
          tokenExpiresAt: this.config.wechat?.tokenExpiresAt || newConfig.wechat?.tokenExpiresAt,
        },
        // WordPress 配置（可选）
        wordpress: newConfig.wordpress ? {
          ...this.config.wordpress,
          ...newConfig.wordpress,
        } : this.config.wordpress,
      };
      
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      logger.error('保存配置失败:', error);
      throw error;
    }
  }

  getNotionConfig(): NotionConfig {
    return this.config.notion;
  }

  async saveNotionConfig(config: NotionConfig): Promise<void> {
    try {
      // 更新配置
      this.config.notion = config;
      
      // 确保配置目录存在
      const configDir = dirname(this.configPath);
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
      }
      
      // 保存到文件
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
      
      // 验证配置是否保存成功
      await this.loadConfig();
    } catch (error) {
      logger.error('保存 Notion 配置失败:', error);
      throw error;
    }
  }

  getWeChatConfig(): WeChatConfig {
    return this.config.wechat;
  }

  getWordPressConfig(): WordPressConfig | undefined {
    return this.config.wordpress;
  }

  // 格式化数据库 ID
  private formatDatabaseId(id: string): string {
    // 移除所有非字母数字字符
    const cleanId = id.replace(/[^a-zA-Z0-9]/g, '');
    
    if (cleanId.length !== 32) {
      throw new Error('数据库 ID 必须是 32 位字符');
    }

    // 转换为 UUID 格式
    return [
      cleanId.slice(0, 8),
      cleanId.slice(8, 12),
      cleanId.slice(12, 16),
      cleanId.slice(16, 20),
      cleanId.slice(20)
    ].join('-');
  }

  private validateConfig(config: Config) {
    const errors: string[] = [];

    // 验证 Notion 配置
    if (!config.notion.apiKey) {
      errors.push('Notion API Key 不能为空');
    } else if (config.notion.apiKey.length < 50) {
      errors.push('Notion API Key 格式不正确');
    }

    if (!config.notion.databaseId) {
      errors.push('数据库 ID 不能为空');
    } else {
      try {
        // 尝试格式化数据库 ID
        config.notion.databaseId = this.formatDatabaseId(config.notion.databaseId);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : '数据库 ID 格式不正确');
      }
    }

    // 验证微信配置
    if (!config.wechat.appId) {
      errors.push('微信 AppID 不能为空');
    }
    if (!config.wechat.appSecret) {
      errors.push('微信 AppSecret 不能为空');
    }

    if (errors.length > 0) {
      throw new Error(errors.join('\n'));
    }
  }
} 