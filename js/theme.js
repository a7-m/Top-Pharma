/**
 * AL-Pharmacist Theme Management System
 * Handles Light, Dark, and System theme preferences
 */

(function () {
  const THEME_KEY = "al_pharmacist_theme";

  // 1. Get initial theme
  function getInitialTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme) return savedTheme;

    // Check system preference
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  }

  // 2. Apply theme to document
  function applyTheme(theme) {
    if (theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }

  // 3. Initialize theme immediately (to prevent flash)
  const currentTheme = getInitialTheme();
  applyTheme(currentTheme);

  // 4. Handle Toggle Logic
  window.themeManager = {
    getTheme: () => localStorage.getItem(THEME_KEY) || "system",
    setTheme: (theme) => {
      if (theme === "system") {
        localStorage.removeItem(THEME_KEY);
      } else {
        localStorage.setItem(THEME_KEY, theme);
      }
      applyTheme(theme);
      updateToggleButtonUI(theme);
    },
    toggle: () => {
      const current = localStorage.getItem(THEME_KEY) || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      const next = current === "dark" ? "light" : "dark";
      window.themeManager.setTheme(next);
    }
  };

  // 5. Inject Toggle Button into Navbar
  function injectToggleButton() {
    const navbarContainer = document.querySelector(".navbar-container");
    if (!navbarContainer) return;

    // Check if toggle already exists
    if (document.getElementById("themeToggle")) return;

    const toggleContainer = document.createElement("div");
    toggleContainer.className = "theme-toggle-container";
    toggleContainer.innerHTML = `
      <button id="themeToggle" class="theme-toggle-btn" title="تبديل الثيم" aria-label="تبديل الثيم">
        ${getThemeIcon(currentTheme)}
      </button>
    `;

    // Insert before the menu (or at the end of container)
    const navMenu = document.getElementById("navMenu");
    if (navMenu) {
        navbarContainer.insertBefore(toggleContainer, navMenu);
    } else {
        navbarContainer.appendChild(toggleContainer);
    }

    document.getElementById("themeToggle").addEventListener("click", () => {
      window.themeManager.toggle();
    });
  }

  function getThemeIcon(theme) {
    const t = theme === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme;
    return t === "dark" ? "🌙" : "☀️";
  }

  function updateToggleButtonUI(theme) {
    const btn = document.getElementById("themeToggle");
    if (btn) {
      btn.innerHTML = getThemeIcon(theme);
    }
  }

  // Run injection on load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectToggleButton);
  } else {
    injectToggleButton();
  }

  // Listen for system theme changes
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    if (!localStorage.getItem(THEME_KEY)) {
      applyTheme("system");
      updateToggleButtonUI("system");
    }
  });
})();
