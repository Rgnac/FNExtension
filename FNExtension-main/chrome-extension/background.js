// Background script - runs in the background
console.log('Background script loaded');

// Import German scraper background functionality
importScripts('german-scraper-background.js');

// Store the log tab ID when it's created
let logTabId = null;

// Simple message deduplication cache
const messageCache = {};

// Tab validation interval
let tabValidationInterval = null;

// Function to periodically validate that our log tab reference is correct
function startTabValidation() {
  // Clear any existing interval
  if (tabValidationInterval) {
    clearInterval(tabValidationInterval);
  }
  
  // Set up new interval (check every 30 seconds)
  tabValidationInterval = setInterval(() => {
    if (logTabId) {
      // Find all log.html tabs
      chrome.tabs.query({url: chrome.runtime.getURL('log.html')}, (tabs) => {
        // If our stored tab ID doesn't match any existing tab, reset it
        const tabExists = tabs.some(tab => tab.id === logTabId);
        if (!tabExists && tabs.length > 0) {
          console.log(`Log tab ID (${logTabId}) not found but another log tab exists, updating reference`);
          logTabId = tabs[0].id;
        } else if (!tabExists) {
          console.log(`Log tab ID (${logTabId}) not valid anymore, clearing reference`);
          logTabId = null;
        }
      });
    }
  }, 30000); // Every 30 seconds
}

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
    // First try to find any existing log.html tabs, regardless of our stored ID
    chrome.tabs.query({url: chrome.runtime.getURL('log.html')}, (tabs) => {
      if (tabs && tabs.length > 0) {
        // Found existing log tab(s), use the first one
        logTabId = tabs[0].id; // Update our stored tab ID
        console.log("Found existing log tab:", logTabId);
        resolve(logTabId);
        return;
      }
      
      // No tab found in query, check our stored reference
      if (logTabId !== null) {
        // Double-check if the tab still exists
        chrome.tabs.get(logTabId, (tab) => {
          if (chrome.runtime.lastError || !tab) {
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
  });
}

// Function to create a new log tab
function createNewLogTab(shouldFocus = false) {
  return new Promise((resolve) => {
    // First, check if there's already a log tab that we might have missed
    chrome.tabs.query({url: chrome.runtime.getURL('log.html')}, (tabs) => {
      if (tabs && tabs.length > 0) {
        // Found existing log tab, use it instead of creating a new one
        logTabId = tabs[0].id;
        console.log('Found existing log tab to use:', logTabId);
        
        // If requested to focus, do that
        if (shouldFocus) {
          chrome.tabs.update(logTabId, { active: true });
        }
        
        // Check if it's ready
        checkTabReady(logTabId, 0, resolve);
        return;
      }
      
      // No existing log tab found, create a new one
      chrome.tabs.create({ 
        url: 'log.html',
        active: shouldFocus // Only focus if explicitly requested
      }, (tab) => {
        logTabId = tab.id;
        console.log('New tab created with ID:', tab.id);
        
        // Monitor when the tab is completely loaded
        checkTabReady(tab.id, 0, resolve);
      });
    });
  });
}

// Helper function to check if a tab is ready
function checkTabReady(tabId, attempt, resolveCallback) {
  if (attempt > 20) {  // Give up after 20 attempts (10 seconds)
    console.warn("Tab ready check timed out after 20 attempts");
    resolveCallback(tabId);
    return;
  }
  
  try {
    chrome.tabs.sendMessage(tabId, { ping: true }, function(response) {
      if (chrome.runtime.lastError) {
        // Tab isn't ready yet, try again after a delay
        console.log(`Tab not ready yet (attempt ${attempt+1}), retrying...`);
        setTimeout(() => checkTabReady(tabId, attempt + 1, resolveCallback), 500);
        return;
      }
      
      if (response && response.pong) {
        // Tab is ready!
        console.log("Tab is ready to receive messages");
        resolveCallback(tabId);
      } else {
        // Unexpected response, try again
        setTimeout(() => checkTabReady(tabId, attempt + 1, resolveCallback), 500);
      }
    });
  } catch (e) {
    // Error likely means tab is not ready
    console.error("Error checking tab:", e);
    setTimeout(() => checkTabReady(tabId, attempt + 1, resolveCallback), 500);
  }
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
  
  if (message.action === 'ensureLogTabExists') {
    console.log('Ensuring log tab exists (without focusing)');
    ensureLogTabExists().then((tabId) => {
      sendResponse({ success: true, tabId: tabId });
    }).catch(err => {
      console.error('Error ensuring log tab exists:', err);
      sendResponse({ success: false, error: err.message });
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
                  console.log("Tab exists but page not ready yet. Waiting for tab to load...");
                  
                  // Instead of creating a new tab, try to wait for this one to load
                  let retryCount = 0;
                  const maxRetries = 10;
                  
                  function retryPing() {
                    retryCount++;
                    if (retryCount > maxRetries) {
                      console.error("Tab failed to respond after multiple attempts");
                      // As last resort, create a new tab
                      logTabId = null;
                      createNewLogTab(false).then(newTabId => {
                        setTimeout(() => {
                          chrome.tabs.sendMessage(newTabId, message, (response) => {
                            sendResponse(response || { success: true });
                          });
                        }, 1000);
                      });
                      return;
                    }
                    
                    console.log(`Retry attempt ${retryCount}/${maxRetries}...`);
                    chrome.tabs.sendMessage(tabId, { ping: true }, function(retryResponse) {
                      if (chrome.runtime.lastError || !retryResponse || !retryResponse.pong) {
                        // Still not ready, retry after delay
                        setTimeout(retryPing, 500);
                      } else {
                        // Tab is now responsive, send our message
                        console.log("Tab now responsive after retrying");
                        chrome.tabs.sendMessage(tabId, message, (response) => {
                          sendResponse(response || { success: true });
                        });
                      }
                    });
                  }
                  
                  // Start retry process
                  setTimeout(retryPing, 500);
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

// Start tab validation when background script loads
startTabValidation();

// Listen for tab removal to update our log tab ID if needed
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (tabId === logTabId) {
    console.log("Log tab was closed, clearing reference");
    logTabId = null;
    
    // Check if there's another log tab we can use
    chrome.tabs.query({url: chrome.runtime.getURL('log.html')}, (tabs) => {
      if (tabs && tabs.length > 0) {
        logTabId = tabs[0].id;
        console.log("Found another log tab to use:", logTabId);
      }
    });
  }
});