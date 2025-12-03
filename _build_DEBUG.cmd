@echo off
REM 开发环境构建 - 包含完整调试日志（仅用于调试问题）
cd /d "%~dp0"

chcp 65001 > nul
echo.
echo =====================================
echo   开发构建 - DEBUG 模式
echo   包含完整调试日志
echo =====================================
echo.
echo [警告] 此模式包含大量日志输出
echo [警告] 仅用于调试问题，不要用于发布
echo.
pause
echo.

REM 设置开发环境
set NODE_ENV=development

REM 添加常见路径
set "PATH=%LOCALAPPDATA%\pnpm;%APPDATA%\npm;%PATH%"
if exist "C:\Program Files\nodejs\node.exe" set "PATH=C:\Program Files\nodejs;%PATH%"
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"

REM 检测工具
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 无法找到 Node.js
    pause
    exit /b 1
)

where pnpm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 无法找到 pnpm，运行: npm install -g pnpm
    pause
    exit /b 1
)

echo [1/3] 检查依赖...
if not exist "node_modules" (
    pnpm install
)
echo.

echo [2/3] 清理旧构建...
if exist "dist" rd /s /q "dist" 2>nul
if exist "out" rd /s /q "out" 2>nul
echo.

echo [3/3] 开始打包（DEBUG 模式）...
echo.
pnpm run build:dev

echo.
echo =====================================
if %ERRORLEVEL% EQU 0 (
    echo   ✓ DEBUG 构建完成！
    echo.
    echo   [提示] 此版本包含调试日志，仅用于测试
    echo   [提示] 发布请使用: _build.cmd
    echo.
    if exist "dist\win-unpacked" rd /s /q "dist\win-unpacked"
    dir dist\*.exe /b 2>nul
) else (
    echo   ✗ 构建失败
)
echo =====================================
echo.
pause

