const THEME_STORAGE_KEY = 'pkchamps-theme';
const THEME_COLORS = {
  light: '#eef2f6',
  dark: '#0f1621',
};

function getStoredTheme() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'dark' ? 'dark' : 'light';
  } catch (e) {
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  }
}

function storeTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (e) {}
}

function applyTheme(theme) {
  const nextTheme = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = nextTheme;
  if (nextTheme === 'light') delete document.documentElement.dataset.theme;
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute('content', THEME_COLORS[nextTheme]);
  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    const isDark = nextTheme === 'dark';
    toggle.setAttribute('aria-pressed', String(isDark));
    toggle.setAttribute('aria-label', isDark ? '라이트 모드로 전환' : '다크 모드로 전환');
    const text = toggle.querySelector('.theme-toggle-text');
    if (text) text.textContent = isDark ? '라이트' : '다크';
  }
}

function initThemeToggle() {
  applyTheme(getStoredTheme());
  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;
  toggle.addEventListener('click', () => {
    const nextTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    storeTheme(nextTheme);
  });
}
