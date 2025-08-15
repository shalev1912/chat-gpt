# GitHub Auto Updater - מעדכן אוטומטי לגיטהאב 
 
## מה זה? 
מערכת שמעדכנת אוטומטית את גיטהאב עם כל שינוי שאתה עושה בפרויקט! 
 
## איך להשתמש? 
 
### צעד 1: התקנת Node.js 
הורד והתקן Node.js מ- https://nodejs.org 
 
### צעד 2: הפעלת המערכת 
לחץ פעמיים על הקובץ `start-server.bat` 
 
### צעד 3: פתיחת האפליקציה 
פתח דפדפן וכתוב: http://localhost:3000/github-auto-updater.html 
 
## מה המערכת עושה? 
- בודקת אם יש שינויים בקבצים 
- מעדכנת אוטומטית את גיטהאב 
- מציגה סטטוס בזמן אמת 
- שומרת לוג של כל הפעולות 
 
## פתרון בעיות 
 
### אם השרת לא נפתח: 
1. וודא ש-Node.js מותקן 
2. נסה לפתוח Command Prompt ולהריץ: `node --version` 
 
### אם האתר לא נפתח: 
נסה את הכתובות הבאות: 
- http://127.0.0.1:3000/github-auto-updater.html 
- http://localhost:3000/ 
 
## קבצים בתיקייה: 
- `start-server.bat` - מפעיל את השרת 
- `github-updater-server.js` - השרת 
- `github-auto-updater.html` - האפליקציה 
- `README.md` - הקובץ הזה 
