// Dino Runner 跑酷小遊戲（頁面版）— 頁面下方的小恐龍直接原地開跑
// 玩家就是頁面上那隻恐龍（DOM + sprite class），障礙物用 DOM 元素從右往左飛。
// 物理與參數對照 Chromium 原始碼 components/neterror/resources/dino_game/
// （trex.ts / obstacle.ts / offline.ts），時間計算採原版 deltaTime/msPerFrame，
// 高更新率螢幕（120Hz）速度不會跑掉。
// 進入方式：連點小恐龍三下（見 script.js）；空白鍵/↑ 跳（長按跳更高）、↓ 蹲、Esc 離開
(function () {
    // sprite.png 的 1x 原圖座標（恐龍本體 frame 由 style.css 的 game-running/game-ducking 處理，
    // 翼手龍拍翅由 .ob-ptero 的 CSS 動畫處理，這裡只需要仙人掌座標與各尺寸）
    const S = {
        TREX: { w: 44, h: 47 }, DUCK_W: 59, DUCK_H: 25,
        PTERO: { w: 46, h: 40 },
        CACTUS_SMALL: { x: 228, w: 17, h: 35 },
        CACTUS_LARGE: { x: 332, w: 25, h: 50 }
    };
    // Chromium 原版常數
    const SCALE = 1.1; // 頁面恐龍是 1.1 倍：遊戲邏輯跑 1x 座標、渲染時放大
    const MS_PER_FRAME = 1000 / 60;
    const GRAVITY = 0.6, INITIAL_JUMP_VELOCITY = -10, DROP_VELOCITY = -5;
    const MIN_JUMP_HEIGHT = 30, SPEED_DROP_COEFFICIENT = 3;
    const START_SPEED = 6, MAX_SPEED = 13, ACCELERATION = 0.001;
    const GAP_COEFFICIENT = 0.6, MAX_GAP_COEFFICIENT = 1.5;
    const CLEAR_TIME = 3000, SCORE_COEFFICIENT = 0.025;
    const RESTART_DEBOUNCE = 500;

    let layer = null, scoreEl = null;
    let raf = null, lastT = 0, state = 'running';
    let obs = [], speed, dist, runTime, typeHist, hiScore;
    let dinoY, dinoVy, ducking, speedDrop, downHeld, crashedAt;
    let pet, container, statusEl, groundBottom, dinoGX, viewW;

    function isActive() { return layer !== null; }

    function getScore(d) { return Math.floor(d * SCORE_COEFFICIENT); }

    function enter() {
        if (layer) return;
        pet = document.getElementById('pet');
        container = document.getElementById('petContainer');
        statusEl = document.getElementById('petStatus');
        if (!pet || !container) return;
        window.dinoGameActive = true;
        document.body.classList.add('inline-game-mode');
        hiScore = parseInt(localStorage.getItem('dino-runner-hi') || '0', 10);
        // 恐龍滑到左側起跑點、面向右
        container.style.transition = 'left 0.6s ease';
        container.style.left = '12%';
        pet.classList.remove('walking', 'ducking', 'scared', 'jumping', 'happy', 'hungry', 'dead');
        pet.style.setProperty('--flip', 'none');
        layer = document.createElement('div');
        layer.id = 'inlineGameLayer';
        document.body.appendChild(layer);
        scoreEl = document.createElement('div');
        scoreEl.id = 'inlineGameScore';
        document.body.appendChild(scoreEl);
        document.addEventListener('keydown', onKey);
        document.addEventListener('keyup', onKey);
        document.addEventListener('pointerdown', onPointer);
        // 等恐龍滑到定位再起跑
        setTimeout(() => {
            if (!layer) return; // 中途已退出
            measure();
            reset();
            lastT = 0;
            raf = requestAnimationFrame(loop);
        }, 700);
        if (typeof gtag === 'function') gtag('event', 'minigame_open', { mode: 'inline' });
    }

    function measure() {
        pet.style.transform = 'translateY(0)';
        const r = pet.getBoundingClientRect();
        groundBottom = window.innerHeight - r.bottom;
        dinoGX = r.left / SCALE;
        viewW = window.innerWidth / SCALE;
    }

    function reset() {
        obs.forEach(o => o.el.remove());
        obs = []; typeHist = [];
        speed = START_SPEED; dist = 0; runTime = 0;
        dinoY = 0; dinoVy = 0; ducking = false; speedDrop = false; downHeld = false;
        state = 'running';
        document.body.classList.remove('inline-game-crashed');
        pet.classList.remove('dead', 'game-ducking');
        pet.classList.add('game-running');
        if (scoreEl) scoreEl.textContent = '';
    }

    function setDuck(d) {
        ducking = d;
        pet.classList.toggle('game-ducking', d && state === 'running');
        pet.classList.toggle('game-running', !d && state === 'running');
    }

    function jump() {
        if (state !== 'running' || dinoY !== 0 || dinoVy !== 0) return;
        dinoVy = -(INITIAL_JUMP_VELOCITY - speed / 10); // 向上為正，速度越快跳越高一點
        setDuck(false);
        speedDrop = false;
    }

    function endJump() {
        // 原版可變跳躍高度：提早放開按鍵 → 提早下墜（輕點小跳、長按大跳）
        if (dinoY > MIN_JUMP_HEIGHT && dinoVy > -DROP_VELOCITY) dinoVy = -DROP_VELOCITY;
    }

    function restart() {
        if (performance.now() - crashedAt < RESTART_DEBOUNCE) return; // 防手抖誤觸
        measure();
        reset();
        if (typeof gtag === 'function') gtag('event', 'minigame_restart', { mode: 'inline' });
    }

    function spawnObstacle() {
        const types = ['small', 'large'];
        if (speed >= 8.5) types.push('ptero'); // 原版 PTERODACTYL minSpeed: 8.5
        let t;
        do { t = types[Math.floor(Math.random() * types.length)]; }
        while (typeHist.length >= 2 && typeHist[0] === t && typeHist[1] === t); // 同型最多連兩次
        typeHist.push(t);
        if (typeHist.length > 2) typeHist.shift();

        const el = document.createElement('div');
        el.className = 'inline-ob';
        let o;
        if (t === 'ptero') {
            const yOpts = [100, 75, 50]; // 低(跳)/中(跳或蹲)/高(蹲或直接穿過)
            const y = yOpts[Math.floor(Math.random() * yOpts.length)];
            o = { type: 'ptero', x: viewW, w: S.PTERO.w, h: S.PTERO.h, yTop: y,
                  speedOffset: Math.random() > 0.5 ? 0.8 : -0.8, minGap: 150, el: el };
            el.classList.add('ob-ptero');
            el.style.width = (S.PTERO.w * SCALE) + 'px';
            el.style.height = (S.PTERO.h * SCALE) + 'px';
            el.style.bottom = (groundBottom + (100 - y) * SCALE) + 'px';
        } else {
            const def = t === 'large' ? S.CACTUS_LARGE : S.CACTUS_SMALL;
            let size = 1 + Math.floor(Math.random() * 3);
            if (size > 1 && (t === 'large' ? 7 : 4) > speed) size = 1; // 原版 multipleSpeed 門檻
            const variant = Math.floor(Math.random() * (6 - size + 1));
            o = { type: 'cactus', x: viewW, w: def.w * size, h: def.h, minGap: 120, el: el };
            el.style.width = (o.w * SCALE) + 'px';
            el.style.height = (def.h * SCALE) + 'px';
            el.style.bottom = groundBottom + 'px';
            el.style.backgroundPosition = (-(def.x + variant * def.w) * SCALE) + 'px -2.2px';
        }
        // 原版 getGap 公式
        const minGap = Math.round(o.w * speed + o.minGap * GAP_COEFFICIENT);
        const maxGap = Math.round(minGap * MAX_GAP_COEFFICIENT);
        o.gap = minGap + Math.floor(Math.random() * (maxGap - minGap + 1));
        el.style.transform = 'translate3d(' + Math.round(o.x * SCALE) + 'px,0,0)';
        layer.appendChild(el);
        obs.push(o);
    }

    function hitTest(o) {
        const dw = ducking ? S.DUCK_W : S.TREX.w;
        const dh = ducking ? S.DUCK_H : S.TREX.h;
        const pad = 5;
        let ox = o.x, ow = o.w, oBot, oTop;
        if (o.type === 'ptero') {
            ox += 10; ow -= 20;
            const base = 100 - o.yTop; // 翼手龍底部離地高度
            oBot = base + 10; oTop = base + 28; // 身體集中在中段
        } else { oBot = 0; oTop = o.h; }
        return dinoGX + pad < ox + ow && dinoGX + dw - pad > ox &&
               dinoY + pad < oTop && dinoY + dh - pad > oBot;
    }

    function crash() {
        state = 'crashed';
        crashedAt = performance.now();
        pet.classList.remove('game-running', 'game-ducking');
        pet.classList.add('dead');
        pet.style.transform = 'translateY(0)';
        document.body.classList.add('inline-game-crashed');
        const sc = getScore(dist);
        if (sc > hiScore) { hiScore = sc; localStorage.setItem('dino-runner-hi', String(hiScore)); }
        if (statusEl) statusEl.textContent = 'GAME OVER！' + sc + ' 分・空白鍵再來・Esc 離開';
        if (typeof gtag === 'function') gtag('event', 'minigame_gameover', { score: sc, hi_score: hiScore, mode: 'inline' });
    }

    function step(dt) {
        const fe = dt / MS_PER_FRAME; // 原版 framesElapsed
        runTime += dt;
        if (speed < MAX_SPEED) speed += ACCELERATION * fe;
        dist += speed * fe;

        // 跳躍物理（原版 updateJump；speedDrop 三倍下墜）
        if (dinoY > 0 || dinoVy !== 0) {
            dinoY += dinoVy * (speedDrop && dinoVy < 0 ? SPEED_DROP_COEFFICIENT : 1) * fe;
            dinoVy -= GRAVITY * fe;
            if (dinoY <= 0) {
                dinoY = 0; dinoVy = 0; speedDrop = false;
                if (downHeld) setDuck(true);
            }
        }
        pet.style.transform = 'translateY(' + (-Math.round(dinoY * SCALE)) + 'px)';

        obs.forEach(o => {
            o.x -= (speed + (o.speedOffset || 0)) * fe;
            o.el.style.transform = 'translate3d(' + Math.round(o.x * SCALE) + 'px,0,0)';
        });
        obs = obs.filter(o => { if (o.x + o.w > -10) return true; o.el.remove(); return false; });
        // 原版 CLEAR_TIME：開場三秒淨空讓玩家進入狀況
        if (runTime > CLEAR_TIME) {
            const last = obs[obs.length - 1];
            if (!last || last.x + last.w + last.gap < viewW) spawnObstacle();
        }
        if (obs.some(hitTest)) crash();
        scoreEl.textContent = String(getScore(dist)).padStart(5, '0') + (hiScore > 0 ? '  HI ' + String(hiScore).padStart(5, '0') : '');
    }

    function loop(now) {
        raf = requestAnimationFrame(loop);
        const dt = Math.min(now - (lastT || now), 100); // 分頁切回來不暴衝
        lastT = now;
        if (state === 'running') step(dt);
    }

    function onKey(e) {
        if (e.type === 'keydown') {
            if (e.code === 'Escape') { exit(); return; }
            if (e.code === 'Space' || e.code === 'ArrowUp') {
                e.preventDefault();
                if (state === 'crashed') restart(); else if (!e.repeat) jump();
            } else if (e.code === 'ArrowDown') {
                e.preventDefault();
                downHeld = true;
                if (dinoY === 0 && dinoVy === 0) setDuck(true);
                else speedDrop = true; // 原版空中下壓：三倍速落地
            }
        } else {
            if (e.code === 'ArrowDown') { downHeld = false; setDuck(false); speedDrop = false; }
            if (e.code === 'Space' || e.code === 'ArrowUp') endJump();
        }
    }

    function onPointer(e) {
        if (e.target.closest('.menu, .settings-btn, .modal-overlay')) return;
        if (state === 'crashed') restart(); else jump();
    }

    function exit() {
        if (!layer) return;
        cancelAnimationFrame(raf);
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('keyup', onKey);
        document.removeEventListener('pointerdown', onPointer);
        obs.forEach(o => o.el.remove());
        obs = [];
        layer.remove(); layer = null;
        if (scoreEl) { scoreEl.remove(); scoreEl = null; }
        document.body.classList.remove('inline-game-mode', 'inline-game-crashed');
        pet.classList.remove('game-running', 'game-ducking', 'dead');
        pet.style.transform = '';
        container.style.transition = '';
        container.style.left = (typeof petPos !== 'undefined' ? petPos : 50) + '%';
        window.dinoGameActive = false;
        if (typeof updatePetStatus === 'function') { isAnnouncing = false; updatePetStatus(); }
        if (typeof gtag === 'function') gtag('event', 'minigame_close', { score: getScore(dist || 0), hi_score: hiScore, mode: 'inline' });
    }

    window.DinoRunner = { open: enter, close: exit, isActive: isActive };
})();
