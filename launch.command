#!/bin/zsh
# AI Office 서버 실행 스크립트 — Finder에서 더블클릭하면 실행됩니다.
# 종료하려면 이 터미널 창에서 Ctrl+C 를 누르세요.

# Finder에서 실행하면 PATH가 비어 있을 수 있으므로 로그인 셸 환경을 불러옵니다.
[[ -f ~/.zprofile ]] && source ~/.zprofile
[[ -f ~/.zshrc ]] && source ~/.zshrc 2>/dev/null
# ~/.local/bin(최신 claude CLI)을 최우선으로, 나머지는 기존 PATH 뒤에 보조로 둡니다.
export PATH="$HOME/.local/bin:$PATH:/opt/homebrew/bin:/usr/local/bin"

# 스크립트가 있는 폴더(프로젝트 루트)로 이동
cd "${0:A:h}" || exit 1

PORT="${PORT:-3000}"
# 서버는 localhost(127.0.0.1)에만 열립니다 (package.json의 dev/start 스크립트). 사내망의 다른 PC는 접속할 수 없습니다.
URL="http://localhost:$PORT"

if ! command -v npm >/dev/null 2>&1; then
  echo "❌ npm 을 찾을 수 없습니다. Node.js 를 설치한 뒤 다시 실행하세요."
  read -k 1 "?아무 키나 누르면 창을 닫습니다..."
  exit 1
fi

# 의존성이 없으면 설치
if [[ ! -d node_modules ]]; then
  echo "📦 의존성 설치 중 (npm install)..."
  npm install || { read -k 1 "?설치 실패. 아무 키나 누르면 닫습니다..."; exit 1; }
fi

# 이미 포트가 사용 중이면 브라우저만 열기
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "ℹ️  포트 $PORT 에서 이미 서버가 실행 중입니다. 브라우저를 엽니다."
  open "$URL"
  exit 0
fi

# 기본은 빌드한 뒤 실행(빠르고 안정적). 코드를 고치는 중이면 DEV=1 ./launch.command 로 개발 모드 실행.
if [[ "$DEV" != "1" ]]; then
  echo "🔨 앱을 빌드하는 중 (npm run build)..."
  npm run build || { read -k 1 "?빌드 실패. 아무 키나 누르면 닫습니다..."; exit 1; }
fi

echo "🚀 AI Office 서버를 시작합니다: $URL"
echo "   (종료: Ctrl+C)"

# 서버가 준비되면 브라우저 열기 (백그라운드)
(
  for _ in {1..60}; do
    if curl -s -o /dev/null "$URL"; then open "$URL"; break; fi
    sleep 1
  done
) &

if [[ "$DEV" == "1" ]]; then
  npm run dev -- --port "$PORT"
else
  npm run start -- --port "$PORT"
fi
