const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;

// Middleware
app.use(express.json());
app.use(express.static('.'));

// נתיב לפרויקט - חזרה לתיקייה הראשית
const PROJECT_PATH = path.join(__dirname, '..');

class GitHubUpdater {
    constructor() {
        this.isUpdating = false;
        this.lastUpdate = Date.now();
        this.logs = [];
    }

    // הוספת לוג
    addLog(message, type = 'info') {
        const log = {
            timestamp: new Date().toLocaleString('he-IL'),
            message,
            type
        };
        this.logs.push(log);
        console.log(`[${log.timestamp}] ${message}`);
        
        // שמירת רק 50 הלוגים האחרונים
        if (this.logs.length > 50) {
            this.logs = this.logs.slice(-50);
        }
    }

    // בדיקת חיבור לאינטרנט
    async checkInternetConnection() {
        return new Promise((resolve) => {
            exec('ping -n 1 8.8.8.8', (error) => {
                resolve(!error);
            });
        });
    }

    // בדיקת Git
    async checkGitStatus() {
        return new Promise((resolve) => {
            exec('git --version', (error, stdout) => {
                if (error) {
                    this.addLog('Git לא מותקן במחשב', 'error');
                    resolve({ installed: false, error: 'Git לא מותקן' });
                } else {
                    this.addLog(`Git מותקן: ${stdout.trim()}`, 'success');
                    resolve({ installed: true, version: stdout.trim() });
                }
            });
        });
    }

    // בדיקת repository
    async checkRepository() {
        return new Promise((resolve) => {
            exec('git status', { cwd: PROJECT_PATH }, (error, stdout, stderr) => {
                if (error) {
                    this.addLog('לא נמצא repository תקין', 'error');
                    resolve({ valid: false, error: 'לא נמצא repository תקין' });
                } else {
                    this.addLog('Repository תקין נמצא', 'success');
                    resolve({ valid: true, status: stdout });
                }
            });
        });
    }

    // בדיקת הרשאות גיטהאב
    async checkGitHubAuth() {
        return new Promise((resolve) => {
            exec('git remote -v', { cwd: PROJECT_PATH }, (error, stdout) => {
                if (error || !stdout.includes('origin')) {
                    this.addLog('לא נמצא remote origin', 'error');
                    resolve({ configured: false, error: 'לא מוגדר remote origin' });
                } else {
                    this.addLog('Remote origin מוגדר', 'success');
                    resolve({ configured: true, remotes: stdout });
                }
            });
        });
    }

    // עדכון לגיטהאב
    async updateToGitHub() {
        if (this.isUpdating) {
            this.addLog('כבר מתבצע עדכון', 'warning');
            return { success: false, message: 'כבר מתבצע עדכון' };
        }

        this.isUpdating = true;
        this.addLog('מתחיל עדכון לגיטהאב...', 'info');

        try {
            // בדיקת חיבור לאינטרנט
            this.addLog('בודק חיבור לאינטרנט...', 'info');
            const internetOk = await this.checkInternetConnection();
            if (!internetOk) {
                throw new Error('אין חיבור לאינטרנט');
            }

            // בדיקת Git
            this.addLog('בודק התקנת Git...', 'info');
            const gitStatus = await this.checkGitStatus();
            if (!gitStatus.installed) {
                throw new Error('Git לא מותקן במחשב');
            }

            // בדיקת repository
            this.addLog('בודק repository...', 'info');
            const repoStatus = await this.checkRepository();
            if (!repoStatus.valid) {
                throw new Error('לא נמצא repository תקין');
            }

            // בדיקת הרשאות גיטהאב
            this.addLog('בודק הרשאות גיטהאב...', 'info');
            const authStatus = await this.checkGitHubAuth();
            if (!authStatus.configured) {
                throw new Error('לא מוגדר remote origin');
            }

            // שלב 1: בודק שינויים
            this.addLog('בודק שינויים...', 'info');
            const statusOutput = await this.executeCommand('git status --porcelain');
            if (!statusOutput.trim()) {
                this.addLog('אין שינויים לעדכן', 'info');
                return { success: true, message: 'אין שינויים לעדכן' };
            }
            
            // שלב 2: מוסיף קבצים
            this.addLog('מוסיף קבצים...', 'info');
            await this.executeCommand('git add .');
            
            // שלב 3: שומר שינויים
            this.addLog('שומר שינויים...', 'info');
            const commitMessage = `Auto update: ${new Date().toLocaleString('he-IL')}`;
            await this.executeCommand(`git commit -m "${commitMessage}"`);
            
            // שלב 4: מושך שינויים (אם יש)
            this.addLog('מושך שינויים...', 'info');
            try {
                await this.executeCommand('git pull origin main');
            } catch (pullError) {
                this.addLog('לא הצלחתי למשוך שינויים (אולי אין שינויים)', 'warning');
            }
            
            // שלב 5: מעלה לגיטהאב
            this.addLog('מעלה לגיטהאב...', 'info');
            await this.executeCommand('git push origin main');
            
            this.lastUpdate = Date.now();
            this.addLog('העדכון הושלם בהצלחה! 🎉', 'success');
            
            return { success: true, message: 'הקבצים הועלו בהצלחה לגיטהאב! 🎸' };
            
        } catch (error) {
            this.addLog(`שגיאה בעדכון: ${error.message}`, 'error');
            console.error('שגיאה מפורטת:', error);
            
            // הודעות שגיאה מפורטות
            let errorMessage = 'שגיאה בעדכון לגיטהאב';
            
            if (error.message.includes('אין חיבור לאינטרנט')) {
                errorMessage = 'אין חיבור לאינטרנט - בדוק את החיבור שלך';
            } else if (error.message.includes('Git לא מותקן')) {
                errorMessage = 'Git לא מותקן - הורד והתקן Git מ-https://git-scm.com';
            } else if (error.message.includes('repository')) {
                errorMessage = 'לא נמצא repository תקין - וודא שאתה בתיקיית הפרויקט';
            } else if (error.message.includes('remote origin')) {
                errorMessage = 'לא מוגדר remote origin - הגדר את גיטהאב repository';
            } else if (error.message.includes('authentication')) {
                errorMessage = 'בעיית הרשאות - וודא שיש לך הרשאות לגיטהאב';
            } else if (error.message.includes('network')) {
                errorMessage = 'בעיית רשת - נסה שוב מאוחר יותר';
            }
            
            return { success: false, message: errorMessage };
        } finally {
            this.isUpdating = false;
        }
    }

