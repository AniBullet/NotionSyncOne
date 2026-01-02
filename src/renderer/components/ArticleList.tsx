import React from 'react';
import { NotionPage } from '../../shared/types/notion';
import { SyncState, SyncStatus } from '../../shared/types/sync';
import SyncButton, { SyncTarget } from './SyncButton';

interface ArticleListProps {
  articles: NotionPage[];
  loading: boolean;
  error: string | null;
  onSync: (pageId: string, target: SyncTarget, mode: 'publish' | 'draft') => void;
  syncStates: Record<string, SyncState>;
  wpSyncStates?: Record<string, SyncState>;
  selectedArticles: string[];
  onSelectArticle: (articleId: string) => void;
  hasWordPressConfig?: boolean;
}

const ArticleList: React.FC<ArticleListProps> = ({ 
  articles, 
  loading, 
  error, 
  onSync, 
  syncStates, 
  wpSyncStates = {},
  selectedArticles, 
  onSelectArticle,
  hasWordPressConfig = false
}) => {
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

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--spacing-lg)', padding: 'var(--spacing-lg)' }}>
      {articles.map((article) => {
        // 解析 Notion 页面封面图片（优先 external，其次 file）
        const coverUrl =
          article.cover?.type === 'external'
            ? article.cover.external?.url
            : article.cover?.file?.url;

        const syncState = syncStates[article.id] || { articleId: article.id, status: SyncStatus.PENDING };
        const wpSyncState = wpSyncStates[article.id];
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

            {/* 同步按钮 - 右上角 */}
            <div
              style={{
                position: 'absolute',
                top: 'var(--spacing-md)',
                right: 'var(--spacing-md)',
                zIndex: 20,
              }}
              onClick={e => e.stopPropagation()}
            >
              <SyncButton
                articleId={article.id}
                state={syncState}
                wpState={wpSyncState}
                onSync={onSync}
                hasWordPressConfig={hasWordPressConfig}
              />
            </div>

            {/* 同步状态徽章 - 微信和 WordPress */}
            <div style={{ 
              position: 'absolute',
              top: '56px',
              right: 'var(--spacing-md)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              zIndex: 15
            }}>
              {syncState && syncState.status !== SyncStatus.PENDING && (
                <div 
                  className={`badge badge-${syncState.status === SyncStatus.SUCCESS ? 'success' : syncState.status === SyncStatus.FAILED ? 'error' : 'warning'}`}
                  style={{ 
                    fontSize: '10px',
                    padding: '3px 6px',
                  }}
                  title={`微信: ${syncState.status === SyncStatus.SUCCESS ? '同步成功' : syncState.status === SyncStatus.FAILED ? '同步失败' : '同步中'}`}
                >
                  💬 {syncState.status === SyncStatus.SUCCESS ? '✓' : syncState.status === SyncStatus.FAILED ? '✗' : '◷'}
                </div>
              )}
              {wpSyncState && wpSyncState.status !== SyncStatus.PENDING && (
                <div 
                  className={`badge badge-${wpSyncState.status === SyncStatus.SUCCESS ? 'success' : wpSyncState.status === SyncStatus.FAILED ? 'error' : 'warning'}`}
                  style={{ 
                    fontSize: '10px',
                    padding: '3px 6px',
                  }}
                  title={`WordPress: ${wpSyncState.status === SyncStatus.SUCCESS ? '同步成功' : wpSyncState.status === SyncStatus.FAILED ? '同步失败' : '同步中'}`}
                >
                  📝 {wpSyncState.status === SyncStatus.SUCCESS ? '✓' : wpSyncState.status === SyncStatus.FAILED ? '✗' : '◷'}
                </div>
              )}
            </div>

            {/* 封面图（如果有） */}
            {coverUrl && (
              <div
                style={{
                  margin: 'var(--spacing-lg) var(--spacing-md) var(--spacing-md)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  position: 'relative',
                  background: 'var(--bg-tertiary)',
                  height: '160px',
                  zIndex: 1
                }}
              >
                <img
                  src={coverUrl}
                  alt={article.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                    transform: 'scale(1.02)',
                    transition: 'transform var(--transition-base), filter var(--transition-base)',
                    filter: 'brightness(0.96)'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'scale(1.06)';
                    e.currentTarget.style.filter = 'brightness(1)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'scale(1.02)';
                    e.currentTarget.style.filter = 'brightness(0.96)';
                  }}
                  onError={e => {
                    // 图片加载失败时隐藏整个封面区域，避免显示破图图标
                    const parent = e.currentTarget.parentElement as HTMLElement | null;
                    if (parent) {
                      parent.style.display = 'none';
                    }
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.28), rgba(0,0,0,0.05))',
                    pointerEvents: 'none'
                  }}
                />
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
                {/* 不显眼的"打开 Notion 页面"入口 */}
                {article.url && (
                  <>
                    <span style={{ margin: '0 4px' }}>•</span>
                    <button
                      type="button"
                      title="点击在应用内打开；按住 Ctrl 点击用系统浏览器打开"
                      style={{
                        padding: 0,
                        border: 'none',
                        background: 'transparent',
                        fontSize: '11px',
                        color: 'var(--text-tertiary)',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        textUnderlineOffset: '2px',
                      }}
                      onClick={async e => {
                        e.stopPropagation();
                        try {
                          if (e.ctrlKey || e.metaKey) {
                            await window.electron.openExternal(article.url!);
                          } else {
                            await window.electron.openNotionPage(article.url!);
                          }
                        } catch (err) {
                          console.error('打开 Notion 页面失败:', err);
                        }
                      }}
                    >
                      打开 Notion
                    </button>
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
            {(syncState?.error || wpSyncState?.error) && (
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
              title={`${syncState?.error ? '微信: ' + syncState.error : ''} ${wpSyncState?.error ? 'WordPress: ' + wpSyncState.error : ''}`}
              >
                ⚠️ {syncState?.error || wpSyncState?.error}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ArticleList;
