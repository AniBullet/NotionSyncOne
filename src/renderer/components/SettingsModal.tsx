import React, { useState, useEffect } from 'react';
import { IpcService } from '../../shared/services/IpcService';
import { Config } from '../../shared/types/config';
import { BilibiliSeason } from '../../shared/types/bilibili';
import { APP_VERSION, GITHUB_REPO } from '../../shared/constants';
import { getSettingsSections, SettingsSectionStatus } from '../utils/settingsStatus';

const BILIBILI_TIDS = [
  { tid: 138, name: '搞笑',        parent: '生活' },
  { tid: 239, name: '家居房产',    parent: '生活' },
  { tid: 161, name: '手工',        parent: '生活' },
  { tid: 162, name: '绘画',        parent: '生活' },
  { tid:  21, name: '日常',        parent: '生活' },
  { tid:  17, name: '单机游戏',    parent: '游戏' },
  { tid:  65, name: '网络游戏',    parent: '游戏' },
  { tid: 172, name: '手机游戏',    parent: '游戏' },
  { tid: 171, name: '电子竞技',    parent: '游戏' },
  { tid: 173, name: '桌游棋牌',    parent: '游戏' },
  { tid: 136, name: '音游',        parent: '游戏' },
  { tid: 121, name: 'GMV',         parent: '游戏' },
  { tid:  19, name: 'Mugen',       parent: '游戏' },
  { tid:  71, name: '综艺',        parent: '娱乐' },
  { tid: 137, name: '明星',        parent: '娱乐' },
  { tid: 201, name: '科学科普',    parent: '知识' },
  { tid: 124, name: '社科·法律·心理', parent: '知识' },
  { tid: 228, name: '人文历史',    parent: '知识' },
  { tid: 207, name: '财经商业',    parent: '知识' },
  { tid: 208, name: '校园学习',    parent: '知识' },
  { tid: 209, name: '职业职场',    parent: '知识' },
  { tid: 229, name: '设计·创意',  parent: '知识' },
  { tid: 122, name: '野生技能协会', parent: '知识' },
  { tid:  85, name: '短片',        parent: '影视' },
  { tid: 182, name: '影视杂谈',    parent: '影视' },
  { tid: 183, name: '影视剪辑',    parent: '影视' },
  { tid: 184, name: '预告·资讯',  parent: '影视' },
  { tid: 130, name: '音乐综合',    parent: '音乐' },
  { tid:  29, name: '音乐现场',    parent: '音乐' },
  { tid:  59, name: '演奏',        parent: '音乐' },
  { tid:  31, name: '翻唱',        parent: '音乐' },
  { tid: 193, name: 'MV',          parent: '音乐' },
  { tid:  30, name: 'VOCALOID·UTAU', parent: '音乐' },
  { tid: 194, name: '电音',        parent: '音乐' },
  { tid:  28, name: '原创音乐',    parent: '音乐' },
  { tid:  24, name: 'MAD·AMV',    parent: '动画' },
  { tid:  25, name: 'MMD·3D',      parent: '动画' },
  { tid:  27, name: '综合',        parent: '动画' },
  { tid:  47, name: '短片·手书·配音', parent: '动画' },
  { tid: 210, name: '手办·模玩',  parent: '动画' },
  { tid:  86, name: '特摄',        parent: '动画' },
  { tid: 157, name: '美妆护肤',    parent: '时尚' },
  { tid: 158, name: '穿搭',        parent: '时尚' },
  { tid: 159, name: '时尚潮流',    parent: '时尚' },
  { tid:  76, name: '美食制作',    parent: '美食' },
  { tid: 212, name: '美食侦探',    parent: '美食' },
  { tid: 213, name: '美食测评',    parent: '美食' },
  { tid: 214, name: '田园美食',    parent: '美食' },
  { tid: 215, name: '美食记录',    parent: '美食' },
  { tid: 176, name: '汽车生活',    parent: '汽车' },
  { tid: 224, name: '汽车文化',    parent: '汽车' },
  { tid: 225, name: '汽车极客',    parent: '汽车' },
  { tid: 240, name: '摩托车',      parent: '汽车' },
  { tid: 226, name: '智能出行',    parent: '汽车' },
  { tid: 227, name: '购车攻略',    parent: '汽车' },
  { tid: 235, name: '篮球·足球',  parent: '运动' },
  { tid: 164, name: '健身',        parent: '运动' },
  { tid: 236, name: '竞技体育',    parent: '运动' },
  { tid: 237, name: '运动文化',    parent: '运动' },
  { tid: 238, name: '运动综合',    parent: '运动' },
  { tid:  95, name: '数码',        parent: '科技' },
  { tid: 230, name: '软件应用',    parent: '科技' },
  { tid: 231, name: '计算机技术',  parent: '科技' },
  { tid: 232, name: '工业·工程·机械', parent: '科技' },
  { tid: 233, name: '极客DIY',     parent: '科技' },
  { tid: 218, name: '喵星人',      parent: '动物圈' },
  { tid: 219, name: '汪星人',      parent: '动物圈' },
  { tid: 221, name: '野生动物',    parent: '动物圈' },
  { tid: 222, name: '爬宠',        parent: '动物圈' },
  { tid: 220, name: '大熊猫',      parent: '动物圈' },
  { tid:  75, name: '动物综合',    parent: '动物圈' },
  { tid:  20, name: '宅舞',        parent: '舞蹈' },
  { tid: 154, name: '舞蹈综合',    parent: '舞蹈' },
  { tid: 156, name: '舞蹈教程',    parent: '舞蹈' },
  { tid: 198, name: '街舞',        parent: '舞蹈' },
  { tid: 199, name: '明星舞蹈',    parent: '舞蹈' },
  { tid: 200, name: '中国舞',      parent: '舞蹈' },
  { tid: 153, name: '国产动画',    parent: '国创' },
  { tid: 168, name: '国产原创相关', parent: '国创' },
  { tid: 169, name: '布袋戏',      parent: '国创' },
  { tid: 170, name: '资讯',        parent: '国创' },
  { tid: 195, name: '动态漫·广播剧', parent: '国创' },
  { tid:  22, name: '鬼畜调教',    parent: '鬼畜' },
  { tid:  26, name: '音MAD',       parent: '鬼畜' },
  { tid: 126, name: '人力VOCALOID', parent: '鬼畜' },
  { tid: 216, name: '鬼畜剧场',    parent: '鬼畜' },
  { tid: 127, name: '教程演示',    parent: '鬼畜' },
  { tid:  37, name: '人文·历史',  parent: '纪录片' },
  { tid: 178, name: '科学·探索·自然', parent: '纪录片' },
  { tid: 179, name: '军事',        parent: '纪录片' },
  { tid: 180, name: '社会·美食·旅行', parent: '纪录片' },
  { tid:  51, name: '资讯',        parent: '番剧' },
  { tid: 152, name: '官方延伸',    parent: '番剧' },
  { tid:  32, name: '完结动画',    parent: '番剧' },
  { tid:  33, name: '连载动画',    parent: '番剧' },
  { tid: 185, name: '国产剧',      parent: '电视剧' },
  { tid: 187, name: '海外剧',      parent: '电视剧' },
  { tid:  83, name: '其他国家',    parent: '电影' },
  { tid: 145, name: '欧美电影',    parent: '电影' },
  { tid: 146, name: '日本电影',    parent: '电影' },
  { tid: 147, name: '国产电影',    parent: '电影' },
] as const;

