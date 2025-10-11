// Content script - runs on web pages
console.log('Content script loaded at ' + new Date().toISOString());

// Global variables to prevent multiple initializations
let isInitialized = false;
let globalProcessingEvent = false;
let lastGlobalEventTime = 0;
let observerMap = new Map(); // Store observers by element to prevent duplicates

// Send a message to the background script to notify that content script is ready
chrome.runtime.sendMessage({
  action: 'contentScriptReady',
  timestamp: Date.now(),
  url: window.location.href
}, (response) => {
  console.log('Background notified that content script is ready:', response);
});

// Global audio for sound notification
const sound = new Audio(chrome.runtime.getURL('sounds/button-44.mp3'));
sound.preload = 'auto';

// Global object to store all message handlers
const messageHandlers = {
  // Initialize the extension
  performAction: function(message, sender, sendResponse) {
    if (!isInitialized) {
      console.log("Initializing Fonbet notification");
      isInitialized = true;
      initFonbetNotification();
      sendResponse({ success: true });
    } else {
      console.log("Already initialized - ignoring duplicate initialization request");
      sendResponse({ success: true, alreadyInitialized: true });
    }
  },
  
  // Trigger a test event for debugging
  debugTest: function(message, sender, sendResponse) {
    console.log("Debug test triggered");
    debugTriggerTestEvent();
    sendResponse({ success: true });
  },
  
  // Reset the extension state
  reset: function(message, sender, sendResponse) {
    console.log("Resetting extension state");
    isInitialized = false;
    globalProcessingEvent = false;
    lastGlobalEventTime = 0;
    
    // Clean up observers
    observerMap.forEach((observer) => {
      observer.disconnect();
    });
    observerMap.clear();
    
    sendResponse({ success: true });
  }
};

// Unified message listener that routes to appropriate handlers
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  console.log("Message received in content script:", message);
  
  // Handle ping messages quickly to check if content script is responsive
  if (message.ping === true) {
    console.log("Received ping - responding immediately with pong");
    sendResponse({ pong: true });
    return true;
  }
  
  const handler = messageHandlers[message.action];
  if (handler) {
    handler(message, sender, sendResponse);
  } else {
    console.error("Unknown action:", message.action);
    sendResponse({ success: false, error: "Unknown action" });
  }
  
  // Return true to indicate you want to send a response asynchronously
  return true;
});

// Function to log score changes to a dedicated tab
function logScoreChange(data) {
  try {
    // Global rate limit to prevent duplicates
    const now = Date.now();
    if (now - lastGlobalEventTime < 1000) {
      console.log("Rate limited event - ignoring");
      return;
    }
    
    // Update the last event time
    lastGlobalEventTime = now;
    
    // Add a unique message ID to help with deduplication
    const messageId = `${now}-${Math.random().toString(36).substring(2, 10)}`;
    
    console.log("Attempting to log score change:", data);
    
    // Make sure the log tab exists first
    chrome.runtime.sendMessage({
      action: 'ensureLogTabExists'
    }, (logTabResponse) => {
      console.log("Log tab check response:", logTabResponse);
      
      // Now send the actual score change message
      chrome.runtime.sendMessage({
        action: 'logScoreChange',
        messageId: messageId,
        data: data
      }, (response) => {
        if (response && response.success) {
          console.log('Score change logged successfully');
        } else {
          console.warn('Log response issue:', response);
          
          // Try once more with a delay if it failed
          setTimeout(() => {
            chrome.runtime.sendMessage({
              action: 'logScoreChange',
              messageId: messageId,
              data: data,
              retry: true
            });
          }, 1000);
        }
      });
    });
    
    // Safety timeout to ensure processing completes
    setTimeout(() => {
      console.log('Ensuring message processing is complete');
    }, 3000);
    
    // Remove reference to non-existent sendMessagePromise
    // No need to wait for any promise, we're using callbacks
  } catch (error) {
    console.error('Error in logScoreChange:', error);
  }
}

// Function to change the background color to red for 5 seconds and then smoothly revert over 2 seconds
function flashBackgroundRed(parentElement) {
  const originalBackground = window.getComputedStyle(parentElement).backgroundColor;
  
  // Set a transition for the background color (for smooth reverting over 2 seconds)
  parentElement.style.transition = 'background-color 2s ease';

  // Change background to red
  parentElement.style.backgroundColor = 'red';

  // Play the sound
  sound.play();

  // After 5 seconds, revert the background color smoothly over 2 seconds
  setTimeout(() => {
    parentElement.style.backgroundColor = originalBackground;
  }, 5000);
}

