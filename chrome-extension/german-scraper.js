// German Scraper functionality
console.log("German Scraper script loaded");

// Add debug messaging
function debugGerman(message) {
  console.log(`[German Scraper] ${message}`);
}

// Initialize variables
let germanScraperInterval = null;
let germanRefreshRate = 5; // Default refresh rate in minutes

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  debugGerman("DOM loaded, initializing German Scraper");
  setTimeout(initGermanScraper, 500); // Small delay to ensure DOM is fully processed
});

// Also try initializing if document is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  debugGerman("Document already loaded, initializing German Scraper");
  setTimeout(initGermanScraper, 500); // Small delay to ensure DOM is fully processed
}

// Initialize the German scraper functionality
function initGermanScraper() {
  debugGerman("Initializing German Scraper");
  
  // Get DOM elements
  const germanScraperBtn = document.getElementById('german-scraper-btn');
  const germanScraperContainer = document.getElementById('german-scraper-container');
  const germanContent = document.getElementById('german-content');
  const germanRefreshControls = document.getElementById('german-refresh-controls');
  const germanRefreshIntervalInput = document.getElementById('german-refresh-interval');
  const germanApplyRefreshBtn = document.getElementById('german-apply-refresh-btn');
  const germanRefreshNowBtn = document.getElementById('german-refresh-now-btn');
  const germanUrlInput = document.getElementById('german-url-input');
  const germanAddUrlBtn = document.getElementById('german-add-url-btn');
  const germanUrlList = document.getElementById('german-url-list');
  
  // Check if button is already initialized (avoid multiple event listeners)
  if (germanScraperBtn && !germanScraperBtn.hasAttribute('data-initialized')) {
    // Add click event listener
    germanScraperBtn.addEventListener('click', function() {
      // Toggle visibility
      const isVisible = germanScraperContainer.style.display !== 'none';
      
      if (isVisible) {
        germanScraperContainer.style.display = 'none';
        germanScraperBtn.textContent = 'German Scraper';
        
        // Save visibility preference
        chrome.storage.local.set({ germanScraperVisible: false });
        
        // Clear refresh interval
        if (germanScraperInterval) {
          clearInterval(germanScraperInterval);
          germanScraperInterval = null;
        }
      } else {
        germanScraperContainer.style.display = 'block';
        germanScraperBtn.textContent = 'Hide German Scraper';
        
        // Save visibility preference
        chrome.storage.local.set({ germanScraperVisible: true });
        
        // Fetch content for any saved URLs
        loadSavedUrls();
        
        // Set up auto-refresh
        setupGermanRefreshInterval();
      }
    });
    
    // Mark as initialized
    germanScraperBtn.setAttribute('data-initialized', 'true');
  }
  
  // Set up add URL button
  if (germanAddUrlBtn) {
    germanAddUrlBtn.addEventListener('click', function() {
      addGermanUrl();
    });
  }
  
  // Setup enter key press in URL input field
  if (germanUrlInput) {
    germanUrlInput.addEventListener('keyup', function(event) {
      if (event.key === 'Enter') {
        addGermanUrl();
      }
    });
  }
  
  // Apply refresh interval button
  if (germanApplyRefreshBtn) {
    germanApplyRefreshBtn.addEventListener('click', function() {
      const newInterval = parseInt(germanRefreshIntervalInput.value);
      if (newInterval >= 1 && newInterval <= 60) {
        germanRefreshRate = newInterval;
        chrome.storage.local.set({ germanRefreshRate: newInterval });
        
        setupGermanRefreshInterval();
        
        // Update UI
        updateGermanRefreshTimeInfo();
      }
    });
  }
  
  // Refresh now button
  if (germanRefreshNowBtn) {
    germanRefreshNowBtn.addEventListener('click', function() {
      refreshGermanContent();
    });
  }
  
  // Check saved preferences
  chrome.storage.local.get(['germanScraperVisible', 'germanRefreshRate', 'germanUrls'], function(data) {
    // Set refresh rate from saved preference
    if (data.germanRefreshRate) {
      germanRefreshRate = data.germanRefreshRate;
      if (germanRefreshIntervalInput) {
        germanRefreshIntervalInput.value = germanRefreshRate;
      }
    }
    
    // Show German scraper if it was visible before
    if (data.germanScraperVisible && germanScraperBtn) {
      germanScraperContainer.style.display = 'block';
      germanScraperBtn.textContent = 'Hide German Scraper';
      
      // Load saved URLs and start refresh interval
      loadSavedUrls();
      setupGermanRefreshInterval();
    }
  });
}

