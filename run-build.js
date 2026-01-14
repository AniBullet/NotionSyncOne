/**
 * NotionSyncOne 生产构建脚本
 * 使用方法：node run-build.js 或直接 Run Code
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('======================================');
console.log('   NotionSyncOne 打包构建');
console.log('======================================');
console.log('');

// 设置环境变量
process.env.NODE_ENV = 'production';

// 检查 Node.js 和 pnpm
console.log('[1/4] 检查环境...');
try {
  execSync('node --version', { stdio: 'pipe' });
  console.log('      ✓ Node.js 已安装');
} catch {
  console.error('      ✗ 未找到 Node.js，请先安装');
  process.exit(1);
}

try {
  execSync('pnpm --version', { stdio: 'pipe' });
  console.log('      ✓ pnpm 已安装');
} catch {
  console.error('      ✗ 未找到 pnpm，请运行: npm install -g pnpm');
  process.exit(1);
}
console.log('');

// 检查依赖
console.log('[2/4] 检查依赖...');
if (!fs.existsSync('node_modules')) {
  console.log('      依赖未安装，正在安装...');
  execSync('pnpm install', { stdio: 'inherit' });
  console.log('      ✓ 依赖安装完成');
} else {
  console.log('      ✓ 依赖已存在');
}
console.log('');

// 清理旧构建
console.log('[3/4] 清理旧构建...');
const dirsToClean = ['dist', 'out', 'dist-electron'];
dirsToClean.forEach(dir => {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`      ✓ 已清理 ${dir} 目录`);
  }
});
console.log('');

// 开始构建
console.log('[4/4] 开始打包...');
console.log('');
console.log('======================================');
console.log('[提示] 如果打包失败，请检查:');
console.log('      1. 是否有足够的磁盘空间');
console.log('      2. 杀毒软件是否干扰');
console.log('      3. 是否有管理员权限');
console.log('======================================');
console.log('');

const build = spawn('pnpm', ['build'], {
  shell: true,
  stdio: 'inherit'
});

build.on('close', (code) => {
  console.log('');
  console.log('======================================');
  if (code === 0) {
    console.log('   ✓ 打包完成！');
    console.log('');
    console.log('[清理] 删除临时文件...');
    const unpackedDir = path.join('dist', 'win-unpacked');
    if (fs.existsSync(unpackedDir)) {
      fs.rmSync(unpackedDir, { recursive: true, force: true });
      console.log('      ✓ 已清理临时文件');
    }
    console.log('');
    console.log('   安装程序位于: dist/');
    
    // 列出生成的文件
    if (fs.existsSync('dist')) {
      const files = fs.readdirSync('dist').filter(f => f.endsWith('.exe'));
      files.forEach(file => console.log(`      - ${file}`));
    }
    console.log('');
    console.log('   推荐分享: portable 版本（无需安装）');
  } else {
    console.log('   ✗ 打包失败');
  }
  console.log('======================================');
  console.log('');
  process.exit(code);
});
