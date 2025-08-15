@echo off
title GitHub Auto Updater Server
echo ========================================
echo    GitHub Auto Updater Server
echo ========================================
echo.

cd /d "C:\Users\Win10\Downloads\chat-gpt"

echo בדיקת Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo שגיאה: Node.js לא מותקן!
    echo אנא הורד והתקן Node.js מ- https://nodejs.org
    pause
    exit /b 1
)

echo Node.js מותקן ✓

echo בדיקת תלויות...
if not exist "node_modules" (
    echo מתקין תלויות...
    npm init -y >nul 2>&1
    npm install express >nul 2>&1
    echo תלויות הותקנו ✓
) else (
    echo תלויות קיימות ✓
)

echo.
echo מפעיל את השרת...
echo.
echo ========================================
echo    השרת פועל על: http://localhost:3000
echo    פתח את הדפדפן בכתובת זו
echo ========================================
echo.
echo לעצירת השרת לחץ Ctrl+C
echo.

node github-updater-server.js

pause
