import { app, safeStorage } from 'electron';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { NotionConfig } from '../../shared/types/notion';
import { WeChatConfig } from '../../shared/types/wechat';
import { WordPressConfig } from '../../shared/types/wordpress';
import { BilibiliConfig } from '../../shared/types/bilibili';
import { Config } from '../../shared/types/config';
import { logger } from '../utils/logger';

/**
 * 安全存储的配置格式
 * 敏感字段使用 [encrypted] 前缀标记为加密字段
 */
interface SecureConfig {
  notion?: {
    apiKey?: string;
    databaseId?: string;
  };
  wechat?: {
    appId?: string;
    appSecret?: string;
    author?: string;
    topNotice?: string;
    accessToken?: string;
    tokenExpiresAt?: number;
  };
  wordpress?: {
    siteUrl?: string;
    username?: string;
    appPassword?: string;
    defaultCategory?: number;
    defaultAuthor?: number;
    topNotice?: string;
  };
  bilibili?: BilibiliConfig;
}

export class ConfigService {
  private configPath: string;
  private config: Config;
  private encryptionAvailable: boolean;

  constructor() {
    const userDataPath = app.getPath('userData');
    const configDir = join(userDataPath, 'config');
    
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }
    
    this.configPath = join(configDir, 'config.json');
    this.config = {
      notion: { apiKey: '', databaseId: '' },
      wechat: { appId: '', appSecret: '' },
      bilibili: { enabled: false }
    };

    // 检查加密是否可用
    this.encryptionAvailable = safeStorage.isEncryptionAvailable();
    if (this.encryptionAvailable) {
      logger.log('✓ 系统加密服务可用，敏感配置将被加密保存', 'ConfigService');
    } else {
      logger.warn('⚠ 系统加密服务不可用，配置将以明文保存', 'ConfigService');
    }

