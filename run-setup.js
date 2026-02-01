/**
 * NotionSyncOne 环境初始化脚本
 * 使用方法：node run-setup.js 或直接 Run Code
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 设置Windows终端为UTF-8编码（修复中文乱码）
if (os.platform() === 'win32') {
  try {
    execSync('chcp 65001', { stdio: 'pipe' });
    if (process.stdout.setEncoding) {
      process.stdout.setEncoding('utf8');
    }
  } catch (err) {
    // 忽略错误，继续执行
  }
}

console.log('======================================');
console.log('   NotionSyncOne 环境初始化');
console.log('======================================');
console.log('');

// [1/6] 检查 Node.js
console.log('[1/6] 检查 Node.js...');
try {
  const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
  console.log(`      ✓ Node.js 版本: ${nodeVersion}`);
} catch {
  console.error('      ✗ 未找到 Node.js，请先安装');
  console.error('      下载: https://nodejs.org/');
  process.exit(1);
}
console.log('');

// [2/6] 检查并安装 pnpm
console.log('[2/6] 检查 pnpm...');
try {
  const pnpmVersion = execSync('pnpm --version', { encoding: 'utf8' }).trim();
  console.log(`      ✓ pnpm 已安装，版本: ${pnpmVersion}`);
} catch {
  console.log('      pnpm 未安装，正在安装...');
  try {
    execSync('npm install -g pnpm', { stdio: 'inherit' });
    const pnpmVersion = execSync('pnpm --version', { encoding: 'utf8' }).trim();
    console.log(`      ✓ pnpm 安装成功，版本: ${pnpmVersion}`);
  } catch {
    console.error('      ✗ pnpm 安装失败');
    process.exit(1);
  }
}
console.log('');

// [3/6] 清理旧的依赖
console.log('[3/6] 清理旧的依赖...');
if (fs.existsSync('node_modules')) {
  console.log('      删除 node_modules...');
  fs.rmSync('node_modules', { recursive: true, force: true });
}
if (fs.existsSync('pnpm-lock.yaml')) {
  console.log('      删除 pnpm-lock.yaml...');
  fs.unlinkSync('pnpm-lock.yaml');
}
console.log('      ✓ 清理完成');
console.log('');

// [4/6] 创建配置文件
console.log('[4/6] 创建配置文件...');
const npmrcContent = `enable-pre-post-scripts=true
side-effects-cache=true
shamefully-hoist=true
electron_mirror=https://npmmirror.com/mirrors/electron/
electron_builder_binaries_mirror=https://npmmirror.com/mirrors/electron-builder-binaries/`;
fs.writeFileSync('.npmrc', npmrcContent, 'utf8');
console.log('      ✓ .npmrc 创建成功（已配置国内镜像）');
console.log('');

// [5/6] 安装所有依赖（一次到位）
console.log('[5/6] 安装项目依赖...');
console.log('      这可能需要几分钟时间，请耐心等待...');
console.log('      pnpm 会自动安装 Electron 二进制文件...');
try {
  // 设置环境变量确保 Electron 安装
  const env = { ...process.env, ELECTRON_SKIP_BINARY_DOWNLOAD: '0' };
  execSync('pnpm install', { stdio: 'inherit', env });
  console.log('      ✓ 所有依赖安装成功');
} catch {
  console.error('      ✗ 依赖安装失败');
  process.exit(1);
}
console.log('');

// [6/6] 验证并修复 Electron
console.log('[6/6] 验证 Electron...');
try {
  // 尝试 require electron 来验证是否正常
  execSync('node -e "require(\'electron\')"', { stdio: 'pipe' });
  console.log('      ✓ Electron 验证通过');
} catch {
  console.log('      ⚠ Electron 验证失败，正在自动修复...');
  try {
    const electronInstallScript = path.join('node_modules', 'electron', 'install.js');
    if (fs.existsSync(electronInstallScript)) {
      execSync(`node "${electronInstallScript}"`, { stdio: 'inherit' });
      console.log('      ✓ Electron 修复成功');
    } else {
      console.error('      ✗ 找不到 Electron 安装脚本');
      process.exit(1);
    }
  } catch (error) {
    console.error('      ✗ Electron 修复失败');
    console.error('      请检查网络连接后重试');
    process.exit(1);
  }
}
console.log('');

// 检查 biliup 和 yt-dlp（如果需要B站功能）
console.log('======================================');
console.log('   功能工具检查');
console.log('======================================');
console.log('');

console.log('[功能] 检查 biliup (B站上传)...');
try {
  execSync('biliup --version', { stdio: 'pipe' });
  console.log('      ✓ biliup 已安装');
} catch {
  console.log('      ⚠ biliup 未安装（如需B站功能请安装）');
  console.log('      安装: winget install biliup');
}
console.log('');

console.log('[功能] 检查 yt-dlp (视频下载)...');
try {
  execSync('yt-dlp --version', { stdio: 'pipe' });
  console.log('      ✓ yt-dlp 已安装');
} catch {
  console.log('      ⚠ yt-dlp 未安装（如需下载外部视频请安装）');
  console.log('      安装: winget install yt-dlp.yt-dlp');
}
console.log('');

console.log('[功能] 检查 FFmpeg (视频压缩)...');
try {
  execSync('ffmpeg -version', { stdio: 'pipe' });
  console.log('      ✓ FFmpeg 已安装');
} catch {
  console.log('      ⚠ FFmpeg 未安装（如需视频压缩请安装）');
  console.log('      安装: winget install Gyan.FFmpeg');
}
console.log('');

// 完成
console.log('======================================');
console.log('   ✓ 环境初始化完成！');
console.log('======================================');
console.log('');
console.log('下一步:');
console.log('  1. 运行开发服务器: node run-dev.js');
console.log('  2. 或按 Ctrl+Shift+B 快捷启动');
console.log('');
