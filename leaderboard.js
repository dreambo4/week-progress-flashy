// 排行榜與 Google 綁定（可選登入）
// spec: .claude/specs/20260709_google登入與排行榜.md
// 防 XSS 三層：上傳前 sanitize、Security Rules 格式擋、顯示端一律 textContent/DOM property
(function () {
    const noop = function () { alert('雲端功能載入失敗，請稍後再試 🙈'); };
    if (typeof firebase === 'undefined') {
        window.Leaderboard = { showBoard: noop, closeBoard: function () {}, switchTab: function () {}, toggleAuth: noop, editNickname: noop, submitScore: function () {} };
        return;
    }

    firebase.initializeApp({
        apiKey: "AIzaSyDo59Qt3kk0JQLuKhCReEZhlR1EDeLhkRM",
        authDomain: "week-progress-ufkaq.firebaseapp.com",
        projectId: "week-progress-ufkaq",
        storageBucket: "week-progress-ufkaq.firebasestorage.app",
        messagingSenderId: "361224211236",
        appId: "1:361224211236:web:d26d719c8b142737a501b1"
    });
    const auth = firebase.auth();
    const db = firebase.firestore();

    let user = null;
    let cloudDoc = null;   // 自己的雲端紀錄快取
    let curTab = 'week';

    // ===== 防 XSS：上傳前清洗 =====
    function sanitizeName(s) {
        return String(s || '').replace(/[<>]/g, '').trim().slice(0, 40) || '匿名恐龍';
    }
    function sanitizePhoto(u) {
        u = String(u || '');
        return (/^https:\/\/[^<>"\s]*$/.test(u) && u.length < 490) ? u : '';
    }
    function sanitizeScore(n) {
        n = Math.floor(Number(n) || 0);
        return Math.max(0, Math.min(99999, n));
    }

    // 週定義與 script.js updateProgress 一致：週一 00:00 起算（本地時間）
    function currentWeekId() {
        const now = new Date(), day = now.getDay();
        const monday = new Date(now);
        monday.setDate(now.getDate() + (day === 0 ? -6 : 1 - day));
        return monday.getFullYear() + '-' +
               String(monday.getMonth() + 1).padStart(2, '0') + '-' +
               String(monday.getDate()).padStart(2, '0');
    }

    // ===== Auth =====
    auth.onAuthStateChanged(async (u) => {
        user = u;
        updateAuthUI();
        if (u) {
            await loadMyDoc();
            await mergeLocalHi();
        } else {
            cloudDoc = null;
        }
    });

    function updateAuthUI() {
        const btn = document.getElementById('lbAuthBtn');
        const nickBtn = document.getElementById('lbNickBtn');
        const hint = document.getElementById('lbAuthHint');
        if (!btn) return;
        btn.textContent = user ? '🚪 登出（' + sanitizeName(user.displayName) + '）' : '🔗 使用 Google 綁定分數';
        if (nickBtn) nickBtn.style.display = user ? 'block' : 'none';
        if (hint) hint.style.display = user ? 'none' : 'block';
    }

    async function toggleAuth() {
        if (user) {
            await auth.signOut();
            gtag('event', 'leaderboard_auth', { action: 'logout' });
            return;
        }
        try {
            await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
            gtag('event', 'leaderboard_auth', { action: 'login' });
        } catch (e) {
            console.error('signIn failed', e);
            if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
                alert('登入失敗：' + (e.message || e.code || '未知錯誤'));
            }
        }
    }

    // ===== 分數同步 =====
    async function loadMyDoc() {
        if (!user) return;
        try {
            const snap = await db.collection('scores').doc(user.uid).get();
            cloudDoc = snap.exists ? snap.data() : null;
        } catch (e) { console.error('load score failed', e); }
    }

    // 首次綁定：本地歷史最高併入雲端；雲端較高則回寫本地
    async function mergeLocalHi() {
        if (!user) return;
        const localHi = sanitizeScore(localStorage.getItem('dino-runner-hi'));
        if (localHi > 0 && (!cloudDoc || localHi > cloudDoc.allTimeHi)) {
            await writeScore(localHi, false); // 本地分數無法證明是本週打的，不進週榜
        } else if (cloudDoc && cloudDoc.allTimeHi > localHi) {
            localStorage.setItem('dino-runner-hi', String(cloudDoc.allTimeHi));
        }
    }

    async function writeScore(score, weekEligible) {
        if (!user) return;
        score = sanitizeScore(score);
        if (score <= 0) return;
        if (!cloudDoc) await loadMyDoc(); // 避免搶在首次載入前寫入而蓋低
        const weekId = currentWeekId();
        const prevAll = cloudDoc ? cloudDoc.allTimeHi : 0;
        const sameWeek = !!(cloudDoc && cloudDoc.weekId === weekId);
        const prevWeek = sameWeek ? cloudDoc.weekHi : 0;
        const newAll = Math.max(score, prevAll);
        const newWeek = Math.min(weekEligible ? Math.max(score, prevWeek) : prevWeek, newAll);
        // 同週且分數無變化就不寫，省配額；換週一定寫（刷新 weekId）
        if (cloudDoc && sameWeek && newAll === prevAll && newWeek === prevWeek) return;
        const data = {
            name: sanitizeName((cloudDoc && cloudDoc.name) || user.displayName), // 保留自訂暱稱
            photo: sanitizePhoto(user.photoURL),
            allTimeHi: newAll,
            weekHi: newWeek,
            weekId: weekId,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        try {
            await db.collection('scores').doc(user.uid).set(data, { merge: true });
            cloudDoc = Object.assign({}, data, { updatedAt: null });
            gtag('event', 'leaderboard_score_synced', { score: score, all_time_hi: newAll });
        } catch (e) { console.error('write score failed', e); }
    }

    function submitScore(score) { writeScore(score, true); }

    // ===== 自訂暱稱 =====
    async function editNickname() {
        if (!user) { alert('先綁定 Google 才能設定暱稱喔 🦖'); return; }
        if (!cloudDoc) await loadMyDoc();
        const cur = (cloudDoc && cloudDoc.name) || sanitizeName(user.displayName);
        const input = prompt('排行榜上顯示的暱稱（40 字內，不可包含 < >）：', cur);
        if (input === null) return;
        const name = sanitizeName(input);
        if (!cloudDoc) {
            // 還沒有任何分數紀錄：先建一筆 0 分文件掛暱稱
            cloudDoc = { name: name, photo: sanitizePhoto(user.photoURL), allTimeHi: 0, weekHi: 0, weekId: currentWeekId() };
        }
        const data = {
            name: name,
            photo: sanitizePhoto(user.photoURL),
            allTimeHi: cloudDoc.allTimeHi,
            weekHi: cloudDoc.weekHi,
            weekId: cloudDoc.weekId,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        try {
            await db.collection('scores').doc(user.uid).set(data, { merge: true });
            cloudDoc = Object.assign({}, data, { updatedAt: null });
            gtag('event', 'leaderboard_nickname_set');
            if (document.getElementById('leaderboardModal').classList.contains('active')) renderBoard();
        } catch (e) {
            console.error('nickname failed', e);
            alert('暱稱儲存失敗，請稍後再試 🙈');
        }
    }

    // ===== 排行榜查詢與顯示（顯示端全部用 textContent / DOM property，防 XSS）=====
    async function fetchBoard(tab) {
        const col = db.collection('scores');
        const q = tab === 'week'
            ? col.where('weekId', '==', currentWeekId()).where('weekHi', '>', 0).orderBy('weekHi', 'desc').limit(10)
            : col.where('allTimeHi', '>', 0).orderBy('allTimeHi', 'desc').limit(10);
        const snap = await q.get();
        return snap.docs.map(d => Object.assign({ uid: d.id }, d.data()));
    }

    function makeRow(rank, row) {
        const li = document.createElement('li');
        li.className = 'lb-row' + (user && row.uid === user.uid ? ' lb-me' : '');
        const rankEl = document.createElement('span');
        rankEl.className = 'lb-rank';
        rankEl.textContent = rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : String(rank);
        const photo = sanitizePhoto(row.photo);
        let avatar;
        if (photo) {
            avatar = document.createElement('img');
            avatar.className = 'lb-avatar';
            avatar.referrerPolicy = 'no-referrer';
            avatar.alt = '';
            avatar.onerror = function () { this.replaceWith(makeFallbackAvatar()); };
            avatar.src = photo;
        } else {
            avatar = makeFallbackAvatar();
        }
        const nameEl = document.createElement('span');
        nameEl.className = 'lb-name';
        nameEl.textContent = sanitizeName(row.name);
        const scoreEl = document.createElement('span');
        scoreEl.className = 'lb-score';
        scoreEl.textContent = String(sanitizeScore(curTab === 'week' ? row.weekHi : row.allTimeHi));
        li.append(rankEl, avatar, nameEl, scoreEl);
        return li;
    }

    function makeFallbackAvatar() {
        const s = document.createElement('span');
        s.className = 'lb-avatar lb-avatar-fallback';
        s.textContent = '🦖';
        return s;
    }

    async function renderBoard() {
        const list = document.getElementById('lbList');
        const empty = document.getElementById('lbEmpty');
        const footer = document.getElementById('lbFooter');
        if (!list) return;
        list.textContent = '';
        const loading = document.createElement('li');
        loading.className = 'lb-loading';
        loading.textContent = '載入中...';
        list.appendChild(loading);
        if (empty) empty.style.display = 'none';
        if (footer) footer.style.display = user ? 'none' : 'block';
        try {
            const rows = await fetchBoard(curTab);
            list.textContent = '';
            if (!rows.length) {
                if (empty) empty.style.display = 'block';
                return;
            }
            rows.forEach((r, i) => list.appendChild(makeRow(i + 1, r)));
        } catch (e) {
            console.error('fetch board failed', e);
            list.textContent = '';
            const err = document.createElement('li');
            err.className = 'lb-loading';
            err.textContent = '排行榜載入失敗，稍後再試 🙈';
            list.appendChild(err);
        }
    }

    function switchTab(tab) {
        curTab = tab;
        document.querySelectorAll('.lb-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        renderBoard();
    }

    function showBoard() {
        const modal = document.getElementById('leaderboardModal');
        if (!modal) return;
        modal.classList.add('active');
        gtag('event', 'leaderboard_open', { tab: curTab });
        renderBoard();
    }

    function closeBoard() {
        const modal = document.getElementById('leaderboardModal');
        if (modal) modal.classList.remove('active');
    }

    document.addEventListener('DOMContentLoaded', function () {
        const modal = document.getElementById('leaderboardModal');
        if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeBoard(); });
        updateAuthUI();
    });

    window.Leaderboard = {
        showBoard: showBoard, closeBoard: closeBoard, switchTab: switchTab,
        toggleAuth: toggleAuth, editNickname: editNickname, submitScore: submitScore
    };
})();
