// Background script - runs in the background
console.log('Background script loaded');

// Store the log tab ID when it's created
let logTabId = null;

// Simple message deduplication cache
const messageCache = {};

// Keep track of tabs with active content scripts
const contentScriptTabs = {};

// Example of using chrome API
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

// Function to open and focus the log tab (when user explicitly wants to view it)
function openAndFocusLogTab() {
  return new Promise((resolve) => {
    // Check if we already have a log tab open
    if (logTabId !== null) {
      // Check if the tab still exists
      chrome.tabs.get(logTabId, (tab) => {
        if (chrome.runtime.lastError) {
          // Tab doesn't exist anymore, create a new one
          createNewLogTab(true).then(resolve);
        } else {
          // Tab exists, focus it
          chrome.tabs.update(logTabId, { active: true }, () => {
            resolve(logTabId);
          });
        }
      });
    } else {
      // No log tab yet, create a new one and focus it
      createNewLogTab(true).then(resolve);
    }
  });
}

// Function to ensure log tab exists without focusing it (for sending updates)
function ensureLogTabExists() {
  return new Promise((resolve) => {
    // Check if we already have a log tab open
    if (logTabId !== null) {
      // Check if the tab still exists
      chrome.tabs.get(logTabId, (tab) => {
        if (chrome.runtime.lastError) {
          // Tab doesn't exist anymore, create a new one without focusing
          console.log("Log tab no longer exists, creating new one");
          createNewLogTab(false).then(resolve);
        } else {
          // Tab exists, don't focus it, just return its id
          console.log("Using existing log tab:", logTabId);
          resolve(logTabId);
        }
      });
    } else {
      // No log tab yet, create a new one without focusing
      console.log("No log tab exists yet, creating new one");
      createNewLogTab(false).then(resolve);
    }
  });
}

// Function to create a new log tab
function createNewLogTab(shouldFocus = false) {
  return new Promise((resolve) => {
    // Create the tab
    chrome.tabs.create({ 
      url: 'log.html',
      active: shouldFocus // Only focus if explicitly requested
    }, (tab) => {
      logTabId = tab.id;
      console.log('Tab created with ID:', tab.id);
      
      // Monitor when the tab is completely loaded
      function checkTabReady(attempt = 0) {
        if (attempt > 20) {  // Give up after 20 attempts (10 seconds)
          console.warn("Tab ready check timed out after 20 attempts");
          resolve(tab.id);
          return;
        }
        
        try {
          chrome.tabs.sendMessage(tab.id, { ping: true }, function(response) {
            if (chrome.runtime.lastError) {
              // Tab isn't ready yet, try again after a delay
              console.log(`Tab not ready yet (attempt ${attempt+1}), retrying...`);
              setTimeout(() => checkTabReady(attempt + 1), 500);
              return;
            }
            
            if (response && response.pong) {
              // Tab is ready!
              console.log("Tab is ready to receive messages");
              resolve(tab.id);
            } else {
              // Unexpected response, try again
              setTimeout(() => checkTabReady(attempt + 1), 500);
            }
          });
        } catch (e) {
          // Error likely means tab is not ready
          setTimeout(() => checkTabReady(attempt + 1), 500);
        }
      }
      
      // Start checking if tab is ready after a brief initial delay
      setTimeout(() => checkTabReady(), 500);
    });
  });
}

// Example of listening for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
  
  if (message.action === 'getData') {
    // Example response
    sendResponse({ result: 'Data from background script' });
  }
  
  if (message.action === 'contentScriptReady') {
    // Record that this tab has a ready content script
    if (sender.tab && sender.tab.id) {
      contentScriptTabs[sender.tab.id] = {
        timestamp: Date.now(),
        url: message.url || sender.tab.url
      };
      console.log('Content script ready in tab:', sender.tab.id);
    }
    sendResponse({ success: true });
  }
  
  if (message.action === 'openLogTab') {
    // Open and focus the log tab when explicitly requested by the user
    openAndFocusLogTab().then((tabId) => {
      sendResponse({ success: true, tabId: tabId });
    });
    return true; // Keep the message channel open for the async response
  }
  
  if (message.action === 'fetchTunisD1' && message.url) {
    console.log('Background script fetching Tunis D1 content from:', message.url);
    
    fetch(message.url)
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to fetch content');
        }
        return response.text();
      })
      .then(html => {
        sendResponse({ success: true, html: html });
      })
      .catch(error => {
        console.error('Background script fetch error:', error);
        sendResponse({ success: false, error: error.message });
      });
      
    return true; // Keep the message channel open for the async response
  }
  
  if (message.action === 'logScoreChange') {
    // Add a unique message ID if it doesn't have one
    if (!message.messageId) {
      message.messageId = Date.now() + '-' + Math.random().toString(36).substring(2, 10);
    }
    
    try {
      // Simple deduplication using a cache of recent message IDs
      const now = Date.now();
      const messageKey = JSON.stringify(message.data);
      
      // Check for duplicates
      if (messageCache[messageKey] && (now - messageCache[messageKey] < 2000)) {
        console.log('Duplicate message detected - ignoring');
        sendResponse({ success: true, duplicate: true });
        return true;
      }
      
      // Record this message
      messageCache[messageKey] = now;
      
      // Cleanup old messages from cache
      Object.keys(messageCache).forEach(key => {
        if (now - messageCache[key] > 10000) {
          delete messageCache[key];
        }
      });
      
      // Make sure the log tab exists without focusing it
      ensureLogTabExists().then((tabId) => {
        // First check if the tab is fully loaded
        chrome.tabs.get(tabId, (tab) => {
          if (chrome.runtime.lastError || !tab) {
            console.error("Tab not found:", chrome.runtime.lastError);
            sendResponse({ success: false, error: "Log tab not found" });
            return;
          }

          // Wait a moment to ensure the page is loaded
          setTimeout(() => {
            try {
              // Try to send the message with proper error handling
              chrome.tabs.sendMessage(tabId, { ping: true }, function(pingResponse) {
                if (chrome.runtime.lastError) {
                  console.log("Tab exists but page not ready yet. Creating new tab.");
                  // Tab exists but content script not ready, create a new tab
                  logTabId = null; // Reset so we create a new one
                  createNewLogTab(false).then(newTabId => {
                    // Store message to send once tab is ready
                    setTimeout(() => {
                      chrome.tabs.sendMessage(newTabId, message, (response) => {
                        sendResponse(response || { success: true });
                      });
                    }, 1000);
                  });
                } else {
                  // Tab is responsive, send our actual message
                  chrome.tabs.sendMessage(tabId, message, (response) => {
                    sendResponse(response || { success: true });
                  });
                }
              });
            } catch (err) {
              console.error("Exception sending message to tab:", err);
              sendResponse({ success: false, error: err.message });
            }
          }, 100);
        });
      }).catch(err => {
        console.error("Error ensuring log tab exists:", err);
        sendResponse({ success: false, error: err.message });
      });
    } catch (err) {
      console.error("General error in logScoreChange handler:", err);
      sendResponse({ success: false, error: err.message });
    }
    
    return true; // Keep the message channel open for the async response
  }
  
  // Return true to indicate you want to send a response asynchronously
  return true;
});