// Function to add a new URL to the German scraper
function addGermanUrl() {
  const germanUrlInput = document.getElementById('german-url-input');
  const url = germanUrlInput.value.trim();
  
  if (!url) return;
  
  // Validate URL format - should be a fupa.net URL
  if (!url.includes('fupa.net/match/')) {
    showGermanError('Please enter a valid fupa.net match URL');
    return;
  }
  
  // Save URL to storage
  chrome.storage.local.get(['germanUrls'], function(data) {
    const urls = data.germanUrls || [];
    
    // Check for duplicates
    if (!urls.includes(url)) {
      urls.push(url);
      chrome.storage.local.set({ germanUrls: urls }, function() {
        console.log('German URL saved:', url);
        
        // Clear input
        germanUrlInput.value = '';
        
        // Update URL list
        updateGermanUrlList(urls);
        
        // Fetch content for the new URL
        fetchGermanContent(url);
      });
    } else {
      showGermanError('This URL is already in the list');
    }
  });
}

// Function to show error message in German scraper
function showGermanError(message) {
  const germanContent = document.getElementById('german-content');
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error';
  errorDiv.textContent = message;
  
  // Insert at the top
  germanContent.insertBefore(errorDiv, germanContent.firstChild);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.remove();
    }
  }, 5000);
}

// Function to load saved URLs
function loadSavedUrls() {
  chrome.storage.local.get(['germanUrls'], function(data) {
    const urls = data.germanUrls || [];
    
    // Update URL list
    updateGermanUrlList(urls);
    
    // Fetch content for all URLs
    if (urls.length > 0) {
      refreshGermanContent();
    }
  });
}

// Function to update German URL list display
function updateGermanUrlList(urls) {
  const germanUrlList = document.getElementById('german-url-list');
  
  // Clear current list
  germanUrlList.innerHTML = '';
  
  // Add each URL to the list
  urls.forEach(url => {
    const urlItem = document.createElement('div');
    urlItem.className = 'german-url-item';
    
    // Extract match name from URL
    const matchName = extractMatchNameFromUrl(url);
    
    // Create URL display
    const urlText = document.createElement('span');
    urlText.textContent = matchName;
    urlText.title = url;
    urlItem.appendChild(urlText);
    
    // Create remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'german-remove-btn';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove';
    removeBtn.addEventListener('click', function() {
      removeGermanUrl(url);
    });
    
    urlItem.appendChild(removeBtn);
    germanUrlList.appendChild(urlItem);
  });
}

// Function to extract match name from URL
function extractMatchNameFromUrl(url) {
  try {
    // Format: https://www.fupa.net/match/sv-schalding-heining-m1-fc-deisenhofen-m1-251011
    const parts = url.split('/match/')[1].split('-');
    
    // Get team names and format them nicely
    let teamA = '';
    let teamB = '';
    let dateFound = false;
    
    for (let i = 0; i < parts.length; i++) {
      if (!isNaN(parts[i]) && parts[i].length > 5) {
        // This is likely the date part
        dateFound = true;
        continue;
      }
      
      if (!dateFound) {
        teamA += (teamA ? ' ' : '') + parts[i].charAt(0).toUpperCase() + parts[i].slice(1);
      } else {
        teamB += (teamB ? ' ' : '') + parts[i].charAt(0).toUpperCase() + parts[i].slice(1);
      }
    }
    
    return teamA + ' vs ' + teamB;
  } catch (e) {
    // If parsing fails, return the URL
    return url.split('/').pop();
  }
}

// Function to remove a URL from the German scraper
function removeGermanUrl(url) {
  chrome.storage.local.get(['germanUrls'], function(data) {
    let urls = data.germanUrls || [];
    
    // Remove the URL
    urls = urls.filter(u => u !== url);
    
    // Save updated list
    chrome.storage.local.set({ germanUrls: urls }, function() {
      console.log('German URL removed:', url);
      
      // Update URL list
      updateGermanUrlList(urls);
      
      // Remove content for this URL
      const germanContent = document.getElementById('german-content');
      const matchContainer = document.querySelector(`[data-url="${url}"]`);
      if (matchContainer) {
        matchContainer.remove();
      }
    });
  });
}

