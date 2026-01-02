import React, { useState, useRef, useEffect } from 'react';
import { SyncState, SyncStatus } from '../../shared/types/sync';

// 同步目标平台
export type SyncTarget = 'wechat' | 'wordpress' | 'both';

interface SyncButtonProps {
  articleId: string;
  state: SyncState;
  wpState?: SyncState;
  onSync: (articleId: string, target: SyncTarget, mode: 'publish' | 'draft') => void;
  hasWordPressConfig?: boolean;
}

const SyncButton: React.FC<SyncButtonProps> = ({ 
  articleId, 
  state, 
  wpState,
  onSync,
  hasWordPressConfig = false 
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const isSyncing = state.status === SyncStatus.SYNCING || wpState?.status === SyncStatus.SYNCING;
  const isSuccess = state.status === SyncStatus.SUCCESS;
  const isFailed = state.status === SyncStatus.FAILED;
  const wpIsSuccess = wpState?.status === SyncStatus.SUCCESS;
  const wpIsFailed = wpState?.status === SyncStatus.FAILED;

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getButtonClass = () => {
    if (isSyncing) {
      return 'btn-syncing';
    } else if (isSuccess && (!hasWordPressConfig || wpIsSuccess)) {
      return 'btn-success';
    } else if (isFailed || wpIsFailed) {
      return 'btn-error';
    } else {
      return 'btn-primary';
    }
  };

  const getButtonText = () => {
    if (isSyncing) {
      return '⏳ 同步中...';
    } else if (isSuccess && (!hasWordPressConfig || wpIsSuccess)) {
      return '✅ 同步成功';
    } else if (isFailed || wpIsFailed) {
      return '❌ 同步失败';
    } else {
      return '🔄 同步';
    }
  };

  const handleMenuClick = (target: SyncTarget, mode: 'publish' | 'draft') => {
    setShowMenu(false);
    onSync(articleId, target, mode);
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={menuRef}>
      <button
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        disabled={isSyncing}
        className={`btn ${getButtonClass()}`}
        style={{
          padding: '8px 16px',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          opacity: isSyncing ? 0.7 : 1,
          cursor: isSyncing ? 'not-allowed' : 'pointer',
        }}
      >
        {getButtonText()}
        <span style={{ marginLeft: '4px' }}>▼</span>
      </button>

      {/* 下拉菜单 */}
      {showMenu && !isSyncing && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '4px',
            backgroundColor: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 1000,
            minWidth: '200px',
            overflow: 'hidden',
          }}
        >
          {/* 微信公众号选项 */}
          <div style={{ 
            padding: '8px 12px', 
            backgroundColor: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-color)',
            fontSize: '12px',
            fontWeight: '600',
            color: 'var(--text-secondary)'
          }}>
            💬 微信公众号
          </div>
          <button
            onClick={() => handleMenuClick('wechat', 'draft')}
            style={{
              width: '100%',
              padding: '10px 16px',
              textAlign: 'left',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              fontSize: '14px',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            📝 保存为草稿
          </button>
          <button
            onClick={() => handleMenuClick('wechat', 'publish')}
            style={{
              width: '100%',
              padding: '10px 16px',
              textAlign: 'left',
              border: 'none',
              backgroundColor: 'transparent',
              cursor: 'pointer',
              fontSize: '14px',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderBottom: hasWordPressConfig ? '1px solid var(--border-color)' : 'none',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            🚀 直接发布
          </button>

          {/* WordPress 选项（仅在配置了 WordPress 时显示） */}
          {hasWordPressConfig && (
            <>
              <div style={{ 
                padding: '8px 12px', 
                backgroundColor: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-color)',
                fontSize: '12px',
                fontWeight: '600',
                color: 'var(--text-secondary)'
              }}>
                📝 WordPress
              </div>
              <button
                onClick={() => handleMenuClick('wordpress', 'draft')}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  textAlign: 'left',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                📝 保存为草稿
              </button>
              <button
                onClick={() => handleMenuClick('wordpress', 'publish')}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  textAlign: 'left',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderBottom: '1px solid var(--border-color)',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                🚀 直接发布
              </button>

              {/* 同时同步选项 */}
              <div style={{ 
                padding: '8px 12px', 
                backgroundColor: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-color)',
                fontSize: '12px',
                fontWeight: '600',
                color: 'var(--text-secondary)'
              }}>
                🔗 同时同步
              </div>
              <button
                onClick={() => handleMenuClick('both', 'draft')}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  textAlign: 'left',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                📝 全部保存为草稿
              </button>
              <button
                onClick={() => handleMenuClick('both', 'publish')}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  textAlign: 'left',
                  border: 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                🚀 全部直接发布
              </button>
            </>
          )}
        </div>
      )}

      {/* 状态信息 */}
      {(state.error || wpState?.error) && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: '4px',
          padding: '8px 12px',
          backgroundColor: 'var(--error-bg)',
          color: 'var(--error-color)',
          borderRadius: '4px',
          fontSize: '12px',
          maxWidth: '300px',
          whiteSpace: 'pre-wrap',
          zIndex: 999,
        }}>
          {state.error && <div>微信: {state.error}</div>}
          {wpState?.error && <div>WordPress: {wpState.error}</div>}
        </div>
      )}
    </div>
  );
};

export default SyncButton;
