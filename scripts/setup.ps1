# NotionSyncOne 环境初始化脚本 (Windows)
# 前提条件：已安装 Node.js

# 切换到项目根目录
Set-Location -Path (Split-Path -Parent $PSScriptRoot)

Write-Host "======================================"
Write-Host "  NotionSyncOne 环境初始化"
Write-Host "======================================"
Write-Host ""

# 检查 Node.js 是否安装
Write-Host "[1/6] 检查 Node.js..."
try {
    $nodeVersion = node --version
    Write-Host "      Node.js 版本: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "      错误: 未找到 Node.js，请先安装 Node.js" -ForegroundColor Red
    exit 1
}

# 检查并安装 pnpm
Write-Host ""
Write-Host "[2/6] 检查 pnpm..."
try {
    $pnpmVersion = pnpm --version 2>$null
    Write-Host "      pnpm 已安装，版本: $pnpmVersion" -ForegroundColor Green
} catch {
    Write-Host "      pnpm 未安装，正在安装..." -ForegroundColor Yellow
    npm install -g pnpm
    if ($LASTEXITCODE -eq 0) {
        $pnpmVersion = pnpm --version
        Write-Host "      pnpm 安装成功，版本: $pnpmVersion" -ForegroundColor Green
    } else {
        Write-Host "      pnpm 安装失败" -ForegroundColor Red
        exit 1
    }
}

# 清理旧的依赖（如果存在）
Write-Host ""
Write-Host "[3/6] 清理旧的依赖..."
if (Test-Path "node_modules") {
    Write-Host "      删除 node_modules..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force node_modules
}
if (Test-Path "pnpm-lock.yaml") {
    Write-Host "      删除 pnpm-lock.yaml..." -ForegroundColor Yellow
    Remove-Item -Force pnpm-lock.yaml
}
Write-Host "      清理完成" -ForegroundColor Green

# 创建 .npmrc 配置
Write-Host ""
Write-Host "[4/6] 创建配置文件..."
$npmrcContent = @"
enable-pre-post-scripts=true
side-effects-cache=true
"@
$npmrcContent | Out-File -FilePath ".npmrc" -Encoding utf8 -NoNewline
Write-Host "      .npmrc 创建成功" -ForegroundColor Green

# 安装依赖
Write-Host ""
Write-Host "[5/6] 安装项目依赖..."
Write-Host "      这可能需要几分钟时间，请耐心等待..." -ForegroundColor Yellow
pnpm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "      依赖安装失败" -ForegroundColor Red
    exit 1
}

# 手动安装 Electron（因为 pnpm 可能会忽略构建脚本）
Write-Host ""
Write-Host "[6/6] 配置 Electron..."
Write-Host "      使用国内镜像加速 Electron 下载..." -ForegroundColor Yellow

# 为 Electron 设置国内镜像（如有需要可自行修改为其他镜像）
# 常见镜像：
#   - https://npmmirror.com/mirrors/electron/
#   - https://registry.npmmirror.com/-/binary/electron/
if (-not $env:ELECTRON_MIRROR) {
    $env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
}
Write-Host "      ELECTRON_MIRROR = $($env:ELECTRON_MIRROR)" -ForegroundColor DarkGray

if (Test-Path "node_modules\electron\install.js") {
    node node_modules\electron\install.js
    Write-Host "      Electron 配置成功" -ForegroundColor Green
} else {
    # 尝试在 pnpm 的存储路径中查找
    $electronInstallScript = Get-ChildItem -Path "node_modules\.pnpm" -Filter "install.js" -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.FullName -match "electron" } | Select-Object -First 1
    if ($electronInstallScript) {
        node $electronInstallScript.FullName
        Write-Host "      Electron 配置成功" -ForegroundColor Green
    } else {
        Write-Host "      警告: 未找到 Electron 安装脚本，但可能已正确安装" -ForegroundColor Yellow
    }
}

# 验证安装
Write-Host ""
Write-Host "======================================"
Write-Host "  验证安装"
Write-Host "======================================"

$electronPath = Get-ChildItem -Path "node_modules\.pnpm" -Filter "electron.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if ($electronPath) {
    Write-Host "✓ Electron 已正确安装" -ForegroundColor Green
} else {
    Write-Host "⚠ Electron 可能未正确安装" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "======================================"
Write-Host "  安装完成！"
Write-Host "======================================"
Write-Host ""
Write-Host "可用命令："
Write-Host "  pnpm dev        - 启动开发服务器"
Write-Host "  pnpm build      - 构建生产版本"
Write-Host ""
Write-Host "或使用脚本："
Write-Host "  .\scripts\dev.cmd    - 启动开发服务器"
Write-Host "  .\scripts\build.cmd  - 构建生产版本"
Write-Host ""
