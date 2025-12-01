import React from 'react';
import { NotionPage } from '../../shared/types/notion';
import { SyncState, SyncStatus } from '../../shared/types/sync';

interface ArticleListProps {
  articles: NotionPage[];
  loading: boolean;
  error: string | null;
  onSync: (pageId: string) => Promise<void>;
  syncStates: Record<string, SyncState>;
  selectedArticles: string[];
  onSelectArticle: (articleId: string) => void;
}

const ArticleList: React.FC<ArticleListProps> = ({ articles, loading, error, onSync, syncStates, selectedArticles, onSelectArticle }) => {
  if (loading) {
    return <div style={{ padding: 'var(--spacing-lg)', color: 'var(--text-secondary)', textAlign: 'center' }}>⏳ 加载中...</div>;
  }

  if (error) {
    return <div style={{ padding: 'var(--spacing-lg)', color: 'var(--error)', textAlign: 'center' }}>❌ {error}</div>;
  }

  if (articles.length === 0) {
    return <div style={{ padding: 'var(--spacing-lg)', color: 'var(--text-secondary)', textAlign: 'center' }}>📭 暂无文章</div>;
  }

  const formatFeatureTag = (tag: string | string[] | undefined) => {
    if (!tag) return '无标签';
    if (Array.isArray(tag)) return tag.join(', ');
    return tag;
  };

  const getSyncStatusColor = (state?: SyncState) => {
    if (!state) return 'text-gray-500';
    switch (state.status) {
      case SyncStatus.SUCCESS:
        return 'text-green-500';
      case SyncStatus.FAILED:
        return 'text-red-500';
      case SyncStatus.SYNCING:
        return 'text-blue-500';
      default:
        return 'text-gray-500';
    }
  };

  const getSyncStatusText = (state?: SyncState) => {
    if (!state) return '未同步';
    switch (state.status) {
      case SyncStatus.SUCCESS:
        return '同步成功';
      case SyncStatus.FAILED:
        return '同步失败';
      case SyncStatus.SYNCING:
        return '同步中...';
      default:
        return '未同步';
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--spacing-lg)', padding: 'var(--spacing-lg)' }}>
      {articles.map((article) => {
        const syncState = syncStates[article.id];
        const isSyncing = syncState?.status === SyncStatus.SYNCING;
        const isSelected = selectedArticles.includes(article.id);
        
        return (
          <div 
            key={article.id} 
            className="card" 
            style={{ 
              transition: 'all var(--transition-base)',
              position: 'relative',
              paddingTop: 'var(--spacing-lg)',
              border: isSelected ? '2px solid var(--primary-green)' : '1px solid var(--border-light)',
              backgroundColor: isSelected ? 'var(--bg-hover)' : 'var(--bg-primary)',
              cursor: 'pointer'
            }}
            onClick={() => onSelectArticle(article.id)}
            onMouseEnter={e => {
              if (!isSelected) {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
              }
            }}
            onMouseLeave={e => {
              if (!isSelected) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
              }
            }}
          >
            {/* 选中状态指示器 */}
            {isSelected && (
              <div style={{
                position: 'absolute',
                top: 'var(--spacing-md)',
                left: 'var(--spacing-md)',
                width: '24px',
                height: '24px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--primary-green)',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: 'bold',
                zIndex: 10,
                pointerEvents: 'none'
              }}>
                ✓
              </div>
            )}

            {/* 右上角同步按钮 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSync(article.id);
              }}
              disabled={isSyncing}
              title={isSyncing ? '同步中...' : '同步到微信'}
              style={{
                position: 'absolute',
                top: 'var(--spacing-md)',
                right: 'var(--spacing-md)',
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-full)',
                border: 'none',
                background: isSyncing ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, var(--primary-green) 0%, var(--primary-green-dark) 100%)',
                color: '#FFFFFF',
                fontSize: '18px',
                cursor: isSyncing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all var(--transition-base)',
                boxShadow: isSyncing ? 'none' : 'var(--shadow-md)',
                opacity: isSyncing ? 0.6 : 1
              }}
              onMouseEnter={e => {
                if (!isSyncing) {
                  e.currentTarget.style.transform = 'scale(1.1) rotate(10deg)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
                e.currentTarget.style.boxShadow = isSyncing ? 'none' : 'var(--shadow-md)';
              }}
            >
              {isSyncing ? '⏳' : '🚀'}
            </button>

            {/* 同步状态徽章 - 移到右上角火箭按钮下方 */}
            {syncState && (
              <div 
                className={`badge badge-${syncState.status === SyncStatus.SUCCESS ? 'success' : syncState.status === SyncStatus.FAILED ? 'error' : 'warning'}`}
                style={{ 
                  position: 'absolute',
                  top: '60px',
                  right: 'var(--spacing-md)',
                  fontSize: '10px',
                  padding: '3px 6px'
                }}
              >
                {syncState.status === SyncStatus.SUCCESS ? '✓' : syncState.status === SyncStatus.FAILED ? '✗' : '◷'}
              </div>
            )}

            {/* 标题 */}
            <h2 style={{ 
              fontSize: '17px', 
              fontWeight: '600', 
              color: 'var(--text-primary)',
              marginBottom: 'var(--spacing-md)',
              lineHeight: '1.5',
              paddingLeft: isSelected ? '36px' : '0',
              paddingRight: '48px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              transition: 'padding-left var(--transition-base)'
            }}>
              {article.title}
            </h2>

            {/* 元信息 */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '6px',
              fontSize: '12px',
              color: 'var(--text-tertiary)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📅</span>
                <span>{new Date(article.lastEditedTime).toLocaleDateString('zh-CN', { 
                  month: 'short', 
                  day: 'numeric'
                })}</span>
                {article.author && (
                  <>
                    <span style={{ margin: '0 4px' }}>•</span>
                    <span>✍️ {article.author}</span>
                  </>
                )}
              </div>
              
              {article.from && (
                <div style={{ 
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  📍 {article.from}
                </div>
              )}
              
              {article.featureTag && (
                <div style={{ 
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px',
                  marginTop: '4px'
                }}>
                  {formatFeatureTag(article.featureTag).split(',').map((tag, idx) => (
                    <span key={idx} style={{
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--bg-tertiary)',
                      fontSize: '11px',
                      color: 'var(--text-secondary)'
                    }}>
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 错误信息 */}
            {syncState?.error && (
              <div style={{ 
                marginTop: 'var(--spacing-md)',
                padding: 'var(--spacing-sm)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                fontSize: '11px',
                color: '#FCA5A5',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
              title={syncState.error}
              >
                ⚠️ {syncState.error}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ArticleList; 