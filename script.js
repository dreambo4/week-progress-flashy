const WORK_START_HOUR = 8;
const WORK_END_HOUR = 17;
const WORK_DAYS = 5; 
const TOTAL_WORK_HOURS_PER_DAY = WORK_END_HOUR - WORK_START_HOUR;
const TOTAL_WORK_SECONDS_PER_WEEK = WORK_DAYS * TOTAL_WORK_HOURS_PER_DAY * 3600;

console.log("Week Progress Script Loaded v1.4.1");

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
let userLat = null;
let userLon = null;

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

function parseTimeToSec(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 3600 + m * 60;
}

const NOTI_ICON_DINO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAvCAAAAAC9e3dzAAAAAnRSTlMAAHaTzTgAAADaSURBVHic1ZQ7EoUwCEXRocn6bFkereujfRNjjIT4CWrxaMzA9c4ZQgD4KoZ2Whq5AHgkpSrHADA+xhDjm7xPnOe5znRh4HFpgkfO4x+K8UrAXuchjU3YpdpjFLqZBWjPJaB8+aVuiLbdIridaXtzVJVJcXuYafnf4rLK+bpBb88GXgmC2zkcrJRuDFYQi/i+9wj9i1Gat6d74V25UnlbX/+SYdZfG2gXa4m6hnm9z+triReR+GviZ1PHDT8jPiM34kieXqGs3uVU4j7zBDBEgNSRvDtiN/JJxw/71S1l4zrV3AAAAABJRU5ErkJggg==";
// 通知 icon 不支援 SVG，必須是點陣圖；改用預先轉好的 64x64 PNG 檔（⏰ / 💧）
const NOTI_ICON_CLOCK = "icons/clock.png";
const NOTI_ICON_WATER = "icons/water.png";

let notiConfig = JSON.parse(localStorage.getItem('week-progress-noti-config')) || { endDay: true, progress: true, hourly: true, weatherAlert: true };
if (notiConfig.weatherAlert === undefined) notiConfig.weatherAlert = true;
let weatherConfig = JSON.parse(localStorage.getItem('week-progress-weather-config')) || { bgEnabled: true, infoEnabled: true };
let currentWeatherData = null;
let previousWeatherCode = JSON.parse(localStorage.getItem('week-progress-prev-weather-code'));

function isRainyCode(code) {
    return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
}

function getWeatherChangeMessage(oldCode, newCode) {
    const wasRainy = oldCode !== null && isRainyCode(oldCode);
    const isRainy = isRainyCode(newCode);
    if (!wasRainy && isRainy) return { title: '下雨了！☔', body: '外面開始下雨了，記得帶傘！🌧️' };
    if (wasRainy && !isRainy) return { title: '雨停了！🌤️', body: '雨已經停囉，出去透透氣吧！☀️' };
    if (wasRainy && isRainy && oldCode !== newCode) {
        if (newCode >= 95 && oldCode < 95) return { title: '暴雨來了！⛈️', body: '注意安全，避免外出！' };
        if (oldCode >= 95 && newCode < 95) return { title: '暴雨已過 🌧️', body: '還在下雨，但暴雨已減弱。' };
    }
    return null;
}

async function requestNotiPermission() {
    if (typeof Notification === 'undefined') {
        alert("此瀏覽器不支援通知功能 🚫");
        return;
    }
    gtag('event', 'notification_permission', { action: 'request' });
    const permission = await Notification.requestPermission();
    gtag('event', 'notification_permission', { action: permission });
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
    const weatherAlertCheck = document.getElementById('notiWeatherAlert');
    const weatherBgCheck = document.getElementById('weatherBgEnabled');
    const weatherInfoCheck = document.getElementById('weatherInfoEnabled');
    if (endDayCheck) endDayCheck.checked = notiConfig.endDay;
    if (progressCheck) progressCheck.checked = notiConfig.progress;
    if (hourlyCheck) hourlyCheck.checked = notiConfig.hourly;
    if (weatherAlertCheck) weatherAlertCheck.checked = notiConfig.weatherAlert;
    if (weatherBgCheck) weatherBgCheck.checked = weatherConfig.bgEnabled;
    if (weatherInfoCheck) weatherInfoCheck.checked = weatherConfig.infoEnabled;
    if (typeof Notification === 'undefined') {
        requestBtn.textContent = "此瀏覽器不支援通知";
        requestBtn.style.color = "gray";
        return;
    }
    requestBtn.style.display = (Notification.permission === 'granted') ? 'none' : 'block';
}

