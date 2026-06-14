(function () {
  "use strict";

  const DEFAULT_REPLY_TEMPLATES = {
    zh_TW: [
      "謝謝分享，這個觀點很值得參考。",
      "這段整理很清楚，我先收藏起來。",
      "同意，尤其是你提到的那個重點。",
      "這讓我想到另一個角度，也許可以再延伸討論。",
      "很實用的提醒，感謝補充。"
    ],
    en: [
      "Thanks for sharing. This is a useful perspective.",
      "Clear summary. Saving this for later.",
      "I agree, especially with the point you highlighted.",
      "This opens up another angle worth discussing.",
      "Helpful note. Thanks for adding it."
    ]
  };

  const DEFAULT_PATROL_STATS = {
    scannedPosts: 0,
    highlightedPosts: 0,
    repliedPosts: 0,
    skippedPosts: 0,
    keywordHits: {}
  };

  window.TT_DEFAULT_REPLY_TEMPLATES = DEFAULT_REPLY_TEMPLATES;
  window.TT_DEFAULT_PATROL_STATS = DEFAULT_PATROL_STATS;

  window.TT_STATE = {
    currentLang: "zh_TW",
    messagesCache: null,
    messagesFallbackCache: null,
    highlightObserver: null,
    isHighlighting: false,
    highlightKeywords: [],
    dangerKeywords: [],
    highlightCount: 0,
    repliedPostIds: new Set(),
    replyTemplates: [],
    replyMode: "autofill",
    interactionThrottleWindowMinutes: 10,
    interactionThrottleThreshold: 15,
    replyInteractionTimestamps: [],
    patrolStats: { ...DEFAULT_PATROL_STATS, keywordHits: {} },
    aiProvider: "gemini",
    aiApiKeys: {
      gemini: "",
      openai: "",
      claude: ""
    },
    geminiModel: "gemini-2.0-flash",
    openaiModel: "gpt-4o-mini",
    claudeModel: "claude-3-5-sonnet-latest"
  };
})();
