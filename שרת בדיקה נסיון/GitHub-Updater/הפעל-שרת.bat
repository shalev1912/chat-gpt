@echo off
title GitHub Updater Server - הפעלה אוטומטית
echo ========================================
echo    GitHub Updater Server
echo ========================================
echo.

cd /d "%~dp0"

echo בדיקת Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ שגיאה: Node.js לא מותקן!
    echo.
    echo 📥 הורד Node.js מ: https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo ✅ Node.js מותקן
echo.

echo בדיקת תלויות...
if not exist "node_modules" (
    echo 📦 מתקין תלויות...
    npm install express
    if errorlevel 1 (
        echo ❌ שגיאה בהתקנת תלויות
        pause
        exit /b 1
    )
) else (
    echo ✅ תלויות מותקנות
)

echo.
echo 🚀 מפעיל שרת...
echo.
echo 📍 כתובת: http://localhost:3001
echo 📁 תיקייה: %CD%
echo.
echo ⚠️  אל תסגור את החלון הזה!
echo.

node github-updater-server.js

echo.
echo ❌ השרת נעצר
pause
