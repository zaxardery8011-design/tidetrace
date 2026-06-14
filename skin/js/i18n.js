(function () {
  "use strict";

  const CHROME_API = typeof browser !== "undefined" ? browser : chrome;
  const SUPPORTED_LANGUAGES = [
    { value: "zh_TW", label: "繁體中文" },
    { value: "zh_CN", label: "简体中文" },
    { value: "en", label: "English" },
    { value: "ja", label: "日本語" },
    { value: "es", label: "Español" },
    { value: "hi", label: "हिन्दी" },
    { value: "ko", label: "한국어" },
    { value: "vi", label: "Tiếng Việt" }
  ];

  function applyPlaceholders(message, placeholders) {
    if (!placeholders) return message;
    const list = Array.isArray(placeholders) ? placeholders : [placeholders];
    return list.reduce((current, value, index) => {
      return current.replace(new RegExp(`\\$${index + 1}`, "g"), String(value));
    }, message);
  }

  window.TT_I18N = {
    supportedLanguages: SUPPORTED_LANGUAGES,

    async loadLanguage(lang) {
      const state = window.TT_STATE;
      const target = SUPPORTED_LANGUAGES.some((item) => item.value === lang) ? lang : "zh_TW";
      try {
        const url = CHROME_API.runtime.getURL(`_locales/${target}/messages.json`);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        state.messagesCache = await response.json();
        state.currentLang = target;
        CHROME_API.storage.local.set({ language: target });
      } catch (error) {
        console.warn("[Tidetrace i18n] Failed to load locale", target, error);
        state.messagesCache = null;
        state.currentLang = "zh_TW";
      }
    },

    t(key, placeholders = null) {
      const state = window.TT_STATE;
      if (state.messagesCache && state.messagesCache[key]) {
        return applyPlaceholders(state.messagesCache[key].message, placeholders);
      }
      const fallback = CHROME_API.i18n.getMessage(key, placeholders);
      return fallback || key;
    },

    browserLocale() {
      const raw = CHROME_API.i18n.getUILanguage().replace("-", "_");
      return SUPPORTED_LANGUAGES.find((item) => raw.startsWith(item.value.substring(0, 2)))?.value || "zh_TW";
    }
  };
})();
