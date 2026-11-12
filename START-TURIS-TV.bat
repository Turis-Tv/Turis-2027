@echo off
setlocal
title Turis Tv - Yerel Sunucu
cd /d "%~dp0"

echo ========================================================
echo                 TURIS TV - YEREL SUNUCU
echo ========================================================
echo.
echo Bu, Arena'daki gibi gercek Next.js sunucusunu baslatir.
echo index.html dosyasini dogrudan acmak yerine bu dosyayi kullanin.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js bulunamadi. Sunucu bu yuzden baslayamadi.
  echo localhost:3000 adresi ancak Node.js kurulduktan sonra acilir.
  echo.
  where winget >nul 2>nul
  if not errorlevel 1 (
    echo Node.js LTS winget ile yukleniyor. Lutfen bekleyin...
    winget install --id OpenJS.NodeJS.LTS --exact --accept-source-agreements --accept-package-agreements
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
  )
  where node >nul 2>nul
  if errorlevel 1 (
    echo.
    echo Node.js kurulumu henuz tamamlanmadi.
    echo Acilan sayfadan Node.js LTS surumunu indirip kurun.
    echo Kurulumdan sonra START-TURIS-TV.bat dosyasini YENIDEN calistirin.
    start "" "https://nodejs.org/en/download"
    echo.
    pause
    exit /b 1
  )
)

echo Kullanilan Node.js surumu:
node --version
echo.

if not exist ".env" (
  echo Ilk ayarlar hazirlaniyor...
  > ".env" echo DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
  >> ".env" echo LINK_PIN_HASH=954446921d7cda37f7f285ffbd7df61b5215886a1ff2b7abb55c4c29f151011f
  for /f %%i in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N')"') do >> ".env" echo SESSION_SECRET=%%i
)

if not exist "node_modules" (
  echo Paketler yukleniyor. Ilk seferde birkac dakika surebilir...
  call npm install
  if errorlevel 1 (
    echo [HATA] Paket yukleme basarisiz oldu.
    pause
    exit /b 1
  )
)

echo.
echo Bilgisayarda acmak icin:
echo   http://localhost:3000
echo.
echo Telefon AYNI Wi-Fi agindaysa asagidaki IPv4 adreslerinden birini kullanin:
ipconfig | findstr /c:"IPv4"
echo Ornek: http://192.168.1.50:3000
echo.
echo Windows Guvenlik Duvari sorarsa Node.js icin ozel aglarda izin verin.
echo Sunucuyu durdurmak icin Ctrl+C tuslarina basin.
echo.

echo Tarayici, sunucu gercekten hazir oldugunda otomatik acilacak.
echo npm warn deprecated mesajlari HATA DEGILDIR; lutfen kurulumu bekleyin.
echo localhost:3000 adresini sunucu hazir olmadan once acmayin.
echo.
start "" powershell -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File "%~dp0OPEN-TURIS-WHEN-READY.ps1"
call npm run dev -- --hostname 0.0.0.0 --port 3000

if errorlevel 1 (
  echo.
  echo [HATA] Turis Tv sunucusu baslatilamadi. Yukaridaki son hata mesajini okuyun.
)

pause
