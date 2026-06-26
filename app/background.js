/* World Sex Map — background service worker; opens the full-tab map on icon click. */
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('sex.html') });
});
