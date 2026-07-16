// ===== 主題切換 =====
function setTheme(theme) {
    const prevTheme = document.body.getAttribute('data-theme');
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('week-progress-theme', theme);
    const menu = document.getElementById('themeMenu');
    if (menu) menu.classList.remove('active');
    if (prevTheme && prevTheme !== theme) gtag('event', 'theme_change', { theme_name: theme });
}

const savedTheme = localStorage.getItem('week-progress-theme') || 'neon';
setTheme(savedTheme);
