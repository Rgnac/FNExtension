// Emergency dark mode fix
(function() {
  console.log("Emergency dark mode script running");
  
  // Create a more reliable toggle function
  function toggleDarkMode() {
    const body = document.body;
    
    // Apply the dark mode style directly if needed
    if (!document.getElementById('emergency-dark-styles')) {
      const darkStyles = document.createElement('style');
      darkStyles.id = 'emergency-dark-styles';
      darkStyles.textContent = `
        body.dark-mode {
          background-color: #121212 !important;
          color: #e0e0e0 !important;
        }
        
        body.dark-mode h1 {
          color: #64b5f6 !important;
          border-bottom-color: #444 !important;
        }
        
        body.dark-mode .log-entry {
          background-color: #1e1e1e !important;
          border-left-color: #64b5f6 !important;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3) !important;
        }
        
        body.dark-mode .status {
          background-color: #2e7d32 !important;
        }
      `;
      document.head.appendChild(darkStyles);
    }
    
    // Toggle class
    body.classList.toggle('dark-mode');
    const isDarkMode = body.classList.contains('dark-mode');
    
    // Find the toggle button
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
      toggleBtn.textContent = isDarkMode ? 'Light Mode' : 'Dark Mode';
    }
    
    // Save setting
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    console.log("Dark mode toggled to:", isDarkMode);
  }
  
  // Function to init based on saved preference
  function initDarkMode() {
    try {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        const toggleBtn = document.getElementById('theme-toggle');
        if (toggleBtn) {
          toggleBtn.textContent = 'Light Mode';
        }
      }
    } catch (e) {
      console.error("Error initializing dark mode:", e);
    }
  }
  
  // Load from saved preference
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initDarkMode();
  } else {
    document.addEventListener('DOMContentLoaded', initDarkMode);
  }
  
  // Setup the click handler when everything is ready
  window.addEventListener('load', function() {
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
      console.log("Adding emergency click handler to theme toggle");
      
      // Remove any existing handlers (safer approach)
      toggleBtn.outerHTML = toggleBtn.outerHTML;
      
      // Get the new reference after outerHTML replacement
      const newToggleBtn = document.getElementById('theme-toggle');
      
      // Add our handler
      if (newToggleBtn) {
        newToggleBtn.addEventListener('click', function() {
          console.log("Emergency toggle clicked");
          toggleDarkMode();
        });
      }
    }
  });
})();