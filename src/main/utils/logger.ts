/**
 * 日志工具 - 根据环境控制日志输出
 */

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = {
  log: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  
  error: (...args: unknown[]) => {
    console.error(...args);
  },
  
  info: (...args: unknown[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  
  // 总是输出的重要日志
  always: (...args: unknown[]) => {
    console.log(...args);
  }
};

