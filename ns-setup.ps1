# NotionSyncOne 环境初始化脚本 (Windows)
# 前提条件：已安装 Node.js

# 确保在项目根目录
Set-Location -Path $PSScriptRoot

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

# 检查 B站投稿工具（可选）
Write-Host ""
Write-Host "======================================"
Write-Host "  检查可选工具 (B站投稿功能)"
Write-Host "======================================"
Write-Host ""

$needInstall = $false
$toolsToInstall = @()

# 检查 biliup
Write-Host "[可选] 检查 biliup-rs..."
try {
    $biliupVersion = biliup --version 2>$null
    Write-Host "        ✓ biliup 已安装: $biliupVersion" -ForegroundColor Green
} catch {
    Write-Host "        ✗ biliup 未安装，将自动安装..." -ForegroundColor Yellow
    $needInstall = $true
    $toolsToInstall += "biliup"
}

# 检查 ffmpeg
Write-Host ""
Write-Host "[可选] 检查 FFmpeg..."
try {
    $ffmpegVersion = ffmpeg -version 2>$null | Select-Object -First 1
    Write-Host "        ✓ FFmpeg 已安装" -ForegroundColor Green
} catch {
    Write-Host "        ✗ FFmpeg 未安装，将自动安装..." -ForegroundColor Yellow
    $needInstall = $true
    $toolsToInstall += "FFmpeg"
}

# 检查 yt-dlp
Write-Host ""
Write-Host "[可选] 检查 yt-dlp (下载YouTube/Twitter等视频)..."
try {
    $ytdlpVersion = yt-dlp --version 2>$null
    Write-Host "        ✓ yt-dlp 已安装: $ytdlpVersion" -ForegroundColor Green
} catch {
    Write-Host "        ✗ yt-dlp 未安装，将自动安装..." -ForegroundColor Yellow
    $needInstall = $true
    $toolsToInstall += "yt-dlp"
}

