import React from 'react';
import { useTheme } from '../contexts/useTheme';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '36px',
        height: '36px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-medium)',
        backgroundColor: 'var(--bg-tertiary)',
        color: 'var(--text-primary)',
        cursor: 'pointer',
        transition: 'all var(--transition-base)',
        fontSize: '18px'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
        e.currentTarget.style.borderColor = 'var(--primary-green)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
        e.currentTarget.style.borderColor = 'var(--border-medium)';
      }}
      title={theme === 'dark' ? '切换到明亮模式' : '切换到暗黑模式'}
    >
      {theme === 'dark' ? '🌙' : '☀️'}
    </button>
  );
};

export default ThemeToggle;

