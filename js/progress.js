// ===== 週進度與語錄（進度條、狀態文字、里程碑通知、慶祝模式）=====
const ENCOURAGEMENTS = [
    "加油！每一秒的努力都在成就更好的自己。🚀",
    "薪水不是工資，是精神賠償金。💸",
    "專注當下，收穫就在前方。💪",
    "在哪裡跌倒，就在哪裡躺好。🛌",
    "你是最棒的，穩定輸出，專業度滿分！✨",
    "雖然努力不一定會成功，但沒錢一定很不方便。🙄",
    "再撐一下，週末的陽光就在不遠處！☀️",
    "人生就是不停地開會，然後開完會什麼都沒變。☕️",
    "效率是你的超能力，保持節奏。🏎️",
    "不想上班，只想當一隻不用社交的貓。🐱",
    "今天的努力，是明天成功的墊腳石。🧱",
    "加油，只要你夠努力，老闆就能換更好的車。🏎️",
    "保持熱情，世界會看見你的光芒。🌟",
    "能用錢解決的問題，我都解決不了。💸",
    "你是團隊中不可或缺的一份子，加油！🤝",
    "每天叫醒我的不是夢想，是窮。💤",
    "踏實做好每件事，就是對自己最好的交代。🎯",
    "世上無難事，只要肯放棄。🏳️",
    "休息是為了走更長遠的路，別忘了喝口水。☕️",
    "生活不只有眼前的苟且，還有遠方的甲方。😒"
];

const LUNCH_QUOTES = [
    "吃飽才有力氣摸魚。🍱",
    "午睡二十分鐘，下午生龍活虎。😴",
    "先吃飯，天大的事下午再說。🍜",
    "午休是上班族的合法充電時間。🔋",
    "離開座位走走，眼睛也放個假。🌿",
    "吃什麼不重要，重要的是不在座位上吃。🚶",
    "小恐龍午睡中，請勿打擾。💤",
    "半天過去了，你已經很棒了。✨"
];

let lastQuoteIndex = -1;
let lastQuoteTime = 0;

function updateQuote() {
    const quoteElem = document.getElementById('quote');
    if (!quoteElem) return;
    const mode = isLunchBreak(new Date()) ? 'lunch' : 'work';
    const pool = mode === 'lunch' ? LUNCH_QUOTES : ENCOURAGEMENTS;
    const now = Date.now();
    const savedQuote = localStorage.getItem('week-progress-quote');
    const savedQuoteTime = localStorage.getItem('week-progress-quote-time');
    const savedMode = localStorage.getItem('week-progress-quote-mode') || 'work';
    const ROTATION_MS = 5 * 60 * 1000;
    if (savedMode === mode && savedQuote !== null && savedQuoteTime !== null && (now - savedQuoteTime < ROTATION_MS) && parseInt(savedQuote) < pool.length) {
        lastQuoteIndex = parseInt(savedQuote);
        lastQuoteTime = parseInt(savedQuoteTime);
        quoteElem.textContent = pool[lastQuoteIndex];
    } else {
        let newIndex;
        do { newIndex = Math.floor(Math.random() * pool.length); } while (newIndex === lastQuoteIndex && pool.length > 1);
        lastQuoteIndex = newIndex;
        lastQuoteTime = now;
        quoteElem.textContent = pool[lastQuoteIndex];
        localStorage.setItem('week-progress-quote', lastQuoteIndex);
        localStorage.setItem('week-progress-quote-time', lastQuoteTime);
        localStorage.setItem('week-progress-quote-mode', mode);
    }
}

let lastCelebrationDay = -1;
function triggerCelebration() {
    const duration = 60 * 1000;
    const animationEnd = Date.now() + duration;
    const interval = setInterval(function() {
        if (Date.now() > animationEnd) return clearInterval(interval);
        if (typeof confetti === 'function') {
            confetti({ particleCount: 25, origin: { x: Math.random(), y: Math.random() - 0.2 } });
        }
    }, 250);
}

