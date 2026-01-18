/**
 * NotionSyncOne 开发服务器启动脚本
 * 可以直接在 Cursor 中使用 "Run Code" 运行
 * 
 * 使用方法：
 * 1. 在 Cursor 中打开此文件
 * 2. 点击右上角的 "Run Code" 按钮（或按 Ctrl+Alt+N）
 * 3. 或者在终端运行: node dev.js
 */

const { spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

console.log('======================================');
console.log('   NotionSyncOne Dev Server');
console.log('======================================');
console.log('');

// 设置环境变量
process.env.NODE_ENV = 'development';

// 检查依赖是否已安装
if (!fs.existsSync('node_modules')) {
  console.error('❌ 依赖未安装！');
  console.error('');
  console.error('请先运行环境初始化:');
  console.error('  node run-setup.js');
  console.error('');
  process.exit(1);
}

// 不再检查 Electron 二进制文件
// pnpm 使用符号链接，实际路径可能不同，相信 pnpm install 的结果

// 检查操作系统
const isWindows = os.platform() === 'win32';

console.log('[1/3] 检测环境...');
console.log(`      操作系统: ${os.platform()}`);
console.log(`      Node 版本: ${process.version}`);
console.log(`      ✓ 依赖已安装`);
console.log('');

// 清理端口（静默执行，不阻塞）
console.log('[2/3] 检查端口 5173...');
const { execSync } = require('child_process');

try {
  if (isWindows) {
    // Windows: 查找并关闭占用 5173 端口的进程
    execSync('netstat -ano | findstr :5173 | findstr LISTENING > nul && (for /f "tokens=5" %a in (\'netstat -ano ^| findstr :5173 ^| findstr LISTENING\') do taskkill /F /PID %a >nul 2>&1) || echo.', { 
      stdio: 'pipe',
      shell: 'cmd.exe'
    });
  } else {
    // Unix/Linux/Mac: 清理端口
    execSync('lsof -ti:5173 | xargs kill -9 2>/dev/null || true', { stdio: 'pipe' });
  }
  console.log('      端口已清理');
} catch {
  // 端口未被占用或清理失败，继续执行
  console.log('      端口空闲');
}
console.log('');
startDevServer();

function startDevServer() {
  console.log('[3/3] 启动开发服务器...');
  console.log('');
  console.log('======================================');
  console.log('   热重载已启用');
  console.log('   - 代码修改自动编译');
  console.log('   - 按 Ctrl+C 停止服务');
  console.log('======================================');
  console.log('');

  // 注意：Windows 必须使用 shell 来执行 .cmd 文件
  // 这会产生 DEP0190 警告，但是安全的，因为：
  // 1. 参数使用数组传递，不是字符串拼接
  // 2. 命令和参数都是固定的，没有用户输入
  const dev = spawn('pnpm', ['dev'], {
    stdio: 'inherit',
    env: process.env,
    shell: isWindows
  });

  dev.on('error', (error) => {
    console.error('启动失败:', error.message);
    if (error.message.includes('ENOENT')) {
      console.error('\n[错误] 未找到 pnpm，请确保已安装:');
      console.error('  npm install -g pnpm');
    }
    process.exit(1);
  });

  dev.on('close', (code) => {
    if (code !== 0) {
      console.log(`\n开发服务器已停止 (退出码: ${code})`);
    }
    process.exit(code);
  });

  // 处理 Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n正在停止开发服务器...');
    dev.kill('SIGINT');
  });
}
