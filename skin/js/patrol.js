(function () {
  "use strict";

  const CHROME_API = typeof browser !== "undefined" ? browser : chrome;
  const s = () => window.TT_STATE;
  const q = () => window.TT_SELECTORS;
  let shortPhrases = [];

  function t(key, placeholders = null) {
    return window.TT_Content.t(key, placeholders);
  }

  function defaultReplyTemplates() {
    const lang = s().currentLang;
    return lang && lang.startsWith("zh")
      ? [...window.TT_DEFAULT_REPLY_TEMPLATES.zh_TW]
      : [...window.TT_DEFAULT_REPLY_TEMPLATES.en];
  }

  async function loadDictionary() {
    if (shortPhrases.length > 0) return shortPhrases;
    try {
      const url = CHROME_API.runtime.getURL("AIShortPhrasesDictionary.txt");
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      shortPhrases = text.split("\n").map((line) => line.trim()).filter(Boolean);
      return shortPhrases;
    } catch (error) {
      console.error("[Tidetrace] Dictionary load failed:", error);
      return [];
    }
  }

  function loadPatrolData() {
    CHROME_API.storage.local.get([
      "patrolKeywords",
      "replyTemplates",
      "repliedPostIds",
      "replyMode"
    ], (result) => {
      const state = s();

      if (Array.isArray(result.patrolKeywords)) {
        state.highlightKeywords = result.patrolKeywords;
        const textarea = document.getElementById("tt-keyword-textarea");
        if (textarea) textarea.value = state.highlightKeywords.join("\n");
      }

      if (Array.isArray(result.replyTemplates)) {
        state.replyTemplates = result.replyTemplates;
      } else {
        state.replyTemplates = defaultReplyTemplates();
        CHROME_API.storage.local.set({ replyTemplates: state.replyTemplates });
      }

      if (Array.isArray(result.repliedPostIds)) {
        state.repliedPostIds = new Set(result.repliedPostIds);
      }

      if (["copy", "autofill"].includes(result.replyMode)) {
        state.replyMode = result.replyMode;
      }

      renderReplyLibrary();
      updateReplyModeUI();
    });
  }

  function savePatrolKeywords() {
    CHROME_API.storage.local.set({ patrolKeywords: s().highlightKeywords });
  }

  function saveReplyTemplates() {
    CHROME_API.storage.local.set({ replyTemplates: s().replyTemplates });
  }

  function saveReplyMode() {
    CHROME_API.storage.local.set({ replyMode: s().replyMode });
  }

  function saveRepliedPost(postId) {
    if (!postId) return;
    CHROME_API.storage.local.get(["repliedPostIds"], (result) => {
      const stored = Array.isArray(result.repliedPostIds) ? result.repliedPostIds : [];
      if (!stored.includes(postId)) {
        stored.push(postId);
        CHROME_API.storage.local.set({ repliedPostIds: stored });
      }
    });
  }

  function getProviderModel(provider) {
    const state = s();
    if (provider === "openai") return state.openaiModel;
    if (provider === "claude") return state.claudeModel;
    return state.geminiModel;
  }

  function setProviderModel(provider, model) {
    const state = s();
    if (!model) return;
    if (provider === "openai") state.openaiModel = model;
    else if (provider === "claude") state.claudeModel = model;
    else state.geminiModel = model;
  }

  function updateAiProviderUI() {
    const state = s();
    document.querySelectorAll("[data-ai-provider]").forEach((button) => {
      button.classList.toggle("active", button.dataset.aiProvider === state.aiProvider);
    });

    const keyInput = document.getElementById("tt-ai-key-input");
    if (keyInput) keyInput.value = state.aiApiKeys[state.aiProvider] || "";

    const modelInput = document.getElementById("tt-ai-model-input");
    if (modelInput) modelInput.value = getProviderModel(state.aiProvider);
  }

  function loadAiSettings() {
    CHROME_API.storage.local.get([
      "aiProvider",
      "aiApiKeys",
      "geminiModel",
      "openaiModel",
      "claudeModel"
    ], (result) => {
      const state = s();
      if (["gemini", "openai", "claude"].includes(result.aiProvider)) state.aiProvider = result.aiProvider;
      if (result.aiApiKeys) state.aiApiKeys = Object.assign(state.aiApiKeys, result.aiApiKeys);
      if (result.geminiModel) state.geminiModel = result.geminiModel;
      if (result.openaiModel) state.openaiModel = result.openaiModel;
      if (result.claudeModel) state.claudeModel = result.claudeModel;
      updateAiProviderUI();
    });
  }

  function saveAiSettings() {
    const state = s();
    const keyInput = document.getElementById("tt-ai-key-input");
    const modelInput = document.getElementById("tt-ai-model-input");
    state.aiApiKeys[state.aiProvider] = keyInput ? keyInput.value.trim() : "";
    if (modelInput) setProviderModel(state.aiProvider, modelInput.value.trim());

    CHROME_API.storage.local.set({
      aiProvider: state.aiProvider,
      aiApiKeys: state.aiApiKeys,
      geminiModel: state.geminiModel,
      openaiModel: state.openaiModel,
      claudeModel: state.claudeModel
    }, () => {
      const status = document.getElementById("tt-ai-save-status");
      if (!status) return;
      status.textContent = t("saveSuccess");
      setTimeout(() => { status.textContent = ""; }, 1800);
    });
  }

  function updateReplyModeUI() {
    const state = s();
    document.querySelectorAll("[data-reply-mode]").forEach((button) => {
      button.classList.toggle("active", button.dataset.replyMode === state.replyMode);
    });
  }

  function getArticlePostId(article) {
    const links = article.querySelectorAll(q().postLink);
    for (const link of links) {
      const href = link.getAttribute("href");
      const match = href && href.match(/\/post\/([^?#/]+)/);
      if (match) return match[1];
    }
    return null;
  }

  function checkAndHighlight(article) {
    const state = s();
    if (!state.isHighlighting || state.highlightKeywords.length === 0) return;

    const text = (article.innerText || article.textContent || "").toLowerCase();
    const hasMatch = state.highlightKeywords.some((keyword) => {
      return keyword && text.includes(keyword.toLowerCase());
    });
    if (!hasMatch) return;

    const postId = getArticlePostId(article);
    const alreadyCounted = article.classList.contains("tt-highlight-wrapper") ||
      article.classList.contains("tt-replied-wrapper");

    if (postId && state.repliedPostIds.has(postId)) {
      article.classList.remove("tt-highlight-wrapper");
      article.classList.add("tt-replied-wrapper");
      ensureRepliedBadge(article);
    } else {
      article.classList.add("tt-highlight-wrapper");
      article.classList.remove("tt-replied-wrapper");
    }

    if (!alreadyCounted) state.highlightCount += 1;
    injectQuickReplyButton(article, postId);
  }

  function scanAllPosts() {
    document.querySelectorAll(q().postContainer).forEach((article) => checkAndHighlight(article));
  }

  function updatePatrolStatus() {
    const state = s();
    const status = document.getElementById("tt-patrol-status");
    if (!status) return;

    if (!state.isHighlighting) {
      status.textContent = t("statusPatrolOff");
      status.style.color = "var(--tt-text-muted)";
    } else {
      status.textContent = t("statusPatrolOn", [String(state.highlightCount)]);
      status.style.color = "var(--tt-accent)";
    }
  }

  function startHighlight() {
    const state = s();
    loadDictionary();

    const textarea = document.getElementById("tt-keyword-textarea");
    if (!textarea) return;
    const keywords = textarea.value.split("\n").map((line) => line.trim()).filter(Boolean);
    if (keywords.length === 0) {
      alert(t("keywordRequired"));
      return;
    }

    state.highlightKeywords = keywords;
    state.isHighlighting = true;
    state.highlightCount = 0;
    savePatrolKeywords();

    const startButton = document.getElementById("tt-patrol-start");
    const stopButton = document.getElementById("tt-patrol-stop");
    if (startButton) startButton.disabled = true;
    if (stopButton) stopButton.disabled = false;

    scanAllPosts();

    if (state.highlightObserver) state.highlightObserver.disconnect();
    state.highlightObserver = new MutationObserver((mutations) => {
      let found = false;
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          if (node.matches && node.matches(q().postContainer)) {
            checkAndHighlight(node);
            found = true;
          } else if (node.querySelectorAll) {
            node.querySelectorAll(q().postContainer).forEach((article) => {
              checkAndHighlight(article);
              found = true;
            });
          }
        });
      });
      if (found) updatePatrolStatus();
    });
    state.highlightObserver.observe(document.body, { childList: true, subtree: true });
    updatePatrolStatus();
  }

  function stopHighlight() {
    const state = s();
    state.isHighlighting = false;
    if (state.highlightObserver) {
      state.highlightObserver.disconnect();
      state.highlightObserver = null;
    }

    document.querySelectorAll(".tt-highlight-wrapper, .tt-replied-wrapper").forEach((element) => {
      element.classList.remove("tt-highlight-wrapper", "tt-replied-wrapper");
    });
    document.querySelectorAll(".tt-quick-reply-btn, .tt-reply-dropdown, .tt-replied-badge").forEach((element) => {
      element.remove();
    });

    const startButton = document.getElementById("tt-patrol-start");
    const stopButton = document.getElementById("tt-patrol-stop");
    if (startButton) startButton.disabled = false;
    if (stopButton) stopButton.disabled = true;
    updatePatrolStatus();
  }

  function findReplyButton(article) {
    const selector = q().replyButtonSvgs.join(",");
    for (const svg of article.querySelectorAll(selector)) {
      const button = svg.closest("[role=\"button\"], button");
      if (button) return button;
    }
    return null;
  }

  function waitForReplyInput(callback) {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      const input = q().replyInputs
        .map((selector) => document.querySelector(selector))
        .find((candidate) => candidate && candidate.offsetParent !== null);

      if (input) {
        clearInterval(timer);
        callback(input);
        return;
      }

      if (attempts >= 20) {
        clearInterval(timer);
        callback(null);
      }
    }, 150);
  }

  function fillReplyInput(input, text) {
    input.focus();
    try {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(input);
      selection.removeAllRanges();
      selection.addRange(range);
      document.execCommand("insertText", false, text);
      input.dispatchEvent(new InputEvent("input", {
        inputType: "insertText",
        data: text,
        bubbles: true,
        cancelable: true
      }));
    } catch (error) {
      input.textContent = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function executeReply(template, postId, article, modeOverride = null) {
    const state = s();
    const mode = modeOverride || state.replyMode;

    if (mode === "copy") {
      navigator.clipboard.writeText(template).then(() => {
        markAsReplied(postId, article);
        updatePatrolStatus();
      }).catch(() => {
        alert(t("clipboardFailed"));
      });
      return;
    }

    const replyButton = findReplyButton(article);
    if (!replyButton) {
      navigator.clipboard.writeText(template).finally(() => {
        markAsReplied(postId, article);
        updatePatrolStatus();
      });
      return;
    }

    replyButton.click();
    waitForReplyInput((input) => {
      if (!input) {
        navigator.clipboard.writeText(template).finally(() => {
          markAsReplied(postId, article);
          updatePatrolStatus();
        });
        return;
      }
      fillReplyInput(input, template);
      markAsReplied(postId, article);
      updatePatrolStatus();
    });
  }

  function injectQuickReplyButton(article, postId) {
    if (article.querySelector(".tt-quick-reply-btn")) return;

    const button = document.createElement("button");
    button.className = "tt-quick-reply-btn";
    button.type = "button";
    button.textContent = t("btnQuickReply");

    const dropdown = document.createElement("div");
    dropdown.className = "tt-reply-dropdown";
    dropdown.style.display = "none";

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = dropdown.style.display !== "none";
      closeAllDropdowns();
      if (!isOpen) {
        renderDropdown(dropdown, postId, article);
        dropdown.style.display = "block";
      }
    });

    article.appendChild(button);
    article.appendChild(dropdown);
  }

  function renderDropdown(dropdown, postId, article) {
    const state = s();
    dropdown.innerHTML = "";

    const randomItem = document.createElement("div");
    randomItem.className = "tt-reply-item";
    const preview = shortPhrases.length > 0
      ? shortPhrases[Math.floor(Math.random() * shortPhrases.length)]
      : t("randomReply");
    randomItem.textContent = preview;
    randomItem.title = t("randomReplyTitle");
    randomItem.addEventListener("click", async (event) => {
      event.stopPropagation();
      const phrases = await loadDictionary();
      if (phrases.length === 0) {
        alert(t("dictionaryEmpty"));
        return;
      }
      renderRandomConfirmUI(dropdown, phrases, postId, article);
    });
    dropdown.appendChild(randomItem);
    appendSeparator(dropdown);

    const aiItem = document.createElement("div");
    aiItem.className = "tt-reply-item";
    if (!state.aiApiKeys || !state.aiApiKeys[state.aiProvider]) {
      aiItem.textContent = t("aiReplyNoKey");
      aiItem.title = t("aiReplyNoKeyTitle");
      aiItem.style.opacity = "0.48";
      aiItem.style.cursor = "not-allowed";
    } else {
      aiItem.textContent = t("aiReplySuggest");
      aiItem.addEventListener("click", (event) => {
        event.stopPropagation();
        if (window.TT_AI) window.TT_AI.fetchAiReplies(article, postId, dropdown);
      });
    }
    dropdown.appendChild(aiItem);
    appendSeparator(dropdown);

    if (state.replyTemplates.length === 0) {
      const empty = document.createElement("div");
      empty.className = "tt-reply-empty";
      empty.textContent = t("emptyReplyLibrary");
      dropdown.appendChild(empty);
      return;
    }

    state.replyTemplates.forEach((template) => {
      const item = document.createElement("div");
      item.className = "tt-reply-item";
      item.textContent = template;
      item.addEventListener("click", (event) => {
        event.stopPropagation();
        dropdown.style.display = "none";
        executeReply(template, postId, article);
      });
      dropdown.appendChild(item);
    });
  }

  function appendSeparator(container) {
    const separator = document.createElement("div");
    Object.assign(separator.style, {
      borderTop: "1px solid rgba(69, 191, 209, 0.18)",
      margin: "4px 0"
    });
    container.appendChild(separator);
  }

  function renderRandomConfirmUI(dropdown, phrases, postId, article) {
    const pickOne = () => phrases[Math.floor(Math.random() * phrases.length)];
    let currentPhrase = pickOne();

    const render = () => {
      dropdown.innerHTML = "";
      dropdown.style.maxWidth = "310px";

      const title = document.createElement("div");
      title.className = "tt-reply-empty";
      title.textContent = t("randomReplyResult");
      dropdown.appendChild(title);

      const preview = document.createElement("div");
      Object.assign(preview.style, {
        margin: "4px 8px 12px",
        padding: "10px",
        border: "1px solid var(--tt-border)",
        borderRadius: "8px",
        background: "rgba(69, 191, 209, 0.08)",
        color: "var(--tt-text)",
        fontSize: "12px",
        lineHeight: "1.45",
        wordBreak: "break-word"
      });
      preview.textContent = currentPhrase;
      dropdown.appendChild(preview);

      const row = document.createElement("div");
      Object.assign(row.style, { display: "flex", gap: "5px", padding: "0 8px 8px" });

      const rerollButton = createMiniBtn(t("btnReroll"));
      rerollButton.style.flex = "1";
      rerollButton.addEventListener("click", (event) => {
        event.stopPropagation();
        currentPhrase = pickOne();
        render();
      });

      const confirmButton = createMiniBtn(t("btnConfirm"));
      confirmButton.style.flex = "1";
      confirmButton.style.background = "var(--tt-accent)";
      confirmButton.style.color = "#041114";
      confirmButton.addEventListener("click", (event) => {
        event.stopPropagation();
        dropdown.style.display = "none";
        executeReply(currentPhrase, postId, article);
      });

      const cancelButton = createMiniBtn(t("btnCancel"));
      cancelButton.addEventListener("click", (event) => {
        event.stopPropagation();
        dropdown.style.display = "none";
      });

      row.append(rerollButton, confirmButton, cancelButton);
      dropdown.appendChild(row);
    };

    render();
  }

  function ensureRepliedBadge(article) {
    if (article.querySelector(".tt-replied-badge")) return;
    const badge = document.createElement("div");
    badge.className = "tt-replied-badge";
    badge.textContent = t("repliedBadge");
    article.appendChild(badge);
  }

  function markAsReplied(postId, article) {
    if (postId) {
      s().repliedPostIds.add(postId);
      saveRepliedPost(postId);
    }
    article.classList.remove("tt-highlight-wrapper");
    article.classList.add("tt-replied-wrapper");
    ensureRepliedBadge(article);
  }

  function clearRepliedMarkers() {
    const state = s();
    if (!confirm(t("confirmClearMarkers"))) return;
    state.repliedPostIds.clear();
    CHROME_API.storage.local.remove("repliedPostIds");

    document.querySelectorAll(".tt-replied-wrapper").forEach((element) => {
      element.classList.remove("tt-replied-wrapper");
      if (!state.isHighlighting) return;
      const text = (element.innerText || element.textContent || "").toLowerCase();
      const hasMatch = state.highlightKeywords.some((keyword) => keyword && text.includes(keyword.toLowerCase()));
      if (hasMatch) element.classList.add("tt-highlight-wrapper");
    });
    document.querySelectorAll(".tt-replied-badge").forEach((element) => element.remove());
    updatePatrolStatus();
  }

  function renderReplyLibrary() {
    const state = s();
    const list = document.getElementById("tt-reply-list");
    if (!list) return;
    list.innerHTML = "";

    if (state.replyTemplates.length === 0) {
      const empty = document.createElement("div");
      empty.className = "tt-reply-empty";
      empty.textContent = t("emptyReplyLibrary");
      list.appendChild(empty);
      return;
    }

    state.replyTemplates.forEach((template, index) => {
      const row = document.createElement("div");
      row.className = "tt-library-row";

      const text = document.createElement("span");
      text.className = "tt-library-text";
      text.textContent = template;

      const copyButton = createMiniBtn(t("copy"));
      copyButton.addEventListener("click", () => {
        navigator.clipboard.writeText(template);
        copyButton.textContent = t("copied");
        setTimeout(() => { copyButton.textContent = t("copy"); }, 1500);
      });

      const deleteButton = createMiniBtn(t("delete"));
      deleteButton.addEventListener("click", () => {
        state.replyTemplates.splice(index, 1);
        saveReplyTemplates();
        renderReplyLibrary();
      });

      row.append(text, copyButton, deleteButton);
      list.appendChild(row);
    });
  }

  function createMiniBtn(text) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tt-mini-btn";
    button.textContent = text;
    return button;
  }

  function closeAllDropdowns() {
    document.querySelectorAll(".tt-reply-dropdown").forEach((dropdown) => {
      dropdown.style.display = "none";
    });
  }

  function bindUiEvents() {
    const fillKeywords = document.getElementById("tt-patrol-fill-keywords");
    if (fillKeywords) {
      fillKeywords.addEventListener("click", () => {
        const textarea = document.getElementById("tt-keyword-textarea");
        if (textarea) textarea.value = "launch\npricing\nAI workflow\ncreator tools\n潮流觀察";
      });
    }

    document.getElementById("tt-patrol-start")?.addEventListener("click", startHighlight);
    document.getElementById("tt-patrol-stop")?.addEventListener("click", stopHighlight);
    document.getElementById("tt-clear-markers")?.addEventListener("click", clearRepliedMarkers);

    document.querySelectorAll("[data-reply-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        s().replyMode = button.dataset.replyMode;
        saveReplyMode();
        updateReplyModeUI();
      });
    });

    document.getElementById("tt-add-template")?.addEventListener("click", () => {
      const input = document.getElementById("tt-new-template");
      const value = input ? input.value.trim() : "";
      if (!value) return;
      s().replyTemplates.push(value);
      saveReplyTemplates();
      renderReplyLibrary();
      input.value = "";
    });

    document.querySelectorAll("[data-ai-provider]").forEach((button) => {
      button.addEventListener("click", () => {
        const keyInput = document.getElementById("tt-ai-key-input");
        const modelInput = document.getElementById("tt-ai-model-input");
        if (keyInput) s().aiApiKeys[s().aiProvider] = keyInput.value.trim();
        if (modelInput) setProviderModel(s().aiProvider, modelInput.value.trim());
        s().aiProvider = button.dataset.aiProvider;
        updateAiProviderUI();
      });
    });

    document.getElementById("tt-save-ai-settings")?.addEventListener("click", saveAiSettings);
  }

  function initUI(container) {
    if (!container) return;
    container.innerHTML = `
      <div class="tt-row" style="justify-content:space-between;margin-bottom:6px;">
        <span class="tt-field-label" style="margin:0;">${t("patrolHeader")}</span>
        <button id="tt-patrol-fill-keywords" class="tt-btn" type="button">${t("btnFillKeywords")}</button>
      </div>
      <textarea id="tt-keyword-textarea" class="tt-textarea" placeholder="${t("patrolKeywordPlaceholder")}"></textarea>
      <div class="tt-row" style="margin-top:8px;">
        <button id="tt-patrol-start" class="tt-btn tt-btn-primary" type="button" style="flex:1;">${t("btnStartPatrol")}</button>
        <button id="tt-patrol-stop" class="tt-btn" type="button" style="flex:1;" disabled>${t("btnStopPatrol")}</button>
      </div>
      <div id="tt-patrol-status" class="tt-status">${t("statusPatrolOff")}</div>

      <label class="tt-field-label">${t("replyModeLabel")}</label>
      <div class="tt-row">
        <button class="tt-btn tt-mode-btn" data-reply-mode="copy" type="button" style="flex:1;">${t("modeCopy")}</button>
        <button class="tt-btn tt-mode-btn" data-reply-mode="autofill" type="button" style="flex:1;">${t("modeAutofill")}</button>
      </div>

      <label class="tt-field-label">${t("replyLibraryLabel")}</label>
      <div id="tt-reply-list"></div>
      <div class="tt-row" style="margin-top:8px;">
        <input id="tt-new-template" class="tt-input" placeholder="${t("newTemplatePlaceholder")}">
        <button id="tt-add-template" class="tt-btn tt-btn-primary" type="button" style="width:42px;">+</button>
      </div>
      <div class="tt-row" style="margin-top:8px;">
        <button id="tt-clear-markers" class="tt-btn tt-btn-danger" type="button" style="flex:1;">${t("btnClearMarkers")}</button>
      </div>

      <label class="tt-field-label">${t("aiSettingsHeader")}</label>
      <div class="tt-note">${t("aiSettingsNote")}</div>
      <div class="tt-note">${t("byokWarning")}</div>
      <div class="tt-row-wrap" style="margin:8px 0;">
        <button class="tt-btn tt-provider-btn" data-ai-provider="gemini" type="button">${t("providerGemini")}</button>
        <button class="tt-btn tt-provider-btn" data-ai-provider="openai" type="button">${t("providerOpenAI")}</button>
        <button class="tt-btn tt-provider-btn" data-ai-provider="claude" type="button">${t("providerClaude")}</button>
      </div>
      <input id="tt-ai-key-input" class="tt-input" type="password" placeholder="${t("aiApiKeyPlaceholder")}">
      <input id="tt-ai-model-input" class="tt-input" style="margin-top:6px;" placeholder="${t("aiModelLabel")}">
      <div class="tt-row" style="margin-top:8px;">
        <button id="tt-save-ai-settings" class="tt-btn tt-btn-primary" type="button">${t("btnSaveKey")}</button>
        <span id="tt-ai-save-status" class="tt-save-status"></span>
      </div>
    `;

    bindUiEvents();
    loadPatrolData();
    loadAiSettings();
    updatePatrolStatus();
  }

  window.TT_PATROL = {
    initUI,
    loadPatrolData,
    savePatrolKeywords,
    saveReplyTemplates,
    saveReplyMode,
    saveRepliedPost,
    loadAiSettings,
    saveAiSettings,
    updateReplyModeUI,
    startHighlight,
    stopHighlight,
    updatePatrolStatus,
    checkAndHighlight,
    scanAllPosts,
    getArticlePostId,
    executeReply,
    injectQuickReplyButton,
    renderDropdown,
    markAsReplied,
    clearRepliedMarkers,
    renderReplyLibrary,
    createMiniBtn,
    closeAllDropdowns
  };
})();
