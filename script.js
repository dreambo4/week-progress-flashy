const WORK_START_HOUR = 8;
const WORK_END_HOUR = 17;
const WORK_DAYS = 5; 
const TOTAL_WORK_HOURS_PER_DAY = WORK_END_HOUR - WORK_START_HOUR;
const TOTAL_WORK_SECONDS_PER_WEEK = WORK_DAYS * TOTAL_WORK_HOURS_PER_DAY * 3600;

console.log("Week Progress Script Loaded v1.3.0");

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

let lastQuoteIndex = -1;
let lastQuoteTime = 0;

function updateQuote() {
    const quoteElem = document.getElementById('quote');
    if (!quoteElem) return;
    const now = Date.now();
    const savedQuote = localStorage.getItem('week-progress-quote');
    const savedQuoteTime = localStorage.getItem('week-progress-quote-time');
    const ROTATION_MS = 5 * 60 * 1000;
    if (savedQuote !== null && savedQuoteTime !== null && (now - savedQuoteTime < ROTATION_MS)) {
        lastQuoteIndex = parseInt(savedQuote);
        lastQuoteTime = parseInt(savedQuoteTime);
        quoteElem.textContent = ENCOURAGEMENTS[lastQuoteIndex];
    } else {
        let newIndex;
        do { newIndex = Math.floor(Math.random() * ENCOURAGEMENTS.length); } while (newIndex === lastQuoteIndex && ENCOURAGEMENTS.length > 1);
        lastQuoteIndex = newIndex;
        lastQuoteTime = now;
        quoteElem.textContent = ENCOURAGEMENTS[lastQuoteIndex];
        localStorage.setItem('week-progress-quote', lastQuoteIndex);
        localStorage.setItem('week-progress-quote-time', lastQuoteTime);
    }
}

// --- Dynamic Time Configuration ---
let timeConfig = JSON.parse(localStorage.getItem('week-progress-time-config')) || {
    workStart: "08:00",
    workEnd: "17:00",
    lunchStart: "12:00",
    lunchEnd: "13:00"
};

function openTimeModal() {
    console.log("Opening Time Modal...");
    document.getElementById('workStart').value = timeConfig.workStart;
    document.getElementById('workEnd').value = timeConfig.workEnd;
    document.getElementById('lunchStart').value = timeConfig.lunchStart;
    document.getElementById('lunchEnd').value = timeConfig.lunchEnd;
    document.getElementById('settingsModal').classList.add('active');
    const menu = document.getElementById('themeMenu');
    if (menu) menu.classList.remove('active');
}

function closeTimeModal() {
    document.getElementById('settingsModal').classList.remove('active');
}

function saveTimeConfig() {
    timeConfig.workStart = document.getElementById('workStart').value;
    timeConfig.workEnd = document.getElementById('workEnd').value;
    timeConfig.lunchStart = document.getElementById('lunchStart').value;
    timeConfig.lunchEnd = document.getElementById('lunchEnd').value;
    localStorage.setItem('week-progress-time-config', JSON.stringify(timeConfig));
    updateProgress(); 
    closeTimeModal();
    if (typeof confetti === 'function') {
        confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
    }
    // GA: Save settings
    if (typeof gtag === 'function') {
        gtag('event', 'save_settings', {
            'work_hours': `${timeConfig.workStart}-${timeConfig.workEnd}`
        });
    }
}

function parseTimeToSec(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 3600 + m * 60;
}

// --- Notification Logic ---
// 使用 Base64 編碼以提高瀏覽器相容性
const NOTI_ICON_DINO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAvCAAAAAC9e3dzAAAAAnRSTlMAAHaTzTgAAADaSURBVHic1ZQ7EoUwCEXRocn6bFkereujfRNjjIT4CWrxaMzA9c4ZQgD4KoZ2Whq5AHgkpSrHADA+xhDjm7xPnOe5znRh4HFpgkfO4x+K8UrAXuchjU3YpdpjFLqZBWjPJaB8+aVuiLbdIridaXtzVJVJcXuYafnf4rLK+bpBb88GXgmC2zkcrJRuDFYQi/i+9wj9i1Gat6d74V25UnlbX/+SYdZfG2gXa4m6hnm9z+triReR+GviZ1PHDT8jPiM34kieXqGs3uVU4j7zBDBEgNSRvDtiN/JJxw/71S1l4zrV3AAAAABJRU5ErkJggg==";
const NOTI_ICON_CLOCK = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48dGV4dCB4PSI1MCIgeT0iNzAiIGZvbnQtc2l6ZT0iODAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJjZW50cmFsIj7ij7A8L3RleHQ+PC9zdmc+";
const NOTI_ICON_WATER = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48dGV4dCB5PSIuOWVtIiBmb250LXNpemU9IjgwIj7wn5KnPC90ZXh0Pjwvc3ZnPg==";

