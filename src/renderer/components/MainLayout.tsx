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
import {
  getPlatformReadiness,
  getSyncActionState,
  getSyncTargetDisplay,
  PlatformReadiness,
  WorkbenchReadiness
} from '../utils/workbenchStatus';
import {
  collectSyncFailures,
  getSyncFailureGuidance,
  PLATFORM_COLORS
} from '../utils/syncPresentation';
import type { SyncFailureDetail, SyncPlatform } from '../utils/syncPresentation';

import iconUrl from '/icon.png';

const EMPTY_READINESS = getPlatformReadiness({
  notion: { apiKey: '', databaseId: '' },
  wechat: { appId: '', appSecret: '' }
});

const dragRegionStyle = { WebkitAppRegion: 'drag' } as React.CSSProperties & { WebkitAppRegion: 'drag' };
const noDragRegionStyle = { WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion: 'no-drag' };

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
  const [platformReadiness, setPlatformReadiness] = useState<WorkbenchReadiness>(EMPTY_READINESS);
  const [openSyncMenu, setOpenSyncMenu] = useState<SyncTarget | null>(null);
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
  const [showSyncFailures, setShowSyncFailures] = useState(false);

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
      const phaseText = progressData.phase === 'downloading' ? '下载视频' : '上传到 B站';
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
      const readiness = getPlatformReadiness(config);
      setPlatformReadiness(readiness);
      setHasWordPressConfig(readiness.wordpress.configured);
      setHasBilibiliConfig(readiness.bilibili.configured);
      
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

    const actionState = getSyncActionState(target, platformReadiness, selectedArticles.size);
    if (actionState.disabled) {
      setStatusMessage(actionState.reason);
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

  const markSyncFailed = (articleId: string, platform: SyncPlatform, error: string) => {
    const nextState: SyncState = {
      articleId: platform === 'wechat' ? articleId : `${platform === 'wordpress' ? 'wp' : 'bili'}_${articleId}`,
      status: SyncStatus.FAILED,
      error
    };

    if (platform === 'wechat') {
      setSyncStates(prev => ({ ...prev, [articleId]: nextState }));
    } else if (platform === 'wordpress') {
      setWpSyncStates(prev => ({ ...prev, [articleId]: nextState }));
    } else {
      setBiliSyncStates(prev => ({ ...prev, [articleId]: nextState }));
    }
  };

  const markTargetFailed = (articleId: string, target: SyncTarget, error: string) => {
    if (target === 'wechat' || target === 'both') markSyncFailed(articleId, 'wechat', error);
    if (target === 'wordpress' || target === 'both') markSyncFailed(articleId, 'wordpress', error);
    if (target === 'bilibili') markSyncFailed(articleId, 'bilibili', error);
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
          setStatusMessage(`正在同步 B站 [${i + 1}/${total}]: ${title}`);
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
              setStatusMessage(`B站同步成功 [${i + 1}/${total}]: ${title}`);
            } else {
              failCount++;
              setStatusMessage(`B站同步失败 [${i + 1}/${total}]: ${state.error || '未知错误'}`);
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
            setStatusMessage(`B站同步失败 [${i + 1}/${total}]: ${errorMsg}`);
            setShowSyncFailures(true);
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
        const errorMsg = error instanceof Error ? error.message : '同步失败';
        markTargetFailed(articleId, target, errorMsg);
        setStatusMessage(`同步失败 [${i + 1}/${total}]: ${errorMsg}`);
        setShowSyncFailures(true);
        console.error(`同步文章 ${articleId} 失败:`, error);
      }
    }

    const result = failCount === 0 
      ? `全部成功，已同步 ${successCount} 篇文章`
      : `部分失败：成功 ${successCount} 篇，失败 ${failCount} 篇，点“查看原因”看详情`;
    setStatusMessage(result);
    setShowSyncFailures(failCount > 0);
    await IpcService.showNotification('同步完成', result);
    
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
  const syncFailures = collectSyncFailures(articles, syncStates, wpSyncStates, biliSyncStates);

  const openSettingsTab = (tab: 'notion' | 'wechat' | 'wordpress' | 'bilibili' | 'about') => {
    setSettingsTab(tab);
    setShowSettings(true);
  };

  const retryFailureAsDraft = async (failure: SyncFailureDetail) => {
    setShowSyncFailures(false);
    await doMultiSync([failure.articleId], failure.platform, 'draft');
  };

  const renderReadinessChip = (platform: PlatformReadiness) => {
    const available = platform.configured;
    return (
      <button
        key={platform.key}
        onClick={() => !available && openSettingsTab(platform.settingsTab)}
        aria-label={`${platform.label}: ${platform.summary}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '18px',
          height: '28px',
          padding: 0,
          borderRadius: '999px',
          border: 'none',
          backgroundColor: 'transparent',
          color: available ? platform.accentColor : 'var(--text-secondary)',
          cursor: available ? 'default' : 'pointer'
        }}
        title={available ? `${platform.label}: ${platform.summary}` : `${platform.label}: ${platform.summary}，点击打开设置`}
      >
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: available ? platform.accentColor : 'var(--warning)',
          boxShadow: available ? `0 0 0 3px ${platform.accentColor}18` : '0 0 0 3px rgba(252, 211, 77, 0.16)'
        }} />
      </button>
    );
  };

  const renderSyncAction = (target: SyncTarget) => {
    const platform = platformReadiness[target];
    const actionState = getSyncActionState(target, platformReadiness, selectedArticles.size);
    const disabled = actionState.disabled;
    const isOpen = openSyncMenu === target;
    const accent = platform.accentColor;
    const publishText = target === 'bilibili' ? '投稿' : '发布';
    const display = getSyncTargetDisplay(target);

    return (
      <div key={target} style={{ position: 'relative', display: 'inline-block' }}>
        <button
          disabled={disabled}
          onClick={() => setOpenSyncMenu(prev => prev === target ? null : target)}
          aria-label={display.ariaLabel}
          style={{
            minWidth: target === 'wordpress' ? '44px' : '52px',
            height: '36px',
            padding: '0 10px',
            borderRadius: '8px',
            border: disabled ? '1px solid var(--border-light)' : `1px solid ${accent}66`,
            backgroundColor: disabled ? 'var(--bg-tertiary)' : `${accent}18`,
            color: disabled ? 'var(--text-tertiary)' : accent,
            fontSize: '12px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontWeight: 800,
            opacity: disabled ? 0.62 : 1
          }}
          title={actionState.reason || display.ariaLabel}
        >
          {display.compactLabel}
        </button>
        {isOpen && !disabled && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '6px',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-light)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            zIndex: 100,
            overflow: 'hidden',
            minWidth: '112px'
          }}>
            <button
              onClick={() => { setOpenSyncMenu(null); handlePlatformSync(target, 'draft'); }}
              style={{ display: 'block', width: '100%', padding: '9px 12px', border: 'none', backgroundColor: 'transparent', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              保存草稿
            </button>
            <button
              onClick={() => { setOpenSyncMenu(null); handlePlatformSync(target, 'publish'); }}
              style={{ display: 'block', width: '100%', padding: '9px 12px', border: 'none', backgroundColor: 'transparent', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {publishText}
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderFailurePanel = (failures: SyncFailureDetail[]) => {
    const actionButtonStyle: React.CSSProperties = {
      height: '32px',
      padding: '0 10px',
      borderRadius: '8px',
      fontSize: '12px',
      fontWeight: 700,
      cursor: 'pointer'
    };

    return (
      <section
        role="dialog"
        aria-label="同步失败原因"
        style={{
          position: 'absolute',
          right: '20px',
          bottom: '48px',
          width: 'min(620px, calc(100% - 40px))',
          maxHeight: '360px',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-primary)',
          border: '1px solid var(--border-light)',
          borderRadius: '8px',
          boxShadow: '0 16px 42px rgba(0,0,0,0.22)',
          zIndex: 90
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 14px',
          borderBottom: '1px solid var(--border-light)'
        }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>同步失败处理</div>
            <div style={{ marginTop: '2px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
              {failures.length} 个任务需要处理
            </div>
          </div>
          <button
            onClick={() => setShowSyncFailures(false)}
            aria-label="关闭失败原因"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: '1px solid var(--border-light)',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '16px'
            }}
            title="关闭"
          >
            ×
          </button>
        </div>
        <div style={{ maxHeight: '294px', overflow: 'auto', padding: '8px' }}>
          {failures.map((failure, index) => {
            const readiness = platformReadiness[failure.platform];
            const guidance = getSyncFailureGuidance(failure.platform, failure.error, readiness);
            const accent = PLATFORM_COLORS[failure.platform];

            return (
              <div
                key={`${failure.articleId}-${failure.platform}-${index}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '92px 1fr',
                  gap: '10px',
                  padding: '10px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-secondary)',
                  marginBottom: index === failures.length - 1 ? 0 : '8px'
                }}
              >
                <span style={{
                  alignSelf: 'start',
                  justifySelf: 'start',
                  padding: '3px 8px',
                  borderRadius: '999px',
                  backgroundColor: `${accent}18`,
                  color: accent,
                  fontSize: '12px',
                  fontWeight: 700
                }}>
                  {failure.platformLabel}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div
                    title={failure.title}
                    style={{
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {failure.title}
                  </div>
                  <div style={{ marginTop: '5px', color: 'var(--error)', fontSize: '12px', lineHeight: 1.45 }}>
                    {failure.error}
                  </div>
                  <div style={{ marginTop: '8px', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 700 }}>
                    {guidance.primaryText}
                  </div>
                  <div style={{ marginTop: '3px', color: 'var(--text-tertiary)', fontSize: '12px', lineHeight: 1.45 }}>
                    {guidance.secondaryText}
                  </div>
                  <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => retryFailureAsDraft(failure)}
                      aria-label={`重试 ${failure.platformLabel}：${failure.title}`}
                      style={{
                        ...actionButtonStyle,
                        border: `1px solid ${accent}66`,
                        backgroundColor: `${accent}18`,
                        color: accent
                      }}
                    >
                      {guidance.retryLabel}
                    </button>
                    <button
                      onClick={() => openSettingsTab(failure.platform)}
                      aria-label={`打开 ${failure.platformLabel} 设置`}
                      style={{
                        ...actionButtonStyle,
                        border: guidance.intent === 'settings' ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--border-light)',
                        backgroundColor: guidance.intent === 'settings' ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                        color: guidance.intent === 'settings' ? 'var(--error)' : 'var(--text-secondary)'
                      }}
                    >
                      {guidance.settingsLabel}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  const renderWindowControls = () => {
    const baseButtonStyle: React.CSSProperties = {
      ...noDragRegionStyle,
      width: '34px',
      height: '34px',
      padding: 0,
      borderRadius: '8px',
      border: '1px solid transparent',
      backgroundColor: 'transparent',
      color: 'var(--text-secondary)',
      cursor: 'pointer',
      fontSize: '14px',
      lineHeight: 1,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background-color 120ms ease, color 120ms ease, border-color 120ms ease'
    };

    const setHover = (element: HTMLButtonElement, danger = false) => {
      element.style.backgroundColor = danger ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-secondary)';
      element.style.color = danger ? 'var(--error)' : 'var(--text-primary)';
      element.style.borderColor = danger ? 'rgba(239, 68, 68, 0.24)' : 'var(--border-light)';
    };

    const clearHover = (element: HTMLButtonElement) => {
      element.style.backgroundColor = 'transparent';
      element.style.color = 'var(--text-secondary)';
      element.style.borderColor = 'transparent';
    };

    return (
      <div style={{ ...noDragRegionStyle, display: 'flex', alignItems: 'center', gap: '2px', marginLeft: '4px' }}>
        <button
          onClick={() => window.electron.minimizeWindow()}
          aria-label="最小化窗口"
          title="最小化"
          style={baseButtonStyle}
          onMouseEnter={event => setHover(event.currentTarget)}
          onMouseLeave={event => clearHover(event.currentTarget)}
        >
          −
        </button>
        <button
          onClick={() => window.electron.toggleMaximizeWindow()}
          aria-label="最大化或还原窗口"
          title="最大化/还原"
          style={baseButtonStyle}
          onMouseEnter={event => setHover(event.currentTarget)}
          onMouseLeave={event => clearHover(event.currentTarget)}
        >
          □
        </button>
        <button
          onClick={() => window.electron.closeWindow()}
          aria-label="关闭窗口"
          title="关闭"
          style={baseButtonStyle}
          onMouseEnter={event => setHover(event.currentTarget, true)}
          onMouseLeave={event => clearHover(event.currentTarget)}
        >
          ×
        </button>
      </div>
    );
  };

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: 'var(--bg-secondary)',
      position: 'relative'
    }}>
      {/* 顶部导航栏 */}
      <header style={{ 
        ...dragRegionStyle,
        backgroundColor: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-light)',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        {/* 左侧：Logo 和统计 */}
        <div style={{ ...noDragRegionStyle, display: 'flex', alignItems: 'center', gap: '16px' }}>
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
                微信 {wechatSynced}
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
                WP {wpSynced}
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
                B站 {biliSynced}
              </span>
            )}
          </div>
        </div>
        
        {/* 右侧：平台按钮 + 刷新 + 设置 + 主题 */}
        <div style={{ ...noDragRegionStyle, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginRight: '12px',
            paddingRight: '12px',
            borderRight: '1px solid var(--border-light)'
          }}>
            <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
              {renderReadinessChip(platformReadiness.wechat)}
              {renderReadinessChip(platformReadiness.wordpress)}
              {renderReadinessChip(platformReadiness.bilibili)}
            </div>
            <div style={{ width: '1px', height: '22px', backgroundColor: 'var(--border-light)' }} />
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {(['wechat', 'wordpress', 'bilibili', 'both'] as SyncTarget[]).map(renderSyncAction)}
            </div>
          </div>

          <button
            onClick={() => loadData(true)}
            disabled={loading || refreshing}
            style={{
              width: '36px',
              height: '36px',
              padding: 0,
              borderRadius: '8px',
              border: '1px solid var(--border-medium)',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '15px',
              cursor: (loading || refreshing) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title={refreshing ? '\u5237\u65b0\u4e2d' : loading ? '\u52a0\u8f7d\u4e2d' : '\u5237\u65b0\u6587\u7ae0'}
            aria-label={refreshing ? '\u5237\u65b0\u4e2d' : loading ? '\u52a0\u8f7d\u4e2d' : '\u5237\u65b0\u6587\u7ae0'}
          >
            {String.fromCharCode(8635)}
          </button>
          
          <button
            onClick={() => setShowSettings(true)}
            style={{
              width: '36px',
              height: '36px',
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
            title={'\u8bbe\u7f6e'}
            aria-label={'\u6253\u5f00\u8bbe\u7f6e'}
          >
            {String.fromCharCode(9881)}
          </button>
          
          <ThemeToggle />
          {renderWindowControls()}
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
          onShowSyncFailure={() => setShowSyncFailures(true)}
        />
      </main>

      {showSyncFailures && syncFailures.length > 0 && renderFailurePanel(syncFailures)}

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
          {syncFailures.length > 0 && (
            <button
              onClick={() => setShowSyncFailures(prev => !prev)}
              style={{
                height: '28px',
                padding: '0 10px',
                borderRadius: '8px',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                color: 'var(--error)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 700
              }}
              aria-label={`查看 ${syncFailures.length} 个同步失败原因`}
              title="查看同步失败原因"
            >
              查看原因 {syncFailures.length}
            </button>
          )}
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
