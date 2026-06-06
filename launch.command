#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  INSIGHT Analytics Workbench — Mac Launcher
#  더블클릭하면 로컬 서버를 시작하고 브라우저를 자동으로 엽니다.
#
#  처음 실행 시 Gatekeeper 경고가 뜨면:
#    시스템 설정 → 개인 정보 보호 및 보안 → "launch.command" 허용
#  또는 터미널에서: chmod +x launch.command
# ─────────────────────────────────────────────────────────────

# 이 파일이 있는 폴더로 이동
cd "$(dirname "$0")"

PORT=8742
URL="http://localhost:$PORT"

# ── 배너 ──────────────────────────────────────────────────────
clear
echo ""
echo "  ┌─────────────────────────────────────────┐"
echo "  │   INSIGHT Analytics Workbench           │"
echo "  │   Local Server Launcher  (Mac)          │"
echo "  └─────────────────────────────────────────┘"
echo ""

# ── 기존 서버 정리 ───────────────────────────────────────────
EXISTING_PID=$(lsof -ti :$PORT 2>/dev/null)
if [ -n "$EXISTING_PID" ]; then
    echo "  ◆ 포트 $PORT 에서 실행 중인 기존 서버를 종료합니다..."
    kill $EXISTING_PID 2>/dev/null
    sleep 0.8
fi

# ── 앱 업데이트 확인 (git이 있을 때) ────────────────────────
if command -v git &>/dev/null && [ -d ".git" ]; then
    echo "  ◆ 업데이트 확인 중..."
    UPDATE_OUT=$(git pull --quiet 2>&1)
    if echo "$UPDATE_OUT" | grep -q "Already up to date"; then
        echo "    → 최신 버전입니다."
    elif echo "$UPDATE_OUT" | grep -q "error\|fatal"; then
        echo "    → 오프라인 또는 업데이트 불가 (건너뜀)"
    else
        echo "    → 업데이트 완료!"
    fi
    echo ""
fi

# ── 서버 런타임 탐색 ─────────────────────────────────────────
SERVER_CMD=""
SERVER_LABEL=""

if command -v python3 &>/dev/null; then
    VER=$(python3 --version 2>&1 | awk '{print $2}')
    SERVER_CMD="python3 -m http.server $PORT"
    SERVER_LABEL="Python $VER"

elif command -v python &>/dev/null && python --version 2>&1 | grep -q "Python 3"; then
    VER=$(python --version 2>&1 | awk '{print $2}')
    SERVER_CMD="python -m http.server $PORT"
    SERVER_LABEL="Python $VER"

elif command -v node &>/dev/null && command -v npx &>/dev/null; then
    SERVER_CMD="npx --yes serve -l $PORT ."
    SERVER_LABEL="Node.js / serve"

elif command -v php &>/dev/null; then
    SERVER_CMD="php -S 0.0.0.0:$PORT"
    SERVER_LABEL="PHP"
fi

# ── 서버 없으면 자동 설치 시도 ──────────────────────────────
if [ -z "$SERVER_CMD" ]; then
    echo "  ✗ 서버 런타임을 찾을 수 없습니다."
    echo ""

    # 인터넷 연결 확인
    if ping -c 1 -W 2 8.8.8.8 &>/dev/null 2>&1; then
        echo "  ◆ 인터넷 연결 확인됨. Python 3 설치를 시도합니다..."

        if command -v brew &>/dev/null; then
            echo "    Homebrew로 Python 3 설치 중..."
            brew install python3
            if command -v python3 &>/dev/null; then
                VER=$(python3 --version 2>&1 | awk '{print $2}')
                SERVER_CMD="python3 -m http.server $PORT"
                SERVER_LABEL="Python $VER (새로 설치됨)"
            fi
        else
            echo "    Homebrew가 없습니다."
            echo "    Python 3 다운로드 페이지를 엽니다: https://www.python.org/downloads/"
            open "https://www.python.org/downloads/"
        fi
    else
        echo "  ✗ 인터넷 연결 없음. Python 3를 수동으로 설치하세요:"
        echo "    https://www.python.org/downloads/"
    fi
fi

if [ -z "$SERVER_CMD" ]; then
    echo ""
    echo "  설치 후 이 파일을 다시 실행하세요."
    echo ""
    echo "  Press any key to exit..."
    read -n 1
    exit 1
fi

# ── 서버 시작 ────────────────────────────────────────────────
echo "  ◆ 서버 시작 중... ($SERVER_LABEL)"
echo "  ◆ URL: $URL"
echo ""

# 백그라운드에서 서버 시작
eval "$SERVER_CMD" &>/dev/null &
SERVER_PID=$!

# 서버 준비 대기 (최대 5초)
echo "  ◆ 브라우저 오픈 대기 중..."
for i in {1..10}; do
    if curl -sf "$URL" &>/dev/null; then
        break
    fi
    sleep 0.5
done

# 브라우저 열기
open "$URL"

echo "  ✓ 서버 실행 중 (PID: $SERVER_PID)"
echo ""
echo "  ────────────────────────────────────────────"
echo "  이 창을 닫거나 Ctrl+C 를 누르면 서버가 종료됩니다."
echo "  ────────────────────────────────────────────"
echo ""

# Ctrl+C / 창 닫기 시 서버 종료
trap "echo ''; echo '  서버를 종료합니다...'; kill $SERVER_PID 2>/dev/null; exit 0" INT TERM

wait $SERVER_PID