    // 初始化配置
    this.init().catch(error => {
      logger.error('初始化配置失败:', error);
    });
  }

  /**
   * 加密敏感字符串
   */
  private encryptString(plaintext: string): string {
    if (!this.encryptionAvailable || !plaintext) {
      return plaintext;
    }
    
    try {
      const buffer = safeStorage.encryptString(plaintext);
      // 使用 [encrypted] 前缀标记 + Base64 编码
      return '[encrypted]' + buffer.toString('base64');
    } catch (error) {
      logger.error('加密失败，使用明文:', error);
      return plaintext;
    }
  }

  /**
   * 解密敏感字符串
   */
  private decryptString(encrypted: string): string {
    if (!encrypted) {
      return '';
    }

    // 检查是否为加密字段
    if (!encrypted.startsWith('[encrypted]')) {
      // 明文字段，直接返回
      return encrypted;
    }

    if (!this.encryptionAvailable) {
      logger.warn('加密服务不可用，无法解密配置');
      return '';
    }

    try {
      // 移除前缀并解码
      const base64 = encrypted.substring('[encrypted]'.length);
      const buffer = Buffer.from(base64, 'base64');
      return safeStorage.decryptString(buffer);
    } catch (error) {
      logger.error('解密失败:', error);
      return '';
    }
  }

  async init(): Promise<void> {
    try {
      await this.loadConfig();
      
      // 如果加密可用，检查并升级旧配置
      if (this.encryptionAvailable) {
        await this.migrateToEncrypted();
      }
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

  /**
   * 迁移旧的明文配置到加密配置
   */
  private async migrateToEncrypted(): Promise<void> {
    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      const rawConfig: SecureConfig = JSON.parse(data);
      
      // 检查是否有未加密的敏感字段
      let needsMigration = false;
      
      if (rawConfig.notion?.apiKey && !rawConfig.notion.apiKey.startsWith('[encrypted]')) {
        needsMigration = true;
      }
      if (rawConfig.wechat?.appId && !rawConfig.wechat.appId.startsWith('[encrypted]')) {
        needsMigration = true;
      }
      if (rawConfig.wechat?.appSecret && !rawConfig.wechat.appSecret.startsWith('[encrypted]')) {
        needsMigration = true;
      }
      if (rawConfig.wordpress?.appPassword && !rawConfig.wordpress.appPassword.startsWith('[encrypted]')) {
        needsMigration = true;
      }
      
      if (needsMigration) {
        logger.log('⚠ 检测到明文配置，正在升级到加密存储...', 'ConfigService');
        // 重新保存配置，会自动加密
        await this.saveConfig(this.config);
        logger.log('✓ 配置升级完成，敏感信息已加密保护', 'ConfigService');
      }
    } catch (error) {
      logger.warn('配置迁移失败，将继续使用当前配置:', error);
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
      const loadedConfig: SecureConfig = JSON.parse(data);
      
      // 解密敏感字段并确保配置对象包含所有必要的字段
      this.config = {
        notion: {
          apiKey: this.decryptString(loadedConfig.notion?.apiKey || ''),
          databaseId: loadedConfig.notion?.databaseId || '',
        },
        wechat: {
          appId: this.decryptString(loadedConfig.wechat?.appId || ''),
          appSecret: this.decryptString(loadedConfig.wechat?.appSecret || ''),
          author: loadedConfig.wechat?.author,
          topNotice: loadedConfig.wechat?.topNotice,
          // Token 信息（临时的，不加密）
          accessToken: loadedConfig.wechat?.accessToken,
          tokenExpiresAt: loadedConfig.wechat?.tokenExpiresAt,
        },
        // WordPress 配置（可选）
        wordpress: loadedConfig.wordpress ? {
          siteUrl: loadedConfig.wordpress.siteUrl || '',
          username: loadedConfig.wordpress.username || '',
          appPassword: this.decryptString(loadedConfig.wordpress.appPassword || ''),
          defaultCategory: loadedConfig.wordpress.defaultCategory,
          defaultAuthor: loadedConfig.wordpress.defaultAuthor,
          topNotice: loadedConfig.wordpress.topNotice,
        } : undefined,
        // Bilibili 配置（可选，Cookie文件路径不加密）
        bilibili: loadedConfig.bilibili ? {
          cookieFile: loadedConfig.bilibili.cookieFile,
          defaultTid: loadedConfig.bilibili.defaultTid,
          defaultTags: loadedConfig.bilibili.defaultTags,
          enabled: loadedConfig.bilibili.enabled || false,
          descTemplate: loadedConfig.bilibili.descTemplate,
          copyright: loadedConfig.bilibili.copyright,
          noReprint: loadedConfig.bilibili.noReprint,
          openElec: loadedConfig.bilibili.openElec,
          upCloseReply: loadedConfig.bilibili.upCloseReply,
          upCloseDanmu: loadedConfig.bilibili.upCloseDanmu,
        } : { enabled: false },
      };
      
      logger.log('✓ 配置加载成功', 'ConfigService');
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
      // 调试：打印收到的配置
      logger.log('[saveConfig] 收到的 newConfig.bilibili:', 'ConfigService');
      console.log(JSON.stringify(newConfig.bilibili, null, 2));
      
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
        // Bilibili 配置（可选） - 合并配置
        bilibili: newConfig.bilibili ? {
          ...this.config.bilibili,
          ...newConfig.bilibili,
        } : this.config.bilibili,
      };
      
      // 调试：打印合并后的配置
      logger.log('[saveConfig] 合并后的 this.config.bilibili:', 'ConfigService');
      console.log(JSON.stringify(this.config.bilibili, null, 2));
      
      // 创建加密的配置对象（敏感字段加密）
      const secureConfig: SecureConfig = {
        notion: {
          apiKey: this.encryptString(this.config.notion?.apiKey || ''),
          databaseId: this.config.notion?.databaseId,
        },
        wechat: {
          appId: this.encryptString(this.config.wechat?.appId || ''),
          appSecret: this.encryptString(this.config.wechat?.appSecret || ''),
          author: this.config.wechat?.author,
          topNotice: this.config.wechat?.topNotice,
          // Token 信息（临时的，不加密）
          accessToken: this.config.wechat?.accessToken,
          tokenExpiresAt: this.config.wechat?.tokenExpiresAt,
        },
        wordpress: this.config.wordpress ? {
          siteUrl: this.config.wordpress.siteUrl,
          username: this.config.wordpress.username,
          appPassword: this.encryptString(this.config.wordpress.appPassword || ''),
          defaultCategory: this.config.wordpress.defaultCategory,
          defaultAuthor: this.config.wordpress.defaultAuthor,
          topNotice: this.config.wordpress.topNotice,
        } : undefined,
        bilibili: this.config.bilibili,
      };
      
      // 调试：打印最终要保存的配置
      logger.log('[saveConfig] 最终 secureConfig.bilibili:', 'ConfigService');
      console.log(JSON.stringify(secureConfig.bilibili, null, 2));
      
      // 保存加密后的配置
      await fs.writeFile(this.configPath, JSON.stringify(secureConfig, null, 2));
      
      logger.log('✓ 配置已安全保存（敏感字段已加密）', 'ConfigService');
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

  getBilibiliConfig(): BilibiliConfig {
    return this.config.bilibili || { enabled: false };
  }

  async saveBilibiliConfig(config: BilibiliConfig): Promise<void> {
    try {
      this.config.bilibili = config;
      await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
      await this.loadConfig();
    } catch (error) {
      logger.error('保存 Bilibili 配置失败:', error);
      throw error;
    }
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