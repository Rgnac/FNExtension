// Log page script
let logCount = 0;

// Simple in-memory cache for message deduplication
const processedMessages = {};

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Log page received message:', message);
  
  // Handle ping messages for checking if the page is ready
  if (message.ping === true) {
    console.log("Received ping - responding");
    sendResponse({ pong: true, ready: true });
    return true;
  }
  
  try {
    if (message.action === 'logScoreChange') {
      // Use message ID or create a content hash for deduplication
      const messageKey = message.messageId || 
                        JSON.stringify(message.data);
      
      // Check for duplicates (only in the last 5 seconds)
      const now = Date.now();
      if (processedMessages[messageKey] && 
          (now - processedMessages[messageKey] < 5000)) {
        console.log('Duplicate message detected in log.js - ignoring');
        sendResponse({ success: true, duplicate: true });
        return true;
      }
      
      // Mark this message as processed with timestamp
      processedMessages[messageKey] = now;
      
      // Add the log entry
      addLogEntry(message.data);
      
      // Clean up old entries
      for (const key in processedMessages) {
        if (now - processedMessages[key] > 30000) { // 30 seconds
          delete processedMessages[key];
        }
      }
      
      // Send success response
      sendResponse({ success: true });
    }
  } catch (error) {
    console.error('Error processing message:', error);
    sendResponse({ success: false, error: error.message });
  }
  
  return true; // Keep the message channel open for async responses
});

// Function to add a log entry to the page
function addLogEntry(data) {
  const logsContainer = document.getElementById('logs');
  
  // Remove the "no logs" message if it's the first log
  if (logCount === 0) {
    logsContainer.innerHTML = '';
  }
  
  // Create log entry element
  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry';
  if (data.isScoreChange) {
    logEntry.classList.add('highlight');
  }
  
  // Create timestamp
  const timestamp = document.createElement('div');
  timestamp.className = 'timestamp';
  timestamp.textContent = new Date().toLocaleString();
  
  // Create content
  const content = document.createElement('div');
  content.className = 'content';
  
  // Build content HTML based on data
  if (data.eventName) {
    const eventName = document.createElement('div');
    eventName.className = 'event-name';
    eventName.textContent = data.eventName;
    content.appendChild(eventName);
  }
  
  if (data.score) {
    const score = document.createElement('div');
    score.className = data.isScoreChange ? 'score changed' : 'score';
    score.textContent = data.score;
    content.appendChild(score);
  }
  
  if (data.message) {
    const message = document.createElement('div');
    message.className = 'event-message';
    
    // Check if the message contains HTML (like bold tags)
    if (data.isHtml) {
      message.innerHTML = data.message;
    } else {
      message.textContent = data.message;
    }
    
    content.appendChild(message);
  }
  
  // Append all elements
  logEntry.appendChild(timestamp);
  logEntry.appendChild(content);
  logsContainer.insertBefore(logEntry, logsContainer.firstChild);
  
  logCount++;
}

// Send a message to the background script to let it know the log page is ready
chrome.runtime.sendMessage({ action: 'logPageReady' });

// Function to add a startup message
function addStartupMessage() {
  addLogEntry({
    message: 'Log page opened and ready to receive score change notifications.',
    isScoreChange: false
  });
}

// Add a startup message when the page loads
document.addEventListener('DOMContentLoaded', () => {
  // Add startup message
  addStartupMessage();
  
  // Let the background script know we're ready (simple approach)
  chrome.runtime.sendMessage({ 
    action: 'logPageReady',
    timestamp: Date.now()
  });
});