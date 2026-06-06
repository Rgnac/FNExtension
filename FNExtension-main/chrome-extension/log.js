// Log page script
let logCount = 0;

// Simple in-memory cache for message deduplication
const processedMessages = {};

// Listen for messages from the background script
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  console.log('Log page received message:', JSON.stringify(message).substring(0, 200));
  
  // Handle ping messages for checking if the page is ready
  if (message.ping === true) {
    console.log("Received ping - responding with ready status");
    sendResponse({ pong: true, ready: true });
    return true;
  }
  
  try {
    if (message.action === 'logScoreChange') {
      console.log('Received logScoreChange message with data:', message.data);
      
      // Use message ID or create a content hash for deduplication
      const messageKey = message.messageId || JSON.stringify(message.data);
      
      // Check for duplicates (only in the last 5 seconds)
      const now = Date.now();
      if (processedMessages[messageKey] && (now - processedMessages[messageKey] < 5000)) {
        console.log('Duplicate message detected in log.js - ignoring');
        sendResponse({ success: true, duplicate: true });
        return true;
      }
      
      // Mark this message as processed with timestamp
      processedMessages[messageKey] = now;
      
      try {
        // Add the log entry - wrapped in try/catch to ensure we don't fail completely
        addLogEntry(message.data);
        console.log('Log entry added successfully');
      } catch (entryError) {
        console.error('Error adding log entry:', entryError);
      }
      
      // Clean up old entries in the processed messages cache
      for (const key in processedMessages) {
        if (now - processedMessages[key] > 30000) { // 30 seconds
          delete processedMessages[key];
        }
      }
      
      // Send success response
      sendResponse({ success: true });
      return true;
    }
  } catch (error) {
    console.error('Error processing message:', error);
    sendResponse({ success: false, error: error.message });
  }
  
  return true; // Keep the message channel open for async responses
});

