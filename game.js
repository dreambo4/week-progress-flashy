// Dino Runner 摸魚小遊戲 — 素材全部取自 sprite.png（Chrome offline 1x sprite）
// 物理與參數對照 Chromium 原始碼 components/neterror/resources/dino_game/
// （trex.ts / obstacle.ts / offline.ts），時間計算採原版 deltaTime/msPerFrame，
// 高更新率螢幕（120Hz）速度不會跑掉。
// 進入方式：連點小恐龍三下（見 script.js），Esc 或 ✕ 離開
(function () {
    // sprite 座標為此專案 sprite.png 的 1x 原圖座標（與新版 Chromium sprite 佈局不同，
    // restart 在左上角，已逐格裁圖驗證過）
    const S = {
        TREX: { x: 848, y: 2, w: 44, h: 47 },
        TREX_RUN: [936, 980],
        TREX_DEAD: 1068,
        TREX_DUCK: [1112, 1171], DUCK_W: 59, DUCK_H: 25,
        PTERO: { x: [134, 180], y: 2, w: 46, h: 40 },
        CACTUS_SMALL: { x: 228, y: 2, w: 17, h: 35 },
        CACTUS_LARGE: { x: 332, y: 2, w: 25, h: 50 },
        HORIZON: { x: 2, y: 54, w: 600, h: 12 },
        CLOUD: { x: 86, y: 2, w: 46, h: 14 },
        DIGIT: { x: 655, y: 2, w: 10, h: 13 },
        GAMEOVER: { x: 655, y: 15, w: 191, h: 11 },
        RESTART: { x: 2, y: 2, w: 36, h: 32 }
    };
    // Chromium 原版常數
    const W = 600, H = 150, GROUND_LINE = 140, DINO_X = 25;
    const DINO_GROUND = GROUND_LINE - S.TREX.h; // 93
    const MS_PER_FRAME = 1000 / 60;
    const GRAVITY = 0.6, INITIAL_JUMP_VELOCITY = -10, DROP_VELOCITY = -5;
    const MIN_JUMP_HEIGHT = 30, SPEED_DROP_COEFFICIENT = 3;
    const START_SPEED = 6, MAX_SPEED = 13, ACCELERATION = 0.001;
    const GAP_COEFFICIENT = 0.6, MAX_GAP_COEFFICIENT = 1.5;
    const CLEAR_TIME = 3000, SCORE_COEFFICIENT = 0.025;
    const RESTART_DEBOUNCE = 500;

    let overlay = null, canvas, ctx, sprite = null;
    let raf = null, state = 'running', lastTime = 0;
    let dino, obstacles, clouds, groundX, speed, distance, hiScore;
    let runningTime, typeHistory, downHeld, crashedAt;

    function reset() {
        dino = { y: DINO_GROUND, vy: 0, ducking: false, speedDrop: false, frame: 0, timer: 0 };
        obstacles = []; typeHistory = [];
        clouds = [{ x: W * 0.7, y: 30 }];
        groundX = 0; speed = START_SPEED; distance = 0;
        runningTime = 0; downHeld = false;
        state = 'running';
    }

    function getScore(d) { return Math.floor(d * SCORE_COEFFICIENT); }

    function jump() {
        if (state !== 'running' || dino.y !== DINO_GROUND || dino.vy !== 0) return;
        // 原版 startJump：速度越快跳越高一點
        dino.vy = INITIAL_JUMP_VELOCITY - speed / 10;
        dino.ducking = false;
        dino.speedDrop = false;
    }

    function endJump() {
        // 原版可變跳躍高度：提早放開按鍵 → 提早下墜（輕點小跳、長按大跳）
        if (dino.y < DINO_GROUND - MIN_JUMP_HEIGHT && dino.vy < DROP_VELOCITY) dino.vy = DROP_VELOCITY;
    }

    function restart() {
        if (performance.now() - crashedAt < RESTART_DEBOUNCE) return; // 防手抖誤觸
        reset();
        if (typeof gtag === 'function') gtag('event', 'minigame_restart');
    }

    function pickType() {
        const types = ['small', 'large'];
        if (speed >= 8.5) types.push('ptero'); // 原版 PTERODACTYL minSpeed: 8.5
        let t;
        do { t = types[Math.floor(Math.random() * types.length)]; }
        while (typeHistory.length >= 2 && typeHistory[0] === t && typeHistory[1] === t); // 同型最多連兩次
        typeHistory.push(t);
        if (typeHistory.length > 2) typeHistory.shift();
        return t;
    }

    function spawnObstacle() {
        const t = pickType();
        let ob;
        if (t === 'ptero') {
            const yOpts = [100, 75, 50]; // 低(跳)/中(跳或蹲)/高(蹲或直接穿過)
            ob = { type: 'ptero', x: W, y: yOpts[Math.floor(Math.random() * yOpts.length)],
                   w: S.PTERO.w, h: S.PTERO.h, frame: 0, timer: 0,
                   speedOffset: Math.random() > 0.5 ? 0.8 : -0.8, minGap: 150 };
        } else {
            const def = t === 'large' ? S.CACTUS_LARGE : S.CACTUS_SMALL;
            let size = 1 + Math.floor(Math.random() * 3);
            if (size > 1 && (t === 'large' ? 7 : 4) > speed) size = 1; // 原版 multipleSpeed 門檻
            const variant = Math.floor(Math.random() * (6 - size + 1));
            ob = { type: 'cactus', x: W, y: GROUND_LINE - def.h,
                   sx: def.x + variant * def.w, sy: def.y,
                   w: def.w * size, h: def.h, minGap: 120 };
        }
        // 原版 getGap 公式
        const minGap = Math.round(ob.w * speed + ob.minGap * GAP_COEFFICIENT);
        const maxGap = Math.round(minGap * MAX_GAP_COEFFICIENT);
        ob.gap = minGap + Math.floor(Math.random() * (maxGap - minGap + 1));
        obstacles.push(ob);
    }

    function hitTest(ob) {
        const dw = dino.ducking ? S.DUCK_W : S.TREX.w;
        const dh = dino.ducking ? S.DUCK_H : S.TREX.h;
        const dy = dino.ducking ? dino.y + (S.TREX.h - S.DUCK_H) : dino.y;
        // 翼手龍身體集中在 frame 中段，碰撞框比照原版收窄
        let ox = ob.x, oy = ob.y, ow = ob.w, oh = ob.h;
        if (ob.type === 'ptero') { ox += 10; ow -= 20; oy += 12; oh -= 22; }
        const pad = 5;
        return DINO_X + pad < ox + ow && DINO_X + dw - pad > ox &&
               dy + pad < oy + oh && dy + dh - pad > oy;
    }

    function crash() {
        state = 'crashed';
        crashedAt = performance.now();
        const score = getScore(distance);
        if (score > hiScore) {
            hiScore = score;
            localStorage.setItem('dino-runner-hi', String(hiScore));
        }
        if (typeof gtag === 'function') gtag('event', 'minigame_gameover', { score: score, hi_score: hiScore });
    }

    function step(deltaTime) {
        const fe = deltaTime / MS_PER_FRAME; // 原版 framesElapsed
        runningTime += deltaTime;
        if (speed < MAX_SPEED) speed += ACCELERATION * fe;
        distance += speed * fe;

        // 跳躍物理（原版 updateJump：位移與重力都乘 framesElapsed；speedDrop 三倍下墜）
        if (dino.y < DINO_GROUND || dino.vy !== 0) {
            dino.y += Math.round(dino.vy * (dino.speedDrop ? SPEED_DROP_COEFFICIENT : 1) * fe);
            dino.vy += GRAVITY * fe;
            if (dino.y >= DINO_GROUND) {
                dino.y = DINO_GROUND; dino.vy = 0; dino.speedDrop = false;
                if (downHeld) dino.ducking = true;
            }
        }
        // 跑步 12fps / 蹲下 8fps（原版 msPerFrame 83.33 / 125）
        dino.timer += deltaTime;
        if (dino.timer >= (dino.ducking ? 125 : 83.33)) { dino.timer = 0; dino.frame = 1 - dino.frame; }

        groundX = (groundX + speed * fe) % S.HORIZON.w;

        clouds.forEach(c => c.x -= speed * 0.2 * fe); // 原版 bgCloudSpeed 0.2
        clouds = clouds.filter(c => c.x > -S.CLOUD.w);
        if (clouds.length < 6 && Math.random() < 0.5 * deltaTime / 1000) clouds.push({ x: W, y: 15 + Math.random() * 55 });

        obstacles.forEach(ob => {
            ob.x -= (speed + (ob.speedOffset || 0)) * fe;
            if (ob.type === 'ptero') { // 拍翅 6fps
                ob.timer += deltaTime;
                if (ob.timer >= 1000 / 6) { ob.timer = 0; ob.frame = 1 - ob.frame; }
            }
        });
        obstacles = obstacles.filter(ob => ob.x + ob.w > 0);
        // 原版 CLEAR_TIME：開場三秒淨空讓玩家進入狀況
        if (runningTime > CLEAR_TIME) {
            const last = obstacles[obstacles.length - 1];
            if (!last || last.x + last.w + last.gap < W) spawnObstacle();
        }

        if (obstacles.some(hitTest)) crash();
    }

    function drawDigits(str, rightX, dim) {
        let x = rightX - str.length * 11;
        ctx.globalAlpha = dim ? 0.45 : 1;
        for (const ch of str) {
            const idx = ch === 'H' ? 10 : ch === 'I' ? 11 : parseInt(ch, 10);
            ctx.drawImage(sprite, S.DIGIT.x + idx * S.DIGIT.w, S.DIGIT.y, S.DIGIT.w, S.DIGIT.h, x, 6, S.DIGIT.w, S.DIGIT.h);
            x += 11;
        }
        ctx.globalAlpha = 1;
    }

    function draw() {
        ctx.fillStyle = '#f7f7f7';
        ctx.fillRect(0, 0, W, H);
        if (!sprite || !sprite.complete) return;

        const gx = Math.floor(groundX);
        ctx.drawImage(sprite, S.HORIZON.x, S.HORIZON.y, S.HORIZON.w, S.HORIZON.h, -gx, GROUND_LINE - 13, S.HORIZON.w, S.HORIZON.h);
        ctx.drawImage(sprite, S.HORIZON.x, S.HORIZON.y, S.HORIZON.w, S.HORIZON.h, S.HORIZON.w - gx, GROUND_LINE - 13, S.HORIZON.w, S.HORIZON.h);
        clouds.forEach(c => ctx.drawImage(sprite, S.CLOUD.x, S.CLOUD.y, S.CLOUD.w, S.CLOUD.h, Math.floor(c.x), c.y, S.CLOUD.w, S.CLOUD.h));

        obstacles.forEach(ob => {
            if (ob.type === 'ptero') {
                ctx.drawImage(sprite, S.PTERO.x[ob.frame], S.PTERO.y, S.PTERO.w, S.PTERO.h, Math.floor(ob.x), ob.y, S.PTERO.w, S.PTERO.h);
            } else {
                ctx.drawImage(sprite, ob.sx, ob.sy, ob.w, ob.h, Math.floor(ob.x), ob.y, ob.w, ob.h);
            }
        });

        let sx, sw = S.TREX.w;
        if (state === 'crashed') sx = S.TREX_DEAD;
        else if (dino.y < DINO_GROUND) sx = S.TREX.x; // 空中用站立 frame（原版 JUMPING frame 0）
        else if (dino.ducking) { sx = S.TREX_DUCK[dino.frame]; sw = S.DUCK_W; }
        else sx = S.TREX_RUN[dino.frame];
        ctx.drawImage(sprite, sx, S.TREX.y, sw, S.TREX.h, DINO_X, Math.round(dino.y), sw, S.TREX.h);

        drawDigits(String(getScore(distance) % 100000).padStart(5, '0'), W - 8, false);
        if (hiScore > 0) drawDigits('HI' + String(hiScore % 100000).padStart(5, '0'), W - 8 - 6 * 11, true);

        if (state === 'crashed') {
            ctx.drawImage(sprite, S.GAMEOVER.x, S.GAMEOVER.y, S.GAMEOVER.w, S.GAMEOVER.h, (W - S.GAMEOVER.w) / 2, 45, S.GAMEOVER.w, S.GAMEOVER.h);
            ctx.drawImage(sprite, S.RESTART.x, S.RESTART.y, S.RESTART.w, S.RESTART.h, (W - S.RESTART.w) / 2, 68, S.RESTART.w, S.RESTART.h);
        }
    }

    function loop(now) {
        raf = requestAnimationFrame(loop);
        const deltaTime = Math.min(now - (lastTime || now), 100); // 分頁切回來不暴衝
        lastTime = now;
        if (state === 'running') step(deltaTime);
        draw();
    }

    function onKey(e) {
        if (e.type === 'keydown') {
            if (e.code === 'Escape') { close(); return; }
            if (e.code === 'Space' || e.code === 'ArrowUp') {
                e.preventDefault();
                if (state === 'crashed') restart(); else if (!e.repeat) jump();
            } else if (e.code === 'ArrowDown') {
                e.preventDefault();
                downHeld = true;
                if (dino.y === DINO_GROUND && dino.vy === 0) dino.ducking = true;
                else dino.speedDrop = true; // 原版空中下壓：三倍速落地
            }
        } else {
            if (e.code === 'ArrowDown') { downHeld = false; dino.ducking = false; dino.speedDrop = false; }
            if (e.code === 'Space' || e.code === 'ArrowUp') endJump();
        }
    }

    function onPointer(e) {
        e.preventDefault();
        if (state === 'crashed') restart(); else jump();
    }

    function build() {
        overlay = document.createElement('div');
        overlay.className = 'game-overlay';
        overlay.innerHTML = `
            <div class="game-box">
                <button class="game-close" title="關閉 (Esc)">&times;</button>
                <canvas width="${W}" height="${H}"></canvas>
                <div class="game-hint">空白鍵 / ↑ 跳躍（長按跳更高） &nbsp;·&nbsp; ↓ 蹲下 &nbsp;·&nbsp; Esc 離開</div>
            </div>`;
        document.body.appendChild(overlay);
        canvas = overlay.querySelector('canvas');
        ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        overlay.querySelector('.game-close').onclick = close;
        overlay.onclick = (e) => { if (e.target === overlay) close(); };
        canvas.addEventListener('pointerdown', onPointer);
    }

    function open() {
        if (overlay || window.dinoGameActive) return;
        if (!sprite) { sprite = new Image(); sprite.src = 'sprite.png'; }
        hiScore = parseInt(localStorage.getItem('dino-runner-hi') || '0', 10);
        build();
        reset();
        lastTime = 0;
        document.addEventListener('keydown', onKey);
        document.addEventListener('keyup', onKey);
        raf = requestAnimationFrame(loop);
        if (typeof gtag === 'function') gtag('event', 'minigame_open');
    }

    function close() {
        if (!overlay) return;
        cancelAnimationFrame(raf);
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('keyup', onKey);
        overlay.remove();
        overlay = null;
        if (typeof gtag === 'function') gtag('event', 'minigame_close', { score: getScore(distance), hi_score: hiScore });
    }

    // ===== 頁面版：畫面下方的小恐龍直接原地開跑 =====
    // 玩家就是頁面上那隻恐龍（DOM + sprite class），障礙物用 DOM 元素從右往左飛，
    // 物理邏輯與視窗版共用同一套 Chromium 常數，遊戲座標跑 1x、渲染時乘 1.1（頁面恐龍縮放）
    const Inline = (function () {
        const SCALE = 1.1;
        let layer = null, scoreEl = null;
        let raf2 = null, lastT2 = 0, state2 = 'running';
        let obs = [], speed2, dist2, runTime2, typeHist2, hi2;
        let dinoY, dinoVy, ducking2, speedDrop2, downHeld2, crashedAt2;
        let pet2, container2, statusEl, groundBottom, dinoGX, viewW2;

        function isActive() { return layer !== null; }

        function enter() {
            if (layer || overlay) return;
            pet2 = document.getElementById('pet');
            container2 = document.getElementById('petContainer');
            statusEl = document.getElementById('petStatus');
            if (!pet2 || !container2) return;
            window.dinoGameActive = true;
            document.body.classList.add('inline-game-mode');
            hi2 = parseInt(localStorage.getItem('dino-runner-hi') || '0', 10);
            // 恐龍滑到左側起跑點、面向右
            container2.style.transition = 'left 0.6s ease';
            container2.style.left = '12%';
            pet2.classList.remove('walking', 'ducking', 'scared', 'jumping', 'happy', 'hungry', 'dead');
            pet2.style.setProperty('--flip', 'none');
            layer = document.createElement('div');
            layer.id = 'inlineGameLayer';
            document.body.appendChild(layer);
            scoreEl = document.createElement('div');
            scoreEl.id = 'inlineGameScore';
            document.body.appendChild(scoreEl);
            document.addEventListener('keydown', onKey2);
            document.addEventListener('keyup', onKey2);
            document.addEventListener('pointerdown', onPointer2);
            // 等恐龍滑到定位再起跑
            setTimeout(() => {
                if (!layer) return; // 中途已退出
                measure();
                reset2();
                lastT2 = 0;
                raf2 = requestAnimationFrame(loop2);
            }, 700);
            if (typeof gtag === 'function') gtag('event', 'minigame_open', { mode: 'inline' });
        }

        function measure() {
            pet2.style.transform = 'translateY(0)';
            const r = pet2.getBoundingClientRect();
            groundBottom = window.innerHeight - r.bottom;
            dinoGX = r.left / SCALE;
            viewW2 = window.innerWidth / SCALE;
        }

        function reset2() {
            obs.forEach(o => o.el.remove());
            obs = []; typeHist2 = [];
            speed2 = START_SPEED; dist2 = 0; runTime2 = 0;
            dinoY = 0; dinoVy = 0; ducking2 = false; speedDrop2 = false; downHeld2 = false;
            state2 = 'running';
            document.body.classList.remove('inline-game-crashed');
            pet2.classList.remove('dead', 'game-ducking');
            pet2.classList.add('game-running');
            if (scoreEl) scoreEl.textContent = '';
        }

        function setDuck(d) {
            ducking2 = d;
            pet2.classList.toggle('game-ducking', d && state2 === 'running');
            pet2.classList.toggle('game-running', !d && state2 === 'running');
        }

        function jump2() {
            if (state2 !== 'running' || dinoY !== 0 || dinoVy !== 0) return;
            dinoVy = -(INITIAL_JUMP_VELOCITY - speed2 / 10); // 向上為正
            setDuck(false);
            speedDrop2 = false;
        }

        function endJump2() {
            if (dinoY > MIN_JUMP_HEIGHT && dinoVy > -DROP_VELOCITY) dinoVy = -DROP_VELOCITY;
        }

        function restart2() {
            if (performance.now() - crashedAt2 < RESTART_DEBOUNCE) return;
            measure();
            reset2();
            if (typeof gtag === 'function') gtag('event', 'minigame_restart', { mode: 'inline' });
        }

        function spawnOb2() {
            const types = ['small', 'large'];
            if (speed2 >= 8.5) types.push('ptero');
            let t;
            do { t = types[Math.floor(Math.random() * types.length)]; }
            while (typeHist2.length >= 2 && typeHist2[0] === t && typeHist2[1] === t);
            typeHist2.push(t);
            if (typeHist2.length > 2) typeHist2.shift();

            const el = document.createElement('div');
            el.className = 'inline-ob';
            let o;
            if (t === 'ptero') {
                const yOpts = [100, 75, 50];
                const y = yOpts[Math.floor(Math.random() * yOpts.length)];
                o = { type: 'ptero', x: viewW2, w: S.PTERO.w, h: S.PTERO.h, yTop: y,
                      speedOffset: Math.random() > 0.5 ? 0.8 : -0.8, minGap: 150, el: el };
                el.classList.add('ob-ptero');
                el.style.width = (S.PTERO.w * SCALE) + 'px';
                el.style.height = (S.PTERO.h * SCALE) + 'px';
                el.style.bottom = (groundBottom + (100 - y) * SCALE) + 'px';
            } else {
                const def = t === 'large' ? S.CACTUS_LARGE : S.CACTUS_SMALL;
                let size = 1 + Math.floor(Math.random() * 3);
                if (size > 1 && (t === 'large' ? 7 : 4) > speed2) size = 1;
                const variant = Math.floor(Math.random() * (6 - size + 1));
                o = { type: 'cactus', x: viewW2, w: def.w * size, h: def.h, minGap: 120, el: el };
                el.style.width = (o.w * SCALE) + 'px';
                el.style.height = (def.h * SCALE) + 'px';
                el.style.bottom = groundBottom + 'px';
                el.style.backgroundPosition = (-(def.x + variant * def.w) * SCALE) + 'px -2.2px';
            }
            const minGap = Math.round(o.w * speed2 + o.minGap * GAP_COEFFICIENT);
            const maxGap = Math.round(minGap * MAX_GAP_COEFFICIENT);
            o.gap = minGap + Math.floor(Math.random() * (maxGap - minGap + 1));
            el.style.transform = 'translate3d(' + Math.round(o.x * SCALE) + 'px,0,0)';
            layer.appendChild(el);
            obs.push(o);
        }

        function hit2(o) {
            const dw = ducking2 ? S.DUCK_W : S.TREX.w;
            const dh = ducking2 ? S.DUCK_H : S.TREX.h;
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

        function crash2() {
            state2 = 'crashed';
            crashedAt2 = performance.now();
            pet2.classList.remove('game-running', 'game-ducking');
            pet2.classList.add('dead');
            pet2.style.transform = 'translateY(0)';
            document.body.classList.add('inline-game-crashed');
            const sc = getScore(dist2);
            if (sc > hi2) { hi2 = sc; localStorage.setItem('dino-runner-hi', String(hi2)); }
            if (statusEl) statusEl.textContent = 'GAME OVER！' + sc + ' 分・空白鍵再來・Esc 離開';
            if (typeof gtag === 'function') gtag('event', 'minigame_gameover', { score: sc, hi_score: hi2, mode: 'inline' });
        }

        function step2(dt) {
            const fe = dt / MS_PER_FRAME;
            runTime2 += dt;
            if (speed2 < MAX_SPEED) speed2 += ACCELERATION * fe;
            dist2 += speed2 * fe;

            if (dinoY > 0 || dinoVy !== 0) {
                dinoY += dinoVy * (speedDrop2 && dinoVy < 0 ? SPEED_DROP_COEFFICIENT : 1) * fe;
                dinoVy -= GRAVITY * fe;
                if (dinoY <= 0) {
                    dinoY = 0; dinoVy = 0; speedDrop2 = false;
                    if (downHeld2) setDuck(true);
                }
            }
            pet2.style.transform = 'translateY(' + (-Math.round(dinoY * SCALE)) + 'px)';

            obs.forEach(o => {
                o.x -= (speed2 + (o.speedOffset || 0)) * fe;
                o.el.style.transform = 'translate3d(' + Math.round(o.x * SCALE) + 'px,0,0)';
            });
            obs = obs.filter(o => { if (o.x + o.w > -10) return true; o.el.remove(); return false; });
            if (runTime2 > CLEAR_TIME) {
                const last = obs[obs.length - 1];
                if (!last || last.x + last.w + last.gap < viewW2) spawnOb2();
            }
            if (obs.some(hit2)) crash2();
            scoreEl.textContent = String(getScore(dist2)).padStart(5, '0') + (hi2 > 0 ? '  HI ' + String(hi2).padStart(5, '0') : '');
        }

        function loop2(now) {
            raf2 = requestAnimationFrame(loop2);
            const dt = Math.min(now - (lastT2 || now), 100);
            lastT2 = now;
            if (state2 === 'running') step2(dt);
        }

        function onKey2(e) {
            if (e.type === 'keydown') {
                if (e.code === 'Escape') { exit(); return; }
                if (e.code === 'Space' || e.code === 'ArrowUp') {
                    e.preventDefault();
                    if (state2 === 'crashed') restart2(); else if (!e.repeat) jump2();
                } else if (e.code === 'ArrowDown') {
                    e.preventDefault();
                    downHeld2 = true;
                    if (dinoY === 0 && dinoVy === 0) setDuck(true);
                    else speedDrop2 = true;
                }
            } else {
                if (e.code === 'ArrowDown') { downHeld2 = false; setDuck(false); speedDrop2 = false; }
                if (e.code === 'Space' || e.code === 'ArrowUp') endJump2();
            }
        }

        function onPointer2(e) {
            if (e.target.closest('.menu, .settings-btn, .modal-overlay, .game-overlay')) return;
            if (state2 === 'crashed') restart2(); else jump2();
        }

        function exit() {
            if (!layer) return;
            cancelAnimationFrame(raf2);
            document.removeEventListener('keydown', onKey2);
            document.removeEventListener('keyup', onKey2);
            document.removeEventListener('pointerdown', onPointer2);
            obs.forEach(o => o.el.remove());
            obs = [];
            layer.remove(); layer = null;
            if (scoreEl) { scoreEl.remove(); scoreEl = null; }
            document.body.classList.remove('inline-game-mode', 'inline-game-crashed');
            pet2.classList.remove('game-running', 'game-ducking', 'dead');
            pet2.style.transform = '';
            container2.style.transition = '';
            container2.style.left = (typeof petPos !== 'undefined' ? petPos : 50) + '%';
            window.dinoGameActive = false;
            if (typeof updatePetStatus === 'function') { isAnnouncing = false; updatePetStatus(); }
            if (typeof gtag === 'function') gtag('event', 'minigame_close', { score: getScore(dist2 || 0), hi_score: hi2, mode: 'inline' });
        }

        return { enter: enter, exit: exit, isActive: isActive };
    })();

    // ===== 版本選擇小視窗（試玩期間用，定案後改為直接進入）=====
    let chooser = null;
    function choose() {
        if (overlay || Inline.isActive() || chooser) return;
        chooser = document.createElement('div');
        chooser.className = 'game-overlay';
        chooser.innerHTML = `
            <div class="game-box game-choice">
                <button class="game-close" title="關閉">&times;</button>
                <div class="game-choice-title">🦖 Dino Runner — 選一個版本</div>
                <button class="game-choice-btn" data-mode="window">🪟 視窗版（彈出小視窗玩）</button>
                <button class="game-choice-btn" data-mode="inline">🏃 頁面版（小恐龍原地開跑）</button>
            </div>`;
        document.body.appendChild(chooser);
        const closeChooser = () => { if (chooser) { chooser.remove(); chooser = null; } };
        chooser.querySelector('.game-close').onclick = closeChooser;
        chooser.onclick = (e) => { if (e.target === chooser) closeChooser(); };
        chooser.querySelectorAll('.game-choice-btn').forEach(b => {
            b.onclick = () => {
                const mode = b.dataset.mode;
                closeChooser();
                if (mode === 'window') open(); else Inline.enter();
            };
        });
    }

    window.DinoRunner = {
        open: open, close: close, choose: choose,
        openInline: Inline.enter, closeInline: Inline.exit,
        isActive: function () { return !!overlay || Inline.isActive(); }
    };
})();
