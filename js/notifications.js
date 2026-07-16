// ===== 通知（權限、開關設定、下班/進度/喝水/帶傘提醒）=====
const NOTI_ICON_DINO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAvCAAAAAC9e3dzAAAAAnRSTlMAAHaTzTgAAADaSURBVHic1ZQ7EoUwCEXRocn6bFkereujfRNjjIT4CWrxaMzA9c4ZQgD4KoZ2Whq5AHgkpSrHADA+xhDjm7xPnOe5znRh4HFpgkfO4x+K8UrAXuchjU3YpdpjFLqZBWjPJaB8+aVuiLbdIridaXtzVJVJcXuYafnf4rLK+bpBb88GXgmC2zkcrJRuDFYQi/i+9wj9i1Gat6d74V25UnlbX/+SYdZfG2gXa4m6hnm9z+triReR+GviZ1PHDT8jPiM34kieXqGs3uVU4j7zBDBEgNSRvDtiN/JJxw/71S1l4zrV3AAAAABJRU5ErkJggg==";
// 通知 icon 不支援 SVG，必須是點陣圖；改用預先轉好的 64x64 PNG 檔（⏰ / 💧）
const NOTI_ICON_CLOCK = "icons/clock.png";
const NOTI_ICON_WATER = "icons/water.png";

let notiConfig = JSON.parse(localStorage.getItem('week-progress-noti-config')) || { endDay: true, progress: true, hourly: true, weatherAlert: true };
if (notiConfig.weatherAlert === undefined) notiConfig.weatherAlert = true;

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
