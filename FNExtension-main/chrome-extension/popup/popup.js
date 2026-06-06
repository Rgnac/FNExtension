// Popup script - runs when the popup is opened
document.addEventListener('DOMContentLoaded', () => {
  console.log('Popup loaded');
  
  // Get references to DOM elements
  const actionButton = document.getElementById('actionButton');
  const openLogButton = document.getElementById('openLogButton');
  const statusElement = document.getElementById('status');
  
  // Check if content script is ready by sending a ping message
  function checkContentScriptReady(tabId) {
    return new Promise((resolve) => {
      console.log("Checking if content script is ready in tab", tabId);
      let resolved = false;
      
      try {
        // Send ping message to content script
        chrome.tabs.sendMessage(tabId, { ping: true }, (response) => {
          if (chrome.runtime.lastError) {
            console.log("Error checking content script:", chrome.runtime.lastError);
            if (!resolved) {
              resolved = true;
              resolve(false);
            }
            return;
          }
          
          console.log("Received response from content script:", response);
          if (!resolved) {
            resolved = true;
            resolve(response && response.pong === true);
          }
        });
        
        // Set timeout in case we don't get a response
        setTimeout(() => {
          if (!resolved) {
            console.log("Timeout waiting for content script response");
            resolved = true;
            resolve(false);
          }
        }, 2000); // Extended timeout
      } catch (e) {
        console.error("Exception checking content script:", e);
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      }
    });
  }
  
  // Add click event listener to the button
  actionButton.addEventListener('click', () => {
    // Show action in progress
    statusElement.textContent = 'Processing...';
    
    // Get the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        statusElement.textContent = 'Error: No active tab found';
        return;
      }
      
      const activeTab = tabs[0];
      
      // First check if content script is ready
      checkContentScriptReady(activeTab.id).then(isReady => {
        if (!isReady) {
          statusElement.textContent = 'Content script not ready. Trying to inject it...';
          
          // Try to inject the content script regardless of site
          injectContentScript(activeTab.id).then(injected => {
            if (injected) {
              // Verify it's ready after a brief delay
              setTimeout(() => {
                checkContentScriptReady(activeTab.id).then(readyNow => {
                  if (readyNow) {
                    statusElement.textContent = 'Content script injected successfully!';
                    // Now try to initialize
                    sendInitMessage(activeTab.id);
                  } else {
                    offerRefresh(activeTab.id);
                  }
                });
              }, 500);
            } else {
              offerRefresh(activeTab.id);
            }
          });
          return;
        }
        
        try {
          // Send message to content script with error handling
          chrome.tabs.sendMessage(
            activeTab.id,
            { action: 'performAction' },
            (response) => {
              // Check for error
              const error = chrome.runtime.lastError;
              if (error) {
                console.error('Error sending message:', error);
                statusElement.textContent = 'Error: ' + (error.message || 'Unknown error');
                return;
              }
              
              // Handle response from content script
              if (response && response.success) {
                statusElement.textContent = 'Action completed successfully!';
              } else {
                statusElement.textContent = 'Action failed. Please try again.';
              }
              
              // Clear status message after 3 seconds
              setTimeout(() => {
                statusElement.textContent = '';
              }, 3000);
            }
          );
        } catch (err) {
          console.error('Error in action button handler:', err);
          statusElement.textContent = 'Error: ' + err.message;
        }
      });
    });
  });
  
  // Function to inject content script manually
  function injectContentScript(tabId) {
    return new Promise((resolve) => {
      try {
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        }, (results) => {
          if (chrome.runtime.lastError) {
            console.error("Error injecting content script:", chrome.runtime.lastError);
            resolve(false);
          } else {
            console.log("Content script injected successfully:", results);
            resolve(true);
          }
        });
      } catch (e) {
        console.error("Exception injecting content script:", e);
        resolve(false);
      }
    });
  }
  
  // Function to send initialization message
  function sendInitMessage(tabId) {
    try {
      chrome.tabs.sendMessage(
        tabId,
        { action: 'performAction' },
        (response) => {
          const error = chrome.runtime.lastError;
          if (error) {
            console.error('Error sending init message:', error);
            statusElement.textContent = 'Error: ' + (error.message || 'Unknown error');
          } else if (response && response.success) {
            statusElement.textContent = 'Action completed successfully!';
          } else {
            statusElement.textContent = 'Action failed. Please try again.';
          }
          
          // Clear status message after 3 seconds
          setTimeout(() => {
            statusElement.textContent = '';
          }, 3000);
        }
      );
    } catch (err) {
      console.error('Error sending init message:', err);
      statusElement.textContent = 'Error: ' + err.message;
    }
  }
  
  // Function to offer page refresh
  function offerRefresh(tabId) {
    statusElement.textContent = 'Content script not ready. Refresh the page and try again.';
    
    // Offer to refresh the page
    setTimeout(() => {
      if (confirm('Content script not ready. Would you like to refresh the page?')) {
        chrome.tabs.reload(tabId, {}, function() {
          statusElement.textContent = 'Page refreshed. Please try again in a moment.';
        });
      }
    }, 500);
  }
  
  // You can also send messages to the background script
  function sendMessageToBackground() {
    chrome.runtime.sendMessage({ action: 'popupOpened' }, (response) => {
      console.log('Background response:', response);
    });
  }
  
  // Add click event listener to the log button
  openLogButton.addEventListener('click', () => {
    // Open the log tab
    chrome.runtime.sendMessage({ action: 'openLogTab' }, (response) => {
      if (response && response.success) {
        console.log('Log tab opened with ID:', response.tabId);
      }
    });
  });
  
  // Add debug button event listener
  const debugButton = document.getElementById('debugButton');
  debugButton.addEventListener('click', () => {
    // Get the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      
      // First check if content script is ready
      checkContentScriptReady(activeTab.id).then(isReady => {
        if (!isReady) {
          statusElement.textContent = 'Content script not ready. Please refresh the page.';
          return;
        }
        
        // Ensure content script is initialized first
        chrome.tabs.sendMessage(
          activeTab.id,
          { action: 'performAction' },
          () => {
            // Now trigger the debug test
            chrome.tabs.sendMessage(
              activeTab.id,
              { action: 'debugTest' },
              (response) => {
                if (response && response.success) {
                  statusElement.textContent = 'Debug test triggered!';
                  setTimeout(() => {
                    statusElement.textContent = '';
                  }, 3000);
                }
              }
            );
          }
        );
      });
    });
  });
  
  // Add reset button event listener
  const resetButton = document.getElementById('resetButton');
  resetButton.addEventListener('click', () => {
    // Get the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      
      // First check if content script is ready
      checkContentScriptReady(activeTab.id).then(isReady => {
        if (!isReady) {
          statusElement.textContent = 'Content script not ready. Please refresh the page.';
          return;
        }
        
        // Reset the extension state
        chrome.tabs.sendMessage(
          activeTab.id,
          { action: 'reset' },
          (response) => {
            if (response && response.success) {
              statusElement.textContent = 'Extension reset successfully!';
              setTimeout(() => {
                statusElement.textContent = '';
              }, 3000);
            }
          }
        );
      });
    });
  });
  
  // Call the function to send a message to background
  sendMessageToBackground();
});