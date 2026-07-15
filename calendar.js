// 台灣行事曆整合（TaiwanCalendar via jsDelivr）
// spec: .claude/specs/20260715_台灣行事曆整合.md
// 總原則：卡片是錦上添花，任何環節出錯（抓取/快取/解析/找不到連假）一律靜默不顯示卡片
(function () {
    const CDN = (year) => `https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data/${year}.json`;
    const CACHE_KEY = (year) => `tw-calendar-${year}`;
    const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 天
    const ASK_KEY = 'tw-calendar-asked-week';
    const ENABLED_KEY = 'tw-calendar-enabled';

    function isEnabled() {
        return localStorage.getItem(ENABLED_KEY) !== 'false'; // 預設開
    }

    // ===== 日期工具 =====
    function ymd(d) {
        return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    }
    function parseYmd(s) {
        return new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));
    }
    function daysBetween(fromDate, toYmd) {
        const a = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
        const b = parseYmd(toYmd);
        return Math.round((b - a) / 86400000);
    }
    function isWeekendWeek(w) { return w === '六' || w === '日'; }

    // ===== 資料抓取（快取優先，失敗回 null）=====
    async function fetchYear(year, force) {
        if (!force) {
            try {
                const raw = localStorage.getItem(CACHE_KEY(year));
                if (raw) {
                    const cached = JSON.parse(raw);
                    if (cached && cached.t && (Date.now() - cached.t < CACHE_TTL) && Array.isArray(cached.d)) {
                        return cached.d;
                    }
                }
            } catch (e) { /* 快取壞，往下重抓 */ }
        }
        try {
            const res = await fetch(CDN(year));
            if (!res.ok) return null;
            const data = await res.json();
            if (!Array.isArray(data) || !data.length) return null;
            try { localStorage.setItem(CACHE_KEY(year), JSON.stringify({ t: Date.now(), d: data })); } catch (e) { /* 存不下無妨 */ }
            return data;
        } catch (e) {
            return null;
        }
    }

    // 取「今天所在年 + 次年」合併（跨年倒數用），任一年抓不到就回目前拿得到的
    async function loadCalendar(force) {
        const y = new Date().getFullYear();
        const [cur, next] = await Promise.all([fetchYear(y, force), fetchYear(y + 1, force)]);
        if (!cur && !next) return null;
        return (cur || []).concat(next || []);
    }

    // ===== 連假 / 補班偵測 =====
    // 把資料切成一段段「連續放假」，每段標記是否為連假：
    //   連假 = 長度 >= 3（含週末的長連休）或 段中含任何平日放假（含週間單日假）
    //   排除：只有純週末六日的段
    function analyze(list) {
        // 依日期排序、去重
        const map = new Map();
        list.forEach(it => { if (it && it.date) map.set(it.date, it); });
        const days = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));

        const holidays = []; // 連假段：{ name, start, end, length }
        const workdays = []; // 補班日：{ date }
        let seg = null;
        const flush = () => {
            if (!seg) return;
            const allWeekend = seg.days.every(d => isWeekendWeek(d.week));
            const len = seg.days.length;
            // 長連休(>=3)；或含任何平日放假(非全週末，含週間單日假)。只有純週末不算連假
            if (len >= 3 || !allWeekend) {
                // 名稱優先取正式假日名（避開「補假/補班」這類次要標註）
                const primary = seg.days.find(d => d.description && !/補/.test(d.description));
                const named = primary || seg.days.find(d => d.description);
                holidays.push({
                    name: named ? named.description : '連假',
                    start: seg.days[0].date,
                    end: seg.days[seg.days.length - 1].date,
                    length: len
                });
            }
            seg = null;
        };
        days.forEach(d => {
            if (d.isHoliday) {
                if (!seg) seg = { days: [] };
                seg.days.push(d);
            } else {
                flush();
                if (isWeekendWeek(d.week)) workdays.push({ date: d.date }); // 週末上班=補班日
            }
        });
        flush();
        return { holidays, workdays };
    }

    // 下一個連假：從今天起 365 天內第一個「尚未結束」的連假
    function nextHoliday(analysis, today) {
        const todayStr = ymd(today);
        for (const h of analysis.holidays) {
            if (h.end >= todayStr) {
                const d = daysBetween(today, h.start);
                if (d <= 365) return { holiday: h, daysLeft: d };
                return null; // 超過一年不顯示
            }
        }
        return null;
    }

    // 一年內（今天起 365 天）的連假 + 補班清單（給展開視窗用）
    function withinYear(analysis, today) {
        const todayStr = ymd(today);
        const inRange = (dateStr) => {
            const diff = daysBetween(today, dateStr);
            return dateStr >= todayStr && diff <= 365;
        };
        return {
            holidays: analysis.holidays.filter(h => h.end >= todayStr && daysBetween(today, h.start) <= 365),
            workdays: analysis.workdays.filter(w => inRange(w.date))
        };
    }

    // 本週（週一~週日）的行事曆日，用來建議套用到上班日設定
    function thisWeekDays(list, today) {
        const map = new Map();
        list.forEach(it => { if (it && it.date) map.set(it.date, it); });
        const day = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() + (day === 0 ? -6 : 1 - day));
        const result = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            const rec = map.get(ymd(d));
            if (rec) result.push({ jsDay: d.getDay(), isHoliday: rec.isHoliday, week: rec.week, desc: rec.description });
        }
        return result;
    }

    window.TWCalendar = {
        isEnabled: isEnabled,
        setEnabled: (v) => localStorage.setItem(ENABLED_KEY, v ? 'true' : 'false'),
        load: loadCalendar,
        analyze: analyze,
        nextHoliday: nextHoliday,
        withinYear: withinYear,
        thisWeekDays: thisWeekDays,
        ymd: ymd,
        parseYmd: parseYmd,
        askKey: ASK_KEY
    };
})();