// Function to set up auto-refresh for German content
function setupGermanRefreshInterval() {
  // Clear existing interval
  if (germanScraperInterval) {
    clearInterval(germanScraperInterval);
  }
  
  // Convert minutes to milliseconds
  const intervalMs = germanRefreshRate * 60 * 1000;
  
  // Set up new interval
  germanScraperInterval = setInterval(refreshGermanContent, intervalMs);
  
  // Update the refresh time info
  updateGermanRefreshTimeInfo();
}

// Function to update the refresh time info
function updateGermanRefreshTimeInfo() {
  const lastRefreshTimeElement = document.getElementById('german-last-refresh-time');
  const nextRefreshTimeElement = document.getElementById('german-next-refresh-time');
  
  if (lastRefreshTimeElement) {
    const now = new Date();
    lastRefreshTimeElement.textContent = now.toLocaleTimeString();
  }
  
  if (nextRefreshTimeElement) {
    const next = new Date(Date.now() + germanRefreshRate * 60 * 1000);
    nextRefreshTimeElement.textContent = next.toLocaleTimeString();
  }
}

// Function to refresh German content
function refreshGermanContent() {
  chrome.storage.local.get(['germanUrls'], function(data) {
    const urls = data.germanUrls || [];
    
    // Fetch content for all URLs
    urls.forEach(url => {
      fetchGermanContent(url);
    });
    
    // Update refresh time info
    updateGermanRefreshTimeInfo();
  });
}

// Function to fetch content from a German URL
function fetchGermanContent(url) {
  const germanContent = document.getElementById('german-content');
  
  // Create or update match container
  let matchContainer = document.querySelector(`[data-url="${url}"]`);
  if (!matchContainer) {
    matchContainer = document.createElement('div');
    matchContainer.className = 'german-match-container';
    matchContainer.setAttribute('data-url', url);
    
    // Create match header
    const matchHeader = document.createElement('div');
    matchHeader.className = 'german-match-header';
    
    // Extract match name
    const matchName = extractMatchNameFromUrl(url);
    matchHeader.textContent = matchName;
    
    matchContainer.appendChild(matchHeader);
    
    // Create match content
    const matchContent = document.createElement('div');
    matchContent.className = 'german-match-content';
    matchContainer.appendChild(matchContent);
    
    // Add to content area
    germanContent.appendChild(matchContainer);
  }
  
  // Show loading state
  const matchContent = matchContainer.querySelector('.german-match-content');
  matchContent.innerHTML = '<div class="loading">Loading data...</div>';
  
  // Use chrome.runtime to make the request instead of fetch
  chrome.runtime.sendMessage({
    action: 'fetchGermanUrl',
    url: url
  }, function(response) {
    if (response && response.success) {
      // Send HTML to background script to parse
      chrome.runtime.sendMessage({
        action: 'parseGermanHtml',
        html: response.html,
        url: url
      }, function(parseResponse) {
        if (parseResponse && parseResponse.success) {
          updateGermanMatchContent(matchContent, parseResponse.data);
        } else {
          matchContent.innerHTML = '<div class="error">Failed to parse content</div>';
        }
      });
    } else {
      console.error('Error fetching German content:', response ? response.error : 'Unknown error');
      matchContent.innerHTML = '<div class="error">Failed to load content: ' + 
        (response && response.error ? response.error : 'Unknown error') + '</div>';
    }
  });
}

// Function to update match content with scraped data
function updateGermanMatchContent(contentElement, data) {
  // Clear current content
  contentElement.innerHTML = '';
  
  if (data && data.length > 0) {
    data.forEach(item => {
      const itemElement = document.createElement('div');
      itemElement.className = 'german-item';
      itemElement.innerHTML = item;
      contentElement.appendChild(itemElement);
    });
  } else {
    contentElement.innerHTML = '<div class="no-data">No data found</div>';
  }
}

// Background script message handler for parsing HTML
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.action === 'germanHtmlParsed') {
    const contentElement = document.querySelector(`[data-url="${message.url}"] .german-match-content`);
    if (contentElement) {
      updateGermanMatchContent(contentElement, message.data);
    }
    return true;
  }
});

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  initGermanScraper();
});