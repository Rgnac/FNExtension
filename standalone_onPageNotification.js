// Add CSS for minimalist animation
const style = document.createElement('style');
style.textContent = `
  @keyframes minimalistFlash {
    0% { box-shadow: 0 0 0 0 rgba(255,0,0,0.7); background-color: #ffebee; }
    70% { box-shadow: 0 0 0 10px rgba(255,0,0,0); background-color: #ffebee; }
    100% { box-shadow: 0 0 0 0 rgba(255,0,0,0); background-color: transparent; }
  }
  
  .score-changed {
    animation: minimalistFlash 2s ease-out forwards !important;
    position: relative;
    background-color: #ffebee !important;
    transition: background-color 2s ease !important;
  }
  
  .score-changed::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border: 2px solid #ff3333;
    border-radius: 3px;
    opacity: 0;
    pointer-events: none;
    animation: fadeInOut 2s ease-out;
  }
  
  @keyframes fadeInOut {
    0% { opacity: 0; }
    20% { opacity: 1; }
    80% { opacity: 1; }
    100% { opacity: 0; }
  }
  
  /* Add cursor style to scores for testing */
  .event-block-score__score--r0ZU9 {
    cursor: pointer;
  }
`;
document.head.appendChild(style);

// Select all div elements with the class 'sport-base-event__main--FHhdx'
const targetDivs = document.querySelectorAll('.sport-base-event__main--FHhdx');

// Preload the sound in JavaScript
const sound = new Audio(chrome.runtime.getURL('sounds/button-44.mp3')); // Use relative path with chrome.runtime.getURL
sound.preload = 'auto';

// Function to set minimalist highlighting for score elements
function setInitialFontColor(element) {
  element.style.color = '#2196F3'; // Material Blue - more subtle than lightblue
  element.style.fontWeight = '600'; // Semi-bold instead of full bold
}

// Function to create a minimalist flash notification effect
function flashBackgroundRed(parentElement) {
  // First remove the class if it exists to reset animation
  parentElement.classList.remove('score-changed');
  
  // Force a reflow to restart the animation properly
  void parentElement.offsetWidth;
  
  // Add a subtle flash effect using a class
  parentElement.classList.add('score-changed');
  
  // Add direct style changes as well for older browsers or in case CSS animations fail
  parentElement.style.backgroundColor = '#ffebee';
  parentElement.style.transition = 'background-color 2s';
  
  // Play the sound
  sound.play().catch(err => console.log('Sound play error:', err));

  // Remove the class after animation completes
  setTimeout(() => {
    parentElement.classList.remove('score-changed');
    parentElement.style.backgroundColor = '';
  }, 2000);
}

// Set initial font color for all score elements
targetDivs.forEach(parentDiv => {
  const scoreChild = parentDiv.querySelector('.event-block-score__score--r0ZU9');
  
  if (scoreChild) {
    // Set the font color to blue at the beginning
    setInitialFontColor(scoreChild);

    // Add click event for testing (click on score to trigger flash)
    scoreChild.addEventListener('click', (e) => {
      e.preventDefault();
      flashBackgroundRed(parentDiv);
    });

    // Set up a MutationObserver to detect changes in text content of the child
    const observer = new MutationObserver((mutationsList, observer) => {
      mutationsList.forEach(mutation => {
        if (mutation.type === 'characterData') {
          flashBackgroundRed(parentDiv); // Flash the background of the parent div and play sound
        }
        if (mutation.type === 'childList') {
          if (mutation.target.textContent !== mutation.oldValue) {
            flashBackgroundRed(parentDiv); // Flash the background of the parent div and play sound
          }
        }
      });
    });

    // Observe the scoreChild for text content changes in the subtree
    observer.observe(scoreChild, { characterData: true, subtree: true, childList: true });
  }
});