function updateNotiConfig() {
    const prev = { ...notiConfig };
    notiConfig.endDay = document.getElementById('notiEndDay').checked;
    notiConfig.progress = document.getElementById('notiProgress').checked;
    notiConfig.hourly = document.getElementById('notiHourly').checked;
    notiConfig.weatherAlert = document.getElementById('notiWeatherAlert').checked;
    localStorage.setItem('week-progress-noti-config', JSON.stringify(notiConfig));
    if (prev.endDay !== notiConfig.endDay) gtag('event', 'notification_toggle', { type: 'end_day', enabled: notiConfig.endDay });
    if (prev.progress !== notiConfig.progress) gtag('event', 'notification_toggle', { type: 'progress', enabled: notiConfig.progress });
    if (prev.hourly !== notiConfig.hourly) gtag('event', 'notification_toggle', { type: 'hourly', enabled: notiConfig.hourly });
    if (prev.weatherAlert !== notiConfig.weatherAlert) gtag('event', 'notification_toggle', { type: 'weather_alert', enabled: notiConfig.weatherAlert });
}

function updateWeatherConfig() {
    const prevBg = weatherConfig.bgEnabled, prevInfo = weatherConfig.infoEnabled;
    weatherConfig.bgEnabled = document.getElementById('weatherBgEnabled').checked;
    weatherConfig.infoEnabled = document.getElementById('weatherInfoEnabled').checked;
    localStorage.setItem('week-progress-weather-config', JSON.stringify(weatherConfig));
    applyWeatherEffects();
    if (weatherConfig.bgEnabled || weatherConfig.infoEnabled) fetchWeather();
    if (prevBg !== weatherConfig.bgEnabled) gtag('event', 'weather_toggle', { type: 'bg', enabled: weatherConfig.bgEnabled });
    if (prevInfo !== weatherConfig.infoEnabled) gtag('event', 'weather_toggle', { type: 'info', enabled: weatherConfig.infoEnabled });
}

async function fetchWeather() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        userLat = latitude;
        userLon = longitude;
        updateSolarAngle();
        if (!weatherConfig.bgEnabled && !weatherConfig.infoEnabled && !notiConfig.weatherAlert) return;
        try {
            const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,relative_humidity_2m&daily=sunrise,sunset&timezone=auto`);
            const data = await response.json();
            currentWeatherData = data;
            const newCode = data.current.weather_code;
            gtag('event', 'weather_fetched', { weather_code: newCode, temperature: data.current.temperature_2m, humidity: data.current.relative_humidity_2m });
            // Weather change detection & notification
            if (notiConfig.weatherAlert && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                const changeMsg = getWeatherChangeMessage(previousWeatherCode, newCode);
                if (changeMsg) {
                    new Notification(changeMsg.title, { body: changeMsg.body, icon: NOTI_ICON_DINO });
                    gtag('event', 'notification_sent', { type: 'weather_change' });
                    const changeType = isRainyCode(newCode) ? (newCode >= 95 ? 'storm_start' : 'rain_start') : (previousWeatherCode >= 95 ? 'storm_end' : 'rain_stop');
                    gtag('event', 'weather_change_detected', { from_code: previousWeatherCode, to_code: newCode, change_type: changeType });
                }
            }
            previousWeatherCode = newCode;
            localStorage.setItem('week-progress-prev-weather-code', JSON.stringify(newCode));
            applyWeatherEffects();
            // Check umbrella reminder at end-of-work
            checkUmbrellaReminder(newCode);
        } catch (error) {
            console.error("Failed to fetch weather:", error);
        }
    }, (error) => {
        console.log("Geolocation error:", error.message);
        applyWeatherEffects();
    });
}

function checkUmbrellaReminder(weatherCode) {
    if (!notiConfig.weatherAlert) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (!isRainyCode(weatherCode)) return;
    const now = new Date();
    const curDay = now.getDay();
    const isWorkday = (timeConfig.workdays || [1,2,3,4,5]).includes(curDay);
    if (!isWorkday) return; 
    const curSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const wEnd = parseTimeToSec(timeConfig.workEnd);
    const lStart = parseTimeToSec(timeConfig.lunchStart);
    const todayStr = now.toISOString().split('T')[0];
    // Remind near lunch start (within 10 minutes before)
    const lunchDiffMin = (lStart - curSec) / 60;
    if (lunchDiffMin >= 0 && lunchDiffMin <= 10 && localStorage.getItem('last-noti-umbrella-lunch') !== todayStr) {
        new Notification('午餐時間下雨中！🌧️', { body: '外出用餐記得帶傘哦！☔', icon: NOTI_ICON_DINO });
        localStorage.setItem('last-noti-umbrella-lunch', todayStr);
        gtag('event', 'notification_sent', { type: 'umbrella_lunch' });
    }
    // Remind 30 minutes before end of work
    const diffMin = (wEnd - curSec) / 60;
    if (diffMin > 0 && diffMin <= 30 && localStorage.getItem('last-noti-umbrella') !== todayStr) {
        new Notification('記得帶傘！🌂', { body: '下班時間快到了，外面還在下雨，別忘了帶傘再出門哦！☔', icon: NOTI_ICON_DINO });
        localStorage.setItem('last-noti-umbrella', todayStr);
        gtag('event', 'notification_sent', { type: 'umbrella_work' });
    }
}

function applyWeatherEffects() {
    const bgContainer = document.getElementById('weatherBackground');
    const infoBox = document.getElementById('weatherInfoBox');
    const weatherEmoji = document.getElementById('weatherEmoji');
    const weatherTemp = document.getElementById('weatherTemp');
    const sunriseTime = document.getElementById('sunriseTime');
    const sunsetTime = document.getElementById('sunsetTime');
    const humidityVal = document.getElementById('humidityVal');
    if (!bgContainer) return;
    bgContainer.innerHTML = ''; 
    if (!currentWeatherData) {
        if (infoBox) infoBox.style.display = 'none';
        return;
    }
    if (infoBox) {
        infoBox.style.display = weatherConfig.infoEnabled ? 'flex' : 'none';
        if (weatherConfig.infoEnabled) {
            const temp = currentWeatherData.current.temperature_2m;
            const code = currentWeatherData.current.weather_code;
            const humidity = currentWeatherData.current.relative_humidity_2m;
            const sunrise = currentWeatherData.daily.sunrise[0].split('T')[1];
            const sunset = currentWeatherData.daily.sunset[0].split('T')[1];
            if (weatherEmoji) weatherEmoji.textContent = getWeatherEmoji(code);
            if (weatherTemp) weatherTemp.textContent = `${temp}°C`;
            if (sunriseTime) sunriseTime.textContent = sunrise;
            if (sunsetTime) sunsetTime.textContent = sunset;
            if (humidityVal) humidityVal.textContent = `${humidity}%`;
        }
    }
    if (weatherConfig.bgEnabled) {
        createWeatherVisuals(currentWeatherData.current.weather_code);
    }
}

function getWeatherEmoji(code) {
    if (code === 0) return '☀️';
    if (code <= 3) return '☁️';
    if (code >= 51 && code <= 67) return '🌧️';
    if (code >= 80 && code <= 82) return '🌦️';
    if (code >= 95) return '⛈️';
    return '⛅';
}

function createWeatherVisuals(code) {
    const bgContainer = document.getElementById('weatherBackground');
    if (!bgContainer) return;
    if (code === 0) {
        const sun = document.createElement('div');
        sun.className = 'sun-container';
        sun.id = 'dynamicSun';
        const sunGlow = document.createElement('div');
        sunGlow.className = 'sun-glow';
        const sunRays = document.createElement('div');
        sunRays.className = 'sun-rays';
        const sunCore = document.createElement('div');
        sunCore.className = 'sun-core';
        sun.appendChild(sunGlow);
        sun.appendChild(sunRays);
        sun.appendChild(sunCore);
        bgContainer.appendChild(sun);
    } else if (code <= 3) {
        for (let i = 0; i < 3; i++) {
            const cloud = document.createElement('div');
            cloud.className = 'cloud';
            cloud.style.top = (15 + i * 20) + '%';
            cloud.style.width = (150 + Math.random() * 150) + 'px';
            cloud.style.height = '60px';
            cloud.style.animationDuration = (40 + Math.random() * 40) + 's';
            cloud.style.animationDelay = (i * -15) + 's';
            bgContainer.appendChild(cloud);
        }
    } else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
        const dropCount = code > 63 ? 80 : 40;
        for (let i = 0; i < dropCount; i++) {
            const drop = document.createElement('div');
            drop.className = 'rain-drop';
            drop.style.left = Math.random() * 100 + 'vw';
            drop.style.animationDuration = (0.6 + Math.random() * 0.4) + 's';
            drop.style.animationDelay = Math.random() * 2 + 's';
            bgContainer.appendChild(drop);
        }
    } else if (code >= 95) {
        const flash = document.createElement('div');
        flash.className = 'lightning-flash';
        bgContainer.appendChild(flash);
        for (let i = 0; i < 150; i++) {
            const drop = document.createElement('div');
            drop.className = 'rain-drop storm-drop';
            drop.style.left = Math.random() * 100 + 'vw';
            drop.style.animationDuration = (0.2 + Math.random() * 0.3) + 's';
            drop.style.animationDelay = Math.random() * 1 + 's';
            bgContainer.appendChild(drop);
        }
    }
}

function setTheme(theme) {
    const prevTheme = document.body.getAttribute('data-theme');
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('week-progress-theme', theme);
    const menu = document.getElementById('themeMenu');
    if (menu) menu.classList.remove('active');
    if (prevTheme && prevTheme !== theme) gtag('event', 'theme_change', { theme_name: theme });
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

let petHunger = 100, petPos = 50, isAnnouncing = false;

function feedPet() {
    petHunger = Math.min(100, petHunger + 30);
    const petStatus = document.getElementById('petStatus');
    if (petStatus) {
        petStatus.textContent = "好吃！加點體力 🍱";
        isAnnouncing = true;
        setTimeout(() => { isAnnouncing = false; updatePetStatus(); }, 1500);
        if (typeof confetti === 'function') { confetti({ particleCount: 20, spread: 30, origin: { y: 0.9 } }); }
    }
    gtag('event', 'pet_interact', { action: 'feed', hunger_level: Math.round(petHunger) });
}

function patPet() {
    const pet = document.getElementById('pet'), petStatus = document.getElementById('petStatus');
    if (pet && petStatus) {
        const currentTransform = pet.style.transform || "";
        pet.style.transform = `${currentTransform} scale(1.3)`;
        setTimeout(() => { pet.style.transform = currentTransform; }, 300);
        petStatus.textContent = "❤️";
        isAnnouncing = true;
        setTimeout(() => { isAnnouncing = false; updatePetStatus(); }, 2000);
    }
    gtag('event', 'pet_interact', { action: 'pat', hunger_level: Math.round(petHunger) });
}

function updatePetStatus() {
    if (isAnnouncing) return;
    const petStatus = document.getElementById('petStatus'), pet = document.getElementById('pet');
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
    const now = new Date(), day = now.getDay(), curSec = (now.getHours() * 3600) + (now.getMinutes() * 60);
    const wStart = parseTimeToSec(timeConfig.workStart), wEnd = parseTimeToSec(timeConfig.workEnd);
    const isWorkday = (timeConfig.workdays || [1,2,3,4,5]).includes(day);
    let msg = "";
    if (!isWorkday) {
        msg = (day === 0 || day === 6) ? "週末萬歲！盡情狂歡吧 🎉" : "休假中，享受人生 🏖️";
    }
    else if (curSec < wStart) msg = "還沒開工，再摸一下魚... ☕️";
    else if (curSec >= wEnd) msg = "下班啦！快點回家休息 🍻";
    else {
        const rem = Math.floor((wEnd - curSec) / 60);
        msg = `加油！距離下班還有 ${Math.floor(rem / 60)} 小時 ${rem % 60} 分鐘 🏠`;
    }
    isAnnouncing = true;
    petStatus.textContent = msg;
    setTimeout(() => { isAnnouncing = false; updatePetStatus(); }, 6000);
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
    if (title) title.textContent = statusText;
    if (pBar) pBar.style.width = perc + '%';
    if (pText) pText.textContent = perc.toFixed(4) + '%';
    const tSec = Math.floor(Math.max(0, weekEnd - now) / 1000);
    if (tLeft) tLeft.textContent = `${Math.floor(tSec / 3600)}h ${Math.floor((tSec % 3600) / 60)}m ${tSec % 60}s`;
    const dayNames = ['週日 SUNDAY', '週一 MONDAY', '週二 TUESDAY', '週三 WEDNESDAY', '週四 THURSDAY', '週五 FRIDAY', '週六 SATURDAY'];
    if (dLabel) dLabel.textContent = dayNames[curDay];
    updateQuote();
}

function initPet() {
    const container = document.getElementById('petContainer'), pet = document.getElementById('pet'), fBtn = document.getElementById('feedBtn'), pBtn = document.getElementById('patBtn');
    if (!container || !pet) return;
    container.style.left = petPos + '%';
    fBtn.onclick = (e) => feedPet();
    pBtn.onclick = (e) => patPet();
    setInterval(() => {
        if (Math.random() > 0.85 && !isAnnouncing && petHunger > 0) announceTime();
        if (petHunger > 0 && Math.random() > 0.4) { 
            let newPos = Math.max(15, Math.min(85, petPos + (Math.random() * 40 - 20)));
            if (newPos !== petPos) { pet.style.transform = (newPos > petPos ? "scaleX(-1)" : "scaleX(1)"); petPos = newPos; container.style.left = petPos + '%'; pet.classList.add('walking'); setTimeout(() => pet.classList.remove('walking'), 2500); }
        }
        petHunger = Math.max(0, petHunger - 0.5); updatePetStatus();
    }, 5000);
}

const savedTheme = localStorage.getItem('week-progress-theme') || 'neon';
setTheme(savedTheme);
document.getElementById('settingsBtn').onclick = (e) => { e.stopPropagation(); document.getElementById('themeMenu').classList.toggle('active'); gtag('event', 'settings_open', { panel: 'menu' }); };
window.onclick = (e) => { 
    if (document.getElementById('themeMenu')) document.getElementById('themeMenu').classList.remove('active'); 
    if (e.target === document.getElementById('settingsModal')) closeTimeModal(); 
};
function updateSolarAngle() {
    if (userLat === null || userLon === null || typeof SunCalc === 'undefined') return;
    
    const now = new Date();
    const pos = SunCalc.getPosition(now, userLat, userLon);
    const altitude = pos.altitude * 180 / Math.PI;
    const azimuth = pos.azimuth * 180 / Math.PI;
    
    // 動態更新太陽位置
    const sun = document.getElementById('dynamicSun');
    if (sun) {
        // 仰角對應到垂直位置 (限制在畫面上方，0度地平線=25%, 90度天頂=-10%)
        let topPercent = Math.max(-10, Math.min(25, 25 - (altitude / 90 * 35)));
        // 方位角對應到水平位置 (東-90=10%, 南0=50%, 西+90=90%)，稍微內縮避免太靠邊緣
        let leftPercent = Math.max(-10, Math.min(110, 50 + (azimuth / 90 * 45)));
        
        sun.style.top = topPercent + '%';
        sun.style.left = leftPercent + '%';
        sun.style.right = 'auto'; // 覆寫原本 CSS 綁死的 right
        sun.style.transform = 'translate(-50%, -50%)'; // 讓太陽中心點對齊座標
    }
}

initPet();
updateProgress();
updateNotiUI();
fetchWeather();
setInterval(() => {
    updateProgress();
    updateSolarAngle();
}, 1000);
setInterval(fetchWeather, 30 * 60 * 1000);

// GA: page_load event
(function() {
    const now = new Date();
    const curSec = now.getHours() * 3600 + now.getMinutes() * 60;
    const wStart = parseTimeToSec(timeConfig.workStart), wEnd = parseTimeToSec(timeConfig.workEnd);
    const dayOfWeek = now.getDay();
    const isWorkHour = dayOfWeek >= 1 && dayOfWeek <= 5 && curSec >= wStart && curSec < wEnd;
    gtag('event', 'page_load', { theme: savedTheme, day_of_week: dayOfWeek, is_work_hour: isWorkHour });
})();