// Function to add a log entry to the page
function addLogEntry(data) {
  try {
    console.log('Adding log entry:', data);
    
    const logsContainer = document.getElementById('logs');
    if (!logsContainer) {
      console.error('ERROR: Logs container not found when adding entry');
      
      // Try to find or create container as fallback
      const scoreLogContainer = document.querySelector('.score-log-container');
      if (scoreLogContainer) {
        const newLogsContainer = document.createElement('div');
        newLogsContainer.id = 'logs';
        scoreLogContainer.appendChild(newLogsContainer);
        console.log('Created new logs container as fallback');
      }
    }
    
    // Get the container again (might have been created above)
    const container = document.getElementById('logs') || document.body;
    
    // Remove the "no logs" message if it's the first log
    if (logCount === 0 && container) {
      const noLogs = container.querySelector('.no-logs');
      if (noLogs) {
        noLogs.remove();
      }
    }
  
  // Create log entry element
  const logEntry = document.createElement('div');
  logEntry.className = 'log-entry';
  
  // Add highlight class for score changes
  if (data.isScoreChange) {
    logEntry.classList.add('highlight');
    
    // Play sound notification for score changes - but only if not called from test button
    // The test button already calls playNotificationSound() separately
    if (!data.fromTestButton) {
      console.log('Fonbet score change detected - attempting to play sound');
      try {
        if (typeof playNotificationSound === 'function') {
          // Use the main sound function if it exists
          playNotificationSound();
        } else {
          // Fallback to simple sound
          const audio = new Audio(chrome.runtime.getURL('sounds/button-44.mp3'));
          audio.play().catch(e => console.error('Sound play error:', e));
        }
      } catch (e) {
        console.error('Sound error caught:', e);
      }
    }
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
  
  // Insert the entry at the top of the logs container
  console.log('Adding log entry to DOM, container:', logsContainer);
  logsContainer.insertBefore(logEntry, logsContainer.firstChild);
  console.log('Entry added, current log count:', logCount);
  
  // Increment log count
  logCount++;
  } catch (error) {
    console.error('Error in addLogEntry function:', error);
  }
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

// Preload sound
let notificationSound = null;

// Initialize notification sound - called both at startup and when needed
function initNotificationSound() {
  if (!notificationSound) {
    console.log('Initializing notification sound');
    try {
      // Create a new Audio element
      notificationSound = new Audio(chrome.runtime.getURL('sounds/button-44.mp3'));
      
      // Add event listeners for better debugging
      notificationSound.addEventListener('canplaythrough', () => {
        console.log('Sound loaded and ready to play');
      });
      
      notificationSound.addEventListener('error', (e) => {
        console.error('Error loading sound:', e);
      });
      
      // Preload the sound
      notificationSound.load();
      
      // Test play and immediately mute to force browser audio initialization
      // This can help overcome browsers' autoplay restrictions
      setTimeout(() => {
        const originalVolume = notificationSound.volume;
        notificationSound.volume = 0;
        notificationSound.play().then(() => {
          console.log('Silent test play succeeded');
          notificationSound.pause();
          notificationSound.currentTime = 0;
          notificationSound.volume = originalVolume;
        }).catch(e => {
          console.log('Silent test play failed (expected in some browsers):', e);
        });
      }, 1000);
    } catch (e) {
      console.error('Exception initializing sound:', e);
    }
  }
}

// Add a startup message when the page loads
document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM Content Loaded - initializing log page");
  
  // Verify logs container exists
  const logsContainer = document.getElementById('logs');
  if (!logsContainer) {
    console.error("Critical error: logs container not found!");
    // Try to create it if missing
    const scoreLogContainer = document.querySelector('.score-log-container');
    if (scoreLogContainer) {
      const newLogsContainer = document.createElement('div');
      newLogsContainer.id = 'logs';
      newLogsContainer.innerHTML = '<div class="no-logs">No changes detected yet. Keep this tab open to record changes.</div>';
      scoreLogContainer.appendChild(newLogsContainer);
      console.log("Created new logs container");
    }
  } else {
    console.log("Logs container found and ready");
  }
  
  // Add startup message
  addStartupMessage();
  
  // Let the background script know we're ready
  chrome.runtime.sendMessage({ 
    action: 'logPageReady',
    timestamp: Date.now()
  }, function(response) {
    console.log("Sent logPageReady message, response:", response);
  });
  
  // Try to initialize sound system
  try {
    // First try to use the standard function
    if (typeof initNotificationSound === 'function') {
      initNotificationSound();
      console.log("Sound system initialized");
    } else {
      // Simple fallback
      const audio = new Audio(chrome.runtime.getURL('sounds/button-44.mp3'));
      audio.volume = 0;
      audio.load();
      console.log("Fallback sound initialization");
    }
  } catch (e) {
    console.error("Failed to initialize sound:", e);
  }
  
  // Initialize the Tunis button functionality
  initTunisD1();
  
  // Set up test sound button
  const testSoundBtn = document.getElementById('test-sound-btn');
  if (testSoundBtn) {
    console.log("Found test sound button, adding click listener");
    testSoundBtn.addEventListener('click', function() {
      console.log("Test sound button clicked");
      
      // Play notification sound
      playNotificationSound();
      
      // Visual feedback
      testSoundBtn.textContent = "Playing...";
      setTimeout(function() {
        testSoundBtn.textContent = "Test Sound";
      }, 1000);
    });
  } else {
    console.warn("Test sound button not found in DOM");
  }
  
  // Set up test log entry button
  const testLogBtn = document.getElementById('test-log-btn');
  if (testLogBtn) {
    console.log("Found test log button, adding click listener");
    testLogBtn.addEventListener('click', function() {
      console.log("Test log button clicked");
      
      // Add a test log entry
      addLogEntry({
        eventName: 'Test Goal',
        score: '1:0',
        message: '<b>Test Team 1</b> — Test Team 2',
        isScoreChange: true,
        isHtml: true,
        timestamp: new Date().toISOString(),
        fromTestButton: true // Flag to avoid duplicate sound
      });
      
      // Play notification sound - only once
      playNotificationSound();
      
      // Visual feedback
      testLogBtn.textContent = "Added!";
      setTimeout(function() {
        testLogBtn.textContent = "Test Log Entry";
      }, 1000);
    });
  } else {
    console.warn("Test log button not found in DOM");
  }
  
  console.log("Log page initialization complete");
});