// Function to safely process score changes with a global lock to prevent duplicates
function processSafeScoreChange(scoreChild, parentDiv, currentScore, sportEventName, scoringTeam = "unknown") {
  // If we're already processing an event, ignore this one
  if (globalProcessingEvent) {
    console.log("Already processing an event - ignoring duplicate");
    return;
  }
  
  // Set the global lock - this helps prevent doubled events
  globalProcessingEvent = true;
  console.log("Global lock set - processing score change");
  
  // Use a static variable to track processed scores to prevent duplicates
  processSafeScoreChange.lastProcessedScore = processSafeScoreChange.lastProcessedScore || {};
  
  // Create a unique key for this score+event combination
  const eventKey = `${currentScore}-${sportEventName}`;
  const now = Date.now();
  const lastProcessedTime = processSafeScoreChange.lastProcessedScore[eventKey] || 0;
  
  // If we've processed this exact score+event combination recently, skip it
  if (now - lastProcessedTime < 5000) { // 5 second deduplication window
    console.log("Duplicate event detected - ignoring");
    globalProcessingEvent = false;
    return;
  }
  
  // Mark this event as processed
  processSafeScoreChange.lastProcessedScore[eventKey] = now;
  
  try {
    // Visual feedback - flash the background of the parent div and play sound
    flashBackgroundRed(parentDiv);
    
    // Ensure we have valid data
    const safeScore = currentScore || "Unknown Score";
    const safeEventName = sportEventName || "";
    
    console.log(`Processing score change: ${safeScore}, Event: ${safeEventName}, Scoring team: ${scoringTeam}`);
    
    // Process the team names
    let processedEventName = safeEventName;
    if (scoringTeam !== "unknown" && safeEventName.includes("—")) {
      const teams = safeEventName.split("—").map(team => team.trim());
      if (teams.length === 2) {
        // Bold the scoring team name
        if (scoringTeam === "home") {
          processedEventName = `<b>${teams[0]}</b> — ${teams[1]}`;
        } else if (scoringTeam === "away") {
          processedEventName = `${teams[0]} — <b>${teams[1]}</b>`;
        }
      }
    }
    
    // Log the change to a new tab
    logScoreChange({
      eventName: 'Goal', // Always set to "Goal" as requested
      score: safeScore,
      message: processedEventName, // Set the inner text of the <a> tag as message with bold team
      scoringTeam: scoringTeam,
      isScoreChange: true,
      isHtml: true, // Indicate that the message contains HTML
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error in processSafeScoreChange:", error);
  }
  
  // Release the lock after a delay to prevent rapid successive events
  setTimeout(() => {
    globalProcessingEvent = false;
  }, 1000); // 1 second lockout
}

// Main function to initialize Fonbet notification functionality
function initFonbetNotification() {
  console.log("Initializing Fonbet notification functionality");
  
  // Reset global state
  globalProcessingEvent = false;
  lastGlobalEventTime = 0;
  
  // Make sure the log tab exists, but don't focus it
  chrome.runtime.sendMessage({ 
    action: 'logScoreChange', 
    data: {
      message: 'Started monitoring for score changes',
      isScoreChange: false,
      timestamp: new Date().toISOString()
    }
  });

  // Select all div elements with the class 'sport-base-event__main--FHhdx'
  const targetDivs = document.querySelectorAll('.sport-base-event__main--FHhdx');
  console.log(`Found ${targetDivs.length} matching divs`);
  
  // Sound is now defined globally
  
  // Function to change the font color of the child to blue
  function setInitialFontColor(element) {
    element.style.color = 'lightblue';
  }

  // Clean up any existing observers first
  console.log(`Cleaning up ${observerMap.size} existing observers`);
  observerMap.forEach((observer) => {
    observer.disconnect();
  });
  observerMap.clear();

  // Set initial font color for all score elements
  targetDivs.forEach(parentDiv => {
    const scoreChild = parentDiv.querySelector('.event-block-score__score--r0ZU9');
    
    if (scoreChild) {
      // Create a unique ID for this element to track it
      const elementId = Math.random().toString(36).substring(2, 15);
      
      // Check if we already have an observer for this element
      if (observerMap.has(scoreChild)) {
        console.log("Element already observed - skipping");
        return;
      }
      
      // Set the font color to blue at the beginning
      setInitialFontColor(scoreChild);

      // Variable to track the last score to prevent duplicate events
      let lastScore = scoreChild.textContent.trim();
      let lastEventTime = Date.now();
      console.log(`Initial score for ${elementId}: ${lastScore}`);
      
      // Create a simple score history to detect repeated notifications
      let scoreHistory = [];
      const MAX_HISTORY = 5;
      
      // Set up a MutationObserver with improved handling
      const observer = new MutationObserver((mutationsList, observer) => {
        // Skip processing if global lock is active
        if (globalProcessingEvent) {
          console.log(`[${elementId}] Global lock active, skipping`);
          return;
        }
        
        try {
          // Check if element is still in DOM
          if (!document.contains(scoreChild)) {
            console.log(`[${elementId}] Element no longer in DOM - disconnecting observer`);
            observer.disconnect();
            observerMap.delete(scoreChild);
            return;
          }
          
          // Get the current score
          const currentScore = scoreChild.textContent.trim();
          
          // Skip if score hasn't changed
          if (currentScore === lastScore) {
            return;
          }
          
          // Get current time for rate limiting
          const now = Date.now();
          
          // Apply strict time-based filtering
          if (now - lastEventTime < 500) {
            console.log(`[${elementId}] Rate limited - last event too recent (${now - lastEventTime}ms)`);
            return;
          }
          
          // Check if this score change is in our recent history
          const historyMatch = scoreHistory.find(item => 
            item.score === currentScore && (now - item.time < 2000));
          
          if (historyMatch) {
            console.log(`[${elementId}] Duplicate score change detected in history - ignoring`);
            return;
          }
          
          console.log(`[${elementId}] Score changed from ${lastScore} to ${currentScore}`);
          
          // Add to history
          scoreHistory.unshift({score: currentScore, time: now});
          if (scoreHistory.length > MAX_HISTORY) {
            scoreHistory.pop();
          }
          
          // Determine which team scored by comparing the scores
          let scoringTeam = "unknown";
          try {
            // Parse scores like "2:1" into arrays of numbers
            const oldScoreParts = lastScore.split(':').map(num => parseInt(num, 10));
            const newScoreParts = currentScore.split(':').map(num => parseInt(num, 10));
            
            // If we have valid score parts and there's a difference
            if (oldScoreParts.length === 2 && newScoreParts.length === 2 && 
               !isNaN(oldScoreParts[0]) && !isNaN(oldScoreParts[1]) &&
               !isNaN(newScoreParts[0]) && !isNaN(newScoreParts[1])) {
              
              // Compare home team score
              if (newScoreParts[0] > oldScoreParts[0]) {
                scoringTeam = "home";
              } 
              // Compare away team score
              else if (newScoreParts[1] > oldScoreParts[1]) {
                scoringTeam = "away";
              }
            }
          } catch (parseError) {
            console.error(`Error parsing scores: ${lastScore} vs ${currentScore}`, parseError);
            scoringTeam = "unknown";
          }
          
          // Update tracking variables
          lastScore = currentScore;
          lastEventTime = now;
          
          // If we've passed all the filters, this is likely a legitimate score change
          try {
            const sportEventNameElement = parentDiv.querySelector('a.sport-event__name--YAs00');
            const sportEventName = sportEventNameElement ? sportEventNameElement.textContent.trim() : '';
            
            // Process the score change safely with scoring team info
            processSafeScoreChange(scoreChild, parentDiv, currentScore, sportEventName, scoringTeam);
          } catch (error) {
            console.error(`[${elementId}] Error processing score change:`, error);
          }
        } catch (error) {
          console.error(`[${elementId}] Error in MutationObserver:`, error);
        }
      });

      // Store the observer in the map
      observerMap.set(scoreChild, observer);

      // Use a configuration that minimizes duplicate triggers
      observer.observe(scoreChild, { 
        characterData: true,
        subtree: true,
        childList: true,
        characterDataOldValue: true // This helps with more precise change detection
      });
    }
  });
}

// Example message sender function - this can be used independently
function sendMessageToBackground() {
  chrome.runtime.sendMessage({ action: 'getData' }, (response) => {
    console.log('Received response:', response);
  });
}

// Debug helper function to test event triggering
function debugTriggerTestEvent() {
  try {
    console.log('Debug: Manually triggering test event');
    
    // Try to find a real element on the page first
    const testDiv = document.querySelector('.sport-base-event__main--FHhdx');
    
    if (testDiv) {
      const scoreChild = testDiv.querySelector('.event-block-score__score--r0ZU9');
      if (scoreChild) {
        const parentDiv = testDiv;
        const currentScore = "2:1";
        const sportEventNameElement = parentDiv.querySelector('a.sport-event__name--YAs00');
        const sportEventName = sportEventNameElement ? sportEventNameElement.textContent.trim() : 'Team A — Team B';
        
        // For debug purposes, alternate between home and away team scoring
        const testTime = new Date().getSeconds();
        const scoringTeam = (testTime % 2 === 0) ? "home" : "away";
        
        // Process a test score change
        processSafeScoreChange(scoreChild, parentDiv, currentScore, sportEventName, scoringTeam);
        return;
      }
    }
    
    // Fallback if no real elements found - create a synthetic event
    console.log('No Fonbet elements found, creating synthetic test event');
    
    // Create a synthetic event with test data
    const syntheticData = {
      eventName: 'Test Match',
      score: '2:1',
      message: '<b>Test Team 1</b> — Test Team 2',
      isScoreChange: true,
      isHtml: true,
      timestamp: new Date().toISOString()
    };
    
    // Log directly
    logScoreChange(syntheticData);
    
  } catch (error) {
    console.error('Error in debug test function:', error);
    
    // Try direct messaging as last resort
    try {
      chrome.runtime.sendMessage({
        action: 'logScoreChange',
        data: {
          eventName: 'Error Recovery Test',
          score: '1:0',
          message: 'Fallback test after error',
          isScoreChange: true,
          timestamp: new Date().toISOString()
        }
      });
    } catch (e) {
      console.error('Even fallback messaging failed:', e);
    }
  }
}

// Debug commands are now handled by the unified message handler