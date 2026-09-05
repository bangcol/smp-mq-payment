@echo off
title Auto Update Website SMP MQ Al Huda
color 0b
echo ========================================================
echo       AUTO UPDATE WEBSITE PEMBAYARAN SMP MQ AL HUDA
echo ========================================================
echo.

where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [INFO] Git belum terpasang di komputer ini.
    echo Anda dapat menghubungkan proyek ini ke GitHub agar setiap upgrade
    echo otomatis ter-update ke Netlify tanpa perlu drag-and-drop lagi!
    echo.
    pause
    exit /b
)

echo Memeriksa status Git...
if not exist .git (
    echo Menyiapkan Git repository...
    git init
    git branch -M main
    echo.
    echo Masukkan URL Repository GitHub Anda (contoh: https://github.com/username/smp-mq.git):
    set /p repoUrl="GitHub URL: "
    if not "%repoUrl%"=="" (
        git remote add origin %repoUrl%
    )
)

echo.
echo Mengirim pembaruan terbaru ke Cloud...
git add .
git commit -m "Update otomatis: %date% %time%"
git push -u origin main

echo.
echo ========================================================
echo   BERHASIL! Website online Anda sedang otomatis di-update
echo   oleh Netlify dalam beberapa detik tanpa perlu drag-drop!
echo ========================================================
pause
