@echo off
title PUBLISH ONLINE - SMP MQ AL HUDA
color 0a
echo.
echo  ============================================================
echo   PUBLISH OTOMATIS - SISTEM PEMBAYARAN SMP MQ AL HUDA
echo  ============================================================
echo.
echo  Mengirim pembaruan terbaru ke internet...
echo.

set GIT="C:\Users\cholis\AppData\Local\Programs\Git\cmd\git.exe"

%GIT% add .
%GIT% commit -m "Update otomatis %date% %time%"
%GIT% push origin main

echo.
if %errorlevel% equ 0 (
    color 0a
    echo  ============================================================
    echo   BERHASIL! Website online sudah diperbarui.
    echo   Netlify akan otomatis update dalam 30 detik.
    echo.
    echo   Link website: https://smp-mq-payment.netlify.app
    echo  ============================================================
) else (
    color 0c
    echo  ============================================================
    echo   Ada masalah saat upload. Cek koneksi internet Anda.
    echo  ============================================================
)
echo.
pause
