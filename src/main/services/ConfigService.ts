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
 * 需要加密的字段路径（点分隔）
 * 只需要在这里添加新的敏感字段路径即可
 */
const ENCRYPTED_FIELDS = [
  'notion.apiKey',
  'wechat.appId',
  'wechat.appSecret',
  'wordpress.appPassword',
];

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
    this.config = this.getDefaultConfig();

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
   * 获取默认配置
   */
  private getDefaultConfig(): Config {
    return {
      notion: { apiKey: '', databaseId: '' },
      wechat: { appId: '', appSecret: '' },
      bilibili: { enabled: false }
    };
  }

  /**
   * 根据路径获取对象的值
   */
  private getValueByPath(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * 根据路径设置对象的值
   */
  private setValueByPath(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (current[key] === undefined) {
        current[key] = {};
      }
      return current[key];
    }, obj);
    target[lastKey] = value;
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

    if (!encrypted.startsWith('[encrypted]')) {
      return encrypted;
    }

    if (!this.encryptionAvailable) {
      logger.warn('加密服务不可用，无法解密配置');
      return '';
    }

    try {
      const base64 = encrypted.substring('[encrypted]'.length);
      const buffer = Buffer.from(base64, 'base64');
      return safeStorage.decryptString(buffer);
    } catch (error) {
      logger.error('解密失败:', error);
      return '';
    }
  }

  /**
   * 深度克隆对象
   */
  private deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * 深度合并对象（source 覆盖 target 中存在的字段）
   */
  private deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
    const result = this.deepClone(target);
    
    for (const key in source) {
      if (source[key] !== undefined) {
        if (
          typeof source[key] === 'object' &&
          source[key] !== null &&
          !Array.isArray(source[key]) &&
          typeof result[key] === 'object' &&
          result[key] !== null
        ) {
          // 递归合并对象
          result[key] = this.deepMerge(result[key], source[key] as any);
        } else {
          // 直接覆盖
          result[key] = this.deepClone(source[key]) as any;
        }
      }
    }
    
    return result;
  }

  /**
   * 加密配置中的敏感字段
   */
  private encryptConfig(config: any): any {
    const encrypted = this.deepClone(config);
    
    for (const fieldPath of ENCRYPTED_FIELDS) {
      const value = this.getValueByPath(encrypted, fieldPath);
      if (value && typeof value === 'string') {
        this.setValueByPath(encrypted, fieldPath, this.encryptString(value));
      }
    }
    
    return encrypted;
  }

  /**
   * 解密配置中的敏感字段
   */
  private decryptConfig(config: any): any {
    const decrypted = this.deepClone(config);
    
    for (const fieldPath of ENCRYPTED_FIELDS) {
      const value = this.getValueByPath(decrypted, fieldPath);
      if (value && typeof value === 'string') {
        this.setValueByPath(decrypted, fieldPath, this.decryptString(value));
      }
    }
    
    return decrypted;
  }

  async init(): Promise<void> {
    try {
      await this.loadConfig();
      
      if (this.encryptionAvailable) {
        await this.migrateToEncrypted();
      }
    } catch (error) {
      logger.error('加载配置失败，使用默认配置:', error);
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
      const rawConfig = JSON.parse(data);
      
      let needsMigration = false;
      
      for (const fieldPath of ENCRYPTED_FIELDS) {
        const value = this.getValueByPath(rawConfig, fieldPath);
        if (value && typeof value === 'string' && !value.startsWith('[encrypted]')) {
          needsMigration = true;
          break;
        }
      }
      
      if (needsMigration) {
        logger.log('⚠ 检测到明文配置，正在升级到加密存储...', 'ConfigService');
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
      const loadedConfig = JSON.parse(data);
      
      // 解密敏感字段
      const decryptedConfig = this.decryptConfig(loadedConfig);
      
      // 合并到默认配置（确保所有字段都存在）
      this.config = this.deepMerge(this.getDefaultConfig(), decryptedConfig);
      
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
      // 验证必填字段
      this.validateConfig(newConfig);
      
      // 保留已有的 token 信息（不被覆盖）
      const preservedToken = {
        accessToken: this.config.wechat?.accessToken,
        tokenExpiresAt: this.config.wechat?.tokenExpiresAt,
      };
      
      // 深度合并配置
      this.config = this.deepMerge(this.config, newConfig);
      
      // 恢复 token 信息
      if (preservedToken.accessToken) {
        this.config.wechat.accessToken = preservedToken.accessToken;
      }
      if (preservedToken.tokenExpiresAt) {
        this.config.wechat.tokenExpiresAt = preservedToken.tokenExpiresAt;
      }
      
      // 加密敏感字段并保存
      const encryptedConfig = this.encryptConfig(this.config);
      
      await fs.writeFile(this.configPath, JSON.stringify(encryptedConfig, null, 2));
      
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
      this.config.notion = config;
      
      const configDir = dirname(this.configPath);
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
      }
      
      const encryptedConfig = this.encryptConfig(this.config);
      await fs.writeFile(this.configPath, JSON.stringify(encryptedConfig, null, 2));
      
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
      this.config.bilibili = { ...this.config.bilibili, ...config };
      
      const encryptedConfig = this.encryptConfig(this.config);
      await fs.writeFile(this.configPath, JSON.stringify(encryptedConfig, null, 2));
      
      await this.loadConfig();
    } catch (error) {
      logger.error('保存 Bilibili 配置失败:', error);
      throw error;
    }
  }

  // 格式化数据库 ID
  private formatDatabaseId(id: string): string {
    const cleanId = id.replace(/[^a-zA-Z0-9]/g, '');
    
    if (cleanId.length !== 32) {
      throw new Error('数据库 ID 必须是 32 位字符');
    }

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