    // ביצוע פקודה
    executeCommand(command) {
        return new Promise((resolve, reject) => {
            this.addLog(`מבצע: ${command}`, 'info');
            exec(command, { cwd: PROJECT_PATH }, (error, stdout, stderr) => {
                if (error) {
                    this.addLog(`שגיאה בביצוע ${command}: ${error.message}`, 'error');
                    reject(error);
                    return;
                }
                this.addLog(`בוצע בהצלחה: ${command}`, 'success');
                resolve(stdout);
            });
        });
    }

    // בדיקת סטטוס
    async getStatus() {
        try {
            const internetOk = await this.checkInternetConnection();
            const gitStatus = await this.checkGitStatus();
            const repoStatus = await this.checkRepository();
            const authStatus = await this.checkGitHubAuth();
            
            let status = 'לא ידוע';
            let hasChanges = false;
            
            if (!internetOk) {
                status = 'אין חיבור לאינטרנט';
            } else if (!gitStatus.installed) {
                status = 'Git לא מותקן';
            } else if (!repoStatus.valid) {
                status = 'Repository לא תקין';
            } else if (!authStatus.configured) {
                status = 'לא מוגדר remote origin';
            } else {
                // בדיקת שינויים
                try {
                    const gitStatusOutput = await this.executeCommand('git status --porcelain');
                    hasChanges = gitStatusOutput.trim().length > 0;
                    status = hasChanges ? 'יש שינויים' : 'אין שינויים';
                } catch (error) {
                    status = 'שגיאה בבדיקת שינויים';
                }
            }
            
            return {
                hasChanges,
                isUpdating: this.isUpdating,
                lastUpdate: this.lastUpdate,
                status,
                internetOk,
                gitInstalled: gitStatus.installed,
                repoValid: repoStatus.valid,
                authConfigured: authStatus.configured,
                logs: this.logs.slice(-10) // 10 הלוגים האחרונים
            };
        } catch (error) {
            return {
                hasChanges: false,
                isUpdating: this.isUpdating,
                lastUpdate: this.lastUpdate,
                status: 'שגיאה בבדיקת סטטוס',
                internetOk: false,
                gitInstalled: false,
                repoValid: false,
                authConfigured: false,
                logs: this.logs.slice(-10)
            };
        }
    }
}

const updater = new GitHubUpdater();

// נתיבים API
app.get('/api/status', async (req, res) => {
    try {
        const status = await updater.getStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/update', async (req, res) => {
    try {
        const result = await updater.updateToGitHub();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// נתיב ללוגים
app.get('/api/logs', (req, res) => {
    res.json({ logs: updater.logs });
});

// נתיב בדיקה
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        projectPath: PROJECT_PATH
    });
});

// הפעלת השרת
app.listen(PORT, () => {
    console.log(`🚀 GitHub Updater Server פועל על פורט ${PORT}`);
    console.log(`🌐 פתח את הדפדפן בכתובת: http://localhost:${PORT}/github-auto-updater.html`);
    console.log(`📁 נתיב הפרויקט: ${PROJECT_PATH}`);
    console.log(`⏰ זמן הפעלה: ${new Date().toLocaleString('he-IL')}`);
});
