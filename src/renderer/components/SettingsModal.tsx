import React, { useState, useEffect } from 'react';
import { IpcService } from '../../shared/services/IpcService';
import { Config } from '../../shared/types/config';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'notion' | 'wechat' | 'wordpress' | 'about';
}

const APP_VERSION = '1.0.1';
const GITHUB_REPO = 'https://github.com/AniBullet/NotionSyncOne';

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, defaultTab = 'notion' }) => {
  const [config, setConfig] = useState<Config>({
    notion: { apiKey: '', databaseId: '' },
    wechat: { appId: '', appSecret: '' },
    wordpress: { siteUrl: '', username: '', appPassword: '' },
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'notion' | 'wechat' | 'wordpress' | 'about'>(defaultTab);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<{ checking: boolean; latest?: string; hasUpdate?: boolean }>({ checking: false });

  useEffect(() => {
    if (isOpen) {
      loadConfig();
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  const loadConfig = async () => {
    try {
      const loadedConfig = await IpcService.getConfig();
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
          defaultAuthor: loadedConfig.wordpress?.defaultAuthor,
          topNotice: loadedConfig.wordpress?.topNotice || ''
        }
      });
    } catch (err) {
      console.error('加载配置失败:', err);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setMessage(null);
      
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
        wordpress: (config.wordpress?.siteUrl || config.wordpress?.topNotice) ? {
          siteUrl: (config.wordpress?.siteUrl || '').trim(),
          username: (config.wordpress?.username || '').trim(),
          appPassword: (config.wordpress?.appPassword || '').trim(),
          defaultCategory: config.wordpress?.defaultCategory ? Number(config.wordpress.defaultCategory) : undefined,
          defaultAuthor: config.wordpress?.defaultAuthor ? Number(config.wordpress.defaultAuthor) : undefined,
          topNotice: (config.wordpress?.topNotice || '').trim() || undefined
        } : undefined
      };
      
      await IpcService.saveConfig(configToSave);
      setMessage({ type: 'success', text: '配置已保存' });
      setTimeout(() => setMessage(null), 2000);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '保存失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (section: keyof Config, field: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      [section]: { ...(prev[section] || {}), [field]: value }
    }));
  };

  const testWechat = async () => {
    const appId = config.wechat?.appId?.trim();
    const appSecret = config.wechat?.appSecret?.trim();
    if (!appId || !appSecret) {
      setMessage({ type: 'error', text: '请先填写 AppID 和 AppSecret' });
      return;
    }
    setTesting('wechat');
    setMessage(null);
    try {
      await window.electron.testWechatConnection(appId, appSecret);
      setMessage({ type: 'success', text: '微信连接成功！' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : '连接失败' });
    } finally {
      setTesting(null);
    }
  };

  const testWordPress = async () => {
    const siteUrl = config.wordpress?.siteUrl?.trim();
    const username = config.wordpress?.username?.trim();
    const appPassword = config.wordpress?.appPassword?.trim();
    if (!siteUrl || !username || !appPassword) {
      setMessage({ type: 'error', text: '请先填写完整的 WordPress 配置' });
      return;
    }
    setTesting('wordpress');
    setMessage(null);
    try {
      await window.electron.testWordPressConnection(siteUrl, username, appPassword);
      setMessage({ type: 'success', text: 'WordPress 连接成功！' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : '连接失败' });
    } finally {
      setTesting(null);
    }
  };

  const checkUpdate = async () => {
    setUpdateInfo({ checking: true });
    try {
      const res = await fetch('https://api.github.com/repos/AniBullet/NotionSyncOne/releases/latest');
      if (res.ok) {
        const data = await res.json();
        const latest = data.tag_name?.replace(/^v/, '') || '';
        
        // 版本号比较：只有服务器版本更新时才显示更新提示
        const hasUpdate = latest && compareVersion(latest, APP_VERSION) > 0;
        setUpdateInfo({ checking: false, latest, hasUpdate });
      } else {
        setUpdateInfo({ checking: false });
        setMessage({ type: 'error', text: '检查更新失败' });
      }
    } catch {
      setUpdateInfo({ checking: false });
      setMessage({ type: 'error', text: '网络错误' });
    }
  };

  // 版本号比较函数：v1 > v2 返回 1，v1 < v2 返回 -1，相等返回 0
  const compareVersion = (v1: string, v2: string): number => {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const num1 = parts1[i] || 0;
      const num2 = parts2[i] || 0;
      
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    
    return 0;
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'notion' as const, label: 'Notion', icon: '📝' },
    { id: 'wechat' as const, label: '微信', icon: '💬' },
    { id: 'wordpress' as const, label: 'WP', icon: '🌐' },
    { id: 'about' as const, label: '关于', icon: 'ℹ️' },
  ];

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    fontSize: '13px',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-medium)',
    borderRadius: '6px',
    outline: 'none',
    marginTop: '4px'
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '12px',
    fontWeight: '500',
    color: 'var(--text-secondary)'
  };

  const testBtnStyle: React.CSSProperties = {
    padding: '5px 10px',
    borderRadius: '5px',
    border: '1px solid var(--border-medium)',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '11px',
    cursor: 'pointer',
    marginTop: '8px'
  };

  const linkStyle: React.CSSProperties = {
    color: 'var(--primary-green)',
    textDecoration: 'none',
    cursor: 'pointer',
    fontSize: '12px'
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{ position: 'absolute', inset: 0 }} onClick={onClose} />
      <div style={{
        position: 'relative',
        backgroundColor: 'var(--bg-primary)',
        borderRadius: '12px',
        width: '500px',
        overflow: 'hidden',
        boxShadow: '0 16px 32px rgba(0, 0, 0, 0.25)',
        zIndex: 1
      }}>
        {/* 标签页 */}
        <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '2px' }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: activeTab === tab.id ? 'var(--bg-tertiary)' : 'transparent',
                  color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  fontSize: '13px',
                  fontWeight: activeTab === tab.id ? '600' : '400',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span style={{ fontSize: '11px' }}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
          <button onClick={onClose} style={{ width: '24px', height: '24px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '14px' }}>✕</button>
        </div>

        {/* 内容 */}
        <div style={{ padding: '16px 24px' }}>
          {activeTab === 'notion' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={labelStyle}>API Key</label>
                <input type="password" value={config.notion.apiKey} onChange={e => handleChange('notion', 'apiKey', e.target.value)} placeholder="secret_xxx..." style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>数据库 ID</label>
                <input type="text" value={config.notion.databaseId} onChange={e => handleChange('notion', 'databaseId', e.target.value)} placeholder="32位数据库ID" style={inputStyle} />
                <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px' }}>从 Notion 数据库链接中获取</p>
              </div>
            </div>
          )}

          {activeTab === 'wechat' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>AppID</label>
                  <input type="text" value={config.wechat.appId} onChange={e => handleChange('wechat', 'appId', e.target.value)} placeholder="公众号 AppID" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>AppSecret</label>
                  <input type="password" value={config.wechat.appSecret} onChange={e => handleChange('wechat', 'appSecret', e.target.value)} placeholder="公众号 AppSecret" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>默认作者 <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(可选)</span></label>
                <input type="text" value={config.wechat.author || ''} onChange={e => handleChange('wechat', 'author', e.target.value)} placeholder="留空使用文章作者" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>顶部提示语 <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(可选)</span></label>
                <input type="text" value={config.wechat.topNotice || ''} onChange={e => handleChange('wechat', 'topNotice', e.target.value)} placeholder="文章顶部提示文字" style={inputStyle} />
              </div>
              <button onClick={testWechat} disabled={testing === 'wechat'} style={{ ...testBtnStyle, opacity: testing === 'wechat' ? 0.6 : 1, alignSelf: 'flex-start' }}>
                {testing === 'wechat' ? '测试中...' : '🔗 测试连接'}
              </button>
            </div>
          )}

          {activeTab === 'wordpress' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={labelStyle}>站点 URL</label>
                <input type="text" value={config.wordpress?.siteUrl || ''} onChange={e => handleChange('wordpress', 'siteUrl', e.target.value)} placeholder="https://your-site.com" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>用户名</label>
                  <input type="text" value={config.wordpress?.username || ''} onChange={e => handleChange('wordpress', 'username', e.target.value)} placeholder="登录用户名" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>应用密码</label>
                  <input type="password" value={config.wordpress?.appPassword || ''} onChange={e => handleChange('wordpress', 'appPassword', e.target.value)} placeholder="非登录密码" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={labelStyle}>默认分类 ID <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(可选)</span></label>
                  <input type="number" value={config.wordpress?.defaultCategory || ''} onChange={e => handleChange('wordpress', 'defaultCategory', e.target.value)} placeholder="如: 1" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>默认作者 ID <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(可选)</span></label>
                  <input type="number" value={config.wordpress?.defaultAuthor || ''} onChange={e => handleChange('wordpress', 'defaultAuthor', e.target.value)} placeholder="如: 1" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>顶部提示语 <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(可选)</span></label>
                <input type="text" value={config.wordpress?.topNotice || ''} onChange={e => handleChange('wordpress', 'topNotice', e.target.value)} placeholder="文章顶部提示文字" style={inputStyle} />
              </div>
              <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', margin: 0 }}>
                分类/作者 ID 可在 WordPress 后台相应页面 URL 中查看（如 category&tag_ID=<strong>5</strong>）<br/>
                应用密码在 用户 → 个人资料 中生成
              </p>
              <button onClick={testWordPress} disabled={testing === 'wordpress'} style={{ ...testBtnStyle, opacity: testing === 'wordpress' ? 0.6 : 1, alignSelf: 'flex-start' }}>
                {testing === 'wordpress' ? '测试中...' : '🔗 测试连接'}
              </button>
            </div>
          )}

          {activeTab === 'about' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Logo + 名称 */}
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <img src="icon.png" alt="NotionSyncOne" style={{ width: '64px', height: '64px', marginBottom: '8px', borderRadius: '12px', display: 'block', margin: '0 auto 8px' }} />
                <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>NotionSyncOne</h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-tertiary)' }}>Notion 文章多平台同步工具</p>
              </div>

              {/* 版本信息 */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>当前版本</span>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>v{APP_VERSION}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: updateInfo.hasUpdate ? '#10B981' : 'var(--text-secondary)' }}>
                    {updateInfo.hasUpdate ? `🎉 新版本 v${updateInfo.latest}` : updateInfo.latest ? '✓ 已是最新版本' : '点击检查更新'}
                  </span>
                  <button
                    onClick={() => updateInfo.hasUpdate ? window.electron.openExternal(`${GITHUB_REPO}/releases`) : checkUpdate()}
                    disabled={updateInfo.checking}
                    style={{ ...testBtnStyle, margin: 0, padding: '4px 10px' }}
                  >
                    {updateInfo.checking ? '检查中...' : updateInfo.hasUpdate ? '去下载' : '检查更新'}
                  </button>
                </div>
                {/* 状态提示 */}
                {message && (
                  <div style={{ marginTop: '8px', fontSize: '11px', color: message.type === 'success' ? '#6EE7B7' : '#FCA5A5' }}>
                    {message.type === 'success' ? '✓' : '✗'} {message.text}
                  </div>
                )}
              </div>

              {/* 链接 */}
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                <a style={linkStyle} onClick={() => window.electron.openExternal(GITHUB_REPO)}>📦 GitHub</a>
                <a style={linkStyle} onClick={() => window.electron.openExternal(`${GITHUB_REPO}/issues`)}>🐛 反馈问题</a>
                <a style={linkStyle} onClick={() => window.electron.openExternal(`${GITHUB_REPO}/releases`)}>📋 更新日志</a>
              </div>

              {/* 作者 */}
              <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-tertiary)', margin: 0 }}>
                Made with ❤️ by Bullet.S
              </p>
            </div>
          )}
        </div>

        {/* 底部 - 仅在配置页显示 */}
        {activeTab !== 'about' && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {message ? (
              <span style={{ fontSize: '12px', color: message.type === 'success' ? '#6EE7B7' : '#FCA5A5' }}>
                {message.type === 'success' ? '✓' : '✗'} {message.text}
              </span>
            ) : <span />}
            <button onClick={handleSave} disabled={loading} style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--primary-green)', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsModal;