// Initialize Tunis functionality
function initTunisD1() {
  // Get DOM elements
  const tunisD1Btn = document.getElementById('add-tunis-d1-btn');
  const tunisD1Container = document.getElementById('tunis-d1-container');
  const tunisD1Content = document.getElementById('tunis-d1-content');
  const refreshControls = document.getElementById('refresh-controls');
  const refreshIntervalInput = document.getElementById('refresh-interval');
  const applyRefreshBtn = document.getElementById('apply-refresh-btn');
  const refreshNowBtn = document.getElementById('refresh-now-btn');
  
  // Check if button is already initialized (avoid multiple event listeners)
  if (tunisD1Btn && !tunisD1Btn.hasAttribute('data-initialized')) {
    // Add click event listener
    tunisD1Btn.addEventListener('click', function() {
      // Toggle visibility
      const isVisible = tunisD1Container.style.display !== 'none';
      
      if (isVisible) {
        tunisD1Container.style.display = 'none';
        tunisD1Btn.textContent = 'Add Tunisia Column';
        refreshControls.style.display = 'none';
        
        // Save visibility preference
        chrome.storage.local.set({ tunisD1Visible: false });
        
        // Clear refresh interval
        if (refreshIntervalId) {
          clearInterval(refreshIntervalId);
          refreshIntervalId = null;
        }
      } else {
        tunisD1Container.style.display = 'block';
        tunisD1Btn.textContent = 'Hide Tunisia Column';
        refreshControls.style.display = 'block';
        
        // Save visibility preference
        chrome.storage.local.set({ tunisD1Visible: true });
        
        // Fetch content
        fetchTunisD1Content();
        
        // Set up auto-refresh
        setupRefreshInterval();
      }
    });
    
    // Add header with refresh time info to the container
    const headerDiv = document.createElement('div');
    headerDiv.style.display = 'flex';
    headerDiv.style.justifyContent = 'space-between';
    headerDiv.style.alignItems = 'center';
    headerDiv.style.marginBottom = '10px';
    
    const h2 = document.createElement('h2');
    h2.textContent = 'Tunisia';
    h2.style.margin = '0';
    
    const refreshInfo = document.createElement('div');
    refreshInfo.innerHTML = 'Last refresh: <span id="last-refresh-time">-</span>';
    refreshInfo.style.fontSize = '12px';
    refreshInfo.style.color = '#666';
    
    headerDiv.appendChild(h2);
    headerDiv.appendChild(refreshInfo);
    
    // Replace the h2 with our new header
    const oldH2 = tunisD1Container.querySelector('h2');
    if (oldH2) {
      tunisD1Container.replaceChild(headerDiv, oldH2);
    }
    
    // Apply refresh interval button
    applyRefreshBtn.addEventListener('click', function() {
      const newInterval = parseInt(refreshIntervalInput.value);
      if (newInterval >= 1 && newInterval <= 60) {
        refreshIntervalMinutes = newInterval;
        // Save to storage
        chrome.storage.local.set({ tunisD1RefreshInterval: refreshIntervalMinutes });
        
        // Clear existing interval and set up new one
        if (refreshIntervalId) {
          clearInterval(refreshIntervalId);
        }
        
        setupRefreshInterval();
        
        alert(`Refresh interval updated to ${refreshIntervalMinutes} minutes`);
      } else {
        alert('Please enter a valid interval between 1 and 60 minutes');
      }
    });
    
    // Refresh now button
    refreshNowBtn.addEventListener('click', function() {
      fetchTunisD1Content();
    });
    
    // Mark as initialized
    tunisD1Btn.setAttribute('data-initialized', 'true');
    
    // Check if we should show the column on load (from storage)
    chrome.storage.local.get(['tunisD1Visible', 'tunisD1RefreshInterval'], function(result) {
      // Load saved refresh interval
      if (result.tunisD1RefreshInterval) {
        refreshIntervalMinutes = result.tunisD1RefreshInterval;
        refreshIntervalInput.value = refreshIntervalMinutes;
      }
      
      // Check if column should be visible
      if (result.tunisD1Visible === true) {
        tunisD1Container.style.display = 'block';
        tunisD1Btn.textContent = 'Hide Tunisia Column';
        refreshControls.style.display = 'block';
        fetchTunisD1Content();
        
        // Set up auto-refresh
        setupRefreshInterval();
      } else {
        // Ensure it's hidden by default
        tunisD1Container.style.display = 'none';
        tunisD1Btn.textContent = 'Add Tunisia Column';
        refreshControls.style.display = 'none';
      }
    });
  }
  
  // Variable to store the refresh interval timer
  let refreshIntervalId = null;
  let refreshIntervalMinutes = 5; // Default 5 minutes
  
  // Function to fetch Tunisia content
  function fetchTunisD1Content() {
    // Show loading state
    tunisD1Content.innerHTML = '<div class="loading">Loading Tunisia content...</div>';
    
    // Update last refresh time indicator if needed
    const lastRefreshEl = document.getElementById('last-refresh-time');
    if (lastRefreshEl) {
      const now = new Date();
      lastRefreshEl.textContent = now.toLocaleTimeString();
    }
    
    // First try direct fetch
    fetch('https://live.kawarji.com/')
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to fetch content');
        }
        return response.text();
      })
      .then(html => {
        const content = extractTunisD1Content(html);
        if (content) {
          tunisD1Content.innerHTML = '';
          tunisD1Content.appendChild(content);
        } else {
          tunisD1Content.innerHTML = '<div class="error">No Tunisia content found</div>';
        }
      })
      .catch(error => {
        console.error('Error fetching Tunisia content:', error);
        
        // If direct fetch fails (likely due to CORS), try with background script
        console.log('Trying to fetch via background script...');
        tunisD1Content.innerHTML = '<div class="loading">Trying alternative method...</div>';
        
        // Ask background script to fetch for us
        chrome.runtime.sendMessage({ 
          action: 'fetchTunisD1', 
          url: 'https://live.kawarji.com/' 
        }, response => {
          if (response && response.html) {
            const content = extractTunisD1Content(response.html);
            if (content) {
              tunisD1Content.innerHTML = '';
              tunisD1Content.appendChild(content);
            } else {
              tunisD1Content.innerHTML = '<div class="error">No Tunisia content found</div>';
            }
          } else {
            tunisD1Content.innerHTML = `<div class="error">Error loading content: ${response ? response.error : 'Unknown error'}</div>`;
          }
        });
      });
      
    // Save visibility preference
    chrome.storage.local.set({ tunisD1Visible: true });
  }
  
  // Storage for previous game states to detect changes
  let previousGameStates = {};
  
  // Load previous game states from storage
  chrome.storage.local.get(['tunisD1PreviousState'], function(result) {
    if (result.tunisD1PreviousState) {
      previousGameStates = JSON.parse(result.tunisD1PreviousState);
    }
  });
  
  // Function to extract specific content from the HTML
  function extractTunisD1Content(html) {
    try {
      // Create a DOM parser
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Find all elements matching the specified class
      const resultItems = doc.querySelectorAll('.resultat_item.col-md-12.col-xs-12');
      
      if (resultItems.length === 0) {
        return null;
      }
      
      // Create a document fragment to hold our content
      const fragment = document.createDocumentFragment();
      const currentGameStates = {};
      
      // Process each item
      resultItems.forEach((item, index) => {
        // Process the item to handle specific classes
        processItemClasses(item);
        
        // Find the team names and score elements
        const teamElements = item.querySelectorAll('.resultat_equipe');
        const scoreElement = item.querySelector('.resultat_score');
        
        if (teamElements.length >= 2 && scoreElement) {
          // Create a formatted match container
          const matchContainer = document.createElement('div');
          matchContainer.className = 'match-container';
          matchContainer.dataset.matchId = `match-${index}`;
          
          // Get team names and score
          const team1Name = teamElements[0].textContent.trim();
          const team2Name = teamElements[1].textContent.trim();
          const scoreText = scoreElement.textContent.trim();
          
          // Create match key for change detection
          const matchKey = `${team1Name}_vs_${team2Name}`;
          const currentState = {
            team1: team1Name,
            team2: team2Name,
            score: scoreText
          };
          
          // Store current state
          currentGameStates[matchKey] = currentState;
          
          // Check for changes
          const hasChanged = checkForChanges(matchKey, currentState);
          
          // Create formatted content
          matchContainer.innerHTML = `
            <button class="hide-match-btn" title="Hide this match">×</button>
            <div class="match-header ${hasChanged ? 'match-changed' : ''}">
              <div class="team team1 text-right">${team1Name}</div>
              <div class="score text-center">${scoreText}</div>
              <div class="team team2 text-left">${team2Name}</div>
            </div>
            <div class="match-details">
              ${item.innerHTML}
            </div>
          `;
          
          // Apply highlight effect if changed
          if (hasChanged) {
            highlightChangedMatch(matchContainer);
            
            // Play notification sound
            playNotificationSound();
          }
          
          // Add hide button event listener
          const hideButton = matchContainer.querySelector('.hide-match-btn');
          if (hideButton) {
            hideButton.addEventListener('click', function(e) {
              e.preventDefault();
              e.stopPropagation();
              matchContainer.style.display = 'none';
              // Optionally store hidden status in Chrome storage
              const matchId = matchContainer.dataset.matchId;
              chrome.storage.local.get(['hiddenMatches'], function(result) {
                const hiddenMatches = result.hiddenMatches || {};
                hiddenMatches[matchId] = true;
                chrome.storage.local.set({ hiddenMatches });
              });
            });
          }
          
          // Check if this match was hidden before
          const matchId = matchContainer.dataset.matchId;
          chrome.storage.local.get(['hiddenMatches'], function(result) {
            const hiddenMatches = result.hiddenMatches || {};
            if (hiddenMatches[matchId]) {
              matchContainer.style.display = 'none';
            }
          });
          
          fragment.appendChild(matchContainer);
        } else {
          // Fallback for items that don't match our expected structure
          const fallbackContainer = document.createElement('div');
          fallbackContainer.className = 'match-container fallback';
          fallbackContainer.innerHTML = item.innerHTML;
          fragment.appendChild(fallbackContainer);
        }
      });
      
      // Update previous game states for next comparison
      previousGameStates = currentGameStates;
      
      // Save to storage for persistence between sessions
      chrome.storage.local.set({ 
        tunisD1PreviousState: JSON.stringify(currentGameStates) 
      });
      
      return fragment;
    } catch (error) {
      console.error('Error parsing HTML:', error);
      return null;
    }
  }
  
  // Function to check for changes in match data
  function checkForChanges(matchKey, currentState) {
    // If we don't have previous state, no change detected
    if (!previousGameStates[matchKey]) {
      return false;
    }
    
    const prevState = previousGameStates[matchKey];
    
    // Check if any values changed
    return (
      prevState.score !== currentState.score ||
      prevState.team1 !== currentState.team1 ||
      prevState.team2 !== currentState.team2
    );
  }
  
  // Function to highlight changed matches
  function highlightChangedMatch(matchContainer) {
    matchContainer.classList.add('highlight-change');
    
    // Remove highlight after 5 seconds
    setTimeout(() => {
      matchContainer.classList.remove('highlight-change');
    }, 5000);
  }
  
  // Function to process classes in an item element
  function processItemClasses(itemElement) {
    // Handle show-live-detail elements (hide them)
    const showLiveDetails = itemElement.querySelectorAll('.show-live-detail');
    showLiveDetails.forEach(element => {
      element.style.display = 'none';
    });
    
    // Handle live-details elements (make them visible)
    const liveDetails = itemElement.querySelectorAll('.live-details');
    liveDetails.forEach(element => {
      element.style.display = 'block';
      
      // Process penalty sections specifically
      const penrSections = element.querySelectorAll('.live-penr');
      penrSections.forEach(penr => {
        // Make sure the penalty section is displayed correctly
        processSpecificPenaltySection(penr);
      });
    });
    
    // Replace French text with English in live-middle-item elements
    const middleItems = itemElement.querySelectorAll('.live-middle-item, .live-details div');
    middleItems.forEach(element => {
      const text = element.textContent.trim();
      if (text === 'Cartons rouges') {
        element.textContent = 'Red Cards';
      } else if (text === 'Penalties ratés' || text === 'Pénalités ratées' || text.includes('Penalt')) {
        element.textContent = 'Missed pens';
        // Make sure the text is centered
        element.style.textAlign = 'center';
        element.style.fontWeight = 'bold';
      }
    });
    
    // Additional processing for red cards, missed penalties, and penalties display
    const specialSections = itemElement.querySelectorAll('.live-cr, .live-pr, .live-penr');
    specialSections.forEach(section => {
      section.style.display = 'flex';
      section.style.alignItems = 'center';
    });
    
    // Fix text alignment in live-details sections
    const liveDetailsTextLeft = itemElement.querySelectorAll('.live-details .text-left');
    liveDetailsTextLeft.forEach(element => {
      element.style.textAlign = 'right';
    });
    
    const liveDetailsTextRight = itemElement.querySelectorAll('.live-details .text-right');
    liveDetailsTextRight.forEach(element => {
      element.style.textAlign = 'left';
    });
  }
  
  // Function to process specific penalty sections
  function processSpecificPenaltySection(penaltySection) {
    // Ensure the section is displayed as flex
    penaltySection.style.display = 'flex';
    penaltySection.style.alignItems = 'center';
    
    // Process the middle item (Penalties ratés -> Missed pens)
    const middleItem = penaltySection.querySelector('.col-lg-2, .col-md-2, .col-sm-2, .col-xs-2');
    if (middleItem) {
      const text = middleItem.textContent.trim();
      if (text === 'Penalties ratés' || text === 'Pénalités ratées' || text.includes('Penalt')) {
        middleItem.textContent = 'Missed pens';
      }
      middleItem.style.textAlign = 'center';
      middleItem.style.fontWeight = 'bold';
    }
    
    // Process player names
    const playerColumn = penaltySection.querySelector('.col-lg-5.text-left, .col-md-5.text-left, .col-sm-5.text-left, .col-xs-5.text-left');
    if (playerColumn) {
      // Make sure the text is visible
      playerColumn.style.display = 'block';
      
      // Process any icons
      const icons = playerColumn.querySelectorAll('.fa');
      icons.forEach(icon => {
        icon.style.display = 'inline-block';
        icon.style.marginRight = '5px';
        if (icon.classList.contains('fa-times') || icon.classList.contains('red')) {
          icon.style.color = '#e74c3c';
        }
      });
      
      // Ensure line breaks work properly
      playerColumn.innerHTML = playerColumn.innerHTML.replace(/<br>/g, ' • ');
    }
    
    // Hide any clearfix elements
    const clearfix = penaltySection.querySelector('.clearfix');
    if (clearfix) {
      clearfix.style.display = 'none';
    }
  }
  
  // Function to play notification sound
  function playNotificationSound() {
    try {
      console.log('Playing notification sound');
      
      // Ensure sound is initialized
      if (!notificationSound) {
        initNotificationSound();
      }
      
      // Try different methods to play the sound
      playSound().catch(e => {
        console.error('Primary sound method failed, trying alternative:', e);
        playAlternativeSound();
      });
    } catch (e) {
      console.error('Exception in playNotificationSound:', e);
      playAlternativeSound();
    }
  }
  
  // Primary method to play sound
  function playSound() {
    return new Promise((resolve, reject) => {
      try {
        // Check if sound is initialized
        if (!notificationSound) {
          notificationSound = new Audio(chrome.runtime.getURL('sounds/button-44.mp3'));
        }
        
        // Reset sound to beginning in case it was already played
        notificationSound.currentTime = 0;
        notificationSound.volume = 1.0;
        
        // Try to play the sound
        const playPromise = notificationSound.play();
        
        if (playPromise !== undefined) {
          playPromise.then(() => {
            console.log('Sound played successfully');
            resolve();
          }).catch(error => {
            console.error('Error playing sound:', error);
            reject(error);
          });
        } else {
          console.log('Play promise is undefined, assuming success');
          resolve();
        }
      } catch (e) {
        console.error('Exception playing sound:', e);
        reject(e);
      }
    });
  }
  
  // Alternative method to play sound as a fallback
  function playAlternativeSound() {
    try {
      console.log('Using alternative sound method');
      
      // Create a new audio element each time
      const audio = new Audio();
      audio.src = chrome.runtime.getURL('sounds/button-44.mp3');
      audio.volume = 1.0;
      
      // Force user interaction simulation (may help with autoplay restrictions)
      document.documentElement.addEventListener('mousedown', playOnUserAction, { once: true });
      document.documentElement.addEventListener('keydown', playOnUserAction, { once: true });
      document.documentElement.addEventListener('touchstart', playOnUserAction, { once: true });
      
      function playOnUserAction() {
        audio.play().catch(e => console.error('User action play failed:', e));
        // Remove the listeners
        document.documentElement.removeEventListener('mousedown', playOnUserAction);
        document.documentElement.removeEventListener('keydown', playOnUserAction);
        document.documentElement.removeEventListener('touchstart', playOnUserAction);
      }
      
      // Also try to play immediately
      audio.play().catch(e => {
        console.log('Immediate play failed (expected), waiting for user action');
      });
      
    } catch (e) {
      console.error('Exception in playAlternativeSound:', e);
    }
  }
  
  // Function to set up the refresh interval
  function setupRefreshInterval() {
    // Clear any existing interval
    if (refreshIntervalId) {
      clearInterval(refreshIntervalId);
    }
    
    // Set up new interval
    refreshIntervalId = setInterval(() => {
      if (tunisD1Container.style.display !== 'none') {
        console.log(`Auto-refreshing Tunisia content (every ${refreshIntervalMinutes} minutes)`);
        fetchTunisD1Content();
      }
    }, refreshIntervalMinutes * 60 * 1000);
    
    console.log(`Refresh interval set to ${refreshIntervalMinutes} minutes`);
  }
}