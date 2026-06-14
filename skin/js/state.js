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

  window.TT_DEFAULT_REPLY_TEMPLATES = DEFAULT_REPLY_TEMPLATES;

  window.TT_STATE = {
    currentLang: "zh_TW",
    messagesCache: null,
    highlightObserver: null,
    isHighlighting: false,
    highlightKeywords: [],
    highlightCount: 0,
    repliedPostIds: new Set(),
    replyTemplates: [],
    replyMode: "autofill",
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
