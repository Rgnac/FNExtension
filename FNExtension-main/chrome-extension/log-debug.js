// Debug helper script
console.log("Debug script loaded");

// Debug dark mode toggle functionality
function debugDarkMode() {
  const themeToggle = document.getElementById('theme-toggle');
  if (!themeToggle) {
    console.error("CRITICAL: Theme toggle button not found!");
    return;
  }
  
  console.log("Theme toggle button found:", themeToggle);
  
  // Add a forced dark mode class to test if CSS is working
  console.log("Testing dark mode styles - adding debug-dark class");
  document.documentElement.classList.add('debug-dark-mode');
  
  // Add a test style to see if any CSS is being applied
  const testStyle = document.createElement('style');
  testStyle.textContent = `
    .debug-dark-mode {
      outline: 5px solid red !important;
    }
    
    .debug-dark-mode body {
      outline: 5px solid blue !important;
    }
  `;
  document.head.appendChild(testStyle);
  
  // Replace the existing click handler with our debug version
  themeToggle.addEventListener('click', function(e) {
    console.log("Theme toggle clicked via debug listener");
    
    // Stop any other handlers
    e.stopImmediatePropagation();
    
    // Apply dark mode directly
    document.body.classList.toggle('dark-mode');
    
    // Update UI
    const isDarkMode = document.body.classList.contains('dark-mode');
    console.log("Dark mode class present:", isDarkMode);
    
    // Update button text
    themeToggle.textContent = isDarkMode ? 'Light Mode' : 'Dark Mode';
    
    // Save preference
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    
    return false;
  }, true);
  
  // Check if CSS is loaded
  const allStyles = document.styleSheets;
  let darkModeStyleFound = false;
  
  for (let i = 0; i < allStyles.length; i++) {
    try {
      const href = allStyles[i].href;
      if (href && href.includes('dark-mode.css')) {
        console.log("Dark mode CSS found:", href);
        darkModeStyleFound = true;
        break;
      }
    } catch (e) {
      console.log("Error checking stylesheet:", e);
    }
  }
  
  if (!darkModeStyleFound) {
    console.error("CRITICAL: dark-mode.css not loaded!");
  }
}

// Function to validate DOM structure
function validateLogPage() {
  console.log("Validating log page structure");
  
  // Check logs container
  const logsContainer = document.getElementById('logs');
  if (!logsContainer) {
    console.error("CRITICAL: Logs container (#logs) not found in DOM");
  } else {
    console.log("Logs container found:", logsContainer);
  }
  
  // Check test buttons
  const testSoundBtn = document.getElementById('test-sound-btn');
  const testLogBtn = document.getElementById('test-log-btn');
  
  if (!testSoundBtn) {
    console.warn("Test sound button not found");
  } else {
    console.log("Test sound button found");
    
    // Add test button listener
    testSoundBtn.addEventListener('click', function() {
      console.log("Test sound button clicked");
      
      // Add test log entry
      const testEntry = {
        eventName: 'Test Sound',
        message: 'Sound test button clicked',
        isScoreChange: false,
        timestamp: new Date().toISOString()
      };
      
      try {
        // Try to play sound directly
        const audio = new Audio(chrome.runtime.getURL('sounds/button-44.mp3'));
        audio.play().catch(e => console.error("Sound play failed:", e));
      } catch (e) {
        console.error("Error creating audio:", e);
      }
    });
  }
  
  if (!testLogBtn) {
    console.warn("Test log button not found");
  } else {
    console.log("Test log button found");
    
    // Add test button listener
    testLogBtn.addEventListener('click', function() {
      console.log("Test log button clicked");
      
      // Create test entry
      const testEntry = {
        eventName: 'Test Entry',
        score: '1:0',
        message: '<b>Test Team 1</b> — Test Team 2',
        isScoreChange: true,
        isHtml: true,
        timestamp: new Date().toISOString()
      };
      
      // Try to add log entry directly
      try {
        window.addLogEntry(testEntry);
        console.log("Test log entry added");
      } catch (e) {
        console.error("Error adding test log entry:", e);
        
        // Try fallback approach
        try {
          // Manual DOM manipulation as fallback
          const logsContainer = document.getElementById('logs');
          if (logsContainer) {
            // Remove the "no logs" message if present
            if (logsContainer.querySelector('.no-logs')) {
              logsContainer.innerHTML = '';
            }
            
            // Create basic entry
            const entry = document.createElement('div');
            entry.className = 'log-entry highlight';
            entry.innerHTML = `
              <div class="timestamp">${new Date().toLocaleString()}</div>
              <div class="content">
                <div class="event-name">Test Fallback Entry</div>
                <div class="score changed">1:0</div>
                <div class="event-message"><b>Fallback Test</b> — Test Team 2</div>
              </div>
            `;
            
            logsContainer.insertBefore(entry, logsContainer.firstChild);
            console.log("Fallback test entry added");
          }
        } catch (fallbackError) {
          console.error("Fallback also failed:", fallbackError);
        }
      }
    });
  }
}

// Run validation when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM loaded - running validation");
  
  // Let page finish loading
  setTimeout(() => {
    validateLogPage();
    debugDarkMode(); // Add dark mode debugging
  }, 500);
});