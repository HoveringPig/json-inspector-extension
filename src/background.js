const MENU_ID = "open-json-inspector-selection";
const HANDOFF_KEY = "selectedText";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Open selection in JSON Inspector",
    contexts: ["selection"],
  });
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: chrome.runtime.getURL("src/formatter.html"),
  });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID) {
    return;
  }

  await chrome.storage.session.set({
    [HANDOFF_KEY]: info.selectionText || "",
  });

  chrome.tabs.create({
    url: chrome.runtime.getURL("src/formatter.html?source=selection"),
  });
});
