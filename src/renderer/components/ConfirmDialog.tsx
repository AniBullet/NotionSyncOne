import React from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'info' | 'warning' | 'danger';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel,
  type = 'info'
}) => {
  if (!isOpen) return null;

  const getTypeColor = () => {
    switch (type) {
      case 'warning':
        return '#F59E0B';
      case 'danger':
        return '#EF4444';
      default:
        return 'var(--primary-green)';
    }
  };

  const getTypeIcon = () => {
    switch (type) {
      case 'warning':
        return '⚠️';
      case 'danger':
        return '🚨';
      default:
        return '🚀';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(4px)'
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          width: '90%',
          maxWidth: '420px',
          overflow: 'hidden',
          animation: 'slideUp 0.2s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div style={{
          padding: 'var(--spacing-lg)',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)'
        }}>
          <span style={{ fontSize: '24px' }}>{getTypeIcon()}</span>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: 'var(--text-primary)',
            margin: 0
          }}>
            {title}
          </h3>
        </div>

        {/* 内容 */}
        <div style={{
          padding: 'var(--spacing-lg)',
          color: 'var(--text-secondary)',
          fontSize: '14px',
          lineHeight: '1.6'
        }}>
          {message}
        </div>

        {/* 按钮 */}
        <div style={{
          padding: 'var(--spacing-lg)',
          borderTop: '1px solid var(--border-light)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 'var(--spacing-sm)'
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-medium)',
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all var(--transition-base)',
              fontWeight: '500'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              e.currentTarget.style.borderColor = 'var(--text-secondary)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = 'var(--border-medium)';
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 20px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              backgroundColor: getTypeColor(),
              color: '#FFFFFF',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all var(--transition-base)',
              fontWeight: '600',
              boxShadow: 'var(--shadow-sm)'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>

      <style>
        {`
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
    </div>
  );
};

export default ConfirmDialog;

