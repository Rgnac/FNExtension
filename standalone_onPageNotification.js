// Select all div elements with the class 'sport-base-event__main--FHhdx'\
const targetDivs = document.querySelectorAll('.sport-base-event__main--FHhdx');

// Preload the sound in JavaScript
const sound = new Audio('https://www.soundjay.com/buttons/sounds/button-44.mp3'); // Replace with the path to your sound file
sound.preload = 'auto';

// Function to change the font color of the child to blue
function setInitialFontColor(element) {
  element.style.color = 'lightblue';
}

// Function to change the background color to red for 5 seconds and then smoothly revert over 2 seconds
function flashBackgroundRed(parentElement) {
  const originalBackground = window.getComputedStyle(parentElement).backgroundColor; // Get the computed original background color
  
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

// Set initial font color for all score elements
targetDivs.forEach(parentDiv => {
  const scoreChild = parentDiv.querySelector('.event-block-score__score--r0ZU9');
  
  if (scoreChild) {
    // Set the font color to blue at the beginning
    setInitialFontColor(scoreChild);

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