chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: "index.html" });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'open_manager') {
    chrome.tabs.create({ url: "index.html" });
    if (sendResponse) sendResponse({ success: true });
  }
});
