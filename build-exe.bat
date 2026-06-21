@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo    ValorantOverlay .exe 빌드 (Windows)
echo ============================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo [오류] Node.js 가 설치되어 있지 않습니다.
  echo   https://nodejs.org 에서 LTS 버전을 설치한 뒤, PC를 재시작하고 다시 실행하세요.
  echo.
  pause
  exit /b 1
)
echo Node.js 확인됨. 빌드를 시작합니다.
echo (처음 한 번은 빌드 도구를 받느라 몇 분 걸릴 수 있어요. 인터넷 연결 필요)
echo.
call npx -y @yao-pkg/pkg . -t node20-win-x64 -o dist\ValorantOverlay.exe
if errorlevel 1 (
  echo.
  echo [오류] 빌드에 실패했습니다. 인터넷 연결을 확인하고 다시 시도하세요.
  pause
  exit /b 1
)
echo.
echo ============================================
echo  ✅ 완료!  dist\ValorantOverlay.exe 생성됨
echo  이제 그 exe 파일만 더블클릭하면 앱이 실행됩니다.
echo ============================================
pause
