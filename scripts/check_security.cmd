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

REM 检测 npm
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 无法找到 npm
    pause
    exit /b 1
)

echo [1/2] 检查依赖安全漏洞...
echo.
npm audit

echo.
echo [2/2] 统计漏洞数量...
echo.
npm audit --json > audit-temp.json 2>nul
findstr /C:"\"vulnerabilities\"" audit-temp.json
del audit-temp.json 2>nul

echo.
echo =====================================
echo   检查完成！
echo.
echo [提示] 如发现高危漏洞，运行:
echo        npm audit fix
echo.
echo [提示] 如需查看详细报告:
echo        npm audit --json
echo =====================================
echo.
pause
