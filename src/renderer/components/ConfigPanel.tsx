import React, { useState, useEffect } from 'react';
import { IpcService } from '../../shared/services/IpcService';
import { NotionConfig } from '../../shared/types/notion';
import { WeChatConfig } from '../../shared/types/wechat';
import { WordPressConfig } from '../../shared/types/wordpress';
import { Config } from '../../shared/types/config';

interface ConfigPanelProps {
  onConfigSaved: () => void;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({ onConfigSaved }) => {
  const [config, setConfig] = useState<Config>({
    notion: { apiKey: '', databaseId: '' },
    wechat: { appId: '', appSecret: '' },
    wordpress: { siteUrl: '', username: '', appPassword: '' },
  });
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [wpTestStatus, setWpTestStatus] = useState<{ testing: boolean; result?: { success: boolean; message: string } }>({ testing: false });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const loadedConfig = await IpcService.getConfig();
      // 确保配置对象包含所有字段，包括新添加的 author 和 WordPress 配置
      setConfig({
        notion: {
          apiKey: loadedConfig.notion?.apiKey || '',
          databaseId: loadedConfig.notion?.databaseId || ''
        },
        wechat: {
          appId: loadedConfig.wechat?.appId || '',
          appSecret: loadedConfig.wechat?.appSecret || '',
          author: loadedConfig.wechat?.author || '',
          topNotice: loadedConfig.wechat?.topNotice || ''
        },
        wordpress: {
          siteUrl: loadedConfig.wordpress?.siteUrl || '',
          username: loadedConfig.wordpress?.username || '',
          appPassword: loadedConfig.wordpress?.appPassword || '',
          defaultCategory: loadedConfig.wordpress?.defaultCategory,
          defaultAuthor: loadedConfig.wordpress?.defaultAuthor
        }
      });
    } catch (err) {
      console.error('加载配置失败:', err);
      await IpcService.showNotification('错误', '加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      console.log('ConfigPanel - 开始保存配置...');
      setLoading(true);
      setSaveStatus({ type: null, message: '' });
      
      // ⚠️ 安全：不记录包含敏感信息的完整配置
      console.log('当前配置状态 - Notion:', !!config.notion?.apiKey, 'WeChat:', !!config.wechat?.appId, 'WordPress:', !!config.wordpress?.siteUrl);
      
      // 验证配置
      if (!config.notion.apiKey || !config.notion.databaseId) {
        console.log('配置验证失败: API Key 或数据库 ID 为空');
        setSaveStatus({ type: 'error', message: 'API Key 和数据库 ID 不能为空' });
        return;
      }
      
      // 确保发送完整的配置对象
      const configToSave: Config = {
        notion: {
          apiKey: config.notion.apiKey.trim(),
          databaseId: config.notion.databaseId.trim()
        },
        wechat: {
          appId: (config.wechat?.appId || '').trim(),
          appSecret: (config.wechat?.appSecret || '').trim(),
          author: (config.wechat?.author || '').trim() || undefined,
          topNotice: (config.wechat?.topNotice || '').trim() || undefined
        },
        // WordPress 配置（可选）
        wordpress: config.wordpress?.siteUrl ? {
          siteUrl: (config.wordpress.siteUrl || '').trim(),
          username: (config.wordpress.username || '').trim(),
          appPassword: (config.wordpress.appPassword || '').trim(),
          defaultCategory: config.wordpress.defaultCategory,
          defaultAuthor: config.wordpress.defaultAuthor
        } : undefined
      };
      
      // ⚠️ 安全：不记录包含敏感信息的完整配置
      console.log('处理后配置状态 - Notion:', !!configToSave.notion?.apiKey, 'WeChat:', !!configToSave.wechat?.appId, 'WordPress:', !!configToSave.wordpress?.siteUrl);
      console.log('正在调用 IpcService.saveConfig...');
      const result = await IpcService.saveConfig(configToSave);
      console.log('保存配置结果:', result);
      
      if (result) {
        console.log('配置保存成功，正在显示成功通知...');
        setSaveStatus({ type: 'success', message: '配置保存成功！' });
        await IpcService.showNotification('成功', '配置保存成功！');
        console.log('正在重新加载配置...');
        await loadConfig();
        console.log('配置重新加载完成');
      }
      
      onConfigSaved();
    } catch (error) {
      console.error('保存配置时出错:', error);
      setSaveStatus({ type: 'error', message: error instanceof Error ? error.message : '保存配置失败' });
      await IpcService.showNotification('错误', error instanceof Error ? error.message : '保存配置失败');
    } finally {
      console.log('保存操作完成，设置 loading 为 false');
      setLoading(false);
    }
  };

