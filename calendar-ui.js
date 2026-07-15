// 台灣行事曆 UI 層：吃豆豆倒數橫條 + 連假清單 + 當週套用詢問 + 設定開關
// 依賴 calendar.js（window.TWCalendar）。任何環節出錯一律靜默不顯示橫條。
(function () {
    const TW = window.TWCalendar;
    let analysis = null;   // { holidays, workdays }
    let rawList = null;    // 合併後的原始日資料（給本週套用用）
    let progressTimer = null;

    // 終點 emoji：依連假名稱挑一個應景的
    function goalEmoji(name) {
        if (/春節|除夕|小年夜|農曆/.test(name)) return '🧧';
        if (/端午/.test(name)) return '🎋';
        if (/中秋/.test(name)) return '🥮';
        if (/清明/.test(name)) return '🌱';
        if (/元旦|開國/.test(name)) return '🎆';
        if (/勞動/.test(name)) return '🛠️';
        if (/國慶|雙十/.test(name)) return '🇹🇼';
        if (/兒童/.test(name)) return '🎈';
        return '🏖️';
    }

    function fmtDate(ymd) {
        return `${+ymd.slice(4, 6)}/${+ymd.slice(6, 8)}`;
    }
    function weekLabel(ymd) {
        const wk = ['日', '一', '二', '三', '四', '五', '六'][TW.parseYmd(ymd).getDay()];
        return `週${wk}`;
    }
    // 距今天數的中文標籤：0=今天、正=還有 N 天、負=進行中/已過
    function countdownLabel(today, startYmd, endYmd) {
        const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
        const s = TW.parseYmd(startYmd).getTime();
        const e = endYmd ? TW.parseYmd(endYmd).getTime() : s;
        if (t0 < s) return `還有 ${Math.round((s - t0) / 86400000)} 天`;
        if (t0 <= e) return '進行中';
        return '已過';
    }

    // ===== 吃豆豆橫條 =====
    function hideBar() {
        const bar = document.getElementById('pacBar');
        if (bar) bar.style.display = 'none';
        if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
    }

    function renderBar() {
        const bar = document.getElementById('pacBar');
        if (!bar || !analysis || !TW.isEnabled()) { hideBar(); return; }
        const today = new Date();
        const next = TW.nextHoliday(analysis, today);
        if (!next) { hideBar(); return; } // 365 天內沒有連假 → 不顯示

        const h = next.holiday;
        document.getElementById('pacDays').textContent = next.daysLeft === 0 ? '就是今天' : `${next.daysLeft} 天`;
        document.getElementById('pacName').textContent = `距離 ${h.name}`;
        document.getElementById('pacGoal').textContent = goalEmoji(h.name);

        // 進度 = 上一個假期結束 → 這個連假開始 的時間比例
        const startMs = prevHolidayEndMs(today, h);
        const goalMs = TW.parseYmd(h.start).getTime();
        const nowMs = today.getTime();
        let progress = (nowMs - startMs) / (goalMs - startMs);
        progress = Math.max(0, Math.min(0.97, progress)); // 保留一點終點餘裕
        placePac(bar, progress);

        bar.style.display = 'flex';
    }

    // 上一個連假的結束時間（沒有的話用 60 天前當起點，避免除以 0 或進度爆掉）
    function prevHolidayEndMs(today, nextH) {
        let prevEnd = null;
        for (const h of analysis.holidays) {
            if (h.end < TW.ymd(today) && h !== nextH) prevEnd = h.end;
            if (h === nextH) break;
        }
        if (prevEnd) {
            const d = TW.parseYmd(prevEnd);
            d.setDate(d.getDate() + 1);
            return d.getTime();
        }
        return today.getTime() - 60 * 86400000;
    }

    // 佈置豆子 + 依進度定位吃豆人（量測實際軌道寬度）
    function placePac(bar, progress) {
        const track = document.getElementById('pacTrack');
        const pac = document.getElementById('pacMan');
        if (!track || !pac) return;
        const DOTS = 18;
        if (track.children.length !== DOTS) {
            track.textContent = '';
            for (let i = 0; i < DOTS; i++) {
                const d = document.createElement('div');
                d.className = 'pac-dot';
                track.appendChild(d);
            }
        }
        // 用 rAF 確保版面已排好再量測
        requestAnimationFrame(() => {
            const tr = track.getBoundingClientRect();
            const br = bar.getBoundingClientRect();
            const left = tr.left - br.left;
            const right = tr.right - br.left;
            pac.style.left = (left + (right - left) * progress) + 'px';
            Array.from(track.children).forEach((dot, i) => {
                dot.style.opacity = (i / DOTS) < progress ? '0' : '0.5';
            });
        });
    }

    // ===== 連假清單 Modal =====
    function openList() {
        const modal = document.getElementById('calendarModal');
        const list = document.getElementById('calList');
        if (!modal || !list || !analysis) return;
        const today = new Date();
        const y = TW.withinYear(analysis, today);
        list.textContent = '';

        const addHeader = (t) => {
            const li = document.createElement('li');
            li.className = 'cal-head';
            li.textContent = t;
            list.appendChild(li);
        };
        addHeader('🎉 連假');
        if (!y.holidays.length) {
            const li = document.createElement('li'); li.className = 'cal-empty'; li.textContent = '一年內沒有連假'; list.appendChild(li);
        }
        y.holidays.forEach(h => {
            const li = document.createElement('li');
            li.className = 'cal-row';
            const name = document.createElement('span');
            name.className = 'cal-name';
            name.textContent = `${goalEmoji(h.name)} ${h.name}`;
            const range = document.createElement('span');
            range.className = 'cal-range';
            range.textContent = h.length > 1
                ? `${fmtDate(h.start)}–${fmtDate(h.end)}（${h.length}天）`
                : `${fmtDate(h.start)} ${weekLabel(h.start)}`;
            const cd = document.createElement('span');
            cd.className = 'cal-count';
            cd.textContent = countdownLabel(today, h.start, h.end);
            li.append(name, range, cd);
            list.appendChild(li);
        });

        if (y.workdays.length) {
            addHeader('😮‍💨 補班日');
            y.workdays.forEach(w => {
                const li = document.createElement('li');
                li.className = 'cal-row';
                const name = document.createElement('span');
                name.className = 'cal-name';
                name.textContent = '補班';
                const range = document.createElement('span');
                range.className = 'cal-range';
                range.textContent = `${fmtDate(w.date)} ${weekLabel(w.date)}`;
                const cd = document.createElement('span');
                cd.className = 'cal-count';
                cd.textContent = countdownLabel(today, w.date, w.date);
                li.append(name, range, cd);
                list.appendChild(li);
            });
        }
        modal.classList.add('active');
        gtag('event', 'calendar_list_open');
    }

    function closeList() {
        const modal = document.getElementById('calendarModal');
        if (modal) modal.classList.remove('active');
    }

    async function refresh() {
        const btn = document.getElementById('calRefreshMenu');
        if (btn) { btn.style.pointerEvents = 'none'; btn.textContent = '🔄 查詢中…'; }
        await boot(true); // 強制重抓
        if (btn) {
            btn.textContent = '✅ 已更新';
            setTimeout(() => { btn.textContent = '🔄 重新查詢連假'; btn.style.pointerEvents = ''; }, 1500);
        }
        const modal = document.getElementById('calendarModal');
        if (modal && modal.classList.contains('active')) openList();
        gtag('event', 'calendar_refresh');
    }

    // ===== 當週套用作息詢問 =====
    function maybeAsk() {
        if (!analysis || !rawList || !TW.isEnabled()) return;
        const today = new Date();
        // 算本週 weekId（週一日期），一週只問一次
        const day = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() + (day === 0 ? -6 : 1 - day));
        const weekId = TW.ymd(monday);
        if (localStorage.getItem(TW.askKey) === weekId) return;

        const wd = TW.thisWeekDays(rawList, today);
        // 本週有沒有「平日放假」或「補班」需要調整？
        const hasHoliday = wd.some(d => d.isHoliday && d.jsDay >= 1 && d.jsDay <= 5);
        const hasMakeup = wd.some(d => !d.isHoliday && (d.jsDay === 0 || d.jsDay === 6));
        if (!hasHoliday && !hasMakeup) { localStorage.setItem(TW.askKey, weekId); return; }

        const parts = [];
        if (hasHoliday) parts.push('有國定假日');
        if (hasMakeup) parts.push('有補班日');
        const el = document.getElementById('calAskText');
        if (el) el.textContent = `這週${parts.join('、')}，要幫你把「本週上班日」設定調整成對應的作息嗎？`;
        const modal = document.getElementById('calAskModal');
        if (modal) modal.classList.add('active');
        gtag('event', 'calendar_ask_shown');
    }

    function markAsked() {
        const today = new Date();
        const day = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() + (day === 0 ? -6 : 1 - day));
        localStorage.setItem(TW.askKey, TW.ymd(monday));
    }

    function applyThisWeek() {
        const today = new Date();
        const wd = TW.thisWeekDays(rawList, today);
        // 依行事曆重算本週工作日：非假日的日子為工作日
        const workdays = wd.filter(d => !d.isHoliday).map(d => d.jsDay);
        if (typeof window.applyWorkdaysFromCalendar === 'function') {
            window.applyWorkdaysFromCalendar(workdays);
        }
        markAsked();
        const modal = document.getElementById('calAskModal');
        if (modal) modal.classList.remove('active');
        gtag('event', 'calendar_apply_week', { workday_count: workdays.length });
    }

    function dismissAsk() {
        markAsked();
        const modal = document.getElementById('calAskModal');
        if (modal) modal.classList.remove('active');
        gtag('event', 'calendar_ask_dismiss');
    }

    // ===== 設定開關 =====
    function toggleEnabled() {
        const cb = document.getElementById('calEnabled');
        TW.setEnabled(cb.checked);
        if (cb.checked) boot(false); else hideBar();
        gtag('event', 'calendar_toggle', { enabled: cb.checked });
    }

    function syncSwitch() {
        const cb = document.getElementById('calEnabled');
        if (cb) cb.checked = TW.isEnabled();
    }

    // ===== 啟動 =====
    async function boot(force) {
        rawList = await TW.load(force);
        if (!rawList) { analysis = null; hideBar(); return; }
        analysis = TW.analyze(rawList);
        renderBar();
    }

    // 視窗尺寸變化時重新定位吃豆人
    window.addEventListener('resize', () => { if (analysis) renderBar(); });

    document.addEventListener('DOMContentLoaded', function () {
        syncSwitch();
        [document.getElementById('calendarModal'), document.getElementById('calAskModal')].forEach(m => {
            if (m) m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('active'); });
        });
        if (!TW.isEnabled()) return;
        boot(false).then(() => { maybeAsk(); });
    });

    window.TWCalendarUI = {
        openList, closeList, refresh, applyThisWeek, dismissAsk, toggleEnabled
    };
})();
