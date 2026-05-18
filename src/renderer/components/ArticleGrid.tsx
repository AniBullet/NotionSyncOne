import React, { useState, useEffect } from 'react';
import { NotionPage } from '../../shared/types/notion';
import { SyncState, SyncStatus } from '../../shared/types/sync';
import {
  getSyncBadgePresentation,
  PLATFORM_LABELS
} from '../utils/syncPresentation';
import type { SyncPlatform } from '../utils/syncPresentation';

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
        <span
          aria-hidden="true"
          style={{
            width: '34px',
            height: '44px',
            borderRadius: '6px',
            border: '2px solid var(--border-medium)',
            backgroundColor: 'var(--bg-primary)',
            boxShadow: 'inset 0 -10px 0 var(--bg-secondary)',
            opacity: 0.55
          }}
        />
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
  onShowSyncFailure?: (articleId: string, platform: SyncPlatform) => void;
}

// Compact sync status dots for dense article cards.
const SyncBadges: React.FC<{
  wechatState?: SyncState;
  wpState?: SyncState;
  biliState?: SyncState;
  onShowFailure?: (platform: SyncPlatform) => void;
}> = ({ wechatState, wpState, biliState, onShowFailure }) => {
  const getBadge = (state: SyncState | undefined, platform: SyncPlatform) => {
    if (!state) return null;

    const badge = getSyncBadgePresentation(platform, state);
    if (!badge) return null;

    const title = PLATFORM_LABELS[platform];
    const failed = state.status === SyncStatus.FAILED;
    const tooltip = badge.reason ? `${title}: ${badge.statusText} - ${badge.reason}` : `${title}: ${badge.statusText}`;

    return (
      <div
        key={platform}
        role={failed ? 'button' : undefined}
        tabIndex={failed ? 0 : undefined}
        onClick={event => {
          if (!failed) return;
          event.stopPropagation();
          onShowFailure?.(platform);
        }}
        onKeyDown={event => {
          if (!failed || (event.key !== 'Enter' && event.key !== ' ')) return;
          event.preventDefault();
          event.stopPropagation();
          onShowFailure?.(platform);
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          border: `1px solid ${badge.borderColor}`,
          backgroundColor: badge.backgroundColor,
          color: badge.color,
          lineHeight: 1,
          flexShrink: 0,
          cursor: failed ? 'pointer' : 'default',
          position: 'relative'
        }}
        aria-label={tooltip}
        title={tooltip}
      >
        <span aria-hidden="true" style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          backgroundColor: badge.color
        }} />
        {failed && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              right: '-1px',
              bottom: '-1px',
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              backgroundColor: '#EF4444',
              border: '1px solid var(--bg-primary)'
            }}
          />
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
      {getBadge(wechatState, 'wechat')}
      {getBadge(biliState, 'bilibili')}
      {getBadge(wpState, 'wordpress')}
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
        外部浏览器打开
      </button>
      <button
        style={itemStyle}
        onClick={() => { window.electron.openNotionPage(url); onClose(); }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        内部浏览器打开
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
  hasWordPressConfig: _hasWordPressConfig,
  hasBilibiliConfig: _hasBilibiliConfig,
  selectedArticles,
  onToggleArticle,
  onPreview: _onPreview,
  onShowSyncFailure
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; url?: string } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, url?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, url });
  };

  if (loading) return <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-tertiary)' }}>正在加载文章...</div>;
  if (error) return <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-tertiary)' }}><div style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--error)' }}>加载失败</div>{error}</div>;
  if (!articles.length) return <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-tertiary)' }}><div style={{ fontSize: '18px', marginBottom: '8px', color: 'var(--text-primary)' }}>暂无文章</div>检查 Notion 配置后刷新列表</div>;

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
                borderRadius: '8px',
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
                    onShowFailure={platform => onShowSyncFailure?.(article.id, platform)}
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
