#!/bin/bash
cd "$(dirname "$0")"
echo "============================================"
echo "   ValorantOverlay 빌드 (macOS / Linux)"
echo "============================================"
if ! command -v node >/dev/null 2>&1; then
  echo "[오류] Node.js 미설치 → https://nodejs.org 에서 설치 후 다시 실행하세요."
  read -p "엔터를 눌러 종료..."; exit 1
fi
OS=$(uname -s)
if [ "$OS" = "Darwin" ]; then TGT="node20-macos-x64"; OUT="dist/ValorantOverlay-mac"; else TGT="node20-linux-x64"; OUT="dist/ValorantOverlay-linux"; fi
echo "빌드 시작 (대상: $TGT) ... 처음엔 몇 분 걸릴 수 있어요."
npx -y @yao-pkg/pkg . -t "$TGT" -o "$OUT" || { echo "[오류] 빌드 실패"; read -p "엔터로 종료..."; exit 1; }
chmod +x "$OUT"
echo ""
echo "✅ 완료: $OUT"
echo "더블클릭으로 실행되지 않으면 터미널에서 ./$OUT 로 실행하세요."
read -p "엔터를 눌러 종료..."
