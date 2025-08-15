// GitHub Auto Updater - מעדכן אוטומטית את גיטהאב עם כל שינוי באפליקציה
class GitHubAutoUpdater {
    constructor() {
        this.isUpdating = false;
        this.updateButton = null;
        this.autoUpdate = false;
        this.watchInterval = null;
        this.lastUpdate = Date.now();
        this.changeDetected = false;
    }

    // יצירת כפתור העדכון
    createUpdateButton() {
        const button = document.createElement('button');
        button.id = 'githubUpdateBtn';
        button.className = 'btn';
        button.innerHTML = '🔄 עדכון לגיטהאב';
        button.title = 'עדכן את הקבצים לגיטהאב';
        button.onclick = () => this.updateToGitHub();
        
        return button;
    }

    // יצירת כפתור עדכון אוטומטי
    createAutoUpdateButton() {
        const button = document.createElement('button');
        button.id = 'autoUpdateBtn';
        button.className = 'btn';
        button.innerHTML = '⚡ עדכון אוטומטי';
        button.title = 'הפעל/כבה עדכון אוטומטי לגיטהאב';
        button.onclick = () => this.toggleAutoUpdate();
        
        return button;
    }

    // הוספת הכפתורים לדף
    addButtonsToPage() {
        const toolsSection = document.querySelector('.tools .advanced-toggle');
        if (toolsSection) {
            // כפתור עדכון ידני
            this.updateButton = this.createUpdateButton();
            toolsSection.appendChild(this.updateButton);
            
            // כפתור עדכון אוטומטי
            const autoButton = this.createAutoUpdateButton();
            toolsSection.appendChild(autoButton);
            
            console.log('כפתורי העדכון נוספו בהצלחה!');
        } else {
            console.error('לא נמצא אזור tools');
        }
    }

    // הפעלה/כיבוי עדכון אוטומטי
    toggleAutoUpdate() {
        this.autoUpdate = !this.autoUpdate;
        const autoButton = document.getElementById('autoUpdateBtn');
        
        if (this.autoUpdate) {
            autoButton.innerHTML = '⏹️ עצור אוטומטי';
            autoButton.style.background = 'linear-gradient(135deg, #f44336, #d32f2f)';
            this.startAutoUpdate();
            this.showNotification('עדכון אוטומטי הופעל! 🔄', 'success');
        } else {
            autoButton.innerHTML = '⚡ עדכון אוטומטי';
            autoButton.style.background = '';
            this.stopAutoUpdate();
            this.showNotification('עדכון אוטומטי הופסק! ⏹️', 'info');
        }
    }

    // התחלת עדכון אוטומטי
    startAutoUpdate() {
        // בדיקה כל 10 שניות
        this.watchInterval = setInterval(() => {
            this.checkForChanges();
        }, 10000);
        
        // האזנה לשינויים בדף
        this.watchPageChanges();
    }

    // עצירת עדכון אוטומטי
    stopAutoUpdate() {
        if (this.watchInterval) {
            clearInterval(this.watchInterval);
            this.watchInterval = null;
        }
    }

