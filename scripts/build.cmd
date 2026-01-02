@echo off
REM 切换到项目根目录
cd /d "%~dp0\.."

REM 检测管理员权限（静默检测，不自动提升）
REM 如需管理员权限，请手动右键"以管理员身份运行"

chcp 65001 > nul
echo.
echo =====================================
echo   NotionSyncOne 打包构建
echo =====================================
echo.

REM 智能检测环境
set NODE_ENV=production

REM 尝试添加常见路径到 PATH
set "PATH=%LOCALAPPDATA%\pnpm;%APPDATA%\npm;%PATH%"

REM 检测常见的 Node.js 安装位置
if exist "C:\Program Files\nodejs\node.exe" set "PATH=C:\Program Files\nodejs;%PATH%"
if exist "D:\Program Files\nodejs\node.exe" set "PATH=D:\Program Files\nodejs;%PATH%"
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"
if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"

REM 检测是否能找到命令
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 无法找到 Node.js，请确保已安装
    echo 下载: https://nodejs.org/
    pause
    exit /b 1
)

where pnpm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 无法找到 pnpm，请先安装
    echo 运行: npm install -g pnpm
    pause
    exit /b 1
)

rem 检查依赖
echo [1/3] 检查依赖...
if not exist "node_modules" (
    echo       ^> 依赖未安装，正在安装...
    pnpm install
    echo       ^> 依赖安装完成
) else (
    echo       ^> 依赖已存在
)
echo.

rem 清理旧构建（确保使用最新代码）
echo [2/3] 清理旧构建...
if exist "dist" (
    rd /s /q "dist" 2>nul
    echo       ^> 已清理 dist 目录
)
if exist "out" (
    rd /s /q "out" 2>nul
    echo       ^> 已清理 out 目录
)
if exist "dist-electron" (
    rd /s /q "dist-electron" 2>nul
    echo       ^> 已清理 dist-electron 目录
)
echo.

rem 开始构建
echo [3/3] 开始打包...
echo.
echo =====================================
echo [提示] 如果打包失败(提示权限错误)，请:
echo       1. 右键点击此脚本
echo       2. 选择"以管理员身份运行"
echo.
pnpm build

echo.
echo =====================================
if %ERRORLEVEL% EQU 0 (
    echo   ✓ 打包完成！
    echo.
    echo [清理] 删除临时文件...
    if exist "dist\win-unpacked" rd /s /q "dist\win-unpacked"
    echo       ^> 已清理临时文件
    echo.
    echo   安装程序位于: dist\
    dir dist\*.exe /b 2>nul
    echo.
    echo   推荐分享: NotionSyncOne-1.0.0-portable.exe
) else (
    echo   ✗ 打包失败
)
echo =====================================
echo.
pause
