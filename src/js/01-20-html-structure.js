/* Shared HTML structure helpers.
 * Keep these helpers presentation-neutral: they describe hierarchy and state,
 * while existing CSS owns the visual treatment.
 */
function htmlAttrValue(value) {
  return escapeHTML(value).replace(/"/g, '&quot;');
}

function htmlAttrs(attrs = {}) {
  return Object.entries(attrs)
    .filter(([, value]) => value !== false && value !== null && value !== undefined)
    .map(([name, value]) => value === true ? name : `${name}="${htmlAttrValue(value)}"`)
    .join(' ');
}

function uiButton(label, attrs = {}) {
  const attrText = htmlAttrs({ type: 'button', ...attrs });
  return `<button ${attrText}>${label}</button>`;
}

function syncUiTabs(buttons, activeButton) {
  buttons.forEach(button => {
    const active = button === activeButton;
    button.classList.toggle('active', active);
    if (button.hasAttribute('aria-selected')) {
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    }
    if (button.getAttribute('role') === 'tab') {
      button.tabIndex = activeButton ? (active ? 0 : -1) : 0;
    }
  });
}

function syncUiPanels(panels, activePanel) {
  panels.forEach(panel => {
    const active = panel === activePanel;
    panel.classList.toggle('active', active);
    if (panel.hasAttribute('aria-hidden')) {
      panel.setAttribute('aria-hidden', active ? 'false' : 'true');
    }
    if (panel.getAttribute('role') === 'tabpanel') {
      panel.hidden = !active;
    }
  });
}

function bindUiTabKeyboard(tablist, options = {}) {
  if (!tablist || tablist.dataset.uiTabKeyboard === 'bound') return;
  tablist.dataset.uiTabKeyboard = 'bound';
  const selector = options.selector || '[role="tab"]';

  tablist.addEventListener('keydown', event => {
    const current = event.target.closest(selector);
    if (!current || !tablist.contains(current)) return;

    const tabs = [...tablist.querySelectorAll(selector)].filter(tab => !tab.disabled);
    const currentIndex = tabs.indexOf(current);
    if (currentIndex < 0) return;

    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const next = tabs[nextIndex];
    next.focus();
    if (options.activateOnFocus !== false) next.click();
  });
}

function activateMainPage(pageKey, options = {}) {
  const tab = document.querySelector(`.nav-tab[data-page="${pageKey}"]`);
  const activePage = document.getElementById(`page-${pageKey}`);
  if (!tab || !activePage) return false;

  syncUiTabs(document.querySelectorAll('.nav-tab'), tab);
  syncUiPanels(document.querySelectorAll('.page'), activePage);

  if (options.updateHash) {
    history.replaceState(null, '', `#${pageKey}`);
  }
  return true;
}

function activateMainPageFromHash() {
  const pageKey = decodeURIComponent(location.hash.replace(/^#(?:page-)?/, '')).trim();
  if (!pageKey) return false;
  return activateMainPage(pageKey, { updateHash: false });
}

function bindMainNavigation() {
  const nav = document.querySelector('.main-nav');
  const navTabs = document.querySelectorAll('.nav-tab');
  if (!nav || !navTabs.length) return;

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      activateMainPage(tab.dataset.page, { updateHash: true });
    });
  });

  bindUiTabKeyboard(nav);

  const activeTab = document.querySelector('.nav-tab.active') || navTabs[0];
  const initialPage = activateMainPageFromHash()
    || activateMainPage(activeTab?.dataset.page || 'calc', { updateHash: false });

  if (!initialPage) {
    activateMainPage('calc', { updateHash: false });
  }

  window.addEventListener('hashchange', activateMainPageFromHash);
}
