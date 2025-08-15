const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static('.'));

// נתיב לפרויקט
const PROJECT_PATH = path.join(__dirname);

class GitHubUpdater {
    constructor() {
        this.isUpdating = false;
        this.lastUpdate = Date.now();
    }

    // עדכון לגיטהאב
    async updateToGitHub() {
        if (this.isUpdating) {
            return { success: false, message: 'כבר מתבצע עדכון' };
        }

        this.isUpdating = true;

        try {
            // שלב 1: בודק שינויים
            await this.executeCommand('git status');
            
            // שלב 2: מוסיף קבצים
            await this.executeCommand('git add .');
            
            // שלב 3: שומר שינויים
            await this.executeCommand('git commit -m "Auto update: ' + new Date().toLocaleString() + '"');
            
            // שלב 4: מושך שינויים
            await this.executeCommand('git pull origin main');
            
            // שלב 5: מעלה לגיטהאב
            await this.executeCommand('git push origin main');
            
            this.lastUpdate = Date.now();
            
            return { success: true, message: 'הקבצים הועלו בהצלחה לגיטהאב! 🎸' };
            
        } catch (error) {
            console.error('שגיאה בעדכון:', error);
            return { success: false, message: 'שגיאה בעדכון: ' + error.message };
        } finally {
            this.isUpdating = false;
        }
    }

    // ביצוע פקודה
    executeCommand(command) {
        return new Promise((resolve, reject) => {
            exec(command, { cwd: PROJECT_PATH }, (error, stdout, stderr) => {
                if (error) {
                    console.error(`שגיאה בביצוע ${command}:`, error);
                    reject(error);
                    return;
                }
                console.log(`בוצע בהצלחה: ${command}`);
                resolve(stdout);
            });
        });
    }

    // בדיקת סטטוס
    async getStatus() {
        try {
            const status = await this.executeCommand('git status --porcelain');
            const hasChanges = status.trim().length > 0;
            
            return {
                hasChanges,
                isUpdating: this.isUpdating,
                lastUpdate: this.lastUpdate,
                status: hasChanges ? 'יש שינויים' : 'אין שינויים'
            };
        } catch (error) {
            return {
                hasChanges: false,
                isUpdating: this.isUpdating,
                lastUpdate: this.lastUpdate,
                status: 'שגיאה בבדיקת סטטוס'
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

// הפעלת השרת
app.listen(PORT, () => {
    console.log(`GitHub Updater Server פועל על פורט ${PORT}`);
    console.log(`פתח את הדפדפן בכתובת: http://localhost:${PORT}/github-auto-updater.html`);
});
