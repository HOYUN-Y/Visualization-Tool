#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  INSIGHT Analytics Workbench — Mac Launcher
#  더블클릭하면 로컬 서버를 시작하고 브라우저를 자동으로 엽니다.
#
#  처음 실행 시 Gatekeeper 경고가 뜨면:
#    시스템 설정 → 개인 정보 보호 및 보안 → "launch.command" 허용
#  또는 터미널에서: chmod +x launch.command
# ─────────────────────────────────────────────────────────────

cd "$(dirname "$0")"

PREFERRED_PORT=8742
PORT_RANGE_END=8762   # 최대 8742~8762 범위에서 빈 포트 탐색

# ── 배너 ──────────────────────────────────────────────────────
clear
echo ""
echo "  ┌─────────────────────────────────────────┐"
echo "  │   INSIGHT Analytics Workbench           │"
echo "  │   Local Server Launcher  (Mac)          │"
echo "  └─────────────────────────────────────────┘"
echo ""

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
SERVER_BIN=""
SERVER_LABEL=""

if command -v python3 &>/dev/null; then
    VER=$(python3 --version 2>&1 | awk '{print $2}')
    SERVER_BIN="python3"
    SERVER_LABEL="Python $VER"

elif command -v python &>/dev/null && python --version 2>&1 | grep -q "Python 3"; then
    VER=$(python --version 2>&1 | awk '{print $2}')
    SERVER_BIN="python"
    SERVER_LABEL="Python $VER"

elif command -v node &>/dev/null && command -v npx &>/dev/null; then
    SERVER_BIN="npx"
    SERVER_LABEL="Node.js / serve"

elif command -v php &>/dev/null; then
    SERVER_BIN="php"
    SERVER_LABEL="PHP"
fi

# ── 서버 없으면 자동 설치 시도 ──────────────────────────────
if [ -z "$SERVER_BIN" ]; then
    echo "  ✗ 서버 런타임을 찾을 수 없습니다."
    echo ""
    if ping -c 1 -W 2 8.8.8.8 &>/dev/null 2>&1; then
        echo "  ◆ 인터넷 연결 확인됨. Python 3 설치를 시도합니다..."
        if command -v brew &>/dev/null; then
            brew install python3
            if command -v python3 &>/dev/null; then
                VER=$(python3 --version 2>&1 | awk '{print $2}')
                SERVER_BIN="python3"
                SERVER_LABEL="Python $VER (새로 설치됨)"
            fi
        else
            echo "    Homebrew가 없습니다. Python 3 다운로드 페이지를 엽니다..."
            open "https://www.python.org/downloads/"
        fi
    else
        echo "  ✗ 인터넷 연결 없음. Python 3를 수동으로 설치하세요:"
        echo "    https://www.python.org/downloads/"
    fi
fi

if [ -z "$SERVER_BIN" ]; then
    echo ""
    echo "  설치 후 이 파일을 다시 실행하세요."
    echo "  Press any key to exit..."
    read -n 1
    exit 1
fi

# ── 사용 가능한 포트 탐색 ────────────────────────────────────
# 기본적으로 기존 서버(우리 서버)가 점유 중이면 먼저 종료 시도.
# 다른 프로그램이 점유 중이면 다음 포트로 넘어간다.
find_free_port() {
    local port=$PREFERRED_PORT
    while [ $port -le $PORT_RANGE_END ]; do
        local pid
        pid=$(lsof -ti :$port 2>/dev/null)
        if [ -z "$pid" ]; then
            # 아무것도 없으면 이 포트 사용
            echo $port
            return
        fi

        # 프로세스가 있는 경우 — 우리 서버(http.server / serve / php)인지 확인
        local cmd
        cmd=$(ps -p $pid -o comm= 2>/dev/null)
        if echo "$cmd" | grep -qiE "python|node|php"; then
            echo "  ◆ 포트 $port: 기존 서버 발견 (PID $pid, $cmd) → 종료합니다..." >&2
            kill $pid 2>/dev/null
            sleep 0.6
            # 종료 후 포트가 비었으면 사용
            if [ -z "$(lsof -ti :$port 2>/dev/null)" ]; then
                echo $port
                return
            fi
        fi

        # 다른 앱이 점유 중이거나 종료 실패 → 다음 포트 시도
        echo "  ◆ 포트 $port 사용 중 (다른 앱) → 다음 포트 시도..." >&2
        port=$((port + 1))
    done

    # 범위 내에서 빈 포트를 못 찾은 경우
    echo ""
}

echo "  ◆ 사용 가능한 포트 탐색 중..."
PORT=$(find_free_port)

if [ -z "$PORT" ]; then
    echo ""
    echo "  ✗ 포트 $PREFERRED_PORT ~ $PORT_RANGE_END 이 모두 사용 중입니다."
    echo "    다른 포트를 수동으로 지정하거나, 실행 중인 프로그램을 종료하세요."
    echo ""
    echo "  Press any key to exit..."
    read -n 1
    exit 1
fi

URL="http://localhost:$PORT"

# ── 서버 시작 ────────────────────────────────────────────────
echo "  ◆ 서버 시작 중... ($SERVER_LABEL, 포트 $PORT)"
echo "  ◆ URL: $URL"
echo ""

case "$SERVER_BIN" in
    python3) python3 -m http.server $PORT &>/dev/null & ;;
    python)  python  -m http.server $PORT &>/dev/null & ;;
    npx)     npx --yes serve -l $PORT . &>/dev/null & ;;
    php)     php -S 0.0.0.0:$PORT &>/dev/null & ;;
esac
SERVER_PID=$!

# ── 서버 준비 대기 후 브라우저 열기 ─────────────────────────
echo "  ◆ 브라우저 오픈 대기 중..."
READY=0
for i in {1..20}; do
    if curl -sf "$URL" &>/dev/null; then
        READY=1
        break
    fi
    sleep 0.5
done

if [ $READY -eq 0 ]; then
    echo "  ⚠ 서버 응답 없음 — 그래도 브라우저를 엽니다."
fi

open "$URL"

echo "  ✓ 서버 실행 중 (PID: $SERVER_PID, 포트: $PORT)"
echo ""
echo "  ────────────────────────────────────────────"
echo "  이 창을 닫거나 Ctrl+C 를 누르면 서버가 종료됩니다."
echo "  ────────────────────────────────────────────"
echo ""

trap "echo ''; echo '  서버를 종료합니다...'; kill $SERVER_PID 2>/dev/null; exit 0" INT TERM

wait $SERVER_PID
