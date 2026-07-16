// ===== 時間與作息設定（timeConfig、時間設定 Modal、時間工具函式）=====
const WORK_START_HOUR = 8;
const WORK_END_HOUR = 17;
const WORK_DAYS = 5; 
const TOTAL_WORK_HOURS_PER_DAY = WORK_END_HOUR - WORK_START_HOUR;
const TOTAL_WORK_SECONDS_PER_WEEK = WORK_DAYS * TOTAL_WORK_HOURS_PER_DAY * 3600;

let timeConfig = JSON.parse(localStorage.getItem('week-progress-time-config')) || {};
if (!timeConfig.workStart) timeConfig.workStart = "08:00";
if (!timeConfig.workEnd) timeConfig.workEnd = "17:00";
if (!timeConfig.lunchStart) timeConfig.lunchStart = "12:00";
if (!timeConfig.lunchEnd) timeConfig.lunchEnd = "13:00";
if (!timeConfig.workdays) timeConfig.workdays = [1, 2, 3, 4, 5];
if (timeConfig.weekId === undefined) timeConfig.weekId = 0;

function openTimeModal() {
    document.getElementById('workStart').value = timeConfig.workStart;
    document.getElementById('workEnd').value = timeConfig.workEnd;
    document.getElementById('lunchStart').value = timeConfig.lunchStart;
    document.getElementById('lunchEnd').value = timeConfig.lunchEnd;
    
    document.querySelectorAll('.workday-cb').forEach(cb => {
        cb.checked = timeConfig.workdays.includes(parseInt(cb.value));
    });
    
    document.getElementById('settingsModal').classList.add('active');
    const menu = document.getElementById('themeMenu');
    if (menu) menu.classList.remove('active');
    gtag('event', 'settings_open', { panel: 'time_modal' });
}

function closeTimeModal() {
    document.getElementById('settingsModal').classList.remove('active');
}

function saveTimeConfig() {
    timeConfig.workStart = document.getElementById('workStart').value;
    timeConfig.workEnd = document.getElementById('workEnd').value;
    timeConfig.lunchStart = document.getElementById('lunchStart').value;
    timeConfig.lunchEnd = document.getElementById('lunchEnd').value;
    
    const wdays = [];
    document.querySelectorAll('.workday-cb').forEach(cb => {
        if (cb.checked) wdays.push(parseInt(cb.value));
    });
    timeConfig.workdays = wdays.length > 0 ? wdays : [1, 2, 3, 4, 5];
    
    localStorage.setItem('week-progress-time-config', JSON.stringify(timeConfig));
    updateProgress(); 
    closeTimeModal();
    if (typeof confetti === 'function') {
        confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
    }
    gtag('event', 'time_config_save', { work_start: timeConfig.workStart, work_end: timeConfig.workEnd, lunch_start: timeConfig.lunchStart, lunch_end: timeConfig.lunchEnd });
}

// 由台灣行事曆套用本週上班日（calendar-ui.js 呼叫）
function applyWorkdaysFromCalendar(workdays) {
    if (!Array.isArray(workdays)) return;
    timeConfig.workdays = workdays.length > 0 ? workdays : [1, 2, 3, 4, 5];
    // 同步鎖定本週 weekId，避免 updateProgress 的每週自動重置把套用結果蓋回 [1..5]
    const now = new Date(), curDay = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() + (curDay === 0 ? -6 : 1 - curDay));
    monday.setHours(0, 0, 0, 0);
    timeConfig.weekId = monday.getTime();
    localStorage.setItem('week-progress-time-config', JSON.stringify(timeConfig));
    updateProgress();
    if (typeof confetti === 'function') {
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 } });
    }
}

function parseTimeToSec(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 3600 + m * 60;
}

function isLunchBreak(now) {
    if (!(timeConfig.workdays || [1, 2, 3, 4, 5]).includes(now.getDay())) return false;
    const curSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    return curSec >= parseTimeToSec(timeConfig.lunchStart) && curSec < parseTimeToSec(timeConfig.lunchEnd);
}
