chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.runtime.onInstalled.addListener(() => {
  console.log('OmniPanel extension installed');
});

// Relay messages from sidepanel to content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'INJECT_TEXT') {
    // Broadcast to all active tabs and frames
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, message).catch(err => {
            // Ignore errors for tabs where content script isn't running
          });
        }
      });
    });
  }
});
