(function () {
  "use strict";

  const CHROME_API = typeof browser !== "undefined" ? browser : chrome;
  const s = () => window.TT_STATE;
  const q = () => window.TT_SELECTORS;
  const MINUTE_MS = 60 * 1000;
  const DEFAULT_THROTTLE_WINDOW_MINUTES = 10;
  const DEFAULT_THROTTLE_THRESHOLD = 15;
  let shortPhrases = [];
  let throttleNoticeTimer = null;

  function t(key, placeholders = null) {
    return window.TT_Content.t(key, placeholders);
  }

  function defaultReplyTemplates() {
    const lang = s().currentLang;
    return lang && lang.startsWith("zh")
      ? [...window.TT_DEFAULT_REPLY_TEMPLATES.zh_TW]
      : [...window.TT_DEFAULT_REPLY_TEMPLATES.en];
  }

  function defaultPatrolStats() {
    return {
      ...window.TT_DEFAULT_PATROL_STATS,
      keywordHits: {}
    };
  }

  function normalizeKeywords(value) {
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    return String(value || "").split("\n").map((line) => line.trim()).filter(Boolean);
  }

  function parsePositiveInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  function normalizePatrolStats(value) {
    const base = defaultPatrolStats();
    if (!value || typeof value !== "object") return base;
    return {
      scannedPosts: Math.max(0, Number(value.scannedPosts) || 0),
      highlightedPosts: Math.max(0, Number(value.highlightedPosts) || 0),
      repliedPosts: Math.max(0, Number(value.repliedPosts) || 0),
      skippedPosts: Math.max(0, Number(value.skippedPosts) || 0),
      keywordHits: value.keywordHits && typeof value.keywordHits === "object"
        ? Object.fromEntries(Object.entries(value.keywordHits).map(([key, count]) => [key, Math.max(0, Number(count) || 0)]))
        : {}
    };
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
      "dangerKeywords",
      "replyTemplates",
      "repliedPostIds",
      "replyMode",
      "interactionThrottleWindowMinutes",
      "interactionThrottleThreshold",
      "replyInteractionTimestamps",
      "patrolStats"
    ], (result) => {
      const state = s();

      if (Array.isArray(result.patrolKeywords)) {
        state.highlightKeywords = result.patrolKeywords;
        const textarea = document.getElementById("tt-keyword-textarea");
        if (textarea) textarea.value = state.highlightKeywords.join("\n");
      }

      if (Array.isArray(result.dangerKeywords)) {
        state.dangerKeywords = result.dangerKeywords;
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

      state.interactionThrottleWindowMinutes = parsePositiveInteger(
        result.interactionThrottleWindowMinutes,
        DEFAULT_THROTTLE_WINDOW_MINUTES
      );
      state.interactionThrottleThreshold = parsePositiveInteger(
        result.interactionThrottleThreshold,
        DEFAULT_THROTTLE_THRESHOLD
      );
      state.replyInteractionTimestamps = Array.isArray(result.replyInteractionTimestamps)
        ? result.replyInteractionTimestamps.filter((timestamp) => Number.isFinite(Number(timestamp))).map(Number)
        : [];
      state.patrolStats = normalizePatrolStats(result.patrolStats);

      renderGuardrailSettings();
      renderReplyLibrary();
      renderDashboard();
      updateReplyModeUI();
    });
  }

  function savePatrolKeywords() {
    CHROME_API.storage.local.set({ patrolKeywords: s().highlightKeywords });
  }

  function savePatrolStats() {
    CHROME_API.storage.local.set({ patrolStats: s().patrolStats });
  }

  function collectGuardrailInputs() {
    const state = s();
    const dangerTextarea = document.getElementById("tt-danger-keyword-textarea");
    const windowInput = document.getElementById("tt-throttle-window-input");
    const thresholdInput = document.getElementById("tt-throttle-threshold-input");

    if (dangerTextarea) state.dangerKeywords = normalizeKeywords(dangerTextarea.value);
    state.interactionThrottleWindowMinutes = parsePositiveInteger(
      windowInput ? windowInput.value : state.interactionThrottleWindowMinutes,
      DEFAULT_THROTTLE_WINDOW_MINUTES
    );
    state.interactionThrottleThreshold = parsePositiveInteger(
      thresholdInput ? thresholdInput.value : state.interactionThrottleThreshold,
      DEFAULT_THROTTLE_THRESHOLD
    );

    if (windowInput) windowInput.value = String(state.interactionThrottleWindowMinutes);
    if (thresholdInput) thresholdInput.value = String(state.interactionThrottleThreshold);
  }

  function renderGuardrailSettings() {
    const state = s();
    const dangerTextarea = document.getElementById("tt-danger-keyword-textarea");
    const windowInput = document.getElementById("tt-throttle-window-input");
    const thresholdInput = document.getElementById("tt-throttle-threshold-input");

    if (dangerTextarea) dangerTextarea.value = state.dangerKeywords.join("\n");
    if (windowInput) windowInput.value = String(state.interactionThrottleWindowMinutes);
    if (thresholdInput) thresholdInput.value = String(state.interactionThrottleThreshold);
  }

  function saveGuardrailSettings(showStatus = true) {
    collectGuardrailInputs();
    const state = s();
    CHROME_API.storage.local.set({
      dangerKeywords: state.dangerKeywords,
      interactionThrottleWindowMinutes: state.interactionThrottleWindowMinutes,
      interactionThrottleThreshold: state.interactionThrottleThreshold
    }, () => {
      if (!showStatus) return;
      const status = document.getElementById("tt-guardrail-save-status");
      if (!status) return;
      status.textContent = t("saveSuccess");
      setTimeout(() => { status.textContent = ""; }, 1800);
    });
    if (state.isHighlighting) scanAllPosts();
  }

  function renderDashboard() {
    const stats = s().patrolStats || defaultPatrolStats();
    const values = {
      "tt-stat-scanned": stats.scannedPosts,
      "tt-stat-highlighted": stats.highlightedPosts,
      "tt-stat-replied": stats.repliedPosts,
      "tt-stat-skipped": stats.skippedPosts
    };

    Object.entries(values).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = String(value);
    });

    const rank = document.getElementById("tt-keyword-rank");
    if (!rank) return;
    rank.innerHTML = "";

    const entries = Object.entries(stats.keywordHits || {})
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "tt-reply-empty";
      empty.textContent = t("keywordRankEmpty");
      rank.appendChild(empty);
      return;
    }

    entries.forEach(([keyword, count]) => {
      const row = document.createElement("div");
      row.className = "tt-rank-row";

      const label = document.createElement("span");
      label.textContent = keyword;

      const value = document.createElement("strong");
      value.textContent = String(count);

      row.append(label, value);
      rank.appendChild(row);
    });
  }

  function resetPatrolStats() {
    if (!confirm(t("confirmResetStats"))) return;
    s().patrolStats = defaultPatrolStats();
    savePatrolStats();
    renderDashboard();
  }

  function recordScannedArticle(article) {
    if (article.dataset.ttScanned === "1") return;
    article.dataset.ttScanned = "1";
    const stats = s().patrolStats;
    stats.scannedPosts += 1;
    savePatrolStats();
    renderDashboard();
  }

  function recordSkippedArticle(article) {
    if (article.dataset.ttSkippedStat === "1") return;
    article.dataset.ttSkippedStat = "1";
    const stats = s().patrolStats;
    stats.skippedPosts += 1;
    savePatrolStats();
    renderDashboard();
  }

  function recordHighlightedArticle(article, matchedKeywords) {
    if (article.dataset.ttHighlightedStat === "1") return;
    article.dataset.ttHighlightedStat = "1";
    const stats = s().patrolStats;
    stats.highlightedPosts += 1;
    matchedKeywords.forEach((keyword) => {
      stats.keywordHits[keyword] = (stats.keywordHits[keyword] || 0) + 1;
    });
    savePatrolStats();
    renderDashboard();
  }

  function recordRepliedArticle() {
    const stats = s().patrolStats;
    stats.repliedPosts += 1;
    savePatrolStats();
    renderDashboard();
  }

  function showThrottleNotice(count) {
    const state = s();
    const message = t("throttleWarning", [
      String(state.interactionThrottleWindowMinutes),
      String(count),
      String(state.interactionThrottleThreshold)
    ]);

    const panelNotice = document.getElementById("tt-guardrail-notice");
    if (panelNotice) panelNotice.textContent = message;

    let toast = document.getElementById("tt-throttle-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "tt-throttle-toast";
      toast.className = "tt-throttle-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.hidden = false;

    clearTimeout(throttleNoticeTimer);
    throttleNoticeTimer = setTimeout(() => {
      toast.hidden = true;
    }, 5200);
  }

  function recordReplyInteraction() {
    const state = s();
    const now = Date.now();
    const windowMs = state.interactionThrottleWindowMinutes * MINUTE_MS;

    CHROME_API.storage.local.get(["replyInteractionTimestamps"], (result) => {
      const stored = Array.isArray(result.replyInteractionTimestamps)
        ? result.replyInteractionTimestamps
        : state.replyInteractionTimestamps;
      const recent = stored
        .map(Number)
        .filter((timestamp) => Number.isFinite(timestamp) && now - timestamp <= windowMs);

      recent.push(now);
      state.replyInteractionTimestamps = recent;
      CHROME_API.storage.local.set({ replyInteractionTimestamps: recent });

      if (recent.length >= state.interactionThrottleThreshold) {
        showThrottleNotice(recent.length);
      }
    });
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

  function matchedKeywords(text, keywords) {
    const loweredText = text.toLowerCase();
    return keywords.filter((keyword) => keyword && loweredText.includes(keyword.toLowerCase()));
  }

  function removeArticleControls(article) {
    article.querySelectorAll(".tt-quick-reply-btn, .tt-reply-dropdown, .tt-replied-badge").forEach((element) => {
      element.remove();
    });
  }

  function clearSkippedMarker(article) {
    article.classList.remove("tt-skipped-wrapper");
    article.querySelectorAll(".tt-skipped-badge").forEach((element) => element.remove());
  }

  function ensureSkippedBadge(article) {
    if (article.querySelector(".tt-skipped-badge")) return;
    const badge = document.createElement("div");
    badge.className = "tt-skipped-badge";
    badge.textContent = t("skippedBadge");
    article.appendChild(badge);
  }

  function markAsSkipped(article) {
    article.classList.remove("tt-highlight-wrapper", "tt-replied-wrapper");
    article.classList.add("tt-skipped-wrapper");
    removeArticleControls(article);
    ensureSkippedBadge(article);
    recordSkippedArticle(article);
  }

  function checkAndHighlight(article) {
    const state = s();
    if (!state.isHighlighting || state.highlightKeywords.length === 0) return;

    const text = (article.innerText || article.textContent || "").toLowerCase();
    recordScannedArticle(article);

    if (matchedKeywords(text, state.dangerKeywords).length > 0) {
      markAsSkipped(article);
      return;
    }

    clearSkippedMarker(article);

    const keywordMatches = matchedKeywords(text, state.highlightKeywords);
    if (keywordMatches.length === 0) return;

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

    if (!alreadyCounted) {
      state.highlightCount += 1;
      recordHighlightedArticle(article, keywordMatches);
    }
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
    saveGuardrailSettings(false);

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
    renderDashboard();

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

    document.querySelectorAll(".tt-highlight-wrapper, .tt-replied-wrapper, .tt-skipped-wrapper").forEach((element) => {
      element.classList.remove("tt-highlight-wrapper", "tt-replied-wrapper", "tt-skipped-wrapper");
    });
    document.querySelectorAll(".tt-quick-reply-btn, .tt-reply-dropdown, .tt-replied-badge, .tt-skipped-badge").forEach((element) => {
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
    article.classList.remove("tt-highlight-wrapper", "tt-skipped-wrapper");
    article.querySelectorAll(".tt-skipped-badge").forEach((element) => element.remove());
    article.classList.add("tt-replied-wrapper");
    ensureRepliedBadge(article);
    recordRepliedArticle();
    recordReplyInteraction();
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
    document.getElementById("tt-save-guardrails")?.addEventListener("click", () => saveGuardrailSettings(true));
    document.getElementById("tt-reset-stats")?.addEventListener("click", resetPatrolStats);

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

      <label class="tt-field-label">${t("guardrailHeader")}</label>
      <div class="tt-note">${t("guardrailNote")}</div>
      <textarea id="tt-danger-keyword-textarea" class="tt-textarea tt-textarea-compact" placeholder="${t("dangerKeywordPlaceholder")}"></textarea>
      <div class="tt-row" style="margin-top:8px;">
        <label class="tt-inline-field">
          <span>${t("throttleWindowLabel")}</span>
          <input id="tt-throttle-window-input" class="tt-input" type="number" min="1" value="10">
        </label>
        <label class="tt-inline-field">
          <span>${t("throttleThresholdLabel")}</span>
          <input id="tt-throttle-threshold-input" class="tt-input" type="number" min="1" value="15">
        </label>
      </div>
      <div class="tt-row" style="margin-top:8px;">
        <button id="tt-save-guardrails" class="tt-btn tt-btn-primary" type="button">${t("btnSaveGuardrails")}</button>
        <span id="tt-guardrail-save-status" class="tt-save-status"></span>
      </div>
      <div id="tt-guardrail-notice" class="tt-guardrail-notice" aria-live="polite"></div>

      <label class="tt-field-label">${t("dashboardHeader")}</label>
      <div class="tt-dashboard-grid">
        <div class="tt-stat-box"><span>${t("statScanned")}</span><strong id="tt-stat-scanned">0</strong></div>
        <div class="tt-stat-box"><span>${t("statHighlighted")}</span><strong id="tt-stat-highlighted">0</strong></div>
        <div class="tt-stat-box"><span>${t("statReplied")}</span><strong id="tt-stat-replied">0</strong></div>
        <div class="tt-stat-box"><span>${t("statSkipped")}</span><strong id="tt-stat-skipped">0</strong></div>
      </div>
      <div class="tt-rank-title">${t("keywordRankLabel")}</div>
      <div id="tt-keyword-rank" class="tt-keyword-rank"></div>
      <div class="tt-row" style="margin-top:8px;">
        <button id="tt-reset-stats" class="tt-btn tt-btn-danger" type="button" style="flex:1;">${t("btnResetStats")}</button>
      </div>

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
    saveGuardrailSettings,
    renderDashboard,
    resetPatrolStats,
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
