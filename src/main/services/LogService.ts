interface LogEntry {
  timestamp: number;
  level: 'info' | 'error' | 'warn' | 'success';
  message: string;
  source?: string;
}

export class LogService {
  private static logs: LogEntry[] = [];
  private static maxLogs = 300; // 减少最大日志数量，从 500 -> 300
  private static listeners: Set<(log: LogEntry) => void> = new Set();
  private static isDevelopment = process.env.NODE_ENV === 'development';

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
    
    // 限制日志数量，防止内存占用过大
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // 通知所有监听器
    this.listeners.forEach(listener => listener(log));

    // 控制台输出：生产环境只输出错误和警告，开发环境输出所有日志
    const shouldLog = this.isDevelopment || level === 'error' || level === 'warn';
    if (shouldLog) {
      const consoleMethod = level === 'error' ? console.error : 
                           level === 'warn' ? console.warn : 
                           console.log;
      const prefix = source ? `[${source}]` : '';
      consoleMethod(`${prefix} ${message}`);
    }
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

