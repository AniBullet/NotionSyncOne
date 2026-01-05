import React, { useState, useEffect } from 'react';
import { NotionPage } from '../../shared/types/notion';
import { SyncState, SyncStatus } from '../../shared/types/sync';
import { IpcService } from '../../shared/services/IpcService';
import ArticleGrid from './ArticleGrid';
import SettingsModal from './SettingsModal';
import ConfirmDialog from './ConfirmDialog';
import ThemeToggle from './ThemeToggle';
import { SyncTarget } from './SyncButton';

import iconUrl from '/icon.png';

const MainLayout: React.FC = () => {
  const [articles, setArticles] = useState<NotionPage[]>([]);
  const [syncStates, setSyncStates] = useState<Record<string, SyncState>>({});
  const [wpSyncStates, setWpSyncStates] = useState<Record<string, SyncState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasWordPressConfig, setHasWordPressConfig] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'notion' | 'wechat' | 'wordpress' | 'about'>('notion');
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    loadData();
    checkUpdate();
  }, []);

  const checkUpdate = async () => {
    try {
      // 读取当前版本
      const pkg = await fetch('/package.json').then(r => r.json()).catch(() => ({ version: '1.0.1' }));
      const currentVersion = pkg.version || '1.0.1';

      // 检查 GitHub 最新版本
      const res = await fetch('https://api.github.com/repos/AniBullet/NotionSyncOne/releases/latest');
      if (res.ok) {
        const data = await res.json();
        const latestVersion = data.tag_name?.replace(/^v/, '') || '';
        
        // 比较版本号：只有服务器版本更新时才提示
        if (latestVersion && compareVersion(latestVersion, currentVersion) > 0) {
          setHasUpdate(true);
        }
      }
    } catch {
      // 静默失败，不影响主功能
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

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [pages, states, config] = await Promise.all([
        IpcService.getNotionPages(),
        window.electron.ipcRenderer.invoke('get-all-sync-states'),
        IpcService.getConfig()
      ]);
      
      setArticles(pages);
      
      // 分离微信和 WordPress 状态
      const wechatStates: Record<string, SyncState> = {};
      const wpStates: Record<string, SyncState> = {};
      Object.entries(states || {}).forEach(([key, state]) => {
        if (key.startsWith('wp_')) {
          wpStates[key.replace('wp_', '')] = state as SyncState;
        } else {
          wechatStates[key] = state as SyncState;
        }
      });
      setSyncStates(wechatStates);
      setWpSyncStates(wpStates);
      
      // 检查 WordPress 配置
      const hasWp = !!(config.wordpress?.siteUrl && config.wordpress?.username && config.wordpress?.appPassword);
      setHasWordPressConfig(hasWp);
    } catch (err) {
      console.error('加载数据失败:', err);
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async (articleId: string, target: SyncTarget, mode: 'publish' | 'draft') => {
    const article = articles.find(a => a.id === articleId);
    if (!article) return;

    const targetText = target === 'wechat' ? '微信' : target === 'wordpress' ? 'WordPress' : '全部平台';
    const modeText = mode === 'draft' ? '草稿' : '发布';

    setConfirmDialog({
      isOpen: true,
      title: '确认同步',
      message: `将《${article.title}》同步到${targetText}（${modeText}）？`,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        await doSync(articleId, target, mode);
      }
    });
  };

  const doSync = async (articleId: string, target: SyncTarget, mode: 'publish' | 'draft') => {
    try {
      // 设置同步中状态
      if (target === 'wechat' || target === 'both') {
        setSyncStates(prev => ({ ...prev, [articleId]: { articleId, status: SyncStatus.SYNCING } }));
      }
      if (target === 'wordpress' || target === 'both') {
        setWpSyncStates(prev => ({ ...prev, [articleId]: { articleId: `wp_${articleId}`, status: SyncStatus.SYNCING } }));
      }

      let result: string;
      
      if (target === 'wechat') {
        const state = await IpcService.syncArticle(articleId, mode);
        setSyncStates(prev => ({ ...prev, [articleId]: state }));
        result = state.status === SyncStatus.SUCCESS ? '微信同步成功' : `微信同步失败: ${state.error}`;
      } else if (target === 'wordpress') {
        const state = await IpcService.syncToWordPress(articleId, mode);
        setWpSyncStates(prev => ({ ...prev, [articleId]: state }));
        result = state.status === SyncStatus.SUCCESS ? 'WordPress同步成功' : `WordPress同步失败: ${state.error}`;
      } else {
        const states = await IpcService.syncToBoth(articleId, mode, mode);
        setSyncStates(prev => ({ ...prev, [articleId]: states.wechat }));
        setWpSyncStates(prev => ({ ...prev, [articleId]: states.wordpress }));
        const w = states.wechat.status === SyncStatus.SUCCESS;
        const p = states.wordpress.status === SyncStatus.SUCCESS;
        result = w && p ? '全部同步成功' : `微信${w ? '✓' : '✗'} WordPress${p ? '✓' : '✗'}`;
      }
      
      await IpcService.showNotification('同步完成', result);
    } catch (error) {
      console.error('同步失败:', error);
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      await IpcService.showNotification('同步失败', errorMsg);
    }
  };

  // 批量同步（选中多篇文章）
  const handleBatchSync = async (articleIds: string[], target: SyncTarget, mode: 'publish' | 'draft') => {
    if (articleIds.length === 0) return;

    const targetText = target === 'wechat' ? '微信' : 'WordPress';
    const modeText = mode === 'draft' ? '草稿' : '发布';
    const titles = articleIds.map(id => articles.find(a => a.id === id)?.title || id).slice(0, 3);
    const more = articleIds.length > 3 ? `...等 ${articleIds.length} 篇` : '';

    setConfirmDialog({
      isOpen: true,
      title: '确认批量同步',
      message: `将以下文章同步到${targetText}（${modeText}）？\n\n${titles.join('\n')}${more}`,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        await doBatchSync(articleIds, target, mode);
      }
    });
  };

  const doBatchSync = async (articleIds: string[], target: SyncTarget, mode: 'publish' | 'draft') => {
    let successCount = 0;
    let failCount = 0;

    for (const articleId of articleIds) {
      try {
        // 设置同步中状态
        if (target === 'wechat') {
          setSyncStates(prev => ({ ...prev, [articleId]: { articleId, status: SyncStatus.SYNCING } }));
        } else {
          setWpSyncStates(prev => ({ ...prev, [articleId]: { articleId: `wp_${articleId}`, status: SyncStatus.SYNCING } }));
        }

        if (target === 'wechat') {
          const state = await IpcService.syncArticle(articleId, mode);
          setSyncStates(prev => ({ ...prev, [articleId]: state }));
          if (state.status === SyncStatus.SUCCESS) successCount++;
          else failCount++;
        } else {
          const state = await IpcService.syncToWordPress(articleId, mode);
          setWpSyncStates(prev => ({ ...prev, [articleId]: state }));
          if (state.status === SyncStatus.SUCCESS) successCount++;
          else failCount++;
        }
      } catch (error) {
        failCount++;
        console.error(`同步文章 ${articleId} 失败:`, error);
      }
    }

    const result = failCount === 0 
      ? `${successCount} 篇文章同步成功` 
      : `成功 ${successCount} 篇，失败 ${failCount} 篇`;
    await IpcService.showNotification('批量同步完成', result);
  };

  // 取消同步
  const handleCancelSync = async (articleId: string, target: SyncTarget) => {
    try {
      const syncKey = target === 'wordpress' ? `wp_${articleId}` : articleId;
      await window.electron.ipcRenderer.invoke('cancel-sync', syncKey);
      
      // 也尝试重置状态
      await window.electron.ipcRenderer.invoke('reset-sync-state', syncKey);
      
      // 更新本地状态
      if (target === 'wechat') {
        setSyncStates(prev => ({
          ...prev,
          [articleId]: { articleId, status: SyncStatus.FAILED, error: '已取消', lastSyncTime: Date.now() }
        }));
      } else {
        setWpSyncStates(prev => ({
          ...prev,
          [articleId]: { articleId: `wp_${articleId}`, status: SyncStatus.FAILED, error: '已取消', lastSyncTime: Date.now() }
        }));
      }
    } catch (error) {
      console.error('取消同步失败:', error);
    }
  };

  // 统计
  const wechatSynced = Object.values(syncStates).filter(s => s.status === SyncStatus.SUCCESS).length;
  const wpSynced = Object.values(wpSyncStates).filter(s => s.status === SyncStatus.SUCCESS).length;

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
                  fontWeight: '500',
                  animation: 'pulse 2s infinite'
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
          </div>
        </div>
        
        {/* 右侧：刷新、设置、主题 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={loadData}
            disabled={loading}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-medium)',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {loading ? '刷新中...' : '刷新'}
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
          hasWordPressConfig={hasWordPressConfig}
          onSync={handleSync}
          onBatchSync={handleBatchSync}
          onCancelSync={handleCancelSync}
        />
      </main>

      {/* 设置弹窗 */}
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => { 
          setShowSettings(false); 
          setSettingsTab('notion');
          loadData(); 
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
