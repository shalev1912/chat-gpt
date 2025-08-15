@echo off
title GitHub Auto Updater - הפעלה מהירה
echo ========================================
echo    GitHub Auto Updater
echo    מעדכן אוטומטי לגיטהאב
echo ========================================
echo.

cd /d "%~dp0"

echo בדיקת Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ שגיאה: Node.js לא מותקן!
    echo.
    echo 📥 הורד Node.js מ- https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo ✅ Node.js מותקן

echo.
echo 🛠️ מתקין תלויות...
if not exist "node_modules" (
    npm install express >nul 2>&1
    echo ✅ תלויות הותקנו
) else (
    echo ✅ תלויות קיימות
)

echo.
echo 🚀 מפעיל את השרת...
echo.
echo ========================================
echo     השרת פועל על: http://localhost:3001
echo     פתח דפדפן וכתוב את הכתובת
echo ========================================
echo.
echo  טיפ: לחץ על הקישור כדי לפתוח אוטומטית
echo.
echo ⏹️  לעצירת השרת לחץ Ctrl+C
echo.

start http://localhost:3001/github-auto-updater.html

node github-updater-server.js

pause
