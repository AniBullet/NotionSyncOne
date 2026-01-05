@echo off
REM 依赖安全漏洞检查
cd /d "%~dp0\.."

chcp 65001 > nul
echo.
echo =====================================
echo   NotionSyncOne 依赖安全检查
echo   Security Vulnerability Check
echo =====================================
echo.

REM 添加常见路径
set "PATH=%LOCALAPPDATA%\pnpm;%APPDATA%\npm;%PATH%"
if exist "C:\Program Files\nodejs\node.exe" set "PATH=C:\Program Files\nodejs;%PATH%"
if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%ProgramFiles%\nodejs;%PATH%"

REM 检测 pnpm
where pnpm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 无法找到 pnpm，请先安装
    echo 运行: npm install -g pnpm
    pause
    exit /b 1
)

echo [1/2] 检查依赖安全漏洞...
echo.
pnpm audit

echo.
echo [2/2] 生成详细报告...
echo.
pnpm audit --json > audit-report.json 2>nul
if exist audit-report.json (
    echo ✓ 详细报告已保存到: audit-report.json
) else (
    echo ✗ 无法生成报告
)

echo.
echo =====================================
echo   检查完成！
echo.
echo [提示] 如发现高危漏洞，运行:
echo        pnpm audit --fix
echo.
echo [提示] 查看详细报告:
echo        type audit-report.json
echo =====================================
echo.
pause
