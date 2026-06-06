@echo off
chcp 65001 >nul 2>&1
title INSIGHT Analytics Workbench — Launcher
cd /d "%~dp0"

set PORT=8742
set URL=http://localhost:%PORT%

:: ── 배너 ───────────────────────────────────────────────────
cls
echo.
echo   +------------------------------------------+
echo   ^|  INSIGHT Analytics Workbench             ^|
echo   ^|  Local Server Launcher  (Windows)        ^|
echo   +------------------------------------------+
echo.

:: ── 기존 서버 정리 ────────────────────────────────────────
echo   [*] 포트 %PORT% 확인 중...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":%PORT% "') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: ── 앱 업데이트 확인 ──────────────────────────────────────
where git >nul 2>&1
if %errorlevel%==0 (
    if exist ".git" (
        echo   [*] 업데이트 확인 중...
        git pull --quiet 2>nul
        if %errorlevel%==0 (
            echo       완료.
        ) else (
            echo       오프라인 또는 업데이트 불가 ^(건너뜀^)
        )
        echo.
    )
)

:: ── 서버 런타임 탐색 ──────────────────────────────────────
set SERVER_FOUND=0
set SERVER_LABEL=

:: Python3 시도
where python3 >nul 2>&1
if %errorlevel%==0 (
    echo   [*] Python 3 로 서버 시작 중...
    set SERVER_LABEL=Python 3
    start "INSIGHT-Server" /B python3 -m http.server %PORT%
    set SERVER_FOUND=1
    goto :open_browser
)

:: python (버전 3인지 확인)
where python >nul 2>&1
if %errorlevel%==0 (
    python --version 2>&1 | findstr "Python 3" >nul
    if %errorlevel%==0 (
        echo   [*] Python 3 로 서버 시작 중...
        set SERVER_LABEL=Python 3
        start "INSIGHT-Server" /B python -m http.server %PORT%
        set SERVER_FOUND=1
        goto :open_browser
    )
)

:: npx / Node.js 시도
where npx >nul 2>&1
if %errorlevel%==0 (
    echo   [*] Node.js / npx serve 로 서버 시작 중...
    set SERVER_LABEL=Node.js
    start "INSIGHT-Server" /B npx --yes serve -l %PORT% .
    set SERVER_FOUND=1
    goto :open_browser
)

:: PHP 시도
where php >nul 2>&1
if %errorlevel%==0 (
    echo   [*] PHP 로 서버 시작 중...
    set SERVER_LABEL=PHP
    start "INSIGHT-Server" /B php -S 0.0.0.0:%PORT%
    set SERVER_FOUND=1
    goto :open_browser
)

:: ── 서버 없음 — 자동 설치 시도 ───────────────────────────
echo   [!] 서버 런타임을 찾을 수 없습니다.
echo.

:: 인터넷 연결 확인
ping -n 1 8.8.8.8 >nul 2>&1
if %errorlevel%==0 (
    echo   [*] 인터넷 연결 확인됨.
    echo       Python 3 자동 설치를 시도합니다...
    echo.

    :: winget으로 Python 설치 시도 (Windows 10 2004+ 기본 포함)
    where winget >nul 2>&1
    if %errorlevel%==0 (
        winget install --id Python.Python.3.12 ^
            --silent ^
            --accept-package-agreements ^
            --accept-source-agreements
        :: PATH 갱신 후 재시도
        where python >nul 2>&1
        if %errorlevel%==0 (
            echo.
            echo   [*] Python 설치 완료! 서버를 시작합니다...
            start "INSIGHT-Server" /B python -m http.server %PORT%
            set SERVER_FOUND=1
            goto :open_browser
        )
    ) else (
        echo   [!] winget을 사용할 수 없습니다.
    )

    echo.
    echo   Python 3 다운로드 페이지를 엽니다...
    start https://www.python.org/downloads/
) else (
    echo   [!] 인터넷 연결 없음.
)

echo.
echo   Python 3 를 설치한 후 이 파일을 다시 실행하세요.
echo   다운로드: https://www.python.org/downloads/
echo.
pause
exit /b 1

:: ── 브라우저 열기 ─────────────────────────────────────────
:open_browser
echo   [*] 서버 준비 대기 중...
timeout /t 2 /nobreak >nul

echo   [*] 브라우저를 엽니다: %URL%
start "" "%URL%"

echo.
echo   +------------------------------------------+
echo   ^|  URL  : %URL%            ^|
echo   ^|  상태 : 실행 중                           ^|
echo   ^|                                          ^|
echo   ^|  이 창을 닫으면 서버가 종료됩니다.        ^|
echo   +------------------------------------------+
echo.
echo   Press any key to stop the server...
echo.
pause >nul

:: 서버 종료
echo   [*] 서버를 종료합니다...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":%PORT% "') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo   완료.
