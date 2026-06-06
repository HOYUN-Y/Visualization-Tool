@echo off
chcp 65001 >nul 2>&1
title INSIGHT Analytics Workbench — Launcher
cd /d "%~dp0"

set PREFERRED_PORT=8742
set PORT_RANGE_END=8762

:: ── 배너 ───────────────────────────────────────────────────
cls
echo.
echo   +------------------------------------------+
echo   ^|  INSIGHT Analytics Workbench             ^|
echo   ^|  Local Server Launcher  (Windows)        ^|
echo   +------------------------------------------+
echo.

:: ── 앱 업데이트 확인 ──────────────────────────────────────
where git >nul 2>&1
if %errorlevel%==0 (
    if exist ".git" (
        echo   [*] 업데이트 확인 중...
        git pull --quiet 2>nul
        if %errorlevel%==0 (echo       완료.) else (echo       오프라인 또는 업데이트 불가 ^(건너뜀^))
        echo.
    )
)

:: ── 서버 런타임 탐색 ──────────────────────────────────────
set SERVER_BIN=
set SERVER_LABEL=

where python3 >nul 2>&1
if %errorlevel%==0 (
    set SERVER_BIN=python3
    set SERVER_LABEL=Python 3
    goto :find_port
)

where python >nul 2>&1
if %errorlevel%==0 (
    python --version 2>&1 | findstr "Python 3" >nul
    if %errorlevel%==0 (
        set SERVER_BIN=python
        set SERVER_LABEL=Python 3
        goto :find_port
    )
)

where npx >nul 2>&1
if %errorlevel%==0 (
    set SERVER_BIN=npx
    set SERVER_LABEL=Node.js / serve
    goto :find_port
)

where php >nul 2>&1
if %errorlevel%==0 (
    set SERVER_BIN=php
    set SERVER_LABEL=PHP
    goto :find_port
)

:: ── 서버 없음 — 자동 설치 시도 ───────────────────────────
echo   [!] 서버 런타임을 찾을 수 없습니다.
echo.
ping -n 1 8.8.8.8 >nul 2>&1
if %errorlevel%==0 (
    echo   [*] 인터넷 연결 확인됨. Python 3 설치를 시도합니다...
    where winget >nul 2>&1
    if %errorlevel%==0 (
        winget install --id Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements
        where python >nul 2>&1
        if %errorlevel%==0 (
            set SERVER_BIN=python
            set SERVER_LABEL=Python 3 ^(새로 설치됨^)
            goto :find_port
        )
    )
    echo   [!] winget 설치 실패. Python 다운로드 페이지를 엽니다...
    start https://www.python.org/downloads/
) else (
    echo   [!] 인터넷 연결 없음.
)
echo.
echo   Python 3 설치 후 이 파일을 다시 실행하세요.
echo   https://www.python.org/downloads/
echo.
pause
exit /b 1

:: ── 사용 가능한 포트 탐색 ────────────────────────────────
:find_port
echo   [*] 사용 가능한 포트 탐색 중...
set PORT=%PREFERRED_PORT%

:port_loop
if %PORT% GTR %PORT_RANGE_END% (
    echo.
    echo   [!] 포트 %PREFERRED_PORT%~%PORT_RANGE_END% 이 모두 사용 중입니다.
    echo       실행 중인 프로그램을 종료 후 다시 시도하세요.
    echo.
    pause
    exit /b 1
)

:: 해당 포트를 사용 중인 PID 확인
set OCCUPYING_PID=
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr /R ":%PORT% "') do (
    if not defined OCCUPYING_PID set OCCUPYING_PID=%%a
)

if not defined OCCUPYING_PID (
    :: 포트가 비어 있음 → 사용
    goto :start_server
)

:: 점유 중인 프로세스 확인 — Python/Node/PHP인지 체크
set IS_OUR_SERVER=0
for /f "tokens=1" %%p in ('tasklist /FI "PID eq %OCCUPYING_PID%" /NH 2^>nul') do (
    echo %%p | findstr /i "python node php" >nul 2>&1
    if %errorlevel%==0 set IS_OUR_SERVER=1
)

if %IS_OUR_SERVER%==1 (
    echo       포트 %PORT%: 기존 서버 발견 ^(PID %OCCUPYING_PID%^) -^> 종료합니다...
    taskkill /PID %OCCUPYING_PID% /F >nul 2>&1
    timeout /t 1 /nobreak >nul
    :: 종료 후 포트가 비었는지 재확인
    set CHECK_PID=
    for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr /R ":%PORT% "') do (
        if not defined CHECK_PID set CHECK_PID=%%a
    )
    if not defined CHECK_PID goto :start_server
)

:: 다른 앱이 점유 중이거나 종료 실패 → 다음 포트
echo       포트 %PORT% 사용 중 ^(다른 앱^) -^> 다음 포트 시도...
set /a PORT=%PORT%+1
set OCCUPYING_PID=
goto :port_loop

:: ── 서버 시작 ─────────────────────────────────────────────
:start_server
set URL=http://localhost:%PORT%
echo   [*] 서버 시작 중... (%SERVER_LABEL%, 포트 %PORT%)
echo   [*] URL: %URL%
echo.

if "%SERVER_BIN%"=="python3" (
    start "INSIGHT-Server" /B python3 -m http.server %PORT%
) else if "%SERVER_BIN%"=="python" (
    start "INSIGHT-Server" /B python -m http.server %PORT%
) else if "%SERVER_BIN%"=="npx" (
    start "INSIGHT-Server" /B npx --yes serve -l %PORT% .
) else if "%SERVER_BIN%"=="php" (
    start "INSIGHT-Server" /B php -S 0.0.0.0:%PORT%
)

:: ── 서버 준비 대기 후 브라우저 열기 ──────────────────────
echo   [*] 브라우저 오픈 대기 중...
set READY=0
set /a TRIES=0

:wait_loop
if %TRIES% GEQ 20 goto :open_anyway
set /a TRIES=%TRIES%+1
:: curl이 있으면 HTTP 응답으로 확인, 없으면 포트 리슨 여부로 확인
where curl >nul 2>&1
if %errorlevel%==0 (
    curl -sf %URL% >nul 2>&1
    if %errorlevel%==0 ( set READY=1 & goto :do_open )
) else (
    netstat -aon 2>nul | findstr ":%PORT% " | findstr "LISTENING" >nul 2>&1
    if %errorlevel%==0 ( set READY=1 & goto :do_open )
)
timeout /t 1 /nobreak >nul
goto :wait_loop

:open_anyway
echo   [!] 서버 응답 대기 시간 초과 - 그래도 브라우저를 엽니다.

:do_open
start "" "%URL%"

echo.
echo   +------------------------------------------+
echo   ^|  URL   : %URL%
echo   ^|  상태  : 실행 중
echo   ^|
echo   ^|  이 창을 닫으면 서버가 종료됩니다.
echo   +------------------------------------------+
echo.
echo   Press any key to stop the server...
echo.
pause >nul

:: ── 서버 종료 ─────────────────────────────────────────────
echo   [*] 서버를 종료합니다...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":%PORT% "') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo   완료.
