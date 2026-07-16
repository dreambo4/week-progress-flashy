// ===== 小恐龍寵物（狀態、互動、翼手龍/仙人掌彩蛋）=====
// 小恐龍偶爾冒出的小提示（未來擴充直接往陣列加）
const DINO_TIPS = [
    "上班坐一整天了，『長按』我動一動 🦖"
];

let petHunger = 100, petPos = 50, isAnnouncing = false, isStormy = false;

function happyJump() {
    const pet = document.getElementById('pet');
    if (!pet || petHunger <= 0 || pet.classList.contains('jumping')) return;
    pet.classList.add('jumping');
    setTimeout(() => pet.classList.remove('jumping'), 700);
}

let pteroFlying = false;

function spawnPtero() {
    if (pteroFlying || window.dinoGameActive) return;
    pteroFlying = true;
    const ptero = document.createElement('div');
    ptero.className = 'ptero';
    // 飛行高度落在恐龍頭部附近，蹲下才閃得過
    ptero.style.bottom = (95 + Math.random() * 35) + 'px';
    document.body.appendChild(ptero);
    const pet = document.getElementById('pet');
    // 追蹤水平距離：接近時蹲下、飛過後起身（跟 Chrome 遊戲一樣）
    const duckWatcher = setInterval(() => {
        if (!pet || petHunger <= 0 || window.dinoGameActive) return;
        const pr = ptero.getBoundingClientRect();
        const dr = pet.getBoundingClientRect();
        const dx = (pr.left + pr.width / 2) - (dr.left + dr.width / 2);
        if (dx < -130) pet.classList.remove('ducking');
        else if (Math.abs(dx) < 130) pet.classList.add('ducking');
    }, 100);
    let done = false;
    const cleanup = () => {
        if (done) return;
        done = true;
        clearInterval(duckWatcher);
        if (pet) pet.classList.remove('ducking');
        ptero.remove();
        pteroFlying = false;
    };
    ptero.addEventListener('animationend', (e) => { if (e.animationName === 'ptero-fly') cleanup(); });
    setTimeout(cleanup, 12000);
}

let cactusActive = false;

function spawnCactus() {
    if (cactusActive || pteroFlying || window.dinoGameActive) return;
    const pet = document.getElementById('pet');
    const container = document.getElementById('petContainer');
    if (!pet || petHunger <= 0) return;
    if (container && container.classList.contains('napping')) return; // 睡著跳不了，跳過這輪
    cactusActive = true;
    // 單顆仙人掌（1x 座標：小 x=228 17x35 / 大 x=332 25x50，各 6 款，乘 1.1 縮放）
    // 彩蛋走遊戲起始速度，滯空只夠跳單顆；連叢是遊戲中後段高速時才有的東西
    const large = Math.random() > 0.5;
    const unitW = large ? 25 : 17, unitH = large ? 50 : 35, baseX = large ? 332 : 228;
    const variant = Math.floor(Math.random() * 6);
    const cactus = document.createElement('div');
    cactus.className = 'easter-cactus';
    cactus.style.width = (unitW * 1.1) + 'px';
    cactus.style.height = (unitH * 1.1) + 'px';
    cactus.style.backgroundPosition = (-(baseX + variant * unitW) * 1.1) + 'px -2.2px';
    // 貼齊恐龍腳底的地平線
    cactus.style.bottom = Math.max(0, window.innerHeight - pet.getBoundingClientRect().bottom) + 'px';
    document.body.appendChild(cactus);
    // 追蹤水平距離：仙人掌逼近時起跳躍過（跟 Chrome 遊戲一樣）
    // 停住走路滑行（left 有 3s transition，滑行中相對速度會讓起跳時機失準）
    if (container) container.style.left = getComputedStyle(container).left;
    // 用「仙人掌前緣 vs 恐龍前緣」的間距判斷起跳（中心距離會低估寬叢的逼近），
    // 距離隨螢幕寬換算：仙人掌 5 秒橫越 (寬+120)px，拋物線跳躍約 0.1 秒升到安全高度
    const cactusSpeed = (window.innerWidth + 120) / 5; // px/s
    const triggerGap = cactusSpeed * 0.15 + 15;
    let hopped = false; // 一朵仙人掌只跳一次，避免落地後誤觸發第二跳
    const hopWatcher = setInterval(() => {
        if (hopped || window.dinoGameActive || petHunger <= 0) return;
        const cr = cactus.getBoundingClientRect();
        const dr = pet.getBoundingClientRect();
        const gap = cr.left - dr.right;
        if (gap > -10 && gap < triggerGap) {
            hopped = true;
            pet.classList.add('hopping');
            setTimeout(() => pet.classList.remove('hopping'), 650);
        }
    }, 50);
    let done = false;
    const cleanup = () => {
        if (done) return;
        done = true;
        clearInterval(hopWatcher);
        cactus.remove();
        cactusActive = false;
    };
    cactus.addEventListener('animationend', cleanup);
    setTimeout(cleanup, 12000);
}

function scheduleEasterEgg() {
    setTimeout(() => {
        if (!document.hidden) (Math.random() < 0.5 ? spawnPtero : spawnCactus)();
        scheduleEasterEgg();
    }, 90 * 1000 + Math.random() * 150 * 1000);
}

function scareDino() {
    const pet = document.getElementById('pet'), petStatus = document.getElementById('petStatus');
    if (!pet || petHunger <= 0 || pet.classList.contains('scared')) return;
    pet.classList.add('scared');
    if (petStatus) { isAnnouncing = true; petStatus.textContent = "打雷好可怕...🫣"; }
    setTimeout(() => {
        pet.classList.remove('scared');
        // 緩衝台詞：避免嚇完下一秒馬上「跑得很開心」的情緒斷層
        if (petStatus) petStatus.textContent = "呼...嚇死我了 😮‍💨";
        setTimeout(() => { isAnnouncing = false; updatePetStatus(); }, 5000);
    }, 5000);
}

function feedPet() {
    petHunger = Math.min(100, petHunger + 30);
    happyJump();
    const petStatus = document.getElementById('petStatus');
    if (petStatus) {
        petStatus.textContent = "好吃！加點體力 🍱";
        isAnnouncing = true;
        setTimeout(() => { isAnnouncing = false; updatePetStatus(); }, 1500);
        if (typeof confetti === 'function') { confetti({ particleCount: 20, spread: 30, origin: { y: 0.9 } }); }
    }
    gtag('event', 'pet_interact', { action: 'feed', hunger_level: Math.round(petHunger) });
}

function patPet() {
    const pet = document.getElementById('pet'), petStatus = document.getElementById('petStatus');
    if (pet && petStatus) {
        pet.classList.add('ducking');
        setTimeout(() => pet.classList.remove('ducking'), 1000);
        petStatus.textContent = "❤️";
        isAnnouncing = true;
        setTimeout(() => { isAnnouncing = false; updatePetStatus(); }, 2000);
    }
    gtag('event', 'pet_interact', { action: 'pat', hunger_level: Math.round(petHunger) });
}

function updatePetStatus() {
    if (isAnnouncing) return;
    const petStatus = document.getElementById('petStatus'), pet = document.getElementById('pet');
    const container = document.getElementById('petContainer');
    if (!petStatus || !pet) return;
    pet.classList.remove('hungry', 'happy', 'dead');
    const isNapping = container && container.classList.contains('napping');
    if (petHunger <= 0) { petStatus.textContent = "小恐龍已經斷網了 (GameOver) 👻"; pet.classList.add('dead'); pet.classList.remove('scared'); }
    else if (isNapping) { petStatus.textContent = "Zzz... 午睡中 💤"; }
    else if (petHunger > 80) { petStatus.textContent = "小恐龍跑得很開心！🦖✨"; pet.classList.add('happy'); }
    else if (petHunger > 40) { petStatus.textContent = "小恐龍肚子有點空空的... 🌵"; }
    else { petStatus.textContent = "小恐龍沒力氣跑了 🌫️"; pet.classList.add('hungry'); }
}