function checkMilestones(percentage, now, todayWorkEnd) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const todayStr = now.toISOString().split('T')[0], curHour = now.getHours();
    const wStart = parseTimeToSec(timeConfig.workStart), wEnd = parseTimeToSec(timeConfig.workEnd);
    const isWorkday = (timeConfig.workdays || [1,2,3,4,5]).includes(now.getDay());
    if (notiConfig.endDay && isWorkday && (todayWorkEnd - now <= 10 * 60 * 1000) && (todayWorkEnd - now > 0) && localStorage.getItem('last-noti-10m') !== todayStr) {
        new Notification("準備下班！🍻", { body: "距離下班只剩 10 分鐘，準備收工！", icon: NOTI_ICON_CLOCK });
        localStorage.setItem('last-noti-10m', todayStr);
        gtag('event', 'notification_sent', { type: 'end_day' });
    }
    if (notiConfig.progress && percentage >= 50 && percentage < 90 && localStorage.getItem('last-noti-50p') !== todayStr) {
        new Notification("本週已過一半！🌓", { body: "加油！再撐一下就週末了！🦖", icon: NOTI_ICON_DINO });
        localStorage.setItem('last-noti-50p', todayStr);
        gtag('event', 'notification_sent', { type: 'progress_50' });
        gtag('event', 'milestone_reached', { type: '50_percent' });
    }
    if (notiConfig.progress && percentage >= 90 && percentage < 100 && localStorage.getItem('last-noti-90p') !== todayStr) {
        new Notification("本週進度 90%！🏁", { body: "做得好！勝利就在眼前！", icon: NOTI_ICON_DINO });
        localStorage.setItem('last-noti-90p', todayStr);
        gtag('event', 'notification_sent', { type: 'progress_90' });
        gtag('event', 'milestone_reached', { type: '90_percent' });
    }
    if (notiConfig.hourly && isWorkday && (now.getHours() * 3600 >= wStart) && (now.getHours() * 3600 < wEnd) && now.getMinutes() === 0 && localStorage.getItem('last-noti-hourly') !== `${todayStr}-${curHour}`) {
        new Notification("整點到囉！💧", { body: "起來喝口水、去個廁所吧！🦖", icon: NOTI_ICON_WATER });
        localStorage.setItem('last-noti-hourly', `${todayStr}-${curHour}`);
        gtag('event', 'notification_sent', { type: 'hourly_water' });
    }
}

// 狀態框的日期小字：「7/28 (農 六月十五)」。農曆算不出就只顯示國曆。
// updateProgress 每秒呼叫，故以日期字串比對，跨日才真正重算並寫入 DOM。
let lastDateKey = '';
function updateDateLine(now) {
    const elem = document.getElementById('currentDate');
    if (!elem) return;
    const key = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
    if (key === lastDateKey) return;
    lastDateKey = key;
    const solar = `${now.getMonth() + 1}/${now.getDate()}`;
    const lunar = (typeof Lunar !== 'undefined') ? Lunar.getLunarDate(now) : null;
    elem.textContent = lunar ? `${solar} (農 ${lunar.text})` : solar;
}