let notiConfig = JSON.parse(localStorage.getItem('week-progress-noti-config')) || { endDay: true, progress: true, hourly: true };

async function requestNotiPermission() {
    if (typeof Notification === 'undefined') {
        alert("此瀏覽器不支援通知功能 🚫");
        return;
    }
    console.log("Requesting notification permission...");
    const permission = await Notification.requestPermission();
    updateNotiUI();
    if (permission === 'granted') {
        new Notification("權限已開啟！", { body: "小恐龍現在可以提醒你囉 🦖", icon: NOTI_ICON_DINO });
    }
}

function updateNotiUI() {
    const requestBtn = document.getElementById('notiRequestBtn');
    if (!requestBtn) return;
    
    const endDayCheck = document.getElementById('notiEndDay');
    const progressCheck = document.getElementById('notiProgress');
    const hourlyCheck = document.getElementById('notiHourly');

    if (endDayCheck) endDayCheck.checked = notiConfig.endDay;
    if (progressCheck) progressCheck.checked = notiConfig.progress;
    if (hourlyCheck) hourlyCheck.checked = notiConfig.hourly;

    if (typeof Notification === 'undefined') {
        requestBtn.textContent = "此瀏覽器不支援通知";
        requestBtn.style.color = "gray";
        return;
    }

    requestBtn.style.display = (Notification.permission === 'granted') ? 'none' : 'block';
}

function updateNotiConfig() {
    notiConfig.endDay = document.getElementById('notiEndDay').checked;
    notiConfig.progress = document.getElementById('notiProgress').checked;
    notiConfig.hourly = document.getElementById('notiHourly').checked;
    localStorage.setItem('week-progress-noti-config', JSON.stringify(notiConfig));
    // GA: Update Notification
    if (typeof gtag === 'function') {
        gtag('event', 'update_notifications', {
            'endDay': notiConfig.endDay,
            'progress': notiConfig.progress,
            'hourly': notiConfig.hourly
        });
    }
}

// --- Theme Management ---
function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('week-progress-theme', theme);
    const menu = document.getElementById('themeMenu');
    if (menu) menu.classList.remove('active');
    // GA: Change theme
    if (typeof gtag === 'function') {
        gtag('event', 'select_theme', { 'theme_id': theme });
    }
}

// --- Pet & Celebration Logic ---
let lastCelebrationDay = -1;
function triggerCelebration() {
    const duration = 60 * 1000;
    const animationEnd = Date.now() + duration;
    const interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);
        if (typeof confetti === 'function') {
            confetti({ particleCount: 25, origin: { x: Math.random(), y: Math.random() - 0.2 } });
        }
    }, 250);
}

let petHunger = 100;
let petPos = 50;
let isAnnouncing = false;

function feedPet() {
    petHunger = Math.min(100, petHunger + 30);
    const petStatus = document.getElementById('petStatus');
    if (petStatus) {
        petStatus.textContent = "好吃！加點體力 🍱";
        isAnnouncing = true;
        setTimeout(() => { isAnnouncing = false; updatePetStatus(); }, 1500);
        if (typeof confetti === 'function') { confetti({ particleCount: 20, spread: 30, origin: { y: 0.9 } }); }
    }
    // GA: Feed Pet
    if (typeof gtag === 'function') {
        gtag('event', 'pet_action', { 'method': 'feed' });
    }
}

function patPet() {
    const pet = document.getElementById('pet');
    const petStatus = document.getElementById('petStatus');
    if (pet && petStatus) {
        const currentTransform = pet.style.transform || "";
        pet.style.transform = `${currentTransform} scale(1.3)`;
        setTimeout(() => {
            if (currentTransform.includes("scaleX(-1)")) pet.style.transform = "scaleX(-1)"; else pet.style.transform = "scaleX(1)";
        }, 300);
        petStatus.textContent = "❤️";
        isAnnouncing = true;
        setTimeout(() => { isAnnouncing = false; updatePetStatus(); }, 2000);
    }
    // GA: Pat Pet
    if (typeof gtag === 'function') {
        gtag('event', 'pet_action', { 'method': 'pat' });
    }
}