  const handleChange = (section: keyof Config, field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] || {}),
        [field]: value
      }
    }));
  };

  // 测试 WordPress 连接
  const handleTestWordPress = async () => {
    try {
      setWpTestStatus({ testing: true });
      const result = await IpcService.testWordPressConnection();
      setWpTestStatus({ testing: false, result });
    } catch (error) {
      setWpTestStatus({ 
        testing: false, 
        result: { 
          success: false, 
          message: error instanceof Error ? error.message : '测试连接失败' 
        } 
      });
    }
  };

  if (loading) {
    return (
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: 'var(--text-secondary)',
        backgroundColor: 'var(--bg-secondary)'
      }}>
        ⏳ 加载配置中...
      </div>
    );
  }

  return (
    <div style={{ 
      height: '100%', 
      overflow: 'auto',
      backgroundColor: 'var(--bg-secondary)',
      padding: 'var(--spacing-lg)'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* Notion 配置卡片 */}
      <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
        <h2 style={{ 
          fontSize: '18px', 
          fontWeight: '600', 
          marginBottom: 'var(--spacing-md)',
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)'
        }}>
          <span style={{ fontSize: '20px' }}>📝</span>
          Notion 配置
        </h2>
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <label className="label">API Key</label>
          <input
            type="password"
            value={config.notion.apiKey}
            onChange={e => handleChange('notion', 'apiKey', e.target.value)}
            className="input"
            placeholder="请输入 Notion API Key"
          />
        </div>
        <div>
          <label className="label">数据库 ID</label>
          <input
            type="text"
            value={config.notion.databaseId}
            onChange={e => handleChange('notion', 'databaseId', e.target.value)}
            className="input"
            placeholder="请输入 Notion 数据库 ID"
          />
        </div>
      </div>

      {/* 微信公众号配置卡片 */}
      <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
        <h2 style={{ 
          fontSize: '18px', 
          fontWeight: '600', 
          marginBottom: 'var(--spacing-md)',
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)'
        }}>
          <span style={{ fontSize: '20px' }}>💬</span>
          微信公众号配置
        </h2>
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <label className="label">AppID</label>
          <input
            type="text"
            value={config.wechat.appId}
            onChange={e => handleChange('wechat', 'appId', e.target.value)}
            className="input"
            placeholder="请输入微信公众号 AppID"
          />
        </div>
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <label className="label">AppSecret</label>
          <input
            type="password"
            value={config.wechat.appSecret}
            onChange={e => handleChange('wechat', 'appSecret', e.target.value)}
            className="input"
            placeholder="请输入微信公众号 AppSecret"
          />
        </div>
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <label className="label">作者（可选）</label>
          <input
            type="text"
            value={config.wechat.author || ''}
            onChange={e => handleChange('wechat', 'author', e.target.value)}
            className="input"
            placeholder="留空则使用文章中的作者"
          />
          <p style={{ marginTop: 'var(--spacing-xs)', fontSize: '12px', color: 'var(--text-tertiary)' }}>
            留空则从文章属性获取
          </p>
        </div>
        <div>
          <label className="label">文章顶部提示语（可选）</label>
          <input
            type="text"
            value={config.wechat.topNotice || ''}
            onChange={e => handleChange('wechat', 'topNotice', e.target.value)}
            className="input"
            placeholder="例如：本文章由 NotionSyncOne 自动同步"
          />
          <p style={{ marginTop: 'var(--spacing-xs)', fontSize: '12px', color: 'var(--text-tertiary)' }}>
            留空则不显示提示语
          </p>
        </div>
      </div>

      {/* WordPress 配置卡片 */}
      <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
        <h2 style={{ 
          fontSize: '18px', 
          fontWeight: '600', 
          marginBottom: 'var(--spacing-md)',
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)'
        }}>
          <span style={{ fontSize: '20px' }}>📝</span>
          WordPress 配置（可选）
        </h2>
        <p style={{ marginBottom: 'var(--spacing-md)', fontSize: '13px', color: 'var(--text-tertiary)' }}>
          配置 WordPress 后可以将 Notion 文章同步到 WordPress 站点。需要 WordPress 5.6+ 版本并启用应用密码。
        </p>
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <label className="label">站点 URL</label>
          <input
            type="text"
            value={config.wordpress?.siteUrl || ''}
            onChange={e => handleChange('wordpress', 'siteUrl', e.target.value)}
            className="input"
            placeholder="例如: https://your-site.com"
          />
          <p style={{ marginTop: 'var(--spacing-xs)', fontSize: '12px', color: 'var(--text-tertiary)' }}>
            WordPress 站点的完整 URL，不需要加 /wp-json
          </p>
        </div>
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <label className="label">用户名</label>
          <input
            type="text"
            value={config.wordpress?.username || ''}
            onChange={e => handleChange('wordpress', 'username', e.target.value)}
            className="input"
            placeholder="WordPress 登录用户名"
          />
        </div>
        <div style={{ marginBottom: 'var(--spacing-md)' }}>
          <label className="label">应用密码</label>
          <input
            type="password"
            value={config.wordpress?.appPassword || ''}
            onChange={e => handleChange('wordpress', 'appPassword', e.target.value)}
            className="input"
            placeholder="WordPress 应用密码（非登录密码）"
          />
          <p style={{ marginTop: 'var(--spacing-xs)', fontSize: '12px', color: 'var(--text-tertiary)' }}>
            在 WordPress 后台 → 用户 → 个人资料 → 应用密码 中生成
          </p>
        </div>
        
        {/* 测试连接按钮 */}
        <div style={{ marginTop: 'var(--spacing-md)' }}>
          <button
            onClick={handleTestWordPress}
            className="btn btn-secondary"
            disabled={wpTestStatus.testing || !config.wordpress?.siteUrl || !config.wordpress?.username || !config.wordpress?.appPassword}
            style={{ marginRight: 'var(--spacing-sm)' }}
          >
            {wpTestStatus.testing ? '⏳ 测试中...' : '🔗 测试连接'}
          </button>
          
          {wpTestStatus.result && (
            <span style={{ 
              marginLeft: 'var(--spacing-sm)',
              color: wpTestStatus.result.success ? 'var(--success-color)' : 'var(--error-color)',
              fontSize: '14px'
            }}>
              {wpTestStatus.result.success ? '✅ ' : '❌ '}
              {wpTestStatus.result.message}
            </span>
          )}
        </div>
      </div>

      {/* 保存按钮 */}
      <div style={{ textAlign: 'right' }}>
        {saveStatus.type && (
          <div className={`badge badge-${saveStatus.type === 'success' ? 'success' : 'error'}`} style={{
            marginBottom: 'var(--spacing-md)',
            display: 'block',
            textAlign: 'center',
            padding: 'var(--spacing-md)'
          }}>
            {saveStatus.message}
          </div>
        )}
        <button
          onClick={handleSave}
          className="btn btn-primary"
          disabled={loading}
          style={{
            minWidth: '120px',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? '保存中...' : '💾 保存配置'}
        </button>
      </div>
      </div>
    </div>
  );
};

export default ConfigPanel; 