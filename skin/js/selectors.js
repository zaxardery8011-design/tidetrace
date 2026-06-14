(function () {
  "use strict";

  /*
   * Threads DOM is a moving target. Keep every page selector in this file so
   * site changes can be repaired here without touching patrol or AI logic.
   */
  window.TT_SELECTORS = {
    postContainer: "div[data-pressable-container=\"true\"]",
    postLink: "a[href*=\"/post/\"]",
    replyButtonSvgs: [
      "svg[aria-label*=\"回覆\"]",
      "svg[aria-label*=\"回复\"]",
      "svg[aria-label*=\"Reply\"]",
      "svg[aria-label*=\"返信\"]",
      "svg[aria-label*=\"Responder\"]",
      "svg[aria-label*=\"답글\"]",
      "svg[aria-label*=\"Trả lời\"]"
    ],
    replyInputs: [
      "[role=\"textbox\"][contenteditable=\"true\"]",
      "div[contenteditable=\"true\"][data-lexical-editor]",
      "div[contenteditable=\"true\"]"
    ],
    submitButtonTexts: [
      "回覆",
      "發佈",
      "傳送",
      "送出",
      "Reply",
      "Post",
      "Responder",
      "返信",
      "답글",
      "Trả lời"
    ],
    textNoise: [
      "svg",
      "[role=\"button\"]",
      "time",
      ".tt-quick-reply-btn",
      ".tt-reply-dropdown",
      ".tt-replied-badge"
    ]
  };
})();
