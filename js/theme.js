// ===== 主題切換 =====

// favicon 造型固定，配色跟著主題的 --primary-color / --bg-color 走
const FAVICON_DINO_PATH = 'M 9,3 L 13,3 L 13,5 L 11,5 L 11,6 L 12,6 L 12,7 L 10,7 L 10,9 L 9,9 L 9,11 L 7,11 L 7,9 L 6,9 L 6,10 L 4,10 L 4,8 L 3,8 L 3,7 L 6,7 L 6,5 L 9,5 Z';
let faviconPerc = 58; // 進度條填滿比例，由 updateFavicon() 更新

// 相對亮度（sRGB），用來決定恐龍要用亮色還是暗色
function luminance(hex) {
    const h = hex.replace('#', '');
    const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const [r, g, b] = [0, 2, 4].map(i => parseInt(n.substr(i, 2), 16) / 255);
    const f = (c) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

// 在深底上加白、在淺底上加黑，做出進度條的軌道色
function mix(hex, target, ratio) {
    const h = hex.replace('#', '');
    const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const t = target === 'white' ? 255 : 0;
    const ch = [0, 2, 4].map(i => Math.round(parseInt(n.substr(i, 2), 16) * (1 - ratio) + t * ratio));
    return '#' + ch.map(c => c.toString(16).padStart(2, '0')).join('');
}

function updateFavicon() {
    const link = document.getElementById('favicon');
    if (!link) return;
    const cs = getComputedStyle(document.body);
    const primary = (cs.getPropertyValue('--primary-color') || '#00f2fe').trim();
    const bg = (cs.getPropertyValue('--bg-color') || '#0f172a').trim();

    // 淺色主題（minimal / flow）的底色接近純白，直接當底板會看不見邊界，改壓深一階
    const isLight = luminance(bg) > 0.5;
    const plate = isLight ? mix(bg, 'black', 0.08) : bg;
    // 恐龍要跟底板夠對比，不跟著 primary 走，避免主題主色太暗時糊掉
    const dino = isLight ? '#0f172a' : '#ffffff';
    const track = isLight ? mix(plate, 'black', 0.12) : mix(plate, 'white', 0.16);

    const w = Math.max(0, Math.min(12, 12 * faviconPerc / 100));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">`
        + `<rect x="0" y="0" width="16" height="16" rx="4" fill="${plate}"/>`
        + `<rect x="2" y="12" width="12" height="2" rx="1" fill="${track}"/>`
        + (w > 0 ? `<rect x="2" y="12" width="${w.toFixed(2)}" height="2" rx="1" fill="${primary}"/>` : '')
        + `<path d="${FAVICON_DINO_PATH}" fill="${dino}"/>`
        + `</svg>`;
    link.href = 'data:image/svg+xml,' + svg.replace(/"/g, '%22').replace(/#/g, '%23');
}

// 由 updateProgress() 呼叫，讓 favicon 的進度條反映本週實際進度
function setFaviconProgress(perc) {
    const next = Math.round(perc);
    if (next === faviconPerc) return; // 沒變就不重繪，避免分頁閃爍
    faviconPerc = next;
    updateFavicon();
}

function setTheme(theme) {
    const prevTheme = document.body.getAttribute('data-theme');
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('week-progress-theme', theme);
    updateFavicon();
    const menu = document.getElementById('themeMenu');
    if (menu) menu.classList.remove('active');
    if (prevTheme && prevTheme !== theme) gtag('event', 'theme_change', { theme_name: theme });
}

const savedTheme = localStorage.getItem('week-progress-theme') || 'neon';
setTheme(savedTheme);
