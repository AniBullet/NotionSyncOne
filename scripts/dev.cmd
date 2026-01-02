@echo off
REM 切换到项目根目录
cd /d "%~dp0\.."

REM 检测管理员权限（静默检测，不自动提升）
REM 如需管理员权限，请手动右键"以管理员身份运行"

chcp 65001 >nul
title NotionSyncOne Dev Server

echo ======================================
echo   NotionSyncOne Dev Server
echo ======================================
echo.

REM 智能检测环境
set NODE_ENV=development

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

echo [1/2] Checking port 5173...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173') do taskkill /F /PID %%a >nul 2>&1
echo       Port is free
echo.

echo [2/2] Starting dev server...
echo.
echo ======================================
echo   Hot Reload Enabled
echo   - Code changes auto-compile
echo   - Press Ctrl+C to stop
echo ======================================
echo.

pnpm dev
