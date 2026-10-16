// ===== 到職年資與特休重置倒數（到職日設定、年資卡、年月日 ⇄ 總天數切換）=====
// 特休採週年制：每逢到職週年日重置。日期一律以「當地日曆日」計算，不看時分秒。
(function () {
    'use strict';

    const STORAGE_KEY = 'week-progress-tenure';
    const DAY_MS = 86400000;

    // enabled：是否顯示年資卡；hireDate：'YYYY-MM-DD'；unit：'ymd'（年月日）或 'days'（總天數）
    let config = { enabled: false, hireDate: '', unit: 'ymd' };
    try {
        config = Object.assign(config, JSON.parse(localStorage.getItem(STORAGE_KEY)) || {});
    } catch (e) { /* 設定壞掉就用預設值 */ }

    function save() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch (e) { /* 無痕模式等寫不進去就算了 */ }
    }

    // ===== 日期計算 =====

    function parseDate(str) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str || '');
        if (!m) return null;
        const d = new Date(+m[1], +m[2] - 1, +m[3]);
        return isNaN(d) ? null : d;
    }

    function today() {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    function toInputValue(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    // 以 UTC 換算日數差，不受夏令時間影響
    function daysBetween(from, to) {
        return Math.round((Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
            - Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) / DAY_MS);
    }

    // 加 n 個月；原日期超出目標月份天數時取該月最後一天（1/31 + 1 個月 = 2/28、2/29 + 12 個月 = 2/28）
    function addMonths(date, n) {
        const y = date.getFullYear(), m = date.getMonth() + n;
        const lastDay = new Date(y, m + 1, 0).getDate();
        return new Date(y, m, Math.min(date.getDate(), lastDay));
    }

    // from → to 的年月日差（from ≤ to）：先找不超過 to 的最大整月數，剩下的用實際天數
    function ymdDiff(from, to) {
        let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
        if (addMonths(from, months) > to) months--;
        const days = daysBetween(addMonths(from, months), to);
        return { y: Math.floor(months / 12), m: months % 12, d: days };
    }

    // 回傳卡片所需的全部數值；未設定或到職日在未來時回傳 null
    function compute() {
        const hire = parseDate(config.hireDate);
        const now = today();
        if (!hire || hire > now) return null;
        const tenure = ymdDiff(hire, now);
        // 上次 / 下次週年日（第 0 個週年日 = 到職日本身）
        const lastAnniv = addMonths(hire, tenure.y * 12);
        const nextAnniv = addMonths(hire, (tenure.y + 1) * 12);
        const yearSpan = daysBetween(lastAnniv, nextAnniv);
        return {
            tenure,
            tenureDays: daysBetween(hire, now),
            reset: ymdDiff(now, nextAnniv),
            resetDays: daysBetween(now, nextAnniv),
            isResetToday: tenure.y > 0 && daysBetween(lastAnniv, now) === 0,
            yearIndex: tenure.y + 1,
            progress: yearSpan > 0 ? daysBetween(lastAnniv, now) / yearSpan : 0
        };
    }

    // ===== 顯示 =====

    // 數字大、單位小：<b>2</b>年<b>3</b>月<b>5</b>天。前導的 0 年、0 月省略，中間的 0 保留
    function fmtYmd(v) {
        const parts = [];
        if (v.y > 0) parts.push([v.y, '年']);
        if (v.y > 0 || v.m > 0) parts.push([v.m, '月']);
        parts.push([v.d, '天']);
        return parts.map(([n, u]) => `<b>${n}</b><small>${u}</small>`).join('');
    }

    function fmtDays(n) {
        return `<b>${n.toLocaleString()}</b><small>天</small>`;
    }

    // updateProgress 每秒呼叫，內容沒變就不動 DOM
    let lastRenderKey = '';
    function render() {
        const card = document.getElementById('tenureCard');
        if (!card) return;
        const info = config.enabled ? compute() : null;
        const key = info ? `${toInputValue(today())}|${config.hireDate}|${config.unit}` : 'hidden';
        if (key === lastRenderKey) return;
        lastRenderKey = key;
        if (!info) { card.style.display = 'none'; return; }

        const isDays = config.unit === 'days';
        const sinceEl = document.getElementById('tnSince');
        const resetEl = document.getElementById('tnReset');
        if (sinceEl) {
            sinceEl.innerHTML = info.tenureDays === 0
                ? '今天到職 🎉'
                : (isDays ? fmtDays(info.tenureDays) : fmtYmd(info.tenure));
        }
        if (resetEl) {
            resetEl.innerHTML = info.isResetToday
                ? '就是今天 🎉'
                : (isDays ? fmtDays(info.resetDays) : fmtYmd(info.reset));
        }
        const pct = Math.round(info.progress * 100);
        const fromEl = document.getElementById('tnCpFrom');
        const toEl = document.getElementById('tnCpTo');
        const fillEl = document.getElementById('tnCpFill');
        if (fromEl) fromEl.textContent = `第 ${info.yearIndex} 年`;
        if (toEl) toEl.textContent = `${pct}%`;
        if (fillEl) fillEl.style.width = pct + '%';
        card.style.display = 'flex';
    }

    // 點卡片：兩個數值一起切換「年月日 ⇄ 總天數」，並記住選擇
    function toggleUnit() {
        config.unit = config.unit === 'days' ? 'ymd' : 'days';
        save();
        render();
        gtag('event', 'tenure_unit_toggle', { unit: config.unit });
    }

    // ===== 側選單與設定 Modal =====

    // 開關只在「已設定到職日且啟用」時顯示為開
    function syncMenu() {
        const hire = parseDate(config.hireDate);
        const cb = document.getElementById('tenureEnabled');
        if (cb) cb.checked = config.enabled && !!hire;
        const label = document.getElementById('tenureDateLabel');
        if (label) label.textContent = hire ? `（${hire.getFullYear()}/${hire.getMonth() + 1}/${hire.getDate()}）` : '（未設定）';
    }

    function toggleEnabled() {
        const cb = document.getElementById('tenureEnabled');
        const isOn = !!(cb && cb.checked);
        // 還沒設定到職日：開關維持關閉，帶去設定，儲存成功才由 saveModal 打開
        if (isOn && !parseDate(config.hireDate)) {
            cb.checked = false;
            openModal();
            return;
        }
        config.enabled = isOn;
        save();
        render();
        gtag('event', 'tenure_toggle', { enabled: config.enabled });
    }

    function openModal() {
        const modal = document.getElementById('tenureModal');
        if (!modal) return;
        const input = document.getElementById('tenureDateInput');
        if (input) {
            input.max = toInputValue(today());
            input.value = config.hireDate || '';
        }
        modal.classList.add('active');
        const menu = document.getElementById('themeMenu');
        if (menu) menu.classList.remove('active');
        gtag('event', 'settings_open', { panel: 'tenure_modal' });
    }

    function closeModal() {
        const modal = document.getElementById('tenureModal');
        if (modal) modal.classList.remove('active');
    }

    function saveModal() {
        const input = document.getElementById('tenureDateInput');
        const hire = parseDate(input && input.value);
        if (!hire) { alert('請選擇到職日 📅'); return; }
        if (hire > today()) { alert('到職日不能是未來的日期哦 🦖'); return; }
        config.hireDate = toInputValue(hire);
        config.enabled = true; // 設定完就是想看，順手打開
        save();
        syncMenu();
        render();
        closeModal();
        if (typeof confetti === 'function') {
            confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
        }
        gtag('event', 'tenure_date_save', { tenure_years: ymdDiff(hire, today()).y });
    }

    // 給連假清單用的「下一個到職週年日」：年資功能關閉或未設定時回傳 null。
    // 週年日當天回傳今天（isToday），否則回傳下一個週年日；years 為第幾週年。到職當天不算週年
    function getAnniversary() {
        if (!config.enabled) return null;
        const info = compute();
        if (!info) return null;
        const hire = parseDate(config.hireDate);
        if (info.isResetToday) return { date: today(), years: info.tenure.y, isToday: true };
        return { date: addMonths(hire, info.yearIndex * 12), years: info.yearIndex, isToday: false };
    }

    window.Tenure = { render, toggleUnit, toggleEnabled, openModal, closeModal, saveModal, getAnniversary };

    document.addEventListener('DOMContentLoaded', function () {
        syncMenu();
        render();
        const modal = document.getElementById('tenureModal');
        if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    });
})();
