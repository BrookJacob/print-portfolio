document.addEventListener("DOMContentLoaded", () => {
    // --- START: Landing Page Modal Logic ---
    const landingModal = document.getElementById('landing-modal');
    const choicePrints = document.getElementById('choice-prints');
    const choiceCoding = document.getElementById('choice-coding');
    const choices = [choicePrints, choiceCoding];
    let currentFocusIndex = -1; // -1 means no focus, 0 for prints, 1 for coding
    let resetChoicesTimeoutId = null;

    if (landingModal && choicePrints && choiceCoding) {

        // Function to apply styles based on selection
        function updateChoiceAppearance(selectedIndex) {
            choices.forEach((choice, index) => {
                choice.classList.remove('selected-choice', 'other-choice-up', 'other-choice-down');
                if (index === selectedIndex) {
                    choice.classList.add('selected-choice');
                } else {
                    if (selectedIndex !== -1) { // Only apply 'other' if something is actually selected
                        if (index < selectedIndex) {
                            choice.classList.add('other-choice-up');
                        } else {
                            choice.classList.add('other-choice-down');
                        }
                    }
                }
            });
        }

        // Function to handle making a choice
        function makeChoice(choiceElement) {
            const choiceId = choiceElement.id;
            console.log('Selected:', choiceId); // Placeholder for action

            if (choiceId === 'choice-prints') {
                // Action for "Prints": Hide the modal and enable scrolling on the main page
                window.location.href = '/prints';
                // Optional: Scroll to a specific section, e.g., the gallery
                // const gallerySection = document.getElementById('gallery');
                // if (gallerySection) {
                // Wait for the modal to visually disappear before scrolling
                // setTimeout(() => {
                // gallerySection.scrollIntoView({ behavior: 'smooth' });
                // }, 500); // Match the opacity transition duration
                // }

            } else if (choiceId === 'choice-coding') {
                // Action for "Coding":
                window.location.href = '/coding';
                // Example: window.location.href = 'coding.html'; 
                // Or if it was to hide modal and show a different section on index.html:
                // landingModal.classList.add('hidden');
                // document.body.style.overflow = 'auto';
                // const codingSection = document.getElementById('coding-specific-section'); // Assuming you have one
                // if(codingSection) codingSection.scrollIntoView({ behavior: 'smooth' });
            }
        }

        choices.forEach((choice, index) => {
            // Mouse hover events
            choice.addEventListener('mouseenter', () => {
                if (resetChoicesTimeoutId) {
                    clearTimeout(resetChoicesTimeoutId);
                    resetChoicesTimeoutId = null;
                }
                updateChoiceAppearance(index);
                currentFocusIndex = index; // Keep track of focus for keyboard nav
            });

            // Click event
            choice.addEventListener('click', (e) => {
                e.preventDefault(); // Prevent default link behavior
                makeChoice(choice);
            });

            // Focus event (for tab navigation)
            choice.addEventListener('focus', () => {
                if (resetChoicesTimeoutId) {
                    clearTimeout(resetChoicesTimeoutId);
                    resetChoicesTimeoutId = null;
                }
                updateChoiceAppearance(index);
                currentFocusIndex = index;
            });
        });

        // Reset appearance when mouse leaves the choices area
        const choicesContainer = document.querySelector('.modal-choices');
        if (choicesContainer) {
            choicesContainer.addEventListener('mouseleave', () => {
                if (document.activeElement !== choicePrints && document.activeElement !== choiceCoding) {
                    if (resetChoicesTimeoutId) {
                        clearTimeout(resetChoicesTimeoutId);
                    }
                    resetChoicesTimeoutId = setTimeout(() => {
                        updateChoiceAppearance(-1); // Reset to default
                        currentFocusIndex = -1;
                        resetChoicesTimeoutId = null; // Clear the ID after execution
                    }, 150);
                }
            });
        }

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (!landingModal || landingModal.classList.contains('hidden')) {
                return; // Do nothing if modal is hidden
            }

            let previousFocusIndex = currentFocusIndex;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                currentFocusIndex = (currentFocusIndex + 1) % choices.length;
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                currentFocusIndex = (currentFocusIndex - 1 + choices.length) % choices.length;
            } else if (e.key === 'Enter' && currentFocusIndex !== -1) {
                e.preventDefault();
                makeChoice(choices[currentFocusIndex]);
            } else if (e.key === 'Tab') {
                // Allow default tab behavior to move focus,
                // the focus listener on the choice itself will handle the appearance.
                // Determine next focus index based on tab direction
                // This is a simplified tab handling for two items.
                // For more complex scenarios, you might need more robust logic.
                setTimeout(() => { // Timeout to allow focus to shift
                    if (document.activeElement === choicePrints) {
                        currentFocusIndex = 0;
                    } else if (document.activeElement === choiceCoding) {
                        currentFocusIndex = 1;
                    }
                    // If tabbing out of choices, currentFocusIndex might become inaccurate
                    // but focus listener on choices will correct it if tabbing back in.
                }, 0);
                return; // Don't prevent default for Tab
            } else {
                return; // Other keys do nothing
            }

            if (currentFocusIndex !== -1 && choices[currentFocusIndex]) {
                choices[currentFocusIndex].focus(); // This will trigger the 'focus' event listener
            }
        });

        // Initially, no choice is "selected" until interaction
        updateChoiceAppearance(-1); // -1 indicates no active selection initially

        // Optional: Focus the first choice by default if you want
        // setTimeout(() => { // Timeout to ensure everything is rendered
        //    if (choices.length > 0) {
        //        choices[0].focus();
        //        currentFocusIndex = 0;
        //        updateChoiceAppearance(0);
        //    }
        // }, 100);


    } else {
        console.error("Landing modal elements not found. Modal functionality will not work.");
    }
});