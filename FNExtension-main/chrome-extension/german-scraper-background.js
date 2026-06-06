// Function to parse German website HTML content
function parseGermanHtml(html, url) {
  try {
    console.log("Parsing German HTML from", url);
    
    // In the background script, we can't use DOMParser or document, so we'll use regex
    // to extract relevant information from the HTML string
    const extractedData = [];
    
    // Extract score and teams information
    const scoreRegex = /<span class="sc-lhxcmh-0 eIUnhH">(\d+)<\/span>.*?<span class="sc-lhxcmh-0 eIUnhH">(\d+)<\/span>/s;
    const scoreMatch = html.match(scoreRegex);
    
    // Extract goal information
    const goalRegex = /<div class="sc-v2incs-0 sc-cppg51-0.*?<span class="sc-lhxcmh-0 hudpXq">(.*?)<\/span>.*?<span class="sc-lhxcmh-0 hudpXq">(.*?)<\/span>.*?<span class="sc-lhxcmh-0 bLQQow sc-cppg51-4 blBaVl">(\d+)&#x27;<\/span>/gs;
    
    // Extract team names
    const teamRegex = /<span class="sc-lhxcmh-0 eWMpDr sc-115qv42-3 eEcMqK">(.*?)<\/span>/g;
    const teamMatches = [];
    let teamMatch;
    while ((teamMatch = teamRegex.exec(html)) !== null) {
      teamMatches.push(teamMatch[1]);
    }
    
    // Add score information if available
    if (scoreMatch) {
      extractedData.push(`<div class="german-match-score"><strong>${teamMatches[0] || 'Home'} ${scoreMatch[1]} - ${scoreMatch[2]} ${teamMatches[1] || 'Away'}</strong></div>`);
    }
    
    // Add all goal information
    let goalMatch;
    while ((goalMatch = goalRegex.exec(html)) !== null) {
      const scorer = goalMatch[1];
      const score = goalMatch[2];
      const minute = goalMatch[3];
      extractedData.push(`<div class="german-match-goal">${minute}' - Goal! ${scorer} (${score})</div>`);
    }
    
    // If no specific data was found, return current match status
    if (extractedData.length === 0) {
      const liveMinuteRegex = /<span class="sc-lhxcmh-0 cNLmwn sc-1q35zik-1 gMRfGY" data-testid="live-minute" content="(\d+)&#x27;"><\/span>/;
      const liveMinuteMatch = html.match(liveMinuteRegex);
      
      if (liveMinuteMatch) {
        extractedData.push(`<div class="german-match-status">Match in progress - Minute ${liveMinuteMatch[1]}</div>`);
      } else if (teamMatches.length >= 2) {
        extractedData.push(`<div class="german-match-teams">${teamMatches[0]} vs ${teamMatches[1]}</div>`);
      } else {
        extractedData.push(`<div class="german-match-info">Match information retrieved</div>`);
      }
    }
    
    console.log(`Found ${extractedData.length} relevant data elements`);
    return extractedData;
  } catch (error) {
    console.error("Error parsing German HTML:", error);
    return [];
  }
}

// Function to fetch URL content from background script to bypass CORS
function fetchGermanUrl(url) {
  return new Promise((resolve, reject) => {
    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.text();
      })
      .then(html => {
        resolve({ success: true, html: html });
      })
      .catch(error => {
        console.error('Error fetching URL:', error);
        reject({ success: false, error: error.message });
      });
  });
}

// Message handler for German scraper functionality
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'parseGermanHtml') {
    try {
      const data = parseGermanHtml(message.html, message.url);
      sendResponse({ success: true, data: data });
    } catch (error) {
      console.error('Error in parseGermanHtml:', error);
      sendResponse({ success: false, error: error.message });
    }
    return true;
  }
  
  if (message.action === 'fetchGermanUrl') {
    fetchGermanUrl(message.url)
      .then(result => {
        sendResponse(result);
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message || 'Unknown error' });
      });
    return true;
  }
});