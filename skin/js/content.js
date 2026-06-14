(function () {
  "use strict";

  const CHROME_API = typeof browser !== "undefined" ? browser : chrome;
  const state = window.TT_STATE;

  function languageOptions() {
    return window.TT_I18N.supportedLanguages.map((item) => {
      const selected = item.value === state.currentLang ? " selected" : "";
      return `<option value="${item.value}"${selected}>${item.label}</option>`;
    }).join("");
  }

  window.TT_Content = {
    t(key, placeholders = null) {
      return window.TT_I18N.t(key, placeholders);
    },

    updateAllUI() {
      const patrolTab = document.getElementById("tt-tab-patrol");
      if (window.TT_PATROL && patrolTab) window.TT_PATROL.initUI(patrolTab);
    },

    createPanel() {
      if (document.getElementById("tidetrace-panel")) return;

      const panel = document.createElement("section");
      panel.id = "tidetrace-panel";
      panel.className = "tt-panel";
      panel.hidden = true;
      const manifest = CHROME_API.runtime.getManifest();

      panel.innerHTML = `
        <header class="tt-panel-header">
          <div>
            <span class="tt-section-label">${this.t("sectionLabel")}</span>
            <h1 class="tt-title">Tidetrace / 潮痕</h1>
          </div>
          <div class="tt-header-actions">
            <span class="tt-version">v${manifest.version}</span>
            <button id="tt-theme-toggle" class="tt-icon-btn" type="button" title="${this.t("themeLabel")}">◐</button>
          </div>
        </header>
        <div class="tt-divider"></div>
        <div class="tt-tabs">
          <button class="tt-tab-btn active" type="button">${this.t("tabPatrol")}</button>
        </div>
        <div id="tt-tab-patrol" class="tt-tab-content active"></div>
        <footer class="tt-footer">
          <label class="tt-language-label" for="tt-lang-select">${this.t("languageLabel")}</label>
          <select id="tt-lang-select" class="tt-select">${languageOptions()}</select>
        </footer>
      `;

      document.body.appendChild(panel);

      document.getElementById("tt-theme-toggle").addEventListener("click", () => {
        document.documentElement.classList.toggle("tt-theme-light");
      });

      document.getElementById("tt-lang-select").addEventListener("change", async (event) => {
        await window.TT_I18N.loadLanguage(event.target.value);
        this.updateAllUI();
        const label = document.querySelector(".tt-language-label");
        if (label) label.textContent = this.t("languageLabel");
      });
    },

    async init() {
      const stored = await CHROME_API.storage.local.get(["language"]);
      await window.TT_I18N.loadLanguage(stored.language || window.TT_I18N.browserLocale());
      this.createPanel();
      window.TT_UI.createFloatingButton();
      this.updateAllUI();
    }
  };

  window.TT_Content.init();
})();