# 自动安装缺失的工具
if ($needInstall) {
    Write-Host ""
    Write-Host "正在自动安装 B站投稿工具..." -ForegroundColor Yellow
    Write-Host ""
    
    if ($toolsToInstall -contains "biliup") {
        Write-Host "  [1/2] 安装 biliup-rs..." -ForegroundColor Cyan
        try {
            $output = winget install ForgQi.biliup-rs --silent --accept-package-agreements --accept-source-agreements 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "        ✓ biliup 安装成功" -ForegroundColor Green
                
                # 刷新当前会话的 PATH 环境变量
                $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
                
                # 验证安装
                try {
                    $biliupTest = biliup --version 2>$null
                    Write-Host "        ✓ 验证成功: $biliupTest" -ForegroundColor Green
                } catch {
                    Write-Host "        ⚠ 已安装但需要重启终端才能使用" -ForegroundColor Yellow
                }
            } else {
                Write-Host "        ⚠ biliup 安装失败（可手动安装）" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "        ⚠ biliup 安装失败（可手动安装）" -ForegroundColor Yellow
        }
    }
    
    if ($toolsToInstall -contains "FFmpeg") {
        Write-Host "  [2/3] 安装 FFmpeg..." -ForegroundColor Cyan
        try {
            $output = winget install BtbN.FFmpeg.GPL --silent --accept-package-agreements --accept-source-agreements 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "        ✓ FFmpeg 安装成功" -ForegroundColor Green
                
                # 刷新当前会话的 PATH 环境变量
                $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
                
                # 验证安装
                try {
                    $ffmpegTest = ffmpeg -version 2>$null | Select-Object -First 1
                    Write-Host "        ✓ 验证成功" -ForegroundColor Green
                } catch {
                    Write-Host "        ⚠ 已安装但需要重启终端才能使用" -ForegroundColor Yellow
                }
            } else {
                Write-Host "        ⚠ FFmpeg 安装失败（可手动安装）" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "        ⚠ FFmpeg 安装失败（可手动安装）" -ForegroundColor Yellow
        }
    }
    
    if ($toolsToInstall -contains "yt-dlp") {
        Write-Host "  [3/3] 安装 yt-dlp..." -ForegroundColor Cyan
        try {
            Write-Host "        正在执行: winget install yt-dlp.yt-dlp" -ForegroundColor DarkGray
            $output = winget install yt-dlp.yt-dlp --silent --accept-package-agreements --accept-source-agreements 2>&1
            Write-Host "        安装命令退出码: $LASTEXITCODE" -ForegroundColor DarkGray
            
            if ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq -1978335189) {
                Write-Host "        ✓ yt-dlp 安装成功" -ForegroundColor Green
                
                # 刷新当前会话的 PATH 环境变量
                $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
                
                # 等待一秒让系统注册
                Start-Sleep -Seconds 1
                
                # 验证安装 - 先检查安装位置
                $ytdlpLocations = @(
                    "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\yt-dlp.yt-dlp_Microsoft.Winget.Source_8wekyb3d8bbwe",
                    "$env:LOCALAPPDATA\Microsoft\WinGet\Links",
                    "$env:USERPROFILE\.local\bin"
                )
                
                $foundPath = $null
                foreach ($location in $ytdlpLocations) {
                    if (Test-Path "$location\yt-dlp.exe") {
                        $foundPath = $location
                        Write-Host "        找到 yt-dlp.exe: $foundPath" -ForegroundColor DarkGray
                        break
                    }
                }
                
                # 验证安装
                try {
                    $ytdlpTest = yt-dlp --version 2>$null
                    Write-Host "        ✓ 验证成功: $ytdlpTest" -ForegroundColor Green
                } catch {
                    if ($foundPath) {
                        Write-Host "        ⚠ 已安装在 $foundPath 但需要重启终端才能使用" -ForegroundColor Yellow
                    } else {
                        Write-Host "        ⚠ 已安装但需要重启终端才能使用" -ForegroundColor Yellow
                    }
                }
            } else {
                Write-Host "        ⚠ yt-dlp 安装失败（退出码: $LASTEXITCODE）" -ForegroundColor Yellow
                Write-Host "        输出: $output" -ForegroundColor DarkGray
            }
        } catch {
            Write-Host "        ⚠ yt-dlp 安装失败: $_" -ForegroundColor Yellow
        }
    }
    
    Write-Host ""
    Write-Host "✓ B站投稿工具安装完成" -ForegroundColor Green
    Write-Host "  ⚠ 重要：请【关闭并重新打开】所有终端和应用程序，让 PATH 环境变量生效" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "✓ 所有B站工具已就绪" -ForegroundColor Green
}

Write-Host ""
Write-Host "======================================"
Write-Host "  安装完成！"
Write-Host "======================================"
Write-Host ""

# 检查是否安装了新工具
$installedNewTools = ($toolsToInstall.Count -gt 0) -and $needInstall
if ($installedNewTools) {
    Write-Host "⚠️  重要提示：已安装新的命令行工具（biliup/ffmpeg/yt-dlp）" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   请执行以下步骤使工具生效：" -ForegroundColor Yellow
    Write-Host "   1. 【关闭】当前所有终端窗口" -ForegroundColor Cyan
    Write-Host "   2. 【关闭】NotionSyncOne 应用（如果正在运行）" -ForegroundColor Cyan
    Write-Host "   3. 【重新打开】终端和应用" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "可用命令："
Write-Host "  pnpm dev        - 启动开发服务器"
Write-Host "  pnpm build      - 构建生产版本"
Write-Host ""
Write-Host "或使用脚本："
Write-Host "  .\ns-dev.cmd    - 启动开发服务器"
Write-Host "  .\ns-build.cmd  - 构建生产版本"
Write-Host ""

if ($installedNewTools) {
    Write-Host "💡 提示：B站投稿功能需要在重启应用后，在设置中启用" -ForegroundColor Cyan
} else {
    Write-Host "提示：如需使用B站投稿功能，请在应用设置中启用" -ForegroundColor Cyan
}
Write-Host ""