function updateProgress() {
    const now = new Date(), curDay = now.getDay();
    const wStart = parseTimeToSec(timeConfig.workStart), wEnd = parseTimeToSec(timeConfig.workEnd);
    const lStart = parseTimeToSec(timeConfig.lunchStart), lEnd = parseTimeToSec(timeConfig.lunchEnd);
    const monday = new Date(now);
    monday.setDate(now.getDate() + (curDay === 0 ? -6 : 1 - curDay));
    monday.setHours(0, 0, 0, 0);
    if (timeConfig.weekId !== monday.getTime()) {
        timeConfig.workdays = [1, 2, 3, 4, 5];
        timeConfig.weekId = monday.getTime();
        localStorage.setItem('week-progress-time-config', JSON.stringify(timeConfig));
    }
    
    let selectedDays = timeConfig.workdays || [1, 2, 3, 4, 5];
    const getOffset = (day) => day === 0 ? 6 : day - 1;
    let sortedDays = [...selectedDays].sort((a, b) => getOffset(a) - getOffset(b));
    const firstDayOffset = getOffset(sortedDays[0]);
    const lastDayOffset = getOffset(sortedDays[sortedDays.length - 1]);
    
    const weekStart = new Date(monday); weekStart.setDate(monday.getDate() + firstDayOffset); weekStart.setSeconds(wStart);
    const weekEnd = new Date(monday); weekEnd.setDate(monday.getDate() + lastDayOffset); weekEnd.setSeconds(wEnd);
    const todayWorkEnd = new Date(now); todayWorkEnd.setHours(0, 0, 0, 0); todayWorkEnd.setSeconds(wEnd);
    const totalDuration = Math.max(1000, weekEnd - weekStart);
    let elapsed = now - weekStart;
    let statusText = "努力奮鬥中 🚀", isOff = false, isCeleb = false;
    const curSec = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();
    
    if (!selectedDays.includes(curDay)) { 
        statusText = (curDay === 0 || curDay === 6) ? (curDay === 6 ? "週末狂歡中 🎉" : "週日充電中 ⚡️") : "休假中 🎉"; 
        isOff = true; 
    }
    else if (curSec < wStart) statusText = "尚未開工 ☕️";
    else if (curSec >= wEnd) { isOff = true; if (curSec < wEnd + 60) { statusText = "今日已收工 🍻"; isCeleb = true; } else statusText = "下班休息中 🔋"; }
    else if (curSec >= lStart && curSec < lEnd) statusText = "午休充電中 🍱";
    if (now < weekStart) elapsed = 0; else if (now > weekEnd) elapsed = totalDuration;
    const perc = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
    checkMilestones(perc, now, todayWorkEnd);
    if (isCeleb) { document.body.classList.add('celebration-mode'); if (lastCelebrationDay !== curDay) { triggerCelebration(); lastCelebrationDay = curDay; gtag('event', 'celebration_triggered', { day_of_week: curDay }); gtag('event', 'milestone_reached', { type: '100_percent' }); } }
    else { document.body.classList.remove('celebration-mode'); if (!isOff) lastCelebrationDay = -1; }
    const title = document.getElementById('title'), pBar = document.getElementById('progressBar'), pText = document.getElementById('percentText'), tLeft = document.getElementById('timeLeft'), dLabel = document.getElementById('currentDay');
    if (title) {
        // h1 漸層文字會把 emoji 染成色塊，結尾 emoji 拆進 span 還原原生顏色
        const sp = statusText.lastIndexOf(' ');
        if (sp > -1) title.innerHTML = `${statusText.slice(0, sp)} <span class="title-emoji">${statusText.slice(sp + 1)}</span>`;
        else title.textContent = statusText;
    }
    if (pBar) pBar.style.width = perc + '%';
    if (pText) pText.textContent = perc.toFixed(4) + '%';
    if (typeof setFaviconProgress === 'function') setFaviconProgress(perc);
    const fmtSec = (s) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ${s % 60}s`;
    const isLunch = selectedDays.includes(curDay) && curSec >= lStart && curSec < lEnd;
    const tLabel = document.getElementById('timeLeftLabel');
    if (tLabel) tLabel.textContent = isLunch ? '午休剩餘 LUNCH LEFT' : '剩餘時間 REMAINING';
    if (tLeft) tLeft.textContent = isLunch ? fmtSec(lEnd - curSec) : fmtSec(Math.floor(Math.max(0, weekEnd - now) / 1000));
    const petContainer = document.getElementById('petContainer');
    if (petContainer) petContainer.classList.toggle('napping', isLunch && petHunger > 0 && !window.dinoGameActive);
    const dayNames = ['週日 SUNDAY', '週一 MONDAY', '週二 TUESDAY', '週三 WEDNESDAY', '週四 THURSDAY', '週五 FRIDAY', '週六 SATURDAY'];
    if (dLabel) dLabel.textContent = dayNames[curDay];
    updateDateLine(now);
    updateQuote();
}
