// ===== 天氣（Open-Meteo 抓取、動態背景、天氣資訊、天氣預報 Modal、太陽位置）=====
let userLat = null;
let userLon = null;

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
            const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,relative_humidity_2m&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset&forecast_days=7&timezone=auto`);
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
            // 若天氣預報 modal 開著（每 30 分鐘定時刷新時），同步更新內容
            const wfModal = document.getElementById('weatherModal');
            if (wfModal && wfModal.classList.contains('active')) renderWeatherModal();
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

function applyWeatherEffects() {
    const bgContainer = document.getElementById('weatherBackground');
    const infoBox = document.getElementById('weatherInfoBox');
    const weatherEmoji = document.getElementById('weatherEmoji');
    const weatherTemp = document.getElementById('weatherTemp');
    const sunriseTime = document.getElementById('sunriseTime');
    const sunsetTime = document.getElementById('sunsetTime');
    const humidityVal = document.getElementById('humidityVal');
    if (!bgContainer) return;
    isStormy = !!(currentWeatherData && currentWeatherData.current.weather_code >= 95);
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
    if (code === 45 || code === 48) return '🌫️';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return '❄️';
    if (code >= 51 && code <= 67) return '🌧️';
    if (code >= 80 && code <= 82) return '🌦️';
    if (code >= 95) return '⛈️';
    return '⛅';
}

// ===== 天氣預報 Modal（點擊天氣區塊開啟）=====
const GEO_NAME_CACHE_KEY = 'week-progress-geo-name';
let locationName = null;

async function fetchLocationName(lat, lon) {
    // 座標四捨五入到小數 2 位（約 1km），沒移動就用 localStorage 快取，不重打 API
    const keyLat = lat.toFixed(2), keyLon = lon.toFixed(2);
    const cached = JSON.parse(localStorage.getItem(GEO_NAME_CACHE_KEY) || 'null');
    if (cached && cached.lat === keyLat && cached.lon === keyLon && cached.name) return cached.name;
    // BigDataCloud 免費 client-side 反向地理編碼，無需 API key
    const resp = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=zh-Hant`);
    const data = await resp.json();
    // 台灣通常 principalSubdivision=縣市、locality=鄉鎮市區；Set 去除重複層級
    const name = [...new Set([data.principalSubdivision, data.city, data.locality].filter(Boolean))].join(' ');
    if (name) localStorage.setItem(GEO_NAME_CACHE_KEY, JSON.stringify({ lat: keyLat, lon: keyLon, name }));
    return name || null;
}

function openWeatherModal() {
    const modal = document.getElementById('weatherModal');
    if (!modal || !currentWeatherData) return;
    renderWeatherModal();
    modal.classList.add('active');
    gtag('event', 'weather_modal_open');
    const locEl = document.getElementById('wfLocation');
    if (!locEl) return;
    if (locationName) {
        locEl.textContent = `📍 ${locationName}`;
    } else if (userLat !== null && userLon !== null) {
        locEl.textContent = '📍 定位中…';
        fetchLocationName(userLat, userLon)
            .then(name => { locationName = name; locEl.textContent = name ? `📍 ${name}` : '📍 目前位置'; })
            .catch(() => { locEl.textContent = '📍 目前位置'; });
    } else {
        locEl.textContent = '📍 目前位置';
    }
}

function closeWeatherModal() {
    const modal = document.getElementById('weatherModal');
    if (modal) modal.classList.remove('active');
}

