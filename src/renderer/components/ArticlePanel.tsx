import React, { useState, useEffect } from 'react';
import { NotionPage } from '../../shared/types/notion';
import { SyncState, SyncStatus } from '../../shared/types/sync';
import { IpcService } from '../../shared/services/IpcService';
import ArticleList from './ArticleList';
import ConfirmDialog from './ConfirmDialog';

const ArticlePanel: React.FC = () => {
  const [syncStates, setSyncStates] = useState<Record<string, SyncState>>({});
  const [articles, setArticles] = useState<NotionPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedArticles, setSelectedArticles] = useState<string[]>([]);
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
      setSyncStates(states || {});
    } catch (err) {
      console.error('加载同步状态失败:', err);
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

  const handleSyncWithConfirm = (articleId: string) => {
    const article = articles.find(a => a.id === articleId);
    if (!article) return;

    setConfirmDialog({
      isOpen: true,
      title: '确认同步',
      message: `确定要将文章《${article.title}》同步到微信公众号草稿箱吗？`,
      onConfirm: () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        handleSync(articleId);
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
          await handleSync(articleId);
          // 稍微延迟，避免请求过快
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // 同步完成后清空选择
        setSelectedArticles([]);
        IpcService.showNotification('批量同步完成', `已完成 ${selectedArticles.length} 篇文章的同步`);
      }
    });
  };

  const handleSync = async (articleId: string) => {
    try {
      console.log('开始同步文章:', articleId);
      
      // 设置同步中状态
      setSyncStates(prev => ({
        ...prev,
        [articleId]: {
          articleId,
          status: SyncStatus.SYNCING,
        },
      }));

      // 执行同步（默认保存为草稿）
      console.log('调用 syncArticle，模式: draft');
      const state = await IpcService.syncArticle(articleId, 'draft');
      console.log('同步完成，返回状态:', state);
      
      // 使用返回的状态更新
      setSyncStates(prev => ({
        ...prev,
        [articleId]: state,
      }));
      
      // 显示成功通知
      if (state.status === SyncStatus.SUCCESS) {
        console.log('同步成功，显示通知');
        await IpcService.showNotification('同步成功', '文章已保存到微信公众号草稿箱');
      } else if (state.status === SyncStatus.FAILED) {
        console.log('同步失败，显示错误通知:', state.error);
        await IpcService.showNotification('同步失败', state.error || '未知错误');
      }
      
      await loadArticles(); // 同步后重新加载文章列表
      await loadSyncStates(); // 重新加载同步状态
    } catch (error) {
      console.error('同步文章失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      setSyncStates(prev => ({
        ...prev,
        [articleId]: {
          articleId,
          status: SyncStatus.FAILED,
          error: errorMessage,
          lastSyncTime: Date.now(),
        },
      }));
      
      // 显示错误通知
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
          selectedArticles={selectedArticles}
          onSelectArticle={handleSelectArticle}
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