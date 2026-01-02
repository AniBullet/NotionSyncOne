import React, { useState, useEffect } from 'react';
import { NotionPage } from '../../shared/types/notion';
import { SyncState, SyncStatus } from '../../shared/types/sync';
import { IpcService } from '../../shared/services/IpcService';
import ArticleList from './ArticleList';
import ConfirmDialog from './ConfirmDialog';
import { SyncTarget } from './SyncButton';

const ArticlePanel: React.FC = () => {
  const [syncStates, setSyncStates] = useState<Record<string, SyncState>>({});
  const [wpSyncStates, setWpSyncStates] = useState<Record<string, SyncState>>({});
  const [articles, setArticles] = useState<NotionPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedArticles, setSelectedArticles] = useState<string[]>([]);
  const [hasWordPressConfig, setHasWordPressConfig] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    loadArticles();
    loadSyncStates();
    checkWordPressConfig();
  }, []);

  const loadArticles = async () => {
    try {
      setLoading(true);
      setError(null);
      const pages = await IpcService.getNotionPages();
      setArticles(pages);
    } catch (err) {
      console.error('加载文章失败:', err);
      setError(err instanceof Error ? err.message : '加载文章失败');
    } finally {
      setLoading(false);
    }
  };

  const loadSyncStates = async () => {
    try {
      const states = await window.electron.ipcRenderer.invoke('get-all-sync-states');
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
    } catch (err) {
      console.error('加载同步状态失败:', err);
    }
  };

  const checkWordPressConfig = async () => {
    try {
      const config = await IpcService.getConfig();
      const hasWp = !!(config.wordpress?.siteUrl && config.wordpress?.username && config.wordpress?.appPassword);
      setHasWordPressConfig(hasWp);
    } catch (err) {
      console.error('检查 WordPress 配置失败:', err);
    }
  };

  const handleSelectArticle = (articleId: string) => {
    setSelectedArticles(prev => {
      if (prev.includes(articleId)) {
        return prev.filter(id => id !== articleId);
      } else {
        return [...prev, articleId];
      }
    });
  };

  const handleSyncWithConfirm = (articleId: string, target: SyncTarget, mode: 'publish' | 'draft') => {
    const article = articles.find(a => a.id === articleId);
    if (!article) return;

    // 构建确认消息
    let targetText = '';
    if (target === 'wechat') {
      targetText = '微信公众号';
    } else if (target === 'wordpress') {
      targetText = 'WordPress';
    } else {
      targetText = '微信公众号和 WordPress';
    }
    
    const modeText = mode === 'draft' ? '草稿' : '直接发布';

    setConfirmDialog({
      isOpen: true,
      title: '确认同步',
      message: `确定要将文章《${article.title}》${mode === 'draft' ? '保存为' : ''}${modeText}到 ${targetText} 吗？`,
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        handleSync(articleId, target, mode);
      }
    });
  };

  const handleBatchSync = () => {
    if (selectedArticles.length === 0) {
      IpcService.showNotification('提示', '请先选择要同步的文章');
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: '批量同步确认',
      message: `确定要将选中的 ${selectedArticles.length} 篇文章同步到微信公众号草稿箱吗？`,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        
        // 依次同步选中的文章
        for (const articleId of selectedArticles) {
          await handleSync(articleId, 'wechat', 'draft');
          // 稍微延迟，避免请求过快
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // 同步完成后清空选择
        setSelectedArticles([]);
        IpcService.showNotification('批量同步完成', `已完成 ${selectedArticles.length} 篇文章的同步`);
      }
    });
  };

  const handleSync = async (articleId: string, target: SyncTarget = 'wechat', mode: 'publish' | 'draft' = 'draft') => {
    try {
      console.log('开始同步文章:', articleId, '目标:', target, '模式:', mode);
      
      // 设置同步中状态
      if (target === 'wechat' || target === 'both') {
        setSyncStates(prev => ({
          ...prev,
          [articleId]: {
            articleId,
            status: SyncStatus.SYNCING,
          },
        }));
      }
      
      if (target === 'wordpress' || target === 'both') {
        setWpSyncStates(prev => ({
          ...prev,
          [articleId]: {
            articleId: `wp_${articleId}`,
            status: SyncStatus.SYNCING,
          },
        }));
      }

      let resultMessage = '';
      
      if (target === 'wechat') {
        // 只同步到微信
        const state = await IpcService.syncArticle(articleId, mode);
        setSyncStates(prev => ({ ...prev, [articleId]: state }));
        
        if (state.status === SyncStatus.SUCCESS) {
          resultMessage = `文章已${mode === 'draft' ? '保存到微信公众号草稿箱' : '发布到微信公众号'}`;
        } else if (state.status === SyncStatus.FAILED) {
          resultMessage = `微信同步失败: ${state.error || '未知错误'}`;
        }
      } else if (target === 'wordpress') {
        // 只同步到 WordPress
        const state = await IpcService.syncToWordPress(articleId, mode);
        setWpSyncStates(prev => ({ ...prev, [articleId]: state }));
        
        if (state.status === SyncStatus.SUCCESS) {
          resultMessage = `文章已${mode === 'draft' ? '保存到 WordPress 草稿' : '发布到 WordPress'}`;
        } else if (state.status === SyncStatus.FAILED) {
          resultMessage = `WordPress 同步失败: ${state.error || '未知错误'}`;
        }
      } else if (target === 'both') {
        // 同时同步到两个平台
        const result = await IpcService.syncToBoth(articleId, mode, mode);
        setSyncStates(prev => ({ ...prev, [articleId]: result.wechat }));
        setWpSyncStates(prev => ({ ...prev, [articleId]: result.wordpress }));
        
        const wechatSuccess = result.wechat.status === SyncStatus.SUCCESS;
        const wpSuccess = result.wordpress.status === SyncStatus.SUCCESS;
        
        if (wechatSuccess && wpSuccess) {
          resultMessage = `文章已同步到微信和 WordPress`;
        } else if (wechatSuccess) {
          resultMessage = `微信同步成功，WordPress 失败: ${result.wordpress.error}`;
        } else if (wpSuccess) {
          resultMessage = `WordPress 同步成功，微信失败: ${result.wechat.error}`;
        } else {
          resultMessage = `同步失败: 微信(${result.wechat.error}), WordPress(${result.wordpress.error})`;
        }
      }
      
      // 显示通知
      const isSuccess = resultMessage && !resultMessage.includes('失败');
      await IpcService.showNotification(
        isSuccess ? '同步成功' : '同步完成',
        resultMessage
      );
      
      await loadArticles();
      await loadSyncStates();
    } catch (error) {
      console.error('同步文章失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      if (target === 'wechat' || target === 'both') {
        setSyncStates(prev => ({
          ...prev,
          [articleId]: {
            articleId,
            status: SyncStatus.FAILED,
            error: errorMessage,
            lastSyncTime: Date.now(),
          },
        }));
      }
      
      if (target === 'wordpress' || target === 'both') {
        setWpSyncStates(prev => ({
          ...prev,
          [articleId]: {
            articleId: `wp_${articleId}`,
            status: SyncStatus.FAILED,
            error: errorMessage,
            lastSyncTime: Date.now(),
          },
        }));
      }
      
      await IpcService.showNotification('同步失败', errorMessage);
    }
  };

  return (
    <div className="h-full" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      {/* 顶部工具栏 - 更简洁的设计 */}
      <div style={{ 
        backgroundColor: 'var(--bg-primary)', 
        borderBottom: '1px solid var(--border-light)',
        padding: '12px var(--spacing-lg)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ 
            fontSize: '16px', 
            fontWeight: '600', 
            color: 'var(--text-primary)',
            margin: 0
          }}>
            📚 我的文章
          </h2>
          <span style={{
            fontSize: '13px',
            color: 'var(--text-tertiary)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--bg-tertiary)'
          }}>
            {articles.length} 篇
          </span>
          {selectedArticles.length > 0 && (
            <span style={{
              fontSize: '13px',
              color: 'var(--primary-green)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'rgba(52, 211, 153, 0.1)',
              fontWeight: '600'
            }}>
              已选 {selectedArticles.length} 篇
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* 批量同步按钮（始终可见，根据选择数量调整状态） */}
          <button
            onClick={handleBatchSync}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: selectedArticles.length > 0 ? 'var(--primary-green)' : 'var(--bg-tertiary)',
              color: selectedArticles.length > 0 ? '#FFFFFF' : 'var(--text-tertiary)',
              fontSize: '13px',
              cursor: selectedArticles.length > 0 ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all var(--transition-base)',
              fontWeight: '600',
              boxShadow: selectedArticles.length > 0 ? 'var(--shadow-sm)' : 'none',
              opacity: selectedArticles.length > 0 ? 1 : 0.85
            }}
            onMouseEnter={e => {
              if (selectedArticles.length > 0) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = selectedArticles.length > 0 ? 'var(--shadow-sm)' : 'none';
            }}
          >
            <span>🚀</span>
            {selectedArticles.length > 0 ? `同步选中 (${selectedArticles.length})` : '同步选中'}
          </button>

          {/* 刷新按钮 */}
          <button
            onClick={loadArticles}
            disabled={loading}
            style={{
              padding: '6px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-medium)',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all var(--transition-base)',
              fontWeight: '500'
            }}
            onMouseEnter={e => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                e.currentTarget.style.borderColor = 'var(--primary-green)';
                e.currentTarget.style.color = 'var(--primary-green)';
              }
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = 'var(--border-medium)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <span style={{ fontSize: '14px' }}>{loading ? '⏳' : '🔄'}</span>
            {loading ? '加载中...' : '刷新'}
          </button>
        </div>
      </div>

      {/* 文章列表 - 卡片网格布局 */}
      <div style={{ height: 'calc(100% - 53px)', overflow: 'auto' }}>
        <ArticleList
          articles={articles}
          loading={loading}
          error={error}
          onSync={handleSyncWithConfirm}
          syncStates={syncStates}
          wpSyncStates={wpSyncStates}
          selectedArticles={selectedArticles}
          onSelectArticle={handleSelectArticle}
          hasWordPressConfig={hasWordPressConfig}
        />
      </div>

      {/* 确认对话框 */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        confirmText="确认同步"
        cancelText="取消"
      />
    </div>
  );
};

export default ArticlePanel; 