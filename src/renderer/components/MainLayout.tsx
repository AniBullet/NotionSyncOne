import React, { useState } from 'react';
import { Tab } from '@headlessui/react';
import ConfigPanel from './ConfigPanel';
import ArticlePanel from './ArticlePanel';
import SyncStatusPanel from './SyncStatusPanel';
import ThemeToggle from './ThemeToggle';

// 导入图标（Vite 会自动处理资源路径，兼容开发和生产环境）
import iconUrl from '/icon.png';

const MainLayout: React.FC = () => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <Tab.Group selectedIndex={selectedIndex} onChange={setSelectedIndex}>
      <div className="h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        {/* 优雅的顶部导航栏 - Notion + WeChat 风格 */}
        <header style={{ 
          backgroundColor: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border-light)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            {/* 应用图标和标题 */}
            <div className="flex items-center gap-3">
              <img 
                src={iconUrl} 
                alt="NotionSyncWechat"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-md)'
                }}
              />
              <h1 style={{ 
                fontSize: '20px', 
                fontWeight: '600', 
                color: 'var(--text-primary)',
                letterSpacing: '-0.5px'
              }}>
                NotionSyncWechat
              </h1>
        </div>
            
            {/* 右侧：页签切换 + 主题按钮 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Tab.List style={{
                display: 'flex',
                gap: '8px',
                backgroundColor: 'var(--bg-tertiary)',
                padding: '4px',
                borderRadius: 'var(--radius-md)'
              }}>
                <Tab className="px-4 py-2 text-sm font-medium transition-all outline-none cursor-pointer">
                  {({ selected }) => (
                    <span style={{ 
                      color: selected ? '#FFFFFF' : 'var(--text-secondary)',
                      backgroundColor: selected ? 'var(--primary-green)' : 'transparent',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      display: 'inline-block',
                      fontWeight: selected ? '600' : '500',
                      transition: 'all var(--transition-base)'
                    }}>
                      📄 文章
                    </span>
                  )}
            </Tab>
                <Tab className="px-4 py-2 text-sm font-medium transition-all outline-none cursor-pointer">
                  {({ selected }) => (
                    <span style={{ 
                      color: selected ? '#FFFFFF' : 'var(--text-secondary)',
                      backgroundColor: selected ? 'var(--primary-green)' : 'transparent',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      display: 'inline-block',
                      fontWeight: selected ? '600' : '500',
                      transition: 'all var(--transition-base)'
                    }}>
                      📊 状态
                    </span>
                  )}
            </Tab>
                <Tab className="px-4 py-2 text-sm font-medium transition-all outline-none cursor-pointer">
                  {({ selected }) => (
                    <span style={{ 
                      color: selected ? '#FFFFFF' : 'var(--text-secondary)',
                      backgroundColor: selected ? 'var(--primary-green)' : 'transparent',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      display: 'inline-block',
                      fontWeight: selected ? '600' : '500',
                      transition: 'all var(--transition-base)'
                    }}>
                      ⚙️ 配置
                    </span>
                  )}
            </Tab>
          </Tab.List>
              
              {/* 主题切换按钮 */}
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <Tab.Panels className="h-full">
            <Tab.Panel className="h-full">
              <ArticlePanel />
            </Tab.Panel>
            <Tab.Panel className="h-full">
              <SyncStatusPanel />
            </Tab.Panel>
            <Tab.Panel className="h-full">
              <ConfigPanel onConfigSaved={() => {}} />
            </Tab.Panel>
          </Tab.Panels>
      </main>
    </div>
    </Tab.Group>
  );
};

export default MainLayout; 