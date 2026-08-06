// ===== 24 節氣計算（壽星天文演算法，純前端無依賴）=====
// 原理：節氣 = 太陽視黃經到達 15° 倍數的時刻（春分 0°、清明 15°…）。
// 用簡化 VSOP87 級數算太陽視黃經，牛頓迭代反解各節氣的精確 UTC 時刻，
// 再換算為當地日期。1900~2100 年精度足夠（誤差通常在數分鐘內）。
// 總原則：比照連假卡片——任何環節出錯一律靜默，呼叫端拿到 null 就不顯示。
(function () {
    'use strict';

    // 24 節氣名稱，索引 = 對應太陽黃經 / 15（0=春分, 1=清明 …）
    const TERM_NAMES = [
        '春分', '清明', '穀雨', '立夏', '小滿', '芒種',
        '夏至', '小暑', '大暑', '立秋', '處暑', '白露',
        '秋分', '寒露', '霜降', '立冬', '小雪', '大雪',
        '冬至', '小寒', '大寒', '立春', '雨水', '驚蟄'
    ];

    // 節氣對應的小 emoji（儀表板/時間軸點綴用）
    const TERM_EMOJI = {
        '立春': '🌱', '雨水': '💧', '驚蟄': '🐛', '春分': '🌸', '清明': '🌿', '穀雨': '🌾',
        '立夏': '🌿', '小滿': '🌾', '芒種': '🌾', '夏至': '☀️', '小暑': '🌤️', '大暑': '🔥',
        '立秋': '🍃', '處暑': '🍂', '白露': '💧', '秋分': '🍁', '寒露': '🌫️', '霜降': '❄️',
        '立冬': '🍂', '小雪': '🌨️', '大雪': '⛄', '冬至': '☃️', '小寒': '🥶', '大寒': '❄️'
    };

    const RAD = Math.PI / 180;

    // 週期項係數 [振幅°, 相位°, 角速度°/世紀]（太陽黃經主要攝動項，簡化自 VSOP87）
    const PERIODIC = [
        [1.914602, 357.52911, 35999.05029],
        [0.019993, 715.05822, 71998.10058],
        [0.000290, 1072.58733, 107997.15087]
    ];

    // 儒略世紀 T → 太陽視黃經（度，已歸一到 0~360）
    function sunApparentLongitude(T) {
        // 幾何平黃經
        let L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
        // 平近點角
        const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
        // 中心差
        const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M * RAD)
            + (0.019993 - 0.000101 * T) * Math.sin(2 * M * RAD)
            + 0.000289 * Math.sin(3 * M * RAD);
        let trueLong = L0 + C;
        // 章動 + 光行差修正（视黃經）
        const omega = 125.04 - 1934.136 * T;
        const apparent = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD);
        return ((apparent % 360) + 360) % 360;
    }

    // 儒略日 ↔ Date（UTC）
    function dateToJD(date) {
        return date.getTime() / 86400000 + 2440587.5;
    }
    function jdToDate(jd) {
        return new Date((jd - 2440587.5) * 86400000);
    }
    function jdToT(jd) {
        return (jd - 2451545.0) / 36525;
    }

    // 求某年、目標黃經 targetLong（度）對應的節氣 UTC 時刻（Date）。
    // 用牛頓法從估計日期迭代；太陽每天約走 0.9856°，收斂很快。
    function solveTerm(year, targetLong) {
        // 以「該黃經大約落在哪一天」給初值：春分約 3/20、每 15° 約 15.2 天
        const approxDay = 79 + (((targetLong % 360) + 360) % 360) / 360 * 365.2422;
        let jd = dateToJD(new Date(Date.UTC(year, 0, 1))) + approxDay;
        for (let i = 0; i < 8; i++) {
            const T = jdToT(jd);
            let cur = sunApparentLongitude(T);
            // 目標與當前的角差，收斂到最短方向（處理 0/360 跨越）
            let diff = (((targetLong - cur) % 360) + 540) % 360 - 180;
            if (Math.abs(diff) < 1e-6) break;
            jd += diff / 0.98564736; // 太陽每日平均視運動 °/day
        }
        return jdToDate(jd);
    }

    // 算出「某西元年」全部 24 個節氣，回傳依日期排序的陣列 [{name, date}]
    // date 為當地時間 Date（用瀏覽器時區顯示日期即可）
    const _cache = {};
    function termsOfYear(year) {
        if (_cache[year]) return _cache[year];
        const list = [];
        for (let k = 0; k < 24; k++) {
            const targetLong = k * 15; // 0=春分…
            const utc = solveTerm(year, targetLong);
            list.push({ name: TERM_NAMES[k], date: utc });
        }
        list.sort((a, b) => a.date - b.date);
        _cache[year] = list;
        return list;
    }

    // 取「連續」的節氣序列（跨年）：把 year-2 ~ year+1 四年合併排序。
    // 注意 termsOfYear(y) 是「以春分為首」的一輪（立春/雨水/驚蟄實際落在 y+1 年初），
    // 所以往前必須多墊一年，年初（立春前）回溯歲首時才不會撞到陣列開頭。
    function termsAround(year) {
        return [].concat(termsOfYear(year - 2), termsOfYear(year - 1), termsOfYear(year), termsOfYear(year + 1))
            .sort((a, b) => a.date - b.date);
    }

    // 以「日」為單位比較（節氣當天 00:00 起算為進入該節氣）
    function dayFloor(d) {
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    }

    // 目前所處節氣 + 下一個節氣。now 預設今天。
    // 回傳 { current:{name,date,emoji}, next:{name,date,emoji}, daysToNext }，失敗回 null。
    function getCurrent(now) {
        try {
            now = now || new Date();
            const all = termsAround(now.getFullYear());
            const t0 = dayFloor(now);
            let curIdx = -1;
            for (let i = 0; i < all.length; i++) {
                if (dayFloor(all[i].date) <= t0) curIdx = i; else break;
            }
            if (curIdx < 0 || curIdx >= all.length - 1) return null;
            const cur = all[curIdx];
            const nxt = all[curIdx + 1];
            const curMs = dayFloor(cur.date);
            const nxtMs = dayFloor(nxt.date);
            const daysToNext = Math.round((nxtMs - t0) / 86400000);
            // 當前節氣走完的比例（今天位在 current→next 之間），夾在 0~1
            let progress = (nxtMs > curMs) ? (t0 - curMs) / (nxtMs - curMs) : 0;
            progress = Math.max(0, Math.min(1, progress));
            return {
                current: withEmoji(cur),
                next: withEmoji(nxt),
                daysToNext: daysToNext,
                progress: progress
            };
        } catch (e) {
            return null;
        }
    }

    // 取當前節氣前 before 個、後 after 個（含當前），給時間軸用。失敗回 null。
    function getSeries(now, before, after) {
        try {
            now = now || new Date();
            before = before == null ? 3 : before;
            after = after == null ? 3 : after;
            const all = termsAround(now.getFullYear());
            const t0 = dayFloor(now);
            let curIdx = -1;
            for (let i = 0; i < all.length; i++) {
                if (dayFloor(all[i].date) <= t0) curIdx = i; else break;
            }
            if (curIdx < 0) return null;
            const start = Math.max(0, curIdx - before);
            const end = Math.min(all.length - 1, curIdx + after);
            const items = [];
            for (let i = start; i <= end; i++) {
                items.push(Object.assign(withEmoji(all[i]), { isCurrent: i === curIdx }));
            }
            return items;
        } catch (e) {
            return null;
        }
    }

    // 取「完整一輪 24 節氣」：以今天所在節氣年的立春為起點，往後數滿 24 個。
    // termsAround 涵蓋前後各一年（共 72 個），往前找立春最多 24 步，不會越界。失敗回 null。
    function getYearSeries(now) {
        try {
            now = now || new Date();
            const all = termsAround(now.getFullYear());
            const t0 = dayFloor(now);
            let curIdx = -1;
            for (let i = 0; i < all.length; i++) {
                if (dayFloor(all[i].date) <= t0) curIdx = i; else break;
            }
            if (curIdx < 0) return null;
            // 往前回溯到最近的立春（節氣年歲首）
            let start = -1;
            for (let i = curIdx; i >= 0; i--) {
                if (all[i].name === '立春') { start = i; break; }
            }
            if (start < 0 || start + 24 > all.length) return null;
            const items = [];
            for (let i = start; i < start + 24; i++) {
                items.push(Object.assign(withEmoji(all[i]), {
                    isCurrent: i === curIdx,
                    isPast: i < curIdx,
                    // 節氣年內的序號 0~23，除以 6 即為季節（0春 1夏 2秋 3冬）
                    index: i - start
                }));
            }
            return items;
        } catch (e) {
            return null;
        }
    }

    // 一整個節氣年走完的比例 0~1：已過的整節氣數 + 當前節氣內比例，除以 24。
    // 給 Modal 頂部的年度總覽條用。失敗回 null。
    function getYearProgress(now) {
        try {
            const series = getYearSeries(now);
            const info = getCurrent(now);
            if (!series || !info) return null;
            let idx = -1;
            for (let i = 0; i < series.length; i++) {
                if (series[i].isCurrent) { idx = i; break; }
            }
            if (idx < 0) return null;
            return Math.max(0, Math.min(1, (idx + (info.progress || 0)) / 24));
        } catch (e) {
            return null;
        }
    }

    function withEmoji(term) {
        return { name: term.name, date: term.date, emoji: TERM_EMOJI[term.name] || '📅' };
    }

    window.SolarTerm = {
        getCurrent: getCurrent,
        getSeries: getSeries,
        getYearSeries: getYearSeries,
        getYearProgress: getYearProgress,
        emojiOf: (name) => TERM_EMOJI[name] || '📅'
    };

    // ===== UI 層：獨立節氣卡 + 時間軸 Modal（不依賴天氣）=====

    // 更新首頁節氣卡：當前節氣 emoji/名稱 + 距下一節氣天數。算不出就隱藏卡片。
    function renderCard() {
        const card = document.getElementById('solarTermCard');
        if (!card) return;
        const info = getCurrent();
        if (!info || !info.current) { card.style.display = 'none'; return; }
        const emojiEl = document.getElementById('stCardEmoji');
        const nameEl = document.getElementById('stCardName');
        const nextEl = document.getElementById('stCardNext');
        if (emojiEl) emojiEl.textContent = info.current.emoji;
        if (nameEl) nameEl.textContent = info.current.name;
        if (nextEl && info.next) {
            const d = info.daysToNext;
            nextEl.textContent = d <= 0
                ? `今日交${info.next.name}`
                : `距${info.next.name} ${d} 天`;
        }
        // 迷你進度條：當前 → 下個節氣的走完比例 + 兩端標籤
        const fromEl = document.getElementById('stCpFrom');
        const toEl = document.getElementById('stCpTo');
        const fillEl = document.getElementById('stCpFill');
        if (fromEl && info.current) fromEl.textContent = `${info.current.emoji} ${info.current.name}`;
        if (toEl && info.next) toEl.textContent = `${info.next.name} ${info.next.emoji}`;
        if (fillEl) fillEl.style.width = Math.round((info.progress || 0) * 100) + '%';
        card.style.display = 'flex';
    }

    // 時間軸：以立春起算的一整輪 24 節氣，切成 6 個一排、共 4 排（一排 = 一季）。
    // 每排掛自己的季節色（--st-season）給橫線與已過節點的邊框用，排左緣標季節字。
    // 節點分三態：已過（亮起 + 季節色邊框）、當前（主題色發光放大）、未來（灰階半透明），
    // 用明暗差直接表達「這一年走到哪」。失敗就隱藏。
    const ROW_SIZE = 6;
    const SEASON_NAMES = ['春', '夏', '秋', '冬'];
    function renderTimeline() {
        const box = document.getElementById('stTimeline');
        if (!box) return;
        const series = getYearSeries(new Date());
        if (!series || series.length < 2) { box.style.display = 'none'; return; }
        box.textContent = '';
        for (let r = 0; r < series.length; r += ROW_SIZE) {
            const seasonIdx = Math.floor(r / ROW_SIZE);
            const row = document.createElement('div');
            row.className = 'st-row';
            // 該排的季節色，供 .st-line 與已過節點的 border-color 繼承
            row.style.setProperty('--st-season', `var(--st-season-${seasonIdx})`);
            const line = document.createElement('div');
            line.className = 'st-line';
            row.appendChild(line);
            const tag = document.createElement('span');
            tag.className = 'st-season-tag';
            tag.textContent = SEASON_NAMES[seasonIdx] || '';
            row.appendChild(tag);
            series.slice(r, r + ROW_SIZE).forEach((t) => {
                const node = document.createElement('div');
                const state = t.isCurrent ? ' current' : (t.isPast ? ' past' : ' future');
                node.className = 'st-node' + state;
                const name = document.createElement('span');
                name.className = 'st-name';
                name.textContent = t.name;
                // emoji 底座取代原本純圓點：每個節氣顯示自己的 emoji
                // emoji 包內層 span 以絕對定位死釘圓心，避免字體 metrics 造成偏移
                const dot = document.createElement('span');
                dot.className = 'st-dot';
                const glyph = document.createElement('span');
                glyph.className = 'st-glyph';
                glyph.textContent = t.emoji;
                dot.appendChild(glyph);
                const date = document.createElement('span');
                date.className = 'st-date';
                date.textContent = `${t.date.getMonth() + 1}/${t.date.getDate()}`;
                node.append(name, dot, date);
                row.appendChild(node);
            });
            box.appendChild(row);
        }
        box.style.display = 'flex';
    }

    // Modal 頂部的年度總覽條：主題色填到今天的位置，3 個刻度把整條均分四季，
    // 游標釘在當前位置。純比例圖形，不放百分比數字。算不出就隱藏整條。
    function renderYearBar() {
        const bar = document.getElementById('stYear');
        if (!bar) return;
        const p = getYearProgress();
        if (p == null) { bar.style.display = 'none'; return; }
        const pct = (p * 100).toFixed(1) + '%';
        const fill = document.getElementById('stYearFill');
        const cursor = document.getElementById('stYearCursor');
        if (fill) fill.style.width = pct;
        if (cursor) cursor.style.left = pct;
        bar.style.display = 'block';
    }

    // Modal 頂部的「當前節氣」大字摘要
    function renderModalCurrent() {
        const el = document.getElementById('stCurrent');
        if (!el) return;
        const info = getCurrent();
        if (!info || !info.current) { el.textContent = ''; return; }
        el.textContent = '';
        const emoji = document.createElement('span');
        emoji.className = 'st-cur-emoji';
        emoji.textContent = info.current.emoji;
        const name = document.createElement('span');
        name.className = 'st-cur-name';
        name.textContent = info.current.name;
        const sub = document.createElement('span');
        sub.className = 'st-cur-sub';
        sub.textContent = info.next
            ? (info.daysToNext <= 0 ? `今日交${info.next.name}` : `${info.daysToNext} 天後交${info.next.name}`)
            : '';
        el.append(emoji, name, sub);
    }

    function openModal() {
        const modal = document.getElementById('solarTermModal');
        if (!modal) return;
        renderModalCurrent();
        renderYearBar();
        renderTimeline();
        modal.classList.add('active');
        if (typeof gtag === 'function') gtag('event', 'solarterm_modal_open');
    }

    function closeModal() {
        const modal = document.getElementById('solarTermModal');
        if (modal) modal.classList.remove('active');
    }

    window.SolarTermUI = { renderCard, openModal, closeModal };

    // 載入即渲染節氣卡（純日期計算，不等定位/天氣）
    document.addEventListener('DOMContentLoaded', function () {
        renderCard();
        const modal = document.getElementById('solarTermModal');
        if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
    });
})();

// 全域包裝（給 HTML onclick 用）
function openSolarTermModal() { if (window.SolarTermUI) window.SolarTermUI.openModal(); }
function closeSolarTermModal() { if (window.SolarTermUI) window.SolarTermUI.closeModal(); }
