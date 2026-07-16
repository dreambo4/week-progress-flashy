// ===== 初始化（最後載入：事件綁定、啟動計時器、GA page_load）=====
console.log("Week Progress Script Loaded v1.8.1");

document.getElementById('settingsBtn').onclick = (e) => { e.stopPropagation(); document.getElementById('themeMenu').classList.toggle('active'); gtag('event', 'settings_open', { panel: 'menu' }); };
window.onclick = (e) => { 
    if (document.getElementById('themeMenu')) document.getElementById('themeMenu').classList.remove('active'); 
    if (e.target === document.getElementById('settingsModal')) closeTimeModal();
    if (e.target === document.getElementById('weatherModal')) closeWeatherModal();
};

initPet();
scheduleEasterEgg();
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
