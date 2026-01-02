import React, { useState, useEffect } from 'react';
import { NotionPage } from '../../shared/types/notion';
import { SyncState, SyncStatus } from '../../shared/types/sync';
import { SyncTarget } from './SyncButton';

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
  hasWordPressConfig: boolean;
  onSync: (articleId: string, target: SyncTarget, mode: 'publish' | 'draft') => void;
  onBatchSync?: (articleIds: string[], target: SyncTarget, mode: 'publish' | 'draft') => void;
}

// 操作按钮
const Actions: React.FC<{
  wechatState?: SyncState;
  wpState?: SyncState;
  hasWp: boolean;
  onSync: (target: SyncTarget, mode: 'publish' | 'draft') => void;
}> = ({ wechatState, wpState, hasWp, onSync }) => {
  const [menu, setMenu] = useState<string | null>(null);
  const syncing = wechatState?.status === SyncStatus.SYNCING || wpState?.status === SyncStatus.SYNCING;

  const statusColor = (s?: SyncState) => {
    if (s?.status === SyncStatus.SUCCESS) return '#10B981';
    if (s?.status === SyncStatus.FAILED) return '#EF4444';
    if (s?.status === SyncStatus.SYNCING) return '#F59E0B';
    return undefined;
  };

  const statusIcon = (s?: SyncState, def: string = '') => {
    if (s?.status === SyncStatus.SYNCING) return '···';
    if (s?.status === SyncStatus.SUCCESS) return '✓';
    if (s?.status === SyncStatus.FAILED) return '!';
    return def;
  };

  const btn: React.CSSProperties = {
    height: '22px',
    padding: '0 8px',
    borderRadius: '4px',
    border: 'none',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-secondary)',
    fontSize: '11px',
    cursor: syncing ? 'wait' : 'pointer',
    opacity: syncing ? 0.6 : 1,
    transition: 'all 100ms',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    lineHeight: '22px',
    flexShrink: 0
  };

  const dropdown: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '3px',
    backgroundColor: 'var(--bg-primary)',
    border: '1px solid var(--border-light)',
    borderRadius: '6px',
    boxShadow: '0 3px 12px rgba(0,0,0,0.12)',
    zIndex: 100,
    overflow: 'hidden',
    minWidth: '72px'
  };

  const item: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '7px 12px',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--text-primary)',
    fontSize: '12px',
    cursor: 'pointer',
    textAlign: 'left'
  };

  const syncBoth = (mode: 'publish' | 'draft') => {
    onSync('wechat', mode);
    if (hasWp) onSync('wordpress', mode);
    setMenu(null);
  };

  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => !syncing && setMenu(menu === 'wx' ? null : 'wx')}
          style={{ ...btn, color: statusColor(wechatState) || btn.color }}
          title="微信"
        >{statusIcon(wechatState, '微信')}</button>
        {menu === 'wx' && (
          <div style={dropdown} onMouseLeave={() => setMenu(null)}>
            <button style={item} onClick={() => { setMenu(null); onSync('wechat', 'draft'); }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>存草稿</button>
            <button style={item} onClick={() => { setMenu(null); onSync('wechat', 'publish'); }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>发布</button>
          </div>
        )}
      </div>

      {hasWp && (
        <>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => !syncing && setMenu(menu === 'wp' ? null : 'wp')}
              style={{ ...btn, color: statusColor(wpState) || btn.color }}
              title="WordPress"
            >{statusIcon(wpState, 'WP')}</button>
            {menu === 'wp' && (
              <div style={dropdown} onMouseLeave={() => setMenu(null)}>
                <button style={item} onClick={() => { setMenu(null); onSync('wordpress', 'draft'); }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>存草稿</button>
                <button style={item} onClick={() => { setMenu(null); onSync('wordpress', 'publish'); }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>发布</button>
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => !syncing && setMenu(menu === 'both' ? null : 'both')}
              style={{ ...btn, border: '1px solid rgba(16,185,129,0.4)', color: 'var(--primary-green)' }}
              title="同时同步"
            >全</button>
            {menu === 'both' && (
              <div style={dropdown} onMouseLeave={() => setMenu(null)}>
                <button style={item} onClick={() => syncBoth('draft')}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>全部存草稿</button>
                <button style={item} onClick={() => syncBoth('publish')}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>全部发布</button>
              </div>
            )}
          </div>
        </>
      )}
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
  articles, loading, error, syncStates, wpSyncStates, hasWordPressConfig, onSync, onBatchSync
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchMenu, setBatchMenu] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; url?: string } | null>(null);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const batch = (target: SyncTarget, mode: 'publish' | 'draft') => {
    if (selected.size > 0) {
      onBatchSync?.(Array.from(selected), target, mode);
      setBatchMenu(null);
    }
  };

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

      {/* 批量操作栏 */}
      {selected.size > 0 && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 50,
          padding: '10px 20px',
          backgroundColor: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex', alignItems: 'center', gap: '12px',
          fontSize: '13px'
        }}>
          <span style={{ color: 'var(--text-secondary)' }}>已选 <b style={{ color: 'var(--primary-green)' }}>{selected.size}</b> 篇</span>
          <div style={{ flex: 1 }} />
          
          {['wechat', 'wordpress'].map(t => (
            (t === 'wechat' || hasWordPressConfig) && (
              <div key={t} style={{ position: 'relative' }}>
                <button
                  onClick={() => setBatchMenu(batchMenu === t ? null : t)}
                  style={{ padding: '5px 12px', borderRadius: '5px', border: '1px solid var(--border-medium)', backgroundColor: 'transparent', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer' }}
                >{t === 'wechat' ? '微信同步' : 'WP同步'}</button>
                {batchMenu === t && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '4px', backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: '6px', boxShadow: '0 3px 12px rgba(0,0,0,0.12)', zIndex: 100, overflow: 'hidden' }} onMouseLeave={() => setBatchMenu(null)}>
                    <button style={{ display: 'block', width: '100%', padding: '8px 14px', border: 'none', backgroundColor: 'transparent', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', textAlign: 'left' }}
                      onClick={() => batch(t === 'wechat' ? 'wechat' : 'wordpress', 'draft')}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>批量存草稿</button>
                    <button style={{ display: 'block', width: '100%', padding: '8px 14px', border: 'none', backgroundColor: 'transparent', color: 'var(--text-primary)', fontSize: '12px', cursor: 'pointer', textAlign: 'left' }}
                      onClick={() => batch(t === 'wechat' ? 'wechat' : 'wordpress', 'publish')}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>批量发布</button>
                  </div>
                )}
              </div>
            )
          ))}
          
          <button onClick={() => setSelected(new Set())} style={{ padding: '5px 10px', border: 'none', backgroundColor: 'transparent', color: 'var(--text-tertiary)', fontSize: '12px', cursor: 'pointer' }}>取消选择</button>
        </div>
      )}

      {/* 卡片网格 */}
      <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '18px' }}>
        {articles.map(article => {
          const cover = article.cover?.type === 'external' ? article.cover.external?.url : article.cover?.file?.url;
          const sel = selected.has(article.id);

          return (
            <div
              key={article.id}
              onClick={() => toggle(article.id)}
              onContextMenu={e => handleContextMenu(e, article.url)}
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderRadius: '12px',
                overflow: 'hidden',
                border: sel ? '2px solid var(--primary-green)' : '1px solid var(--border-light)',
                cursor: 'pointer',
                transition: 'all 180ms ease',
                transform: sel ? 'scale(0.98)' : 'scale(1)',
                boxShadow: sel ? '0 0 0 3px rgba(16,185,129,0.15)' : 'none'
              }}
              onMouseEnter={e => { if (!sel) { e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}}
              onMouseLeave={e => { if (!sel) { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'scale(1)'; }}}
            >
              <CoverImage coverUrl={cover} title={article.title} />
              
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
                  <Actions
                    wechatState={syncStates[article.id]}
                    wpState={wpSyncStates[article.id]}
                    hasWp={hasWordPressConfig}
                    onSync={(t, m) => onSync(article.id, t, m)}
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