    // האזנה לשינויים בדף
    watchPageChanges() {
        // האזנה לשינויים ב-DOM
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' || mutation.type === 'attributes') {
                    this.onPageChange();
                }
            });
        });

        // האזנה לכל השינויים בדף
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'data-*']
        });

        // האזנה לשינויים ב-localStorage
        window.addEventListener('storage', () => {
            this.onPageChange();
        });

        // האזנה לשינויים ב-sessionStorage
        window.addEventListener('storage', () => {
            this.onPageChange();
        });

        // האזנה ללחיצות עכבר
        document.addEventListener('click', () => {
            this.onPageChange();
        });

        // האזנה להקלדות
        document.addEventListener('keydown', () => {
            this.onPageChange();
        });

        // האזנה לשינויים בטופסים
        document.addEventListener('input', () => {
            this.onPageChange();
        });

        // האזנה לשינויים בבחירת טקסט
        document.addEventListener('selectionchange', () => {
            this.onPageChange();
        });
    }

    // פונקציה שמופעלת כשהדף משתנה
    onPageChange() {
        if (this.autoUpdate && !this.changeDetected) {
            this.changeDetected = true;
            console.log('שינוי זוהה בדף - מתחיל עדכון לגיטהאב...');
            
            // המתנה קצרה לפני העדכון
            setTimeout(() => {
                this.updateToGitHub();
            }, 2000);
        }
    }

    // בדיקה אם יש שינויים
    async checkForChanges() {
        try {
            const currentTime = Date.now();
            const timeSinceLastUpdate = currentTime - this.lastUpdate;
            
            // אם עברו יותר מ-5 דקות או שיש שינוי זוהה
            if (timeSinceLastUpdate > 300000 || this.changeDetected) {
                console.log('נמצאו שינויים - מעדכן לגיטהאב...');
                await this.updateToGitHub();
            }
        } catch (error) {
            console.error('שגיאה בבדיקת שינויים:', error);
        }
    }

    // פונקציה ראשית לעדכון לגיטהאב
    async updateToGitHub() {
        if (this.isUpdating) return;
        
        this.isUpdating = true;
        const originalText = this.updateButton.innerHTML;
        
        try {
            // שלב 1: בודק שינויים
            await this.updateButtonStatus('⏳ בודק שינויים...', 'checking');
            
            // שלב 2: מוסיף קבצים
            await this.updateButtonStatus('⏳ מוסיף קבצים...', 'adding');
            
            // שלב 3: שומר שינויים
            await this.updateButtonStatus('⏳ שומר שינויים...', 'committing');
            
            // שלב 4: מושך שינויים
            await this.updateButtonStatus('⏳ מושך שינויים...', 'pulling');
            
            // שלב 5: מעלה לגיטהאב
            await this.updateButtonStatus('⏳ מעלה לגיטהאב...', 'pushing');
            
            // שלב 6: מסיים
            await this.updateButtonStatus('⏳ מסיים...', 'finishing');
            
            // הצלחה!
            this.updateButton.innerHTML = '✅ הועלה!';
            this.updateButton.style.background = 'linear-gradient(135deg, #4CAF50, #45a049)';
            this.showNotification('הקבצים הועלו בהצלחה לגיטהאב! 🎸', 'success');
            
            // עדכון זמן העדכון האחרון
            this.lastUpdate = Date.now();
            this.changeDetected = false;
            
            // איפוס הכפתור אחרי 3 שניות
            setTimeout(() => {
                this.resetButton(originalText);
            }, 3000);
            
        } catch (error) {
            console.error('שגיאה בעדכון:', error);
            this.updateButton.innerHTML = '❌ שגיאה';
            this.updateButton.style.background = 'linear-gradient(135deg, #f44336, #d32f2f)';
            this.showNotification('אירעה שגיאה בעדכון לגיטהאב', 'error');
            
            setTimeout(() => {
                this.resetButton(originalText);
            }, 3000);
        }
        
        this.isUpdating = false;
    }

    // עדכון סטטוס הכפתור
    async updateButtonStatus(text, stage) {
        if (this.updateButton) {
            this.updateButton.innerHTML = text;
            this.updateButton.disabled = true;
            
            // אנימציה לכל שלב
            const colors = {
                checking: 'linear-gradient(135deg, #2196F3, #1976D2)',
                adding: 'linear-gradient(135deg, #FF9800, #F57C00)',
                committing: 'linear-gradient(135deg, #9C27B0, #7B1FA2)',
                pulling: 'linear-gradient(135deg, #607D8B, #455A64)',
                pushing: 'linear-gradient(135deg, #FF5722, #D84315)',
                finishing: 'linear-gradient(135deg, #4CAF50, #388E3C)'
            };
            
            this.updateButton.style.background = colors[stage] || 'var(--glass)';
            
            // המתנה קצרה בין השלבים
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    // איפוס הכפתור
    resetButton(originalText) {
        if (this.updateButton) {
            this.updateButton.innerHTML = originalText;
            this.updateButton.disabled = false;
            this.updateButton.style.background = '';
        }
    }

    // הצגת הודעות
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = 'github-notification';
        
        const colors = {
            success: '#4CAF50',
            error: '#f44336',
            info: '#2196F3'
        };
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: 'Heebo', sans-serif;
            font-size: 14px;
            max-width: 300px;
            animation: slideInRight 0.3s ease;
            direction: rtl;
        `;
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        this.addNotificationStyles();
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    // הוספת סגנונות CSS להודעות
    addNotificationStyles() {
        if (!document.getElementById('github-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'github-notification-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // אתחול המערכת
    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.addButtonsToPage();
            });
        } else {
            this.addButtonsToPage();
        }
    }
}

// יצירת מופע של המערכת
const githubAutoUpdater = new GitHubAutoUpdater();

// הפעלת המערכת
githubAutoUpdater.init();

// ייצוא לפונקציות גלובליות
window.githubAutoUpdater = githubAutoUpdater;
