import React, { useState, useEffect } from 'react';
import { NotionPage } from '../../shared/types/notion';
import { SyncState, SyncStatus } from '../../shared/types/sync';

// 封面图
const CoverImage: React.FC<{ coverUrl?: string; title: string }> = ({ coverUrl, title }) => {
  const [failed, setFailed] = useState(false);

  if (!coverUrl || failed) {
    return (
      <div style={{
        height: '160px',
        background: 'linear-gradient(145deg, var(--bg-tertiary), var(--bg-secondary))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <span style={{ fontSize: '40px', opacity: 0.1 }}>📄</span>
      </div>
    );
  }

  return (
    <div style={{ height: '160px', overflow: 'hidden', backgroundColor: 'var(--bg-tertiary)' }}>
      <img
        src={coverUrl}
        alt={title}
        style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 200ms' }}
        onError={() => setFailed(true)}
      />
    </div>
  );
};

interface ArticleGridProps {
  articles: NotionPage[];
  loading: boolean;
  error: string | null;
  syncStates: Record<string, SyncState>;
  wpSyncStates: Record<string, SyncState>;
  biliSyncStates: Record<string, SyncState>;
  biliProgress: Record<string, { phase: string; progress: number }>;
  hasWordPressConfig: boolean;
  hasBilibiliConfig: boolean;
  selectedArticles: Set<string>;
  onToggleArticle: (id: string) => void;
  onPreview?: (articleId: string) => void;
}

// 同步状态徽章（显示在卡片上）
const SyncBadges: React.FC<{
  wechatState?: SyncState;
  wpState?: SyncState;
  biliState?: SyncState;
}> = ({ wechatState, wpState, biliState }) => {
  const getBadge = (state: SyncState | undefined, icon: string, title: string) => {
    if (!state) return null;
    
    let color = 'var(--text-tertiary)';
    if (state.status === SyncStatus.SUCCESS) color = '#10B981';
    else if (state.status === SyncStatus.FAILED) color = '#EF4444';
    else if (state.status === SyncStatus.SYNCING) color = '#F59E0B';
    
    return (
      <div 
        key={title}
        style={{ 
          padding: '2px 6px', 
          borderRadius: '4px',
          backgroundColor: state.status === SyncStatus.SUCCESS ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-tertiary)',
          fontSize: '10px',
          color,
          fontWeight: '500'
        }}
        title={`${title}: ${state.status === SyncStatus.SUCCESS ? '已同步' : state.status === SyncStatus.FAILED ? '失败' : '同步中...'}`}
      >
        {icon}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {getBadge(wechatState, '💬', '微信')}
      {getBadge(wpState, 'WP', 'WordPress')}
      {getBadge(biliState, '📹', 'B站')}
    </div>
  );
};

// 右键菜单
const ContextMenu: React.FC<{
  x: number;
  y: number;
  url?: string;
  onClose: () => void;
}> = ({ x, y, url, onClose }) => {
  useEffect(() => {
    const handleClick = () => onClose();
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [onClose]);

  if (!url) return null;

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: x,
    top: y,
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-light)',
    borderRadius: '8px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
    zIndex: 1000,
    overflow: 'hidden',
    minWidth: '140px'
  };

  const itemStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '10px 14px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
    fontSize: '13px',
    cursor: 'pointer',
    textAlign: 'left'
  };

  return (
    <div style={menuStyle} onClick={e => e.stopPropagation()}>
      <button
        style={itemStyle}
        onClick={() => { window.electron.openExternal(url); onClose(); }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        🌐 外部浏览器打开
      </button>
      <button
        style={itemStyle}
        onClick={() => { window.electron.openNotionPage(url); onClose(); }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        📱 内部浏览器打开
      </button>
    </div>
  );
};

const ArticleGrid: React.FC<ArticleGridProps> = ({
  articles,
  loading,
  error,
  syncStates,
  wpSyncStates,
  biliSyncStates,
  biliProgress,
  hasWordPressConfig,
  hasBilibiliConfig,
  selectedArticles,
  onToggleArticle,
  onPreview
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; url?: string } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, url?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, url });
  };

  if (loading) return <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-tertiary)' }}>加载中...</div>;
  if (error) return <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-tertiary)' }}><div style={{ fontSize: '32px', marginBottom: '12px' }}>😕</div>{error}</div>;
  if (!articles.length) return <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-tertiary)' }}><div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>暂无文章</div>;

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          url={contextMenu.url}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* 卡片网格 */}
      <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '18px' }}>
        {articles.map(article => {
          const cover = article.cover?.type === 'external' ? article.cover.external?.url : article.cover?.file?.url;
          const sel = selectedArticles.has(article.id);
          const progress = biliProgress[article.id];

          return (
            <div
              key={article.id}
              onClick={() => onToggleArticle(article.id)}
              onContextMenu={e => handleContextMenu(e, article.url)}
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderRadius: '12px',
                overflow: 'hidden',
                border: sel ? '2px solid var(--primary-green)' : '1px solid var(--border-light)',
                cursor: 'pointer',
                transition: 'all 180ms ease',
                transform: sel ? 'scale(0.98)' : 'scale(1)',
                boxShadow: sel ? '0 0 0 3px rgba(16,185,129,0.15)' : 'none',
                position: 'relative'
              }}
              onMouseEnter={e => { if (!sel) { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}}
              onMouseLeave={e => { if (!sel) { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'scale(1)'; }}}
            >
              <CoverImage coverUrl={cover} title={article.title} />
              
              {/* B站同步进度条 - 在封面图和内容交界处 */}
              {progress && progress.progress > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '160px',
                  left: 0,
                  right: 0,
                  height: '2px',
                  backgroundColor: 'rgba(0,0,0,0.1)',
                  overflow: 'hidden',
                  zIndex: 1
                }}>
                  <div style={{
                    height: '100%',
                    width: `${progress.progress}%`,
                    backgroundColor: progress.phase === 'downloading' ? '#3B82F6' : '#10B981',
                    transition: 'width 0.3s ease',
                    boxShadow: '0 0 4px currentColor'
                  }} />
                </div>
              )}
              
              <div style={{ padding: '12px' }}>
                <div style={{ height: '40px', display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: 'var(--text-primary)',
                    margin: 0,
                    lineHeight: 1.4,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical'
                  }}>{article.title}</h3>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    {new Date(article.lastEditedTime).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                    {article.author && <> · {article.author}</>}
                  </span>
                  <SyncBadges
                    wechatState={syncStates[article.id]}
                    wpState={wpSyncStates[article.id]}
                    biliState={biliSyncStates[article.id]}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ArticleGrid;
