(() => {
  "use strict";

  function isSupportedUrl(url) {
    return typeof url === "string" && (
      url.includes("threads.net") || url.includes("threads.com")
    );
  }

  function syncActionState(tabId, url) {
    if (!tabId) return;
    if (isSupportedUrl(url)) {
      chrome.action.enable(tabId);
    } else {
      chrome.action.disable(tabId);
    }
  }

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url || changeInfo.status === "loading") {
      syncActionState(tabId, tab && tab.url);
    }
  });

  chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
      if (chrome.runtime.lastError) return;
      syncActionState(activeInfo.tabId, tab && tab.url);
    });
  });
})();
