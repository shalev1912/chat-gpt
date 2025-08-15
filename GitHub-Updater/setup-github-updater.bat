@echo off
title יצירת תיקיית GitHub Updater
echo ========================================
echo    יצירת תיקיית GitHub Updater
echo ========================================
echo.

cd /d "C:\Users\Win10\Downloads\chat-gpt"

echo יוצר תיקיית GitHub-Updater...
if not exist "GitHub-Updater" mkdir GitHub-Updater

echo מעתיק קבצים...
copy "github-updater-server.js" "GitHub-Updater\"
copy "github-auto-updater.html" "GitHub-Updater\"
copy "start-server.bat" "GitHub-Updater\"

echo יוצר קובץ README...
echo # GitHub Auto Updater - מעדכן אוטומטי לגיטהאב > GitHub-Updater\README.md
echo. >> GitHub-Updater\README.md
echo ## מה זה? >> GitHub-Updater\README.md
echo מערכת שמעדכנת אוטומטית את גיטהאב עם כל שינוי שאתה עושה בפרויקט! >> GitHub-Updater\README.md
echo. >> GitHub-Updater\README.md
echo ## איך להשתמש? >> GitHub-Updater\README.md
echo. >> GitHub-Updater\README.md
echo ### צעד 1: התקנת Node.js >> GitHub-Updater\README.md
echo הורד והתקן Node.js מ- https://nodejs.org >> GitHub-Updater\README.md
echo. >> GitHub-Updater\README.md
echo ### צעד 2: הפעלת המערכת >> GitHub-Updater\README.md
echo לחץ פעמיים על הקובץ `start-server.bat` >> GitHub-Updater\README.md
echo. >> GitHub-Updater\README.md
echo ### צעד 3: פתיחת האפליקציה >> GitHub-Updater\README.md
echo פתח דפדפן וכתוב: http://localhost:3000/github-auto-updater.html >> GitHub-Updater\README.md
echo. >> GitHub-Updater\README.md
echo ## מה המערכת עושה? >> GitHub-Updater\README.md
echo - בודקת אם יש שינויים בקבצים >> GitHub-Updater\README.md
echo - מעדכנת אוטומטית את גיטהאב >> GitHub-Updater\README.md
echo - מציגה סטטוס בזמן אמת >> GitHub-Updater\README.md
echo - שומרת לוג של כל הפעולות >> GitHub-Updater\README.md
echo. >> GitHub-Updater\README.md
echo ## פתרון בעיות >> GitHub-Updater\README.md
echo. >> GitHub-Updater\README.md
echo ### אם השרת לא נפתח: >> GitHub-Updater\README.md
echo 1. וודא ש-Node.js מותקן >> GitHub-Updater\README.md
echo 2. נסה לפתוח Command Prompt ולהריץ: `node --version` >> GitHub-Updater\README.md
echo. >> GitHub-Updater\README.md
echo ### אם האתר לא נפתח: >> GitHub-Updater\README.md
echo נסה את הכתובות הבאות: >> GitHub-Updater\README.md
echo - http://127.0.0.1:3000/github-auto-updater.html >> GitHub-Updater\README.md
echo - http://localhost:3000/ >> GitHub-Updater\README.md
echo. >> GitHub-Updater\README.md
echo ## קבצים בתיקייה: >> GitHub-Updater\README.md
echo - `start-server.bat` - מפעיל את השרת >> GitHub-Updater\README.md
echo - `github-updater-server.js` - השרת >> GitHub-Updater\README.md
echo - `github-auto-updater.html` - האפליקציה >> GitHub-Updater\README.md
echo - `README.md` - הקובץ הזה >> GitHub-Updater\README.md

echo.
echo ========================================
echo    התיקייה נוצרה בהצלחה!
echo    מיקום: C:\Users\Win10\Downloads\chat-gpt\GitHub-Updater
echo ========================================
echo.
echo לחץ על כל מקש להמשך...
pause >nul

echo.
echo האם אתה רוצה לפתוח את התיקייה עכשיו? (Y/N)
set /p choice=
if /i "%choice%"=="Y" (
    explorer "C:\Users\Win10\Downloads\chat-gpt\GitHub-Updater"
)

echo.
echo סיום!
pause
