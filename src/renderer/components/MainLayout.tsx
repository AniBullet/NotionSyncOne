import React, { useState, useEffect } from 'react';
import { NotionPage } from '../../shared/types/notion';
import { SyncState, SyncStatus } from '../../shared/types/sync';
import { BilibiliMetadata } from '../../shared/types/bilibili';
import { IpcService } from '../../shared/services/IpcService';
import { APP_VERSION } from '../../shared/constants';
import ArticleGrid from './ArticleGrid';
import SettingsModal from './SettingsModal';
import ConfirmDialog from './ConfirmDialog';
import ThemeToggle from './ThemeToggle';
import { SyncTarget } from './SyncButton';

import iconUrl from '/icon.png';

// 本地缓存 key
const CACHE_KEY = 'notionsyncone_articles_cache';
// 从 localStorage 读取缓存
const loadCachedArticles = (): NotionPage[] => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.error('读取缓存失败:', e);
  }
  return [];
};

// 保存到 localStorage
const saveCachedArticles = (articles: NotionPage[]) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(articles));
  } catch (e) {
    console.error('保存缓存失败:', e);
  }
};

const MainLayout: React.FC = () => {
  // 从缓存初始化文章列表（瞬间显示）
  const [articles, setArticles] = useState<NotionPage[]>(() => loadCachedArticles());
  const [syncStates, setSyncStates] = useState<Record<string, SyncState>>({});
  const [wpSyncStates, setWpSyncStates] = useState<Record<string, SyncState>>({});
  const [biliSyncStates, setBiliSyncStates] = useState<Record<string, SyncState>>({});
  const [biliProgress, setBiliProgress] = useState<Record<string, { phase: string; progress: number }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // 新增：后台刷新状态
  const [error, setError] = useState<string | null>(null);
  const [hasWordPressConfig, setHasWordPressConfig] = useState(false);
  const [hasBilibiliConfig, setHasBilibiliConfig] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'notion' | 'wechat' | 'wordpress' | 'bilibili' | 'about'>('notion');
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [hasUpdate, setHasUpdate] = useState(false);
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const [statusMessage, setStatusMessage] = useState<string>('就绪');

  useEffect(() => {
    loadData();
    checkUpdate();
    
    // 监听B站同步进度
    const handleProgress = (data: unknown) => {
      const progressData = data as { phase: string; progress: number; title: string; articleId?: string };
      // 防御性检查：确保 data 存在且有必要字段
      if (!progressData || progressData.phase === undefined || progressData.progress === undefined) {
        return;
      }
      
      // 更新状态栏消息
      const phaseText = progressData.phase === 'downloading' ? '📥 下载视频' : '📤 上传到B站';
      setStatusMessage(`${phaseText}: ${progressData.progress.toFixed(1)}%`);
      
      // 更新文章卡片进度
      if (progressData.articleId) {
        if (progressData.progress >= 100) {
          // 完成后延迟清除进度
          setTimeout(() => {
            setBiliProgress(prev => {
              const newProgress = { ...prev };
              delete newProgress[progressData.articleId!];
              return newProgress;
            });
          }, 500);
        } else {
          setBiliProgress(prev => ({
            ...prev,
            [progressData.articleId!]: { phase: progressData.phase, progress: progressData.progress }
          }));
        }
      }
    };
    
    window.electron.ipcRenderer.on('bilibili-sync-progress', handleProgress);
    
    return () => {
      window.electron.ipcRenderer.removeListener('bilibili-sync-progress', handleProgress);
    };
    // 初始加载只需要注册一次，刷新动作由按钮显式触发。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkUpdate = async () => {
    try {
      const res = await fetch('https://api.github.com/repos/AniBullet/NotionSyncOne/releases/latest');
      if (res.ok) {
        const data = await res.json();
        const latestVersion = data.tag_name?.replace(/^v/, '') || '';
        if (latestVersion && compareVersion(latestVersion, APP_VERSION) > 0) {
          setHasUpdate(true);
        }
      }
    } catch {
      // 静默失败
    }
  };

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

  /**
   * 加载数据
   * @param forceRefresh 是否强制刷新（跳过缓存）
   */
  const loadData = async (forceRefresh: boolean = false) => {
    const hasCachedData = articles.length > 0;
    
    try {
      // 如果有缓存数据，只显示后台刷新状态，不显示全屏 loading
      if (hasCachedData) {
        setRefreshing(true);
        setStatusMessage('后台刷新中...');
      } else {
        setLoading(true);
        setStatusMessage('正在加载文章...');
      }
      setError(null);
      
      const [pages, states, config] = await Promise.all([
        IpcService.getNotionPages(forceRefresh),
        window.electron.ipcRenderer.invoke('get-all-sync-states'),
        IpcService.getConfig()
      ]);
      
      // 更新文章并保存到本地缓存
      setArticles(pages);
      saveCachedArticles(pages);
      
      // 分离各平台状态
      const wechatStates: Record<string, SyncState> = {};
      const wpStates: Record<string, SyncState> = {};
      const biliStates: Record<string, SyncState> = {};
      Object.entries(states || {}).forEach(([key, state]) => {
        if (key.startsWith('wp_')) {
          wpStates[key.replace('wp_', '')] = state as SyncState;
        } else if (key.startsWith('bili_')) {
          biliStates[key.replace('bili_', '')] = state as SyncState;
        } else {
          wechatStates[key] = state as SyncState;
        }
      });
      setSyncStates(wechatStates);
      setWpSyncStates(wpStates);
      setBiliSyncStates(biliStates);
      
      // 检查配置
      const hasWp = !!(config.wordpress?.siteUrl && config.wordpress?.username && config.wordpress?.appPassword);
      const hasBili = !!(config.bilibili?.enabled);
      setHasWordPressConfig(hasWp);
      setHasBilibiliConfig(hasBili);
      
      setStatusMessage(`已加载 ${pages.length} 篇文章`);
    } catch (err) {
      console.error('加载数据失败:', err);
      const errMsg = err instanceof Error ? err.message : '加载失败';
      // 如果有缓存数据，错误只显示在状态栏，不影响UI
      if (!hasCachedData) {
        setError(errMsg);
      }
      setStatusMessage(`刷新失败: ${errMsg}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handlePlatformSync = async (target: SyncTarget, mode: 'publish' | 'draft') => {
    if (selectedArticles.size === 0) {
      setStatusMessage('请先选择文章');
      return;
    }

    const targetText = target === 'wechat' ? '微信' : target === 'wordpress' ? 'WordPress' : target === 'bilibili' ? 'B站' : '全部平台';
    const modeText = mode === 'draft' ? '草稿' : '发布';
    const titles = Array.from(selectedArticles).map(id => articles.find(a => a.id === id)?.title || id).slice(0, 3);
    const more = selectedArticles.size > 3 ? `...等 ${selectedArticles.size} 篇` : '';

    setConfirmDialog({
      isOpen: true,
      title: '确认同步',
      message: `将以下文章同步到${targetText}（${modeText}）？\n\n${titles.join('\n')}${more}`,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        await doMultiSync(Array.from(selectedArticles), target, mode);
      }
    });
  };

  const doMultiSync = async (articleIds: string[], target: SyncTarget, mode: 'publish' | 'draft') => {
    let successCount = 0;
    let failCount = 0;
    const total = articleIds.length;

    for (let i = 0; i < articleIds.length; i++) {
      const articleId = articleIds[i];
      const article = articles.find(a => a.id === articleId);
      const title = article?.title || articleId;
      
      try {
        setStatusMessage(`正在同步 ${i + 1}/${total}: ${title}`);
        
        if (target === 'wechat' || target === 'both') {
          setSyncStates(prev => ({ ...prev, [articleId]: { articleId, status: SyncStatus.SYNCING } }));
          const state = await IpcService.syncArticle(articleId, mode);
          setSyncStates(prev => ({ ...prev, [articleId]: state }));
          if (state.status === SyncStatus.SUCCESS) successCount++;
          else failCount++;
        }
        
        if (target === 'wordpress' || target === 'both') {
          setWpSyncStates(prev => ({ ...prev, [articleId]: { articleId: `wp_${articleId}`, status: SyncStatus.SYNCING } }));
          const state = await IpcService.syncToWordPress(articleId, mode);
          setWpSyncStates(prev => ({ ...prev, [articleId]: state }));
          if (state.status === SyncStatus.SUCCESS) successCount++;
          else failCount++;
        }

        if (target === 'bilibili') {
          setStatusMessage(`📹 正在同步 [${i + 1}/${total}]: ${title}`);
          setBiliSyncStates(prev => ({ ...prev, [articleId]: { articleId: `bili_${articleId}`, status: SyncStatus.SYNCING } }));
          
          // 调用B站同步服务
          try {
            const metadata: BilibiliMetadata = {
              title: title,
              // desc 不在这里设置，让后端根据 descTemplate 配置自动生成
              // 使用默认配置
              tid: undefined,  // 将使用配置中的 defaultTid
              tags: []  // 将使用配置中的 defaultTags
            };
            
            const state = await IpcService.syncToBilibili(articleId, metadata, mode, true);
            
            setBiliSyncStates(prev => ({ ...prev, [articleId]: state }));
            
            if (state.status === SyncStatus.SUCCESS) {
              successCount++;
              setStatusMessage(`✅ B站同步成功 [${i + 1}/${total}]: ${title}`);
            } else {
              failCount++;
              setStatusMessage(`⚠️ B站同步失败 [${i + 1}/${total}]: ${state.error || '未知错误'}`);
            }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'B站同步失败';
            
            setBiliSyncStates(prev => ({ 
              ...prev, 
              [articleId]: { 
                articleId: `bili_${articleId}`, 
                status: SyncStatus.FAILED,
                error: errorMsg 
              } 
            }));
            failCount++;
            setStatusMessage(`❌ B站同步失败 [${i + 1}/${total}]: ${errorMsg}`);
          }
        }
        
        if (target === 'both') {
          // 同时同步微信和WordPress
          const states = await IpcService.syncToBoth(articleId, mode, mode);
          setSyncStates(prev => ({ ...prev, [articleId]: states.wechat }));
          setWpSyncStates(prev => ({ ...prev, [articleId]: states.wordpress }));
        }
      } catch (error) {
        failCount++;
        console.error(`同步文章 ${articleId} 失败:`, error);
      }
    }

    const result = failCount === 0 
      ? `✅ 全部成功！已同步 ${successCount} 篇文章` 
      : `⚠️ 部分失败：成功 ${successCount} 篇，失败 ${failCount} 篇`;
    setStatusMessage(result);
    await IpcService.showNotification('同步完成', result.replace(/[✅⚠]/gu, '').replace(/\uFE0F/g, '').trim());
    
    // 清空选择
    setSelectedArticles(new Set());
  };

  const handleToggleArticle = (id: string) => {
    setSelectedArticles(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 统计
  const wechatSynced = Object.values(syncStates).filter(s => s.status === SyncStatus.SUCCESS).length;
  const wpSynced = Object.values(wpSyncStates).filter(s => s.status === SyncStatus.SUCCESS).length;
  const biliSynced = Object.values(biliSyncStates).filter(s => s.status === SyncStatus.SUCCESS).length;

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: 'var(--bg-secondary)'
    }}>
      {/* 顶部导航栏 */}
      <header style={{ 
        backgroundColor: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-light)',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        {/* 左侧：Logo 和统计 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src={iconUrl} alt="NotionSyncOne" style={{ width: '26px', height: '26px', borderRadius: '6px' }} />
            <span style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>NotionSyncOne</span>
            {hasUpdate && (
              <span
                onClick={() => {
                  setSettingsTab('about');
                  setShowSettings(true);
                }}
                style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  backgroundColor: '#10B981',
                  color: '#fff',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
                title="点击查看更新"
              >
                有新版本
              </span>
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
              {articles.length} 篇文章
            </span>
            {wechatSynced > 0 && (
              <span style={{ 
                fontSize: '11px', 
                padding: '2px 8px', 
                borderRadius: '10px',
                backgroundColor: 'rgba(7, 193, 96, 0.15)',
                color: '#07C160'
              }}>
                💬 {wechatSynced}
              </span>
            )}
            {wpSynced > 0 && (
              <span style={{ 
                fontSize: '11px', 
                padding: '2px 8px', 
                borderRadius: '10px',
                backgroundColor: 'rgba(33, 117, 155, 0.15)',
                color: '#21759B'
              }}>
                🌐 {wpSynced}
              </span>
            )}
            {biliSynced > 0 && (
              <span style={{ 
                fontSize: '11px', 
                padding: '2px 8px', 
                borderRadius: '10px',
                backgroundColor: 'rgba(251, 114, 153, 0.15)',
                color: '#FB7299'
              }}>
                📹 {biliSynced}
              </span>
            )}
          </div>
        </div>
        
        {/* 右侧：平台按钮 + 刷新 + 设置 + 主题 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* 平台同步按钮组 - 始终显示 */}
          <div style={{ 
            display: 'flex', 
            gap: '6px', 
            marginRight: '12px',
            paddingRight: '12px',
            borderRight: '1px solid var(--border-light)'
          }}>
            {/* 微信按钮 */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button
                disabled={selectedArticles.size === 0}
                onClick={() => {
                  if (selectedArticles.size === 0) return;
                  const menu = document.getElementById('wechat-menu');
                  if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: selectedArticles.size > 0 ? '1px solid rgba(7, 193, 96, 0.3)' : '1px solid var(--border-light)',
                  backgroundColor: selectedArticles.size > 0 ? 'rgba(7, 193, 96, 0.1)' : 'var(--bg-tertiary)',
                  color: selectedArticles.size > 0 ? '#07C160' : 'var(--text-tertiary)',
                  fontSize: '12px',
                  cursor: selectedArticles.size > 0 ? 'pointer' : 'not-allowed',
                  fontWeight: '500',
                  opacity: selectedArticles.size > 0 ? 1 : 0.5
                }}
              >
                💬 微信
              </button>
                <div id="wechat-menu" style={{ 
                  display: 'none', 
                  position: 'absolute', 
                  top: '100%', 
                  left: 0, 
                  marginTop: '4px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '6px',
                  boxShadow: '0 3px 12px rgba(0,0,0,0.12)',
                  zIndex: 100,
                  overflow: 'hidden',
                  minWidth: '90px'
                }}>
                  <button 
                    onClick={() => { document.getElementById('wechat-menu')!.style.display = 'none'; handlePlatformSync('wechat', 'draft'); }}
                    style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', backgroundColor: 'transparent', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    存草稿
                  </button>
                  <button 
                    onClick={() => { document.getElementById('wechat-menu')!.style.display = 'none'; handlePlatformSync('wechat', 'publish'); }}
                    style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', backgroundColor: 'transparent', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    发布
                  </button>
                </div>
              </div>

            {/* WordPress按钮 */}
            {hasWordPressConfig && (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <button
                  disabled={selectedArticles.size === 0}
                  onClick={() => {
                    if (selectedArticles.size === 0) return;
                    const menu = document.getElementById('wp-menu');
                    if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: selectedArticles.size > 0 ? '1px solid rgba(33, 117, 155, 0.3)' : '1px solid var(--border-light)',
                    backgroundColor: selectedArticles.size > 0 ? 'rgba(33, 117, 155, 0.1)' : 'var(--bg-tertiary)',
                    color: selectedArticles.size > 0 ? '#21759B' : 'var(--text-tertiary)',
                    fontSize: '12px',
                    cursor: selectedArticles.size > 0 ? 'pointer' : 'not-allowed',
                    fontWeight: '500',
                    opacity: selectedArticles.size > 0 ? 1 : 0.5
                  }}
                >
                  🌐 WP
                </button>
                  <div id="wp-menu" style={{ 
                    display: 'none', 
                    position: 'absolute', 
                    top: '100%', 
                    left: 0, 
                    marginTop: '4px',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '6px',
                    boxShadow: '0 3px 12px rgba(0,0,0,0.12)',
                    zIndex: 100,
                    overflow: 'hidden',
                    minWidth: '90px'
                  }}>
                    <button 
                      onClick={() => { document.getElementById('wp-menu')!.style.display = 'none'; handlePlatformSync('wordpress', 'draft'); }}
                      style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', backgroundColor: 'transparent', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      存草稿
                    </button>
                    <button 
                      onClick={() => { document.getElementById('wp-menu')!.style.display = 'none'; handlePlatformSync('wordpress', 'publish'); }}
                      style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', backgroundColor: 'transparent', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      发布
                    </button>
                  </div>
                </div>
              )}

            {/* B站按钮 - 始终显示，根据配置状态决定是否可用 */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button
                disabled={!hasBilibiliConfig || selectedArticles.size === 0}
                onClick={() => {
                  if (!hasBilibiliConfig || selectedArticles.size === 0) return;
                  const menu = document.getElementById('bili-menu');
                  if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: (hasBilibiliConfig && selectedArticles.size > 0) ? '1px solid rgba(251, 114, 153, 0.3)' : '1px solid var(--border-light)',
                  backgroundColor: (hasBilibiliConfig && selectedArticles.size > 0) ? 'rgba(251, 114, 153, 0.1)' : 'var(--bg-tertiary)',
                  color: (hasBilibiliConfig && selectedArticles.size > 0) ? '#FB7299' : 'var(--text-tertiary)',
                  fontSize: '12px',
                  cursor: (hasBilibiliConfig && selectedArticles.size > 0) ? 'pointer' : 'not-allowed',
                  fontWeight: '500',
                  opacity: (hasBilibiliConfig && selectedArticles.size > 0) ? 1 : 0.5
                }}
                title={!hasBilibiliConfig ? '请先在设置中启用B站功能' : ''}
              >
                📹 B站
              </button>
              <div id="bili-menu" style={{ 
                display: 'none', 
                position: 'absolute', 
                top: '100%', 
                left: 0, 
                marginTop: '4px',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-light)',
                borderRadius: '6px',
                boxShadow: '0 3px 12px rgba(0,0,0,0.12)',
                zIndex: 100,
                overflow: 'hidden',
                minWidth: '90px'
              }}>
                <button 
                  onClick={() => { document.getElementById('bili-menu')!.style.display = 'none'; handlePlatformSync('bilibili', 'draft'); }}
                  style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', backgroundColor: 'transparent', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  存草稿
                </button>
                <button 
                  onClick={() => { document.getElementById('bili-menu')!.style.display = 'none'; handlePlatformSync('bilibili', 'publish'); }}
                  style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', backgroundColor: 'transparent', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  投稿
                </button>
              </div>
            </div>

            {/* 全部按钮 */}
            {hasWordPressConfig && (
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <button
                  disabled={selectedArticles.size === 0}
                  onClick={() => {
                    if (selectedArticles.size === 0) return;
                    const menu = document.getElementById('all-menu');
                    if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: selectedArticles.size > 0 ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-light)',
                    backgroundColor: selectedArticles.size > 0 ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-tertiary)',
                    color: selectedArticles.size > 0 ? '#10B981' : 'var(--text-tertiary)',
                    fontSize: '12px',
                    cursor: selectedArticles.size > 0 ? 'pointer' : 'not-allowed',
                    fontWeight: '500',
                    opacity: selectedArticles.size > 0 ? 1 : 0.5
                  }}
                >
                  ✨ 全部
                </button>
                  <div id="all-menu" style={{ 
                    display: 'none', 
                    position: 'absolute', 
                    top: '100%', 
                    left: 0, 
                    marginTop: '4px',
                    backgroundColor: 'var(--bg-primary)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '6px',
                    boxShadow: '0 3px 12px rgba(0,0,0,0.12)',
                    zIndex: 100,
                    overflow: 'hidden',
                    minWidth: '90px'
                  }}>
                    <button 
                      onClick={() => { document.getElementById('all-menu')!.style.display = 'none'; handlePlatformSync('both', 'draft'); }}
                      style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', backgroundColor: 'transparent', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      全部草稿
                    </button>
                    <button 
                      onClick={() => { document.getElementById('all-menu')!.style.display = 'none'; handlePlatformSync('both', 'publish'); }}
                      style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', backgroundColor: 'transparent', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', textAlign: 'left' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      全部发布
                    </button>
                  </div>
                </div>
              )}

          </div>

          <button
            onClick={() => loadData(true)}
            disabled={loading || refreshing}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-medium)',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              cursor: (loading || refreshing) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {(loading || refreshing) ? '🔄' : '🔄'} {refreshing ? '刷新中' : loading ? '加载中' : '刷新'}
          </button>
          
          <button
            onClick={() => setShowSettings(true)}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: '1px solid var(--border-medium)',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="设置"
          >
            ⚙️
          </button>
          
          <ThemeToggle />
        </div>
      </header>

      {/* 主内容区 */}
      <main style={{ flex: 1, overflow: 'hidden' }}>
        <ArticleGrid
          articles={articles}
          loading={loading}
          error={error}
          syncStates={syncStates}
          wpSyncStates={wpSyncStates}
          biliSyncStates={biliSyncStates}
          biliProgress={biliProgress}
          hasWordPressConfig={hasWordPressConfig}
          hasBilibiliConfig={hasBilibiliConfig}
          selectedArticles={selectedArticles}
          onToggleArticle={handleToggleArticle}
        />
      </main>

      {/* 底部状态栏 */}
      <footer style={{
        backgroundColor: 'var(--bg-primary)',
        borderTop: '1px solid var(--border-light)',
        padding: '8px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        fontSize: '12px',
        color: 'var(--text-secondary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>状态:</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{statusMessage}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {selectedArticles.size > 0 && (
            <span>已选择 <b style={{ color: 'var(--primary-green)' }}>{selectedArticles.size}</b> 篇</span>
          )}
          <span>NotionSyncOne v{APP_VERSION}</span>
        </div>
      </footer>

      {/* 设置弹窗 */}
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => { 
          setShowSettings(false); 
          setSettingsTab('notion');
          loadData(true); // 设置后强制刷新
        }}
        defaultTab={settingsTab}
      />

      {/* 确认对话框 */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        confirmText="确认"
        cancelText="取消"
      />
    </div>
  );
};

export default MainLayout;