function updatePetStatus() {
    if (isAnnouncing) return;
    const petStatus = document.getElementById('petStatus');
    const pet = document.getElementById('pet');
    if (!petStatus || !pet) return;
    pet.classList.remove('hungry', 'happy', 'dead');
    if (petHunger > 80) { petStatus.textContent = "小恐龍跑得很開心！🦖✨"; pet.classList.add('happy'); }
    else if (petHunger > 40) { petStatus.textContent = "小恐龍肚子有點空空的... 🌵"; }
    else if (petHunger > 0) { petStatus.textContent = "小恐龍沒力氣跑了 🌫️"; pet.classList.add('hungry'); }
    else { petStatus.textContent = "小恐龍已經斷網了 (GameOver) 👻"; pet.classList.add('dead'); }
}

function announceTime() {
    const petStatus = document.getElementById('petStatus');
    if (!petStatus) return;
    const now = new Date();
    const day = now.getDay();
    const currentDaySeconds = (now.getHours() * 3600) + (now.getMinutes() * 60);
    const workStartSec = parseTimeToSec(timeConfig.workStart);
    const workEndSec = parseTimeToSec(timeConfig.workEnd);
    let msg = "";
    if (day === 0 || day === 6) msg = "週末萬歲！盡情狂歡吧 🎉";
    else {
        if (currentDaySeconds < workStartSec) msg = "還沒開工，再摸一下魚... ☕️";
        else if (currentDaySeconds >= workEndSec) msg = "下班啦！快點回家休息 🍻";
        else {
            const remMinTotal = Math.floor((workEndSec - currentDaySeconds) / 60);
            msg = `加油！距離下班還有 ${Math.floor(remMinTotal / 60)} 小時 ${remMinTotal % 60} 分鐘 🏠`;
        }
    }
    isAnnouncing = true;
    petStatus.textContent = msg;
    setTimeout(() => { isAnnouncing = false; updatePetStatus(); }, 6000);
}

function checkMilestones(percentage, now, todayWorkEnd) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const todayStr = now.toISOString().split('T')[0];
    const currentHour = now.getHours();
    const workStartSec = parseTimeToSec(timeConfig.workStart);
    const workEndSec = parseTimeToSec(timeConfig.workEnd);

    if (notiConfig.endDay) {
        const timeToWorkEnd = todayWorkEnd - now;
        if (timeToWorkEnd > 0 && timeToWorkEnd <= 10 * 60 * 1000 && localStorage.getItem('last-noti-10m') !== todayStr) {
            new Notification("準備下班！🍻", { body: "距離下班只剩 10 分鐘，準備收工！", icon: NOTI_ICON_CLOCK });
            localStorage.setItem('last-noti-10m', todayStr);
        }
    }
    if (notiConfig.progress && percentage >= 50 && percentage < 90 && localStorage.getItem('last-noti-50p') !== todayStr) {
        new Notification("本週已過一半！🌓", { body: "加油！再撐一下就週末了！🦖", icon: NOTI_ICON_DINO });
        localStorage.setItem('last-noti-50p', todayStr);
    }
    if (notiConfig.progress && percentage >= 90 && percentage < 100 && localStorage.getItem('last-noti-90p') !== todayStr) {
        new Notification("本週進度 90%！🏁", { body: "做得好！勝利就在眼前！", icon: NOTI_ICON_DINO });
        localStorage.setItem('last-noti-90p', todayStr);
    }
    if (notiConfig.hourly && (now.getHours() * 3600 >= workStartSec) && (now.getHours() * 3600 < workEndSec)) {
        const lastHourlyNoti = localStorage.getItem('last-noti-hourly');
        const hourlyKey = `${todayStr}-${currentHour}`;
        if (now.getMinutes() === 0 && lastHourlyNoti !== hourlyKey) {
            new Notification("整點到囉！💧", { body: "起來ㄋ口水、去個廁所吧！🦖", icon: NOTI_ICON_WATER });
            localStorage.setItem('last-noti-hourly', hourlyKey);
        }
    }
}

