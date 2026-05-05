import React, { useState, useEffect } from 'react';
import { IpcService } from '../../shared/services/IpcService';
import { Config } from '../../shared/types/config';
import { APP_VERSION, GITHUB_REPO } from '../../shared/constants';
import { getSettingsSections, SettingsSectionStatus } from '../utils/settingsStatus';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'notion' | 'wechat' | 'wordpress' | 'bilibili' | 'about';
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, defaultTab = 'notion' }) => {
  const [config, setConfig] = useState<Config>({
    notion: { apiKey: '', databaseId: '' },
    wechat: { appId: '', appSecret: '' },
    wordpress: { siteUrl: '', username: '', appPassword: '' },
    bilibili: { enabled: false }
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'notion' | 'wechat' | 'wordpress' | 'bilibili' | 'about'>(defaultTab);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<{ checking: boolean; latest?: string; hasUpdate?: boolean }>({ checking: false });
  const [bilibiliUser, setBilibiliUser] = useState<{ name: string; mid: string } | null>(null);
  const sectionStatus = getSettingsSections(config);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
      setActiveTab(defaultTab);
      // 如果打开B站标签，尝试加载用户信息
      if (defaultTab === 'bilibili') {
        loadBilibiliUser();
      }
    }
  }, [isOpen, defaultTab]);

  useEffect(() => {
    if (activeTab === 'bilibili') {
      loadBilibiliUser();
    }
  }, [activeTab]);

  const loadBilibiliUser = async () => {
    try {
      const userInfo = await window.electron.ipcRenderer.invoke('get-bilibili-user');
      setBilibiliUser(userInfo as { name: string; mid: string } | null);
    } catch (err) {
      console.error('加载B站用户信息失败:', err);
      setBilibiliUser(null);
    }
  };

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
          topNotice: loadedConfig.wechat?.topNotice || '',
          titleTemplate: loadedConfig.wechat?.titleTemplate || ''
        },
        wordpress: {
          siteUrl: loadedConfig.wordpress?.siteUrl || '',
          username: loadedConfig.wordpress?.username || '',
          appPassword: loadedConfig.wordpress?.appPassword || '',
          defaultCategory: loadedConfig.wordpress?.defaultCategory,
          defaultAuthor: loadedConfig.wordpress?.defaultAuthor,
          topNotice: loadedConfig.wordpress?.topNotice || '',
          titleTemplate: loadedConfig.wordpress?.titleTemplate || ''
        },
        bilibili: {
          enabled: loadedConfig.bilibili?.enabled || false,
          cookieFile: loadedConfig.bilibili?.cookieFile || '',
          defaultTid: loadedConfig.bilibili?.defaultTid ?? undefined,
          defaultTags: loadedConfig.bilibili?.defaultTags || [],
          descTemplate: loadedConfig.bilibili?.descTemplate || '',
          titleTemplate: loadedConfig.bilibili?.titleTemplate || '',
          copyright: loadedConfig.bilibili?.copyright ?? 1,
          noReprint: loadedConfig.bilibili?.noReprint ?? 0,
          openElec: loadedConfig.bilibili?.openElec ?? 0,
          upCloseReply: loadedConfig.bilibili?.upCloseReply ?? false,
          upCloseDanmu: loadedConfig.bilibili?.upCloseDanmu ?? false,
          proxy: loadedConfig.bilibili?.proxy || ''
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
          topNotice: (config.wechat?.topNotice || '').trim() || undefined,
          titleTemplate: (config.wechat?.titleTemplate || '').trim() || undefined
        },
        wordpress: (config.wordpress?.siteUrl || config.wordpress?.topNotice) ? {
          siteUrl: (config.wordpress?.siteUrl || '').trim(),
          username: (config.wordpress?.username || '').trim(),
          appPassword: (config.wordpress?.appPassword || '').trim(),
          defaultCategory: config.wordpress?.defaultCategory ? Number(config.wordpress.defaultCategory) : undefined,
          defaultAuthor: config.wordpress?.defaultAuthor ? Number(config.wordpress.defaultAuthor) : undefined,
          topNotice: (config.wordpress?.topNotice || '').trim() || undefined,
          titleTemplate: (config.wordpress?.titleTemplate || '').trim() || undefined
        } : undefined,
        bilibili: config.bilibili ? {
          enabled: config.bilibili.enabled || false,
          cookieFile: config.bilibili.cookieFile?.trim() || undefined,
          defaultTid: config.bilibili.defaultTid != null ? Number(config.bilibili.defaultTid) : undefined,
          defaultTags: config.bilibili.defaultTags?.length ? config.bilibili.defaultTags.filter(t => t.trim()).map(t => t.trim()) : undefined,
          descTemplate: config.bilibili.descTemplate?.trim(),
          titleTemplate: config.bilibili.titleTemplate?.trim() || undefined,
          copyright: config.bilibili.copyright != null ? Number(config.bilibili.copyright) as 1 | 2 : undefined,
          noReprint: config.bilibili.noReprint != null ? Number(config.bilibili.noReprint) as 0 | 1 : undefined,
          openElec: config.bilibili.openElec != null ? Number(config.bilibili.openElec) as 0 | 1 : undefined,
          upCloseReply: config.bilibili.upCloseReply != null ? config.bilibili.upCloseReply : undefined,
          upCloseDanmu: config.bilibili.upCloseDanmu != null ? config.bilibili.upCloseDanmu : undefined,
          proxy: config.bilibili.proxy?.trim() || undefined
        } : undefined
      };

      await IpcService.saveConfig(configToSave);
      
      setMessage({ type: 'success', text: '配置已保存，状态已刷新' });
      setTimeout(() => setMessage(null), 2500);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '保存失败' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (section: keyof Config, field: string, value: string) => {
    setConfig(prev => {
      if (section === 'bilibili') {
        if (field === 'enabled') {
          return { ...prev, bilibili: { ...prev.bilibili, enabled: value === 'true' } };
        }
        if (field === 'defaultTags') {
          return { ...prev, bilibili: { ...prev.bilibili, defaultTags: value.split(',').map(t => t.trim()).filter(Boolean) } };
        }
        if (field === 'defaultTid') {
          return { ...prev, bilibili: { ...prev.bilibili, defaultTid: value !== '' ? Number(value) : undefined } };
        }
        if (field === 'copyright' || field === 'noReprint' || field === 'openElec') {
          return { ...prev, bilibili: { ...prev.bilibili, [field]: Number(value) } };
        }
        if (field === 'upCloseReply' || field === 'upCloseDanmu') {
          return { ...prev, bilibili: { ...prev.bilibili, [field]: value === 'true' } };
        }
        // 其他字段（如 descTemplate）
        console.log(`[handleChange] bilibili.${field} = `, value);
        return { ...prev, bilibili: { ...prev.bilibili, [field]: value } };
      }
      return { ...prev, [section]: { ...(prev[section] || {}), [field]: value } };
    });
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
    { id: 'notion' as const, label: 'Notion' },
    { id: 'wechat' as const, label: '微信' },
    { id: 'wordpress' as const, label: 'WP' },
    { id: 'bilibili' as const, label: 'B站' },
    { id: 'about' as const, label: '关于' },
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

  const renderStatusDot = (section: SettingsSectionStatus) => (
    <span style={{
      width: '7px',
      height: '7px',
      borderRadius: '50%',
      backgroundColor: section.ready ? section.accentColor : 'var(--warning)',
      boxShadow: section.ready ? `0 0 0 3px ${section.accentColor}22` : 'none',
      flexShrink: 0
    }} />
  );

  const renderSectionSummary = (section: SettingsSectionStatus) => (
    <button
      key={section.key}
      onClick={() => setActiveTab(section.key)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '5px',
        minWidth: 0,
        padding: '10px 12px',
        borderRadius: '8px',
        border: activeTab === section.key ? `1px solid ${section.accentColor}66` : '1px solid var(--border-light)',
        backgroundColor: activeTab === section.key ? `${section.accentColor}14` : 'var(--bg-secondary)',
        cursor: 'pointer'
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
        {renderStatusDot(section)}
        {section.label}
      </span>
      <span style={{ fontSize: '11px', color: section.ready ? section.accentColor : 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
        {section.summary}
      </span>
    </button>
  );

  const activeSection = activeTab !== 'about' ? sectionStatus[activeTab] : null;

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
        borderRadius: '8px',
        width: '720px',
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'calc(100vh - 32px)',
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
                {tab.id !== 'about' && renderStatusDot(sectionStatus[tab.id])}
                {tab.label}
              </button>
            ))}
          </div>
          <button onClick={onClose} style={{ width: '24px', height: '24px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '14px' }}>✕</button>
        </div>

        {/* 内容 */}
        <div style={{ padding: '14px 20px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' }}>
            {renderSectionSummary(sectionStatus.notion)}
            {renderSectionSummary(sectionStatus.wechat)}
            {renderSectionSummary(sectionStatus.wordpress)}
            {renderSectionSummary(sectionStatus.bilibili)}
          </div>
          {activeSection && (
            <div style={{
              marginTop: '10px',
              padding: '9px 12px',
              borderRadius: '8px',
              border: `1px solid ${activeSection.ready ? `${activeSection.accentColor}44` : 'var(--border-light)'}`,
              backgroundColor: activeSection.ready ? `${activeSection.accentColor}10` : 'var(--bg-secondary)',
              color: activeSection.ready ? activeSection.accentColor : 'var(--text-secondary)',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <span>
                <b>{activeSection.label}</b>：{activeSection.summary}
              </span>
              {!activeSection.ready && activeSection.missingFields.length > 0 && (
                <span style={{ color: 'var(--text-tertiary)' }}>
                  补齐后保存即可更新状态
                </span>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: '16px 24px', maxHeight: 'calc(100vh - 250px)', overflow: 'auto' }}>
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
              <div>
                <label style={labelStyle}>标题模板 <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(可选)</span></label>
                <input type="text" value={config.wechat.titleTemplate || ''} onChange={e => handleChange('wechat', 'titleTemplate', e.target.value)} placeholder="例如：【转载】{title}" style={inputStyle} />
                <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px' }}>使用 {'{title}'} 代表原标题</p>
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
              <div>
                <label style={labelStyle}>标题模板 <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(可选)</span></label>
                <input type="text" value={config.wordpress?.titleTemplate || ''} onChange={e => handleChange('wordpress', 'titleTemplate', e.target.value)} placeholder="例如：【转载】{title}" style={inputStyle} />
                <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px' }}>使用 {'{title}'} 代表原标题</p>
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

          {activeTab === 'bilibili' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input 
                    type="checkbox" 
                    checked={config.bilibili?.enabled || false}
                    onChange={e => handleChange('bilibili', 'enabled', e.target.checked.toString())}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  启用 B站视频投稿
                </label>
              </div>

              {config.bilibili?.enabled && (
                <>
                  {/* 账号登录卡片 */}
                  <div style={{ 
                    padding: '12px', 
                    backgroundColor: 'var(--bg-secondary)', 
                    borderRadius: '6px',
                    border: '1px solid var(--border-light)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: '0 0 4px' }}>
                          登录账号
                        </p>
                        {bilibiliUser ? (
                          <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>
                            {bilibiliUser.name} <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>({bilibiliUser.mid})</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>未登录</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={async () => {
                            try {
                              setTesting('bili-login');
                              await IpcService.bilibiliLogin();
                              // 登录成功，立即加载用户信息
                              await loadBilibiliUser();
                              setMessage({ type: 'success', text: '登录成功' });
                            } catch (err) {
                              const errorMsg = err instanceof Error ? err.message : '登录失败';
                              setMessage({ type: 'error', text: errorMsg });
                              console.error('B站登录失败:', err);
                            } finally {
                              setTesting(null);
                            }
                          }}
                          disabled={testing === 'bili-login'}
                          style={{ 
                            padding: '5px 12px',
                            borderRadius: '4px',
                            border: '1px solid rgba(251, 114, 153, 0.3)',
                            backgroundColor: 'transparent',
                            color: '#FB7299',
                            fontSize: '12px',
                            cursor: testing === 'bili-login' ? 'not-allowed' : 'pointer',
                            opacity: testing === 'bili-login' ? 0.6 : 1
                          }}
                        >
                          {testing === 'bili-login' ? '登录中...' : (bilibiliUser ? '重新登录' : '扫码登录')}
                        </button>
                        {bilibiliUser && (
                          <button
                            onClick={async () => {
                              try {
                                setTesting('bili-logout');
                                await IpcService.bilibiliLogout();
                                setBilibiliUser(null);
                                setMessage({ type: 'success', text: '已退出登录' });
                              } catch {
                                setMessage({ type: 'error', text: '退出失败' });
                              } finally {
                                setTesting(null);
                              }
                            }}
                            disabled={testing === 'bili-logout'}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-light)',
                              backgroundColor: 'transparent',
                              color: 'var(--text-secondary)',
                              fontSize: '12px',
                              cursor: testing === 'bili-logout' ? 'not-allowed' : 'pointer',
                              opacity: testing === 'bili-logout' ? 0.6 : 1
                            }}
                          >
                            {testing === 'bili-logout' ? '退出中...' : '退出登录'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 可选配置 */}
                  <div>
                    <label style={labelStyle}>默认分区（可选）</label>
                    <input
                      type="number"
                      value={config.bilibili?.defaultTid || ''}
                      onChange={e => handleChange('bilibili', 'defaultTid', e.target.value)}
                      placeholder="122-技术 / 21-生活 / 230-软件"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>默认标签（可选）</label>
                    <input
                      type="text"
                      value={config.bilibili?.defaultTags?.join(', ') || ''}
                      onChange={e => handleChange('bilibili', 'defaultTags', e.target.value)}
                      placeholder="逗号分隔，如：教程, Notion"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>标题模板（可选）</label>
                    <input
                      type="text"
                      value={config.bilibili?.titleTemplate || ''}
                      onChange={e => handleChange('bilibili', 'titleTemplate', e.target.value)}
                      placeholder="例如：【转载】{title}"
                      style={inputStyle}
                    />
                    <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px' }}>使用 {'{title}'} 代表原标题</p>
                  </div>

                  <div>
                    <label style={labelStyle}>简介模板（可选）</label>
                    <textarea
                      value={config.bilibili?.descTemplate || ''}
                      onChange={e => handleChange('bilibili', 'descTemplate', e.target.value)}
                      placeholder="支持变量：{title} {url} {date} {from} {author} {engine} {rate} {tags}&#10;&#10;推荐格式示例：&#10;━━━━━━━━━━━━━━━&#10;📌 来源：{from}&#10;✍️ 作者：{author}&#10;🎮 引擎：{engine}&#10;⭐ 评分：{rate}&#10;🏷️ 标签：{tags}&#10;━━━━━━━━━━━━━━━&#10;🔗 原文：{url}&#10;📅 日期：{date}"
                      style={{ ...inputStyle, minHeight: '140px', resize: 'vertical' }}
                    />
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                      💡 支持8个变量 | 避免使用 ---- 分隔线（建议用 ━ 或 emoji）
                    </div>
                  </div>

                  {/* 高级选项 */}
                  <details style={{ marginTop: '8px' }}>
                    <summary style={{ cursor: 'pointer', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                      ⚙️ 高级选项
                    </summary>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '16px' }}>
                      <div>
                        <label style={labelStyle}>版权类型</label>
                        <select
                          value={config.bilibili?.copyright || 1}
                          onChange={e => handleChange('bilibili', 'copyright', e.target.value)}
                          style={inputStyle}
                        >
                          <option value={1}>自制</option>
                          <option value={2}>转载</option>
                        </select>
                      </div>

                        <div>
                        <label style={labelStyle}>
                          下载代理 <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(可选)</span>
                        </label>
                        <input
                          type="text"
                          value={config.bilibili?.proxy || ''}
                          onChange={e => handleChange('bilibili', 'proxy', e.target.value)}
                          placeholder="留空自动检测，例如：http://127.0.0.1:10809"
                          style={inputStyle}
                        />
                        <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                          用于 yt-dlp 下载 YouTube 等外链视频。支持 http:// 和 socks5:// 协议
                        </p>
                      </div>

                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={config.bilibili?.noReprint === 1}
                            onChange={e => handleChange('bilibili', 'noReprint', e.target.checked ? '1' : '0')}
                          />
                          禁止转载
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={config.bilibili?.openElec === 1}
                            onChange={e => handleChange('bilibili', 'openElec', e.target.checked ? '1' : '0')}
                          />
                          开启充电
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={config.bilibili?.upCloseReply === true}
                            onChange={e => handleChange('bilibili', 'upCloseReply', e.target.checked ? 'true' : 'false')}
                          />
                          关闭评论
                        </label>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={config.bilibili?.upCloseDanmu === true}
                            onChange={e => handleChange('bilibili', 'upCloseDanmu', e.target.checked ? 'true' : 'false')}
                          />
                          关闭弹幕
                        </label>
                      </div>
                    </div>
                  </details>

                  {/* 简洁的说明链接 */}
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                    💡 需先安装 <code style={{ padding: '1px 4px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '2px' }}>biliup</code> 和 <code style={{ padding: '1px 4px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '2px' }}>ffmpeg</code>
                    （安装后请重启应用），
                    <a
                      href="#"
                      onClick={(e) => { e.preventDefault(); window.electron.openExternal('https://github.com/AniBullet/NotionSyncOne/blob/main/docs/BILIBILI_GUIDE.md'); }}
                      style={{ color: 'var(--primary-green)', textDecoration: 'none', marginLeft: '4px' }}
                    >
                      查看详细说明
                    </a>
                  </div>
                </>
              )}
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

              {/* 安全与隐私 */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', padding: '14px 16px' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>🔐 安全与隐私</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <span style={{ color: '#22C55E', minWidth: '14px' }}>✓</span>
                    <span>系统级加密：敏感配置使用 DPAPI 加密，只有当前用户在当前电脑上才能解密</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <span style={{ color: '#22C55E', minWidth: '14px' }}>✓</span>
                    <span>本地存储：所有数据仅存储在本地，不上传到云端</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <span style={{ color: '#22C55E', minWidth: '14px' }}>✓</span>
                    <span>开源透明：源代码公开可审计，无后门和追踪</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginTop: '4px' }}>
                    <span style={{ color: '#F59E0B', minWidth: '14px' }}>⚠</span>
                    <span>不要在公共电脑使用，不要分享配置文件</span>
                  </div>
                </div>
                
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                  <a 
                    style={{ ...linkStyle, fontSize: '11px' }} 
                    onClick={() => window.electron.openExternal(`${GITHUB_REPO}/blob/main/docs/SECURITY.md`)}
                  >
                    📄 查看完整安全说明
                  </a>
                </div>
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
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div style={{ minWidth: 0 }}>
              {message ? (
                <span style={{ fontSize: '12px', color: message.type === 'success' ? '#6EE7B7' : '#FCA5A5' }}>
                  {message.type === 'success' ? '已完成' : '需要处理'}：{message.text}
                </span>
              ) : activeSection ? (
                <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                  当前页：{activeSection.summary}
                </span>
              ) : <span />}
            </div>
            <button onClick={handleSave} disabled={loading} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--primary-green)', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsModal;
