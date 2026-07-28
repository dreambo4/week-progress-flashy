// ===== 農曆日期計算（天文演算法，純前端無依賴）=====
// 原理：農曆月從「朔」（日月合朔，月亮視黃經 = 太陽視黃經）當天起算為初一。
// 閏月規則：冬至所在月為十一月，若兩個冬至之間有 13 個朔望月，
// 則其中第一個「不含中氣」（太陽黃經非 30° 倍數）的月份為閏月。
// 農曆為東經 120° 時制，故日期一律以 UTC+8 為準（不跟隨瀏覽器時區）。
// 總原則：比照節氣卡——任何環節出錯一律靜默，呼叫端拿到 null 就不顯示。
(function () {
    'use strict';

    // 月序名稱（索引 0 = 正月）。十一/十二月採官方對照表寫法，不用「冬月/臘月」俗稱。
    const MONTH_NAMES = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
    // 日名稱（索引 0 = 初一）
    const DAY_NAMES = [
        '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
        '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
        '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
    ];

    const RAD = Math.PI / 180;
    const CST_OFFSET_MS = 8 * 3600 * 1000; // 東八區

    // ---- 儒略日 ↔ Date（UTC）----
    function dateToJD(date) {
        return date.getTime() / 86400000 + 2440587.5;
    }
    function jdToT(jd) {
        return (jd - 2451545.0) / 36525;
    }

    // 儒略世紀 T → 太陽視黃經（度，0~360）
    // 與 solarterm.js 同源，此處獨立一份以免兩支檔案互相依賴載入順序。
    function sunLongitude(T) {
        const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
        const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
        const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M * RAD)
            + (0.019993 - 0.000101 * T) * Math.sin(2 * M * RAD)
            + 0.000289 * Math.sin(3 * M * RAD);
        const omega = 125.04 - 1934.136 * T;
        const apparent = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * RAD);
        return ((apparent % 360) + 360) % 360;
    }

    // 儒略世紀 T → 月球視黃經（度，0~360）
    // 取 ELP2000 主要攝動項；對「求朔日落在哪一天」而言精度綽綽有餘。
    function moonLongitude(T) {
        const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T; // 月球平黃經
        const D = 297.8501921 + 445267.1114034 * T - 0.0018819 * T * T;   // 日月平距角
        const M = 357.5291092 + 35999.0502909 * T;                        // 太陽平近點角
        const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T;  // 月球平近點角
        const F = 93.2720950 + 483202.0175233 * T - 0.0036539 * T * T;    // 月球升交點角距

        const d = D * RAD, m = M * RAD, mp = Mp * RAD, f = F * RAD;
        // 振幅單位：度
        const sum =
            6.288774 * Math.sin(mp) +
            1.274027 * Math.sin(2 * d - mp) +
            0.658314 * Math.sin(2 * d) +
            0.213618 * Math.sin(2 * mp) +
            -0.185116 * Math.sin(m) +
            -0.114332 * Math.sin(2 * f) +
            0.058793 * Math.sin(2 * d - 2 * mp) +
            0.057066 * Math.sin(2 * d - m - mp) +
            0.053322 * Math.sin(2 * d + mp) +
            0.045758 * Math.sin(2 * d - m) +
            -0.040923 * Math.sin(m - mp) +
            -0.034720 * Math.sin(d) +
            -0.030383 * Math.sin(m + mp) +
            0.015327 * Math.sin(2 * d - 2 * f) +
            -0.012528 * Math.sin(mp + 2 * f) +
            0.010980 * Math.sin(mp - 2 * f) +
            0.010675 * Math.sin(4 * d - mp) +
            0.010034 * Math.sin(3 * mp) +
            0.008548 * Math.sin(4 * d - 2 * mp) +
            -0.007888 * Math.sin(2 * d + m - mp) +
            -0.006766 * Math.sin(2 * d + m) +
            -0.005163 * Math.sin(d - mp) +
            0.004987 * Math.sin(d + m) +
            0.004036 * Math.sin(2 * d - m + mp) +
            0.003994 * Math.sin(2 * d + 2 * mp) +
            0.003861 * Math.sin(4 * d) +
            0.003665 * Math.sin(2 * d - 3 * mp) +
            -0.002689 * Math.sin(m - 2 * mp) +
            -0.002602 * Math.sin(2 * d - mp + 2 * f) +
            0.002390 * Math.sin(2 * d - m - 2 * mp) +
            -0.002348 * Math.sin(d + mp) +
            0.002236 * Math.sin(2 * d - 2 * m) +
            -0.002120 * Math.sin(m + 2 * mp) +
            -0.002069 * Math.sin(2 * m) +
            0.002048 * Math.sin(2 * d - 2 * m - mp);

        return ((( Lp + sum) % 360) + 360) % 360;
    }

    // 日月黃經差（度，歸一到 -180~180）。為 0 即為朔。
    function phaseAngle(jd) {
        const T = jdToT(jd);
        const diff = moonLongitude(T) - sunLongitude(T);
        return ((diff % 360) + 540) % 360 - 180;
    }

    // 求第 k 個朔的儒略日（k 以 2000-01-06 前後的朔為 0 起算）。
    // 牛頓迭代：日月黃經差每日約增加 12.19°。
    function newMoonJD(k) {
        // 平朔近似式（Meeus）給初值
        const T = k / 1236.85;
        let jd = 2451550.09766 + 29.530588861 * k
            + 0.00015437 * T * T - 0.000000150 * T * T * T;
        for (let i = 0; i < 10; i++) {
            const diff = phaseAngle(jd);
            if (Math.abs(diff) < 1e-6) break;
            jd -= diff / 12.190749; // 日月相對平均角速度 °/day
        }
        return jd;
    }

    // 儒略日 → 東八區的「當地日」序數（以 UTC+8 午夜為界，供整日比較）
    // 基準與 dateToCstDayNumber 一致（Unix epoch 日序），兩者才能直接相減比較。
    function jdToCstDayNumber(jd) {
        return Math.floor(jd - 2440587.5 + 8 / 24);
    }

    // Date → 東八區的「當地日」序數
    function dateToCstDayNumber(date) {
        return Math.floor((date.getTime() + CST_OFFSET_MS) / 86400000);
    }

    // 求指定西元年 12 月的冬至（太陽黃經 270°）儒略日。
    function winterSolsticeJD(year) {
        // 初值：該年 12/21 前後
        let jd = dateToJD(new Date(Date.UTC(year, 11, 21)));
        for (let i = 0; i < 10; i++) {
            const cur = sunLongitude(jdToT(jd));
            const diff = ((270 - cur) % 360 + 540) % 360 - 180;
            if (Math.abs(diff) < 1e-6) break;
            jd += diff / 0.98564736; // 太陽每日平均視運動 °/day
        }
        return jd;
    }

    // 求太陽視黃經達 targetLong（度）的儒略日，以 guessJD 為迭代初值。
    function solveSunLongitude(targetLong, guessJD) {
        let jd = guessJD;
        for (let i = 0; i < 10; i++) {
            const cur = sunLongitude(jdToT(jd));
            const diff = ((targetLong - cur) % 360 + 540) % 360 - 180;
            if (Math.abs(diff) < 1e-6) break;
            jd += diff / 0.98564736; // 太陽每日平均視運動 °/day
        }
        return jd;
    }

    // 判斷某農曆月是否含中氣（中氣 = 太陽黃經為 30° 倍數的時刻）。
    // 必須以「整日」為單位判斷：農曆月起於朔日當天 00:00（東八區），
    // 迄於次朔日當天 00:00 之前。若只比較兩端朔的瞬時黃經，會把落在
    // 次朔當天凌晨的中氣誤算進本月——2020 閏四月即是此情形
    // （夏至 6/21 05:44 CST，而次朔在 6/21 14:42，該月實際到 6/20 為止）。
    function hasMajorTerm(startJD, endJD) {
        const startDay = jdToCstDayNumber(startJD);
        const endDay = jdToCstDayNumber(endJD);
        // 該月起始時的黃經所屬 30° 區段，下一個中氣即為 (seg+1)*30
        const a = sunLongitude(jdToT(startJD));
        const target = (Math.floor(a / 30) + 1) * 30 % 360;
        // 以月中附近為初值解出該中氣時刻
        const termJD = solveSunLongitude(target, startJD + 15);
        const termDay = jdToCstDayNumber(termJD);
        return termDay >= startDay && termDay < endDay;
    }

    // 建立涵蓋指定西元年的農曆月序表。
    // 以「year-1 的冬至」到「year 的冬至」為一個歲實，排出月序與閏月。
    // 回傳 [{ startDay, month, isLeap }]，startDay 為該月初一的東八區日序數。
    const _cache = {};
    function buildMonths(year) {
        if (_cache[year]) return _cache[year];

        // 兩端冬至（前一年 12 月、當年 12 月），各往外多包一個歲實以覆蓋整個西元年
        const spans = [];
        for (let y = year - 2; y <= year; y++) {
            const ws1 = winterSolsticeJD(y);
            const ws2 = winterSolsticeJD(y + 1);

            // 找冬至所在月的朔（該月即十一月）：從冬至往前找最近的朔
            const kApprox = Math.round((ws1 - 2451550.09766) / 29.530588861);
            let k11 = kApprox;
            // 修正到「朔日 ≤ 冬至日」的最大 k
            while (jdToCstDayNumber(newMoonJD(k11)) > jdToCstDayNumber(ws1)) k11--;
            while (jdToCstDayNumber(newMoonJD(k11 + 1)) <= jdToCstDayNumber(ws1)) k11++;

            // 下一個冬至所在月的朔
            const kApprox2 = Math.round((ws2 - 2451550.09766) / 29.530588861);
            let k11next = kApprox2;
            while (jdToCstDayNumber(newMoonJD(k11next)) > jdToCstDayNumber(ws2)) k11next--;
            while (jdToCstDayNumber(newMoonJD(k11next + 1)) <= jdToCstDayNumber(ws2)) k11next++;

            const monthCount = k11next - k11; // 12 = 平年，13 = 閏年
            const months = [];
            // 先算出各月起訖的朔
            const newMoons = [];
            for (let i = 0; i <= monthCount; i++) newMoons.push(newMoonJD(k11 + i));

            // 決定閏月：僅在 13 個月時，取第一個不含中氣者（不含十一月本身）
            let leapIndex = -1;
            if (monthCount === 13) {
                for (let i = 1; i < monthCount; i++) {
                    if (!hasMajorTerm(newMoons[i], newMoons[i + 1])) { leapIndex = i; break; }
                }
                if (leapIndex === -1) leapIndex = monthCount - 1; // 理論上不會發生，保底
            }

            // 由十一月起編月序：11, 12, 1, 2, ... 遇閏月沿用前一月序並標記
            let monthNo = 11; // 從十一月起算
            for (let i = 0; i < monthCount; i++) {
                const isLeap = (i === leapIndex);
                if (!isLeap && i > 0) monthNo = monthNo % 12 + 1;
                months.push({
                    startDay: jdToCstDayNumber(newMoons[i]),
                    endDay: jdToCstDayNumber(newMoons[i + 1]),
                    month: monthNo,
                    isLeap: isLeap
                });
            }
            spans.push.apply(spans, months);
        }

        spans.sort((a, b) => a.startDay - b.startDay);
        _cache[year] = spans;
        return spans;
    }

    // 取某日的農曆資訊。now 預設今天。
    // 回傳 { month, day, isLeap, monthName, dayName, text }，失敗回 null。
    // text 形如「六月初三」「閏六月初三」。
    function getLunarDate(now) {
        try {
            now = now || new Date();
            const target = dateToCstDayNumber(now);
            const months = buildMonths(now.getFullYear());
            let hit = null;
            for (let i = 0; i < months.length; i++) {
                if (target >= months[i].startDay && target < months[i].endDay) { hit = months[i]; break; }
            }
            if (!hit) return null;

            const dayIndex = target - hit.startDay; // 0 = 初一
            if (dayIndex < 0 || dayIndex >= DAY_NAMES.length) return null;

            const monthName = MONTH_NAMES[hit.month - 1];
            if (!monthName) return null;
            const dayName = DAY_NAMES[dayIndex];
            const text = `${hit.isLeap ? '閏' : ''}${monthName}月${dayName}`;
            return {
                month: hit.month,
                day: dayIndex + 1,
                isLeap: hit.isLeap,
                monthName: monthName,
                dayName: dayName,
                text: text
            };
        } catch (e) {
            return null;
        }
    }

    window.Lunar = { getLunarDate: getLunarDate };
})();