function updateProgress() {
    const now = new Date();
    const currentDay = now.getDay();
    const workStartSec = parseTimeToSec(timeConfig.workStart);
    const workEndSec = parseTimeToSec(timeConfig.workEnd);
    const lunchStartSec = parseTimeToSec(timeConfig.lunchStart);
    const lunchEndSec = parseTimeToSec(timeConfig.lunchEnd);

    const monday = new Date(now);
    const diffToMon = (currentDay === 0 ? -6 : 1 - currentDay);
    monday.setDate(now.getDate() + diffToMon);
    monday.setHours(0, 0, 0, 0);

    const weekStart = new Date(monday);
    weekStart.setSeconds(workStartSec);
    const weekEnd = new Date(monday);
    weekEnd.setDate(monday.getDate() + 4);
    weekEnd.setSeconds(workEndSec);

    const todayWorkEnd = new Date(now);
    todayWorkEnd.setHours(0, 0, 0, 0);
    todayWorkEnd.setSeconds(workEndSec);

    const totalDuration = weekEnd - weekStart;
    let elapsed = now - weekStart;
    let statusText = "努力奮鬥中 🚀";
    let isOffDuty = false, isCelebrationWindow = false;
    const currentDaySeconds = (now.getHours() * 3600) + (now.getMinutes() * 60) + now.getSeconds();

    if (currentDay === 0 || currentDay === 6) { statusText = (currentDay === 6 ? "週末狂歡中 🎉" : "週日充電中 ⚡️"); isOffDuty = true; }
    else {
        if (currentDaySeconds < workStartSec) statusText = "尚未開工 ☕️";
        else if (currentDaySeconds >= workEndSec) { isOffDuty = true; if (currentDaySeconds < workEndSec + 60) { statusText = "今日已收工 🍻"; isCelebrationWindow = true; } else statusText = "下班休息中 🔋"; }
        else if (currentDaySeconds >= lunchStartSec && currentDaySeconds < lunchEndSec) statusText = "午休充電中 🍱";
    }
    if (now < weekStart) elapsed = 0; else if (now > weekEnd) elapsed = totalDuration;
    const clampedPercentage = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
    checkMilestones(clampedPercentage, now, todayWorkEnd);
    if (isCelebrationWindow) { document.body.classList.add('celebration-mode'); if (lastCelebrationDay !== currentDay) { triggerCelebration(); lastCelebrationDay = currentDay; } }
    else { document.body.classList.remove('celebration-mode'); if (!isOffDuty) lastCelebrationDay = -1; }
    const title = document.getElementById('title'), progressBar = document.getElementById('progressBar'), percentText = document.getElementById('percentText'), timeLeft = document.getElementById('timeLeft'), dayLabel = document.getElementById('currentDay');
    if (title) title.textContent = statusText;
    if (progressBar) progressBar.style.width = clampedPercentage + '%';
    if (percentText) percentText.textContent = clampedPercentage.toFixed(4) + '%';
    const totalSeconds = Math.floor(Math.max(0, weekEnd - now) / 1000);
    if (timeLeft) timeLeft.textContent = `${Math.floor(totalSeconds / 3600)}h ${Math.floor((totalSeconds % 3600) / 60)}m ${totalSeconds % 60}s`;
    const dayNames = ['週日 SUNDAY', '週一 MONDAY', '週二 TUESDAY', '週三 WEDNESDAY', '週四 THURSDAY', '週五 FRIDAY', '週六 SATURDAY'];
    if (dayLabel) dayLabel.textContent = dayNames[currentDay];
    updateQuote();
}

function initPet() {
    const container = document.getElementById('petContainer'), pet = document.getElementById('pet'), feedBtn = document.getElementById('feedBtn'), patBtn = document.getElementById('patBtn');
    if (!container || !pet) return;
    container.style.left = petPos + '%';
    const handleFeed = (e) => { e.preventDefault(); e.stopPropagation(); feedPet(); };
    const handlePat = (e) => { e.preventDefault(); e.stopPropagation(); patPet(); };
    if (feedBtn) { feedBtn.addEventListener('click', handleFeed); feedBtn.addEventListener('touchstart', handleFeed); }
    if (patBtn) { patBtn.addEventListener('click', handlePat); patBtn.addEventListener('touchstart', handlePat); }
    setInterval(() => {
        if (Math.random() > 0.85 && !isAnnouncing && petHunger > 0) announceTime();
        if (petHunger <= 0) { pet.classList.remove('walking'); return; }
        if (Math.random() > 0.4) { 
            let moveAmount = (Math.random() * 40 - 20); let newPos = Math.max(15, Math.min(85, petPos + moveAmount));
            if (newPos !== petPos) { pet.style.transform = (newPos > petPos ? "scaleX(-1)" : "scaleX(1)"); petPos = newPos; container.style.left = petPos + '%'; pet.classList.add('walking'); setTimeout(() => pet.classList.remove('walking'), 2500); }
        }
        petHunger = Math.max(0, petHunger - 0.5); updatePetStatus();
    }, 5000);
}

// --- Initialization ---
const savedTheme = localStorage.getItem('week-progress-theme') || 'neon';
setTheme(savedTheme);

document.getElementById('settingsBtn').onclick = (e) => {
    e.stopPropagation();
    document.getElementById('themeMenu').classList.toggle('active');
};

// Handle window clicks to close menu/modal
window.onclick = (e) => {
    const menu = document.getElementById('themeMenu');
    const modal = document.getElementById('settingsModal');
    if (menu) menu.classList.remove('active');
    if (e.target === modal) closeTimeModal(); // Click outside to close
};

initPet();
updateProgress();
updateNotiUI();
setInterval(updateProgress, 1000);