type BilibiliTidEntry = (typeof BILIBILI_TIDS)[number];

const tidDisplayName = (tid: number): string => {
  const found = (BILIBILI_TIDS as readonly BilibiliTidEntry[]).find(t => t.tid === tid);
  return found ? `${found.parent} / ${found.name}` : `tid: ${tid}`;
};

const notionFieldMapFields = [
  { key: 'linkStart', label: '原文链接', defaultName: 'LinkStart' },
  { key: 'from', label: '来源平台', defaultName: 'From' },
  { key: 'author', label: '原作者', defaultName: 'Author' },
  { key: 'featureTag', label: '标签', defaultName: 'FeatureTag' },
  { key: 'expectationsRate', label: '个人期待值', defaultName: 'ExpectationsRate' },
  { key: 'engine', label: '引擎', defaultName: 'Engine' },
  { key: 'addedTime', label: '添加时间', defaultName: 'AddedTime' }
] as const;

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'notion' | 'wechat' | 'wordpress' | 'bilibili' | 'about';
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, defaultTab = 'notion' }) => {
  const [config, setConfig] = useState<Config>({
    notion: { apiKey: '', databaseId: '' },
    wechat: { appId: '', appSecret: '' },
    wordpress: { enabled: false, siteUrl: '', username: '', appPassword: '' },
    bilibili: { enabled: false }
  });
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'notion' | 'wechat' | 'wordpress' | 'bilibili' | 'about'>(defaultTab);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [updateInfo, setUpdateInfo] = useState<{ checking: boolean; latest?: string; hasUpdate?: boolean }>({ checking: false });
  const [bilibiliUser, setBilibiliUser] = useState<{ name: string; mid: string; verifiedByCookie?: boolean } | null>(null);
  const [seasons, setSeasons] = useState<BilibiliSeason[]>([]);
  const [fetchingSeasons, setFetchingSeasons] = useState(false);
  const [seasonsError, setSeasonsError] = useState<string | null>(null);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [tidSearch, setTidSearch] = useState('');
  const [tidDropdownOpen, setTidDropdownOpen] = useState(false);
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

  // 切到 B站 tab 且已启用时自动拉合集列表（用于显示已配置分组的名称）
  useEffect(() => {
    if (activeTab === 'bilibili' && config.bilibili?.enabled) {
      fetchSeasons().catch(() => {/* 静默失败 */});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, config.bilibili?.enabled]);

  const loadBilibiliUser = async () => {
    try {
      const userInfo = await window.electron.ipcRenderer.invoke('get-bilibili-user');
      setBilibiliUser(userInfo as { name: string; mid: string; verifiedByCookie?: boolean } | null);
    } catch (err) {
      console.error('加载B站用户信息失败:', err);
      setBilibiliUser(null);
    }
  };

  const fetchSeasons = async () => {
    setFetchingSeasons(true);
    setSeasonsError(null);
    setSeasons([]);
    setSelectedSeasonId(null);
    try {
      const list = await IpcService.getBilibiliSeasons();
      setSeasons(list);
      // 如果已配置了 defaultSeasonId，自动定位到对应合集
      const currentSectionId = config.bilibili?.defaultSeasonId;
      if (currentSectionId) {
        const matched = list.find(s => s.sections.some(sec => sec.sectionId === currentSectionId));
        if (matched) setSelectedSeasonId(matched.seasonId);
      }
    } catch (err) {
      setSeasonsError(err instanceof Error ? err.message : '获取合集失败');
    } finally {
      setFetchingSeasons(false);
    }
  };

  const loadConfig = async () => {
    try {
      const loadedConfig = await IpcService.getConfig();
      setConfig({
        notion: {
          apiKey: loadedConfig.notion?.apiKey || '',
          databaseId: loadedConfig.notion?.databaseId || '',
          fieldMap: loadedConfig.notion?.fieldMap
        },
        wechat: {
          appId: loadedConfig.wechat?.appId || '',
          appSecret: loadedConfig.wechat?.appSecret || '',
          author: loadedConfig.wechat?.author || '',
          topNotice: loadedConfig.wechat?.topNotice || '',
          titleTemplate: loadedConfig.wechat?.titleTemplate || ''
        },
        wordpress: {
          enabled: loadedConfig.wordpress?.enabled || false,
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
          defaultSeasonId: loadedConfig.bilibili?.defaultSeasonId ?? undefined,
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
          databaseId: config.notion.databaseId.trim(),
          fieldMap: config.notion.fieldMap && Object.keys(config.notion.fieldMap).length > 0 ? config.notion.fieldMap : undefined
        },
        wechat: {
          appId: (config.wechat?.appId || '').trim(),
          appSecret: (config.wechat?.appSecret || '').trim(),
          author: (config.wechat?.author || '').trim() || undefined,
          topNotice: (config.wechat?.topNotice || '').trim() || undefined,
          titleTemplate: (config.wechat?.titleTemplate || '').trim() || undefined
        },
        wordpress: config.wordpress ? {
          enabled: config.wordpress.enabled || false,
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
          defaultSeasonId: config.bilibili.defaultSeasonId != null ? Number(config.bilibili.defaultSeasonId) : undefined,
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
        if (field === 'defaultTid' || field === 'defaultSeasonId') {
          return { ...prev, bilibili: { ...prev.bilibili, [field]: value !== '' ? Number(value) : undefined } };
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
      if (section === 'wordpress' && field === 'enabled') {
        return {
          ...prev,
          wordpress: {
            siteUrl: '',
            username: '',
            appPassword: '',
            ...prev.wordpress,
            enabled: value === 'true'
          }
        };
      }
      return { ...prev, [section]: { ...(prev[section] || {}), [field]: value } };
    });
  };

  const handleNotionFieldMapChange = (key: typeof notionFieldMapFields[number]['key'], value: string) => {
    setConfig(prev => {
      const nextFieldMap = { ...(prev.notion.fieldMap || {}) };
      const cleanValue = value.trim();
      if (cleanValue) {
        nextFieldMap[key] = cleanValue;
      } else {
        delete nextFieldMap[key];
      }
      return {
        ...prev,
        notion: {
          ...prev.notion,
          fieldMap: Object.keys(nextFieldMap).length > 0 ? nextFieldMap : undefined
        }
      };
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
    { id: 'bilibili' as const, label: 'B站' },
    { id: 'wordpress' as const, label: 'WP' },
    { id: 'about' as const, label: '关于' },
  ];

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '9px 11px',
    fontSize: '13px',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-medium)',
    borderRadius: '8px',
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
    padding: '7px 12px',
    borderRadius: '8px',
    border: '1px solid var(--border-medium)',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '12px',
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

  const renderSidebarTab = (tab: typeof tabs[number]) => {
    const section = tab.id !== 'about' ? sectionStatus[tab.id] : null;
    const isActive = activeTab === tab.id;

    return (
      <button
        key={tab.id}
        type="button"
        role="tab"
        aria-selected={activeTab === tab.id}
        aria-controls={`settings-panel-${tab.id}`}
        onClick={() => setActiveTab(tab.id)}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: '9px',
          border: isActive ? '1px solid var(--border-medium)' : '1px solid transparent',
          backgroundColor: isActive ? 'var(--bg-primary)' : 'transparent',
          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '9px',
          textAlign: 'left',
          boxShadow: isActive ? '0 8px 18px rgba(0, 0, 0, 0.08)' : 'none'
        }}
      >
        {section ? renderStatusDot(section) : (
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--text-tertiary)', flexShrink: 0 }} />
        )}
        <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '13px', fontWeight: isActive ? 700 : 600 }}>{tab.label}</span>
          <span style={{ fontSize: '11px', color: section?.ready ? section.accentColor : 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {section ? section.summary : '版本与安全'}
          </span>
        </span>
      </button>
    );
  };

  const renderSectionHeaderAction = () => {
    if (activeTab === 'wechat') {
      return (
        <button onClick={testWechat} disabled={testing === 'wechat'} style={{ ...testBtnStyle, marginTop: 0, opacity: testing === 'wechat' ? 0.6 : 1 }}>
          {testing === 'wechat' ? '测试中...' : '测试连接'}
        </button>
      );
    }
    if (activeTab === 'wordpress') {
      return (
        <button onClick={testWordPress} disabled={testing === 'wordpress'} style={{ ...testBtnStyle, marginTop: 0, opacity: testing === 'wordpress' ? 0.6 : 1 }}>
          {testing === 'wordpress' ? '测试中...' : '测试连接'}
        </button>
      );
    }
    if (activeTab === 'bilibili') {
      return (
        <button onClick={loadBilibiliUser} disabled={testing === 'bili-login' || testing === 'bili-logout'} style={{ ...testBtnStyle, marginTop: 0 }}>
          刷新账号
        </button>
      );
    }
    return null;
  };

  const activeSection = activeTab !== 'about' ? sectionStatus[activeTab] : null;
  const contentColumnStyle: React.CSSProperties = {
    maxWidth: activeTab === 'about' ? '680px' : '620px',
    margin: '0 auto',
    width: '100%'
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
        width: 'min(920px, calc(100vw - 48px))',
        height: 'min(760px, calc(100vh - 48px))',
        maxWidth: 'calc(100vw - 32px)',
        maxHeight: 'calc(100vh - 32px)',
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
        overflow: 'hidden',
        boxShadow: '0 22px 56px rgba(0, 0, 0, 0.32)',
        zIndex: 1
      }}>
        {/* 标签页 */}
        <div style={{ padding: '16px 18px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '16px', fontWeight: 700 }}>设置</h2>
            <p style={{ margin: '3px 0 0', color: 'var(--text-tertiary)', fontSize: '12px' }}>连接、发布默认值与应用信息</p>
          </div>
          <button type="button" aria-label="关闭设置" onClick={onClose} style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '14px', flexShrink: 0 }}>✕</button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '168px minmax(0, 1fr)',
          minHeight: 0
        }}>
          <aside
            role="tablist"
            aria-label="设置分类"
            style={{
              borderRight: '1px solid var(--border-light)',
              backgroundColor: 'var(--bg-secondary)',
              padding: '14px 12px',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {tabs.map(renderSidebarTab)}
            </div>
          </aside>

          <div
          id={`settings-panel-${activeTab}`}
          role="tabpanel"
          style={{
            minHeight: 0,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            padding: '20px 24px 26px'
          }}
        >
          <div style={contentColumnStyle}>
          {activeSection && (
            <div style={{
              marginBottom: '16px',
              padding: '12px 14px',
              borderRadius: '10px',
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
              {renderSectionHeaderAction()}
            </div>
          )}
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
              <div>
                <label style={labelStyle}>可选元数据字段映射</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {notionFieldMapFields.map(field => (
                    <div key={field.key}>
                      <label style={{ ...labelStyle, fontSize: '11px', color: 'var(--text-tertiary)' }}>{field.label}</label>
                      <input
                        type="text"
                        value={config.notion.fieldMap?.[field.key] || ''}
                        onChange={e => handleNotionFieldMapChange(field.key, e.target.value)}
                        placeholder={field.defaultName}
                        style={inputStyle}
                      />
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '6px' }}>这些字段可以不存在；留空会按默认字段名读取，读不到就跳过</p>
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
            </div>
          )}

          {activeTab === 'wordpress' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={config.wordpress?.enabled || false}
                    onChange={e => handleChange('wordpress', 'enabled', e.target.checked.toString())}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  启用 WordPress 同步
                </label>
              </div>
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
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>
                              {bilibiliUser.name} <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>({bilibiliUser.mid})</span>
                            </div>
                            {bilibiliUser.verifiedByCookie && (
                              <div style={{ marginTop: '3px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                已从登录 Cookie 读取到 UID，上传前会继续使用当前登录状态
                              </div>
                            )}
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
                  <div style={{ position: 'relative' }}>
                    <label style={labelStyle}>默认分区（可选）</label>
                    <input
                      value={tidDropdownOpen ? tidSearch : (config.bilibili?.defaultTid ? tidDisplayName(config.bilibili.defaultTid) : '')}
                      onChange={e => { setTidSearch(e.target.value); setTidDropdownOpen(true); }}
                      onFocus={() => { setTidSearch(''); setTidDropdownOpen(true); }}
                      onBlur={() => setTimeout(() => setTidDropdownOpen(false), 150)}
                      placeholder="搜索分区，如：科技 / 计算机"
                      style={inputStyle}
                      autoComplete="off"
                    />
                    {tidDropdownOpen && (() => {
                      const q = tidSearch.toLowerCase();
                      const filtered = (BILIBILI_TIDS as readonly BilibiliTidEntry[]).filter(
                        t => !q || t.parent.includes(tidSearch) || t.name.includes(tidSearch) || String(t.tid).includes(q)
                      );
                      return filtered.length > 0 ? (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          maxHeight: '220px',
                          overflow: 'auto',
                          backgroundColor: 'var(--bg-primary)',
                          border: '1px solid var(--border-light)',
                          borderRadius: '6px',
                          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                          zIndex: 200
                        }}>
                          {filtered.map(t => (
                            <div
                              key={t.tid}
                              onMouseDown={() => {
                                handleChange('bilibili', 'defaultTid', String(t.tid));
                                setTidSearch('');
                                setTidDropdownOpen(false);
                              }}
                              style={{
                                padding: '7px 12px',
                                fontSize: '13px',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderBottom: '1px solid var(--border-light)'
                              }}
                              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-secondary)')}
                              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              <span>
                                <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>{t.parent} / </span>
                                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{t.name}</span>
                              </span>
                              <span style={{ color: 'var(--text-tertiary)', fontSize: '11px', flexShrink: 0 }}>tid: {t.tid}</span>
                            </div>
                          ))}
                        </div>
                      ) : null;
                    })()}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label style={{ ...labelStyle, marginBottom: 0 }}>固定合集分组（可选）</label>
                      <button
                        onClick={fetchSeasons}
                        disabled={fetchingSeasons}
                        style={{
                          height: '26px',
                          padding: '0 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-light)',
                          backgroundColor: 'transparent',
                          color: 'var(--text-secondary)',
                          cursor: fetchingSeasons ? 'default' : 'pointer',
                          fontSize: '12px',
                          opacity: fetchingSeasons ? 0.6 : 1
                        }}
                      >
                        {fetchingSeasons ? '获取中...' : '获取合集列表'}
                      </button>
                    </div>

                    {/* 未拉取时显示当前已配置值 */}
                    {seasons.length === 0 && !fetchingSeasons && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="number"
                          value={config.bilibili?.defaultSeasonId || ''}
                          onChange={e => handleChange('bilibili', 'defaultSeasonId', e.target.value)}
                          placeholder="点击右上角按钮获取，或手动填 section_id"
                          style={{ ...inputStyle, flex: 1 }}
                        />
                      </div>
                    )}

                    {seasonsError && (
                      <p style={{ fontSize: '12px', color: 'var(--error)', marginTop: '4px' }}>{seasonsError}</p>
                    )}

                    {/* 拉取成功后显示两级选择 */}
                    {seasons.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <select
                          value={selectedSeasonId ?? ''}
                          onChange={e => {
                            const sid = Number(e.target.value);
                            setSelectedSeasonId(sid || null);
                            // 切换合集时自动选第一个分组
                            const season = seasons.find(s => s.seasonId === sid);
                            const firstSection = season?.sections[0];
                            if (firstSection) {
                              handleChange('bilibili', 'defaultSeasonId', String(firstSection.sectionId));
                            }
                          }}
                          style={inputStyle}
                        >
                          <option value="">— 选择合集 —</option>
                          {seasons.map(s => (
                            <option key={s.seasonId} value={s.seasonId}>{s.seasonName}</option>
                          ))}
                        </select>

                        {selectedSeasonId != null && (() => {
                          const secs = seasons.find(s => s.seasonId === selectedSeasonId)?.sections ?? [];
                          return secs.length > 1 ? (
                            <select
                              value={config.bilibili?.defaultSeasonId ?? ''}
                              onChange={e => handleChange('bilibili', 'defaultSeasonId', e.target.value)}
                              style={inputStyle}
                            >
                              <option value="">— 选择分组 —</option>
                              {secs.map(sec => (
                                <option key={sec.sectionId} value={sec.sectionId}>
                                  {sec.sectionName}（section_id: {sec.sectionId}）
                                </option>
                              ))}
                            </select>
                          ) : null;
                        })()}

                        {config.bilibili?.defaultSeasonId && (
                          <p style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                            已选 section_id: {config.bilibili.defaultSeasonId}
                          </p>
                        )}
                      </div>
                    )}

                    <p style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px' }}>留空则只投稿，不自动加入合集分组</p>
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

                  {/* 高级选项 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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

                  {/* 简洁的说明链接 */}
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                    需先安装 <code style={{ padding: '1px 4px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '2px' }}>biliup</code> 和 <code style={{ padding: '1px 4px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '2px' }}>ffmpeg</code>
                    （安装后请重启应用），
                    <a
                      href="#"
                      onClick={(e) => { e.preventDefault(); window.electron.openExternal('https://github.com/AniBullet/NotionSyncOne/blob/main/docs/BILIBILI_GUIDE.md'); }}
                      style={{ color: 'var(--primary-green)', textDecoration: 'none', marginLeft: '4px' }}
                    >
                      查看详细说明
                    </a>
                  </div>

                  <div>
                    <label style={labelStyle}>简介模板（可选）</label>
                    <textarea
                      value={config.bilibili?.descTemplate || ''}
                      onChange={e => handleChange('bilibili', 'descTemplate', e.target.value)}
                      placeholder="支持变量：{title} {url} {date} {from} {author} {engine} {rate} {tags}&#10;&#10;推荐格式示例：&#10;━━━━━━━━━━━━━━━&#10;来源平台：{from}&#10;原作者：{author}&#10;引擎：{engine}&#10;个人期待值：{rate}&#10;标签：{tags}&#10;━━━━━━━━━━━━━━━&#10;原文：{url}&#10;日期：{date}"
                      style={{ ...inputStyle, minHeight: '180px', resize: 'vertical' }}
                    />
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                      支持8个变量；建议用 ━ 这类分隔线
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                      {['{title}', '{url}', '{date}', '{from}', '{author}', '{engine}', '{rate}', '{tags}'].map(token => (
                        <code key={token} style={{ padding: '3px 6px', borderRadius: '6px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: '11px' }}>
                          {token}
                        </code>
                      ))}
                    </div>
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
                    {updateInfo.hasUpdate ? `新版本 v${updateInfo.latest}` : updateInfo.latest ? '已是最新版本' : '点击检查更新'}
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
                    {message.text}
                  </div>
                )}
              </div>

              {/* 链接 */}
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                <a style={linkStyle} onClick={() => window.electron.openExternal(GITHUB_REPO)}>GitHub</a>
                <a style={linkStyle} onClick={() => window.electron.openExternal(`${GITHUB_REPO}/issues`)}>反馈问题</a>
                <a style={linkStyle} onClick={() => window.electron.openExternal(`${GITHUB_REPO}/releases`)}>更新日志</a>
              </div>

              {/* 安全与隐私 */}
              <div style={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '8px', padding: '14px 16px' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>安全与隐私</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <span style={{ color: '#22C55E', minWidth: '14px' }}></span>
                    <span>系统级加密：敏感配置使用 DPAPI 加密，只有当前用户在当前电脑上才能解密</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <span style={{ color: '#22C55E', minWidth: '14px' }}></span>
                    <span>本地存储：所有数据仅存储在本地，不上传到云端</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <span style={{ color: '#22C55E', minWidth: '14px' }}></span>
                    <span>开源透明：源代码公开可审计，无后门和追踪</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginTop: '4px' }}>
                    <span style={{ color: '#F59E0B', minWidth: '14px' }}></span>
                    <span>不要在公共电脑使用，不要分享配置文件</span>
                  </div>
                </div>
                
                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                  <a 
                    style={{ ...linkStyle, fontSize: '11px' }} 
                    onClick={() => window.electron.openExternal(`${GITHUB_REPO}/blob/main/docs/SECURITY.md`)}
                  >
                    查看完整安全说明
                  </a>
                </div>
              </div>

              {/* 作者 */}
              <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-tertiary)', margin: 0 }}>
                Made by Bullet.S
              </p>
            </div>
          )}
          </div>
        </div>

        {/* 底部 - 仅在配置页显示 */}
        </div>

        {activeTab !== 'about' && (
          <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', backgroundColor: 'var(--bg-primary)' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <button type="button" onClick={onClose} style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border-medium)', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' }}>
                取消
              </button>
              <button type="button" onClick={handleSave} disabled={loading} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--primary-green)', color: '#fff', fontSize: '13px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                {loading ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsModal;