function renderWeatherModal() {
    const hourlyBox = document.getElementById('wfHourly');
    const dailyList = document.getElementById('wfDaily');
    if (!hourlyBox || !dailyList || !currentWeatherData) return;
    const { hourly, daily } = currentWeatherData;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const fmtPop = (p) => `💧${p == null ? '--' : p + '%'}`;

    // 今日逐時：從當前小時到今晚 23 時（timezone=auto，回傳時間即當地時間）
    hourlyBox.textContent = '';
    if (hourly && hourly.time) {
        const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        const curHour = now.getHours();
        hourly.time.forEach((t, i) => {
            if (!t.startsWith(todayStr)) return;
            const h = parseInt(t.slice(11, 13), 10);
            if (h < curHour) return;
            const popVal = hourly.precipitation_probability ? hourly.precipitation_probability[i] : null;
            const cell = document.createElement('div');
            cell.className = 'wf-hour' + (h === curHour ? ' now' : '');
            // 降雨機率水位：格子底部填水，水面高度 = 機率，波紋動畫由 CSS 產生
            if (popVal > 0) {
                const water = document.createElement('div');
                water.className = 'wf-hour-water';
                water.style.height = Math.min(100, popVal) + '%';
                cell.appendChild(water);
            }
            const time = document.createElement('span');
            time.className = 'wf-hour-time';
            time.textContent = h === curHour ? '現在' : `${h}時`;
            const emoji = document.createElement('span');
            emoji.className = 'wf-hour-emoji';
            emoji.textContent = getWeatherEmoji(hourly.weather_code[i]);
            const temp = document.createElement('span');
            temp.className = 'wf-hour-temp';
            temp.textContent = `${Math.round(hourly.temperature_2m[i])}°`;
            const pop = document.createElement('span');
            pop.className = 'wf-hour-pop';
            pop.textContent = fmtPop(popVal);
            cell.append(time, emoji, temp, pop);
            hourlyBox.appendChild(cell);
        });
    }

    // 未來 7 天（含今天）：星期、天氣、降雨機率、低/高溫
    dailyList.textContent = '';
    if (daily && daily.time && daily.weather_code) {
        const weekNames = ['日', '一', '二', '三', '四', '五', '六'];
        daily.time.forEach((d, i) => {
            const date = new Date(`${d}T00:00:00`);
            const li = document.createElement('li');
            li.className = 'wf-day' + (i === 0 ? ' today' : '');
            const day = document.createElement('span');
            day.className = 'wf-day-name';
            day.textContent = i === 0 ? '今天' : i === 1 ? '明天' : `週${weekNames[date.getDay()]}`;
            const dateEl = document.createElement('span');
            dateEl.className = 'wf-day-date';
            dateEl.textContent = `${date.getMonth() + 1}/${date.getDate()}`;
            const emoji = document.createElement('span');
            emoji.className = 'wf-day-emoji';
            emoji.textContent = getWeatherEmoji(daily.weather_code[i]);
            const pop = document.createElement('span');
            pop.className = 'wf-day-pop';
            pop.textContent = fmtPop(daily.precipitation_probability_max ? daily.precipitation_probability_max[i] : null);
            const temp = document.createElement('span');
            temp.className = 'wf-day-temp';
            const lo = document.createElement('span');
            lo.className = 'wf-temp-lo';
            lo.textContent = `${Math.round(daily.temperature_2m_min[i])}°`;
            const hi = document.createElement('span');
            hi.className = 'wf-temp-hi';
            hi.textContent = `${Math.round(daily.temperature_2m_max[i])}°`;
            temp.append(lo, document.createTextNode(' / '), hi);
            li.append(day, dateEl, emoji, pop, temp);
            dailyList.appendChild(li);
        });
    }
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
        const rand = (min, max) => Math.round(min + Math.random() * (max - min));
        const count = rand(3, 7);
        for (let i = 0; i < count; i++) {
            const cloud = document.createElement('div');
            cloud.className = 'cloud';
            const w = rand(220, 420);
            cloud.style.top = rand(2, 18) + '%';
            cloud.style.left = -(w + 50) + 'px';
            cloud.style.width = w + 'px';
            cloud.style.height = rand(60, 110) + 'px';
            cloud.style.animationDuration = rand(40, 70) + 's';
            cloud.style.animationDelay = -rand(0, 60) + 's';
            cloud.style.setProperty('--b1-w', rand(45, 75) + '%');
            cloud.style.setProperty('--b1-h', rand(60, 100) + '%');
            cloud.style.setProperty('--b1-top', -rand(25, 50) + '%');
            cloud.style.setProperty('--b1-left', rand(8, 30) + '%');
            cloud.style.setProperty('--b2-w', rand(35, 60) + '%');
            cloud.style.setProperty('--b2-h', rand(50, 80) + '%');
            cloud.style.setProperty('--b2-top', -rand(15, 40) + '%');
            cloud.style.setProperty('--b2-right', rand(8, 25) + '%');
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

function updateSolarAngle() {
    if (userLat === null || userLon === null || typeof SunCalc === 'undefined') return;
    
    const now = new Date();
    const pos = SunCalc.getPosition(now, userLat, userLon);
    const altitude = pos.altitude * 180 / Math.PI;

    // 動態更新太陽位置
    const sun = document.getElementById('dynamicSun');
    if (sun) {
        // 仰角對應到垂直位置 (0度地平線=20%, 90度天頂=0%)
        // 這樣能保證太陽不會掉得太下面擋住主卡片
        let topPercent = Math.max(0, Math.min(20, 20 - (altitude / 90 * 20)));
        // 水平位置用「日出→日落的時間進度」等速換算：日出=85%(右)、日落=15%(左)
        // 不能用方位角換算：台灣夏季正午太陽近天頂，方位角整個早上黏在東、
        // 正午一小時內瞬間掃到西，看起來只剩左右兩種狀態
        // 內縮範圍 (15% ~ 85%) 避免太陽被左右邊緣裁切
        const times = SunCalc.getTimes(now, userLat, userLon);
        let dayProgress = (now - times.sunrise) / (times.sunset - times.sunrise);
        if (!isFinite(dayProgress)) dayProgress = 0.5;
        dayProgress = Math.max(0, Math.min(1, dayProgress));
        let leftPercent = 85 - dayProgress * 70;
        
        sun.style.top = topPercent + '%';
        sun.style.left = leftPercent + '%';
        sun.style.right = 'auto'; // 覆寫原本 CSS 綁死的 right
        sun.style.transform = 'translate(-50%, -50%)'; // 讓太陽中心點對齊座標
    }
}
