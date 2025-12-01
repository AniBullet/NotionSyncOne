import React, { useState, useEffect, useRef } from 'react';

interface LogEntry {
  timestamp: number;
  level: 'info' | 'error' | 'warn' | 'success';
  message: string;
  source?: string;
}

const DebugPanel: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'sync'>('sync');
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 从 localStorage 恢复日志
    const savedLogs = localStorage.getItem('debug-logs');
    if (savedLogs) {
      try {
        const parsed = JSON.parse(savedLogs);
        setLogs(parsed);
      } catch (e) {
        console.error('恢复日志失败:', e);
      }
    }

    // 加载初始日志（只显示同步相关的）
    const loadLogs = async () => {
      try {
        const allLogs = await window.electron.ipcRenderer.invoke('get-logs', {
          source: filter === 'sync' ? undefined : undefined, // 暂时不过滤，让用户选择
          keyword: filter === 'sync' ? '同步' : undefined
        });
        setLogs(allLogs || []);
      } catch (error) {
        console.error('加载日志失败:', error);
      }
    };

    loadLogs();

    // 订阅日志更新
    window.electron.ipcRenderer.invoke('subscribe-logs').catch(err => {
      console.error('订阅日志失败:', err);
    });

    // 监听日志更新
    const handleLogUpdate = (log: LogEntry) => {
      setLogs(prev => {
        const newLogs = [...prev, log].slice(-200); // 保留最近200条
        // 保存到 localStorage
        try {
          localStorage.setItem('debug-logs', JSON.stringify(newLogs));
        } catch (e) {
          console.error('保存日志失败:', e);
        }
        return newLogs;
      });
    };

    window.electron.ipcRenderer.on('log-update', (_, log) => handleLogUpdate(log));

    return () => {
      window.electron.ipcRenderer.removeListener('log-update', handleLogUpdate);
    };
  }, [filter]);

  // 自动滚动到底部
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const clearLogs = async () => {
    try {
      await window.electron.ipcRenderer.invoke('clear-logs');
      setLogs([]);
      localStorage.removeItem('debug-logs');
    } catch (error) {
      console.error('清空日志失败:', error);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  // 过滤日志
  const filteredLogs = filter === 'sync' 
    ? logs.filter(log => 
        log.source === 'SyncService' || 
        log.source === 'WeChatService' ||
        log.message.includes('同步') ||
        log.message.includes('Sync') ||
        log.message.includes('WeChat')
      )
    : logs;

  const clearLogs = () => {
    setLogs([]);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-gray-700 z-50"
      >
        调试日志
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 h-96 bg-white border border-gray-300 rounded-lg shadow-xl z-50 flex flex-col">
      <div className="bg-gray-800 text-white p-2 flex justify-between items-center rounded-t-lg">
        <h3 className="font-semibold">调试日志</h3>
        <div className="flex space-x-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'all' | 'sync')}
            className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-white"
          >
            <option value="sync">仅同步</option>
            <option value="all">全部</option>
          </select>
          <button
            onClick={clearLogs}
            className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded"
          >
            清空
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded"
          >
            关闭
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 text-xs font-mono">
        {filteredLogs.length === 0 ? (
          <div className="text-gray-400 text-center mt-4">暂无日志</div>
        ) : (
          <>
            {filteredLogs.map((log, index) => (
              <div
                key={index}
                className={`mb-1 p-1 rounded ${
                  log.level === 'error' ? 'bg-red-50 text-red-800' :
                  log.level === 'success' ? 'bg-green-50 text-green-800' :
                  log.level === 'warn' ? 'bg-yellow-50 text-yellow-800' :
                  'bg-gray-50 text-gray-800'
                }`}
              >
                <span className="text-gray-500">[{formatTime(log.timestamp)}]</span>
                {log.source && (
                  <span className="text-blue-600 ml-1">[{log.source}]</span>
                )}
                <span className="ml-2">{log.message}</span>
              </div>
            ))}
            <div ref={logsEndRef} />
          </>
        )}
      </div>
    </div>
  );
};

export default DebugPanel;

