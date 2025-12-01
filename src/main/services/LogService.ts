interface LogEntry {
  timestamp: number;
  level: 'info' | 'error' | 'warn' | 'success';
  message: string;
  source?: string;
}

export class LogService {
  private static logs: LogEntry[] = [];
  private static maxLogs = 500;
  private static listeners: Set<(log: LogEntry) => void> = new Set();

  static log(message: string, source?: string) {
    this.addLog('info', message, source);
  }

  static error(message: string, source?: string) {
    this.addLog('error', message, source);
  }

  static warn(message: string, source?: string) {
    this.addLog('warn', message, source);
  }

  static success(message: string, source?: string) {
    this.addLog('success', message, source);
  }

  private static addLog(level: LogEntry['level'], message: string, source?: string) {
    const log: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      source
    };

    this.logs.push(log);
    
    // 限制日志数量
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // 通知所有监听器
    this.listeners.forEach(listener => listener(log));

    // 同时输出到控制台
    const consoleMethod = level === 'error' ? console.error : 
                         level === 'warn' ? console.warn : 
                         console.log;
    const prefix = source ? `[${source}]` : '';
    consoleMethod(`${prefix} ${message}`);
  }

  static getLogs(filter?: { level?: LogEntry['level'], source?: string, keyword?: string }): LogEntry[] {
    let filtered = [...this.logs];

    if (filter) {
      if (filter.level) {
        filtered = filtered.filter(log => log.level === filter.level);
      }
      if (filter.source) {
        filtered = filtered.filter(log => log.source === filter.source);
      }
      if (filter.keyword) {
        const keyword = filter.keyword.toLowerCase();
        filtered = filtered.filter(log => log.message.toLowerCase().includes(keyword));
      }
    }

    return filtered;
  }

  static clearLogs() {
    this.logs = [];
  }

  static subscribe(listener: (log: LogEntry) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