function announceTip() {
    const petStatus = document.getElementById('petStatus');
    if (!petStatus) return;
    isAnnouncing = true;
    petStatus.textContent = DINO_TIPS[Math.floor(Math.random() * DINO_TIPS.length)];
    setTimeout(() => { isAnnouncing = false; updatePetStatus(); }, 6000);
}

function announceTime() {
    const petStatus = document.getElementById('petStatus');
    if (!petStatus) return;
    const now = new Date(), day = now.getDay(), curSec = (now.getHours() * 3600) + (now.getMinutes() * 60);
    const wStart = parseTimeToSec(timeConfig.workStart), wEnd = parseTimeToSec(timeConfig.workEnd);
    const isWorkday = (timeConfig.workdays || [1,2,3,4,5]).includes(day);
    let msg = "";
    if (!isWorkday) {
        msg = (day === 0 || day === 6) ? "週末萬歲！盡情狂歡吧 🎉" : "休假中，享受人生 🏖️";
    }
    else if (curSec < wStart) msg = "還沒開工，再摸一下魚... ☕️";
    else if (curSec >= wEnd) msg = "下班啦！快點回家休息 🍻";
    else if (curSec >= parseTimeToSec(timeConfig.lunchStart) && curSec < parseTimeToSec(timeConfig.lunchEnd)) msg = "午休時間，讓我瞇一下... 💤";
    else {
        const rem = Math.floor((wEnd - curSec) / 60);
        msg = `加油！距離下班還有 ${Math.floor(rem / 60)} 小時 ${rem % 60} 分鐘 🏠`;
    }
    isAnnouncing = true;
    petStatus.textContent = msg;
    setTimeout(() => { isAnnouncing = false; updatePetStatus(); }, 6000);
}

function initPet() {
    const container = document.getElementById('petContainer'), pet = document.getElementById('pet'), fBtn = document.getElementById('feedBtn'), pBtn = document.getElementById('patBtn');
    if (!container || !pet) return;
    container.style.left = petPos + '%';
    fBtn.onclick = (e) => feedPet();
    pBtn.onclick = (e) => patPet();
    // 點恐龍本體＝拍拍；長按 600ms＝開啟 Dino Runner 跑酷小遊戲
    let pressTimer = null, longPressed = false;
    const cancelPress = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };
    pet.addEventListener('pointerdown', () => {
        if (window.dinoGameActive) return;
        longPressed = false;
        pressTimer = setTimeout(() => {
            pressTimer = null;
            longPressed = true;
            if (window.DinoRunner) window.DinoRunner.open();
        }, 600);
    });
    pet.addEventListener('pointerup', cancelPress);
    pet.addEventListener('pointerleave', cancelPress);
    pet.onclick = () => {
        if (window.dinoGameActive) return; // 遊戲中，點擊交給遊戲當跳躍
        if (longPressed) { longPressed = false; return; } // 長按已觸發，吞掉這次 click
        patPet();
    };
    setInterval(() => {
        if (window.dinoGameActive) return; // 頁面版遊戲中：暫停走動/報時/飢餓
        const isNapping = container.classList.contains('napping');
        if (isStormy && petHunger > 0 && !isNapping && !isAnnouncing && Math.random() > 0.8) scareDino();
        if (Math.random() > 0.85 && !isAnnouncing && petHunger > 0 && !isNapping) announceTime();
        else if (Math.random() > 0.96 && !isAnnouncing && petHunger > 0 && !isNapping) announceTip();
        if (petHunger > 0 && !isNapping && !pet.classList.contains('scared') && !pteroFlying && !cactusActive && Math.random() > 0.4) {
            let newPos = Math.max(15, Math.min(85, petPos + (Math.random() * 40 - 20)));
            if (newPos !== petPos) { pet.style.setProperty('--flip', newPos > petPos ? 'scaleX(-1)' : 'scaleX(1)'); petPos = newPos; container.style.left = petPos + '%'; pet.classList.add('walking'); setTimeout(() => pet.classList.remove('walking'), 2500); }
        }
        else if (petHunger > 80 && !isNapping && !pet.classList.contains('scared') && Math.random() > 0.7) happyJump();
        petHunger = Math.max(0, petHunger - 0.5); updatePetStatus();
    }, 5000);
}
