import React, { useState, useEffect } from 'react';
import { SyncState, SyncStatus } from '../../shared/types/sync';
import { NotionPage } from '../../shared/types/notion';
import { IpcService } from '../../shared/services/IpcService';

const SyncStatusPanel: React.FC = () => {
  const [syncStates, setSyncStates] = useState<Record<string, SyncState>>({});
  const [articles, setArticles] = useState<NotionPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadData(true); // 初始加载显示 loading
    // 每10秒静默刷新一次同步状态（只刷新状态，不重新加载文章列表）
    const interval = setInterval(() => refreshSyncStates(), 10000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async (showLoading: boolean = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      
      const [pages, states] = await Promise.all([
        IpcService.getNotionPages(),
        window.electron.ipcRenderer.invoke('get-all-sync-states')
      ]);
      setArticles(pages);
      setSyncStates(states || {});
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 静默刷新同步状态（不重新加载文章列表）
  const refreshSyncStates = async () => {
    try {
      setIsRefreshing(true);
      const states = await window.electron.ipcRenderer.invoke('get-all-sync-states');
      setSyncStates(states || {});
    } catch (error) {
      console.error('刷新同步状态失败:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusBadge = (status: SyncStatus) => {
    switch (status) {
      case SyncStatus.SUCCESS:
        return { icon: '✓', class: 'badge-success', text: '同步成功' };
      case SyncStatus.FAILED:
        return { icon: '✗', class: 'badge-error', text: '同步失败' };
      case SyncStatus.SYNCING:
        return { icon: '◷', class: 'badge-warning', text: '同步中' };
      default:
        return { icon: '○', class: '', text: '未同步' };
    }
  };

  if (loading) {
    return (
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: 'var(--text-secondary)'
      }}>
        ⏳ 加载中...
      </div>
    );
  }

  // 统计信息
  const totalArticles = articles.length;
  const syncedCount = Object.values(syncStates).filter(s => s.status === SyncStatus.SUCCESS).length;
  const failedCount = Object.values(syncStates).filter(s => s.status === SyncStatus.FAILED).length;
  const syncingCount = Object.values(syncStates).filter(s => s.status === SyncStatus.SYNCING).length;

  return (
    <div className="h-full" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      {/* 顶部工具栏 */}
      <div style={{ 
        backgroundColor: 'var(--bg-primary)', 
        borderBottom: '1px solid var(--border-light)',
        padding: '12px var(--spacing-lg)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={{ 
              fontSize: '16px', 
              fontWeight: '600', 
              color: 'var(--text-primary)',
              margin: 0
            }}>
              📊 同步状态
            </h2>
            {isRefreshing && (
              <span style={{ 
                fontSize: '12px', 
                color: 'var(--text-tertiary)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span style={{ 
                  display: 'inline-block',
                  width: '12px',
                  height: '12px',
                  border: '2px solid var(--primary-green)',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }}></span>
                更新中
              </span>
            )}
          </div>
          <button
            onClick={() => loadData(true)}
            disabled={loading || isRefreshing}
            className="btn btn-secondary"
            style={{ padding: '6px 16px', fontSize: '13px' }}
          >
            {loading ? '⏳ 加载中' : '🔄 刷新'}
          </button>
        </div>

        {/* 统计卡片 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          <div style={{
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-light)'
          }}>
            <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '4px' }}>总数</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>{totalArticles}</div>
          </div>
          <div style={{
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.3)'
          }}>
            <div style={{ fontSize: '12px', color: '#6EE7B7', marginBottom: '4px' }}>✓ 成功</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#6EE7B7' }}>{syncedCount}</div>
          </div>
          <div style={{
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)'
          }}>
            <div style={{ fontSize: '12px', color: '#FCA5A5', marginBottom: '4px' }}>✗ 失败</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#FCA5A5' }}>{failedCount}</div>
          </div>
          <div style={{
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(252, 211, 77, 0.15)',
            border: '1px solid rgba(252, 211, 77, 0.3)'
          }}>
            <div style={{ fontSize: '12px', color: '#FDE68A', marginBottom: '4px' }}>◷ 进行中</div>
            <div style={{ fontSize: '24px', fontWeight: '700', color: '#FDE68A' }}>{syncingCount}</div>
          </div>
        </div>
      </div>

      {/* 文章列表 */}
      <div style={{ height: 'calc(100% - 145px)', overflow: 'auto', padding: 'var(--spacing-lg)' }}>
        {articles.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: 'var(--spacing-xl)',
            color: 'var(--text-secondary)' 
          }}>
            📭 暂无文章
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {articles.map((article) => {
              const syncState = syncStates[article.id];
              const status = syncState?.status || SyncStatus.PENDING;
              const badge = getStatusBadge(status);
              
              return (
                <div
                  key={article.id}
                  className="card"
                  style={{ 
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 'var(--spacing-md)',
                    transition: 'all var(--transition-base)'
                  }}
                >
                  {/* 状态图标 */}
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    flexShrink: 0
                  }}>
                    {badge.icon}
                  </div>

                  {/* 文章信息 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <h3 style={{ 
                        fontSize: '15px', 
                        fontWeight: '600', 
                        color: 'var(--text-primary)',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1
                      }}>
                        {article.title}
                      </h3>
                      {badge.class && (
                        <span className={`badge ${badge.class}`} style={{ fontSize: '11px', padding: '4px 8px', flexShrink: 0 }}>
                          {badge.text}
                        </span>
                      )}
                    </div>

                    <div style={{ 
                      fontSize: '13px', 
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      {syncState?.lastSyncTime && (
                        <div>
                          🕒 最后同步: {new Date(syncState.lastSyncTime).toLocaleString('zh-CN', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      )}
                      {syncState?.error && (
                        <div style={{ 
                          color: '#FCA5A5',
                          fontSize: '12px',
                          padding: '6px 10px',
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          marginTop: '4px'
                        }}>
                          ⚠️ {syncState.error}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SyncStatusPanel;

