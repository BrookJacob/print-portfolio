// Wait for the HTML document to be fully loaded and parsed
document.addEventListener('DOMContentLoaded', () => {

    console.log('DOMContentLoaded event fired!');

    // --- Element Selections (Keep most, grid is key) ---
    // REMOVE: const galleryItems = document.querySelectorAll('.thumbnail-container'); (We select these later)
    const grid = document.querySelector('.gallery-grid');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxTitle = document.getElementById('lightbox-title');
    const lightboxYear = document.getElementById('lightbox-year');
    const lightboxDimensions = document.getElementById('lightbox-dimensions');
    const lightboxPrice = document.getElementById('lightbox-price');
    const lightboxDescription = document.getElementById('lightbox-description');
    const lightboxCloseBtn = lightbox.querySelector('.close-btn');
    const currentYearSpan = document.getElementById('current-year');
    const contactForm = document.getElementById('contact-form');
    const formStatus = document.getElementById('form-status');
    const submitButton = contactForm ? contactForm.querySelector('button[type="submit"]') : null;

    // --- Masonry Variable ---
    let msnry = null;

    // --- Firestore Collection Reference ---

    // --- START: Connect to Emulators IF running locally ---
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        console.log("App is running locally. Connecting to Firebase Emulators.");

        // Point Firestore SDK to Emulator
        firebase.firestore().useEmulator("localhost", 8080);
        console.log("Firestore Emulator connected on port 8080");

        // ===>>> Point Storage SDK to Emulator (Ensure this line is active!) <<<===
        // Default Storage emulator port is 9199. Adjust if yours is different.
        firebase.storage().useEmulator("localhost", 9199); // <<== UNCOMMENT/ADD THIS
        console.log("Storage Emulator connected on port 9199");

        // Point Auth SDK to Emulator (if needed)
        // firebase.auth().useEmulator("http://localhost:9099");
        // console.log("Auth Emulator connected on port 9099");

    } else {
        console.log("App is running on deployed environment. Connecting to live Firebase services.");
    }
    // --- END: Connect to Emulators ---

    // Get service instances AFTER potentially connecting to emulators
    const db = firebase.firestore();
    const storage = firebase.storage(); // Get storage instance if needed elsewhere

    // Ensure Firebase has been initialized in index.html before this script runs
    const printsCollection = db.collection("prints");

    // --- Function to Create a Gallery Item Element ---
    function createGalleryItem(printData) {
        const item = document.createElement('div');
        item.classList.add('print-item');

        const thumbnailContainer = document.createElement('div');
        thumbnailContainer.classList.add('thumbnail-container');
        // Add tabindex and style for keyboard nav/focus handling later
        thumbnailContainer.setAttribute('tabindex', '0');
        thumbnailContainer.style.outline = 'none'; // Hide default outline

        const img = document.createElement('img');
        img.src = printData.imgThumbnail; // Use thumbnail URL
        img.alt = printData.description || printData.title; // Use description or title for alt text

        // Add data attributes for lightbox
        img.setAttribute('data-fullsrc', printData.imgFullsize);
        img.setAttribute('data-title', printData.title || '');
        img.setAttribute('data-year', printData.year || '');
        // Format dimensions and price
        const dimensions = (printData.size_w && printData.size_h) ? `${printData.size_w} x ${printData.size_h} inches` : '';
        const price = printData.price ? `$${printData.price}` : '';
        img.setAttribute('data-dimensions', dimensions);
        img.setAttribute('data-price', price);
        img.setAttribute('data-description', printData.description || '');

        thumbnailContainer.appendChild(img);
        item.appendChild(thumbnailContainer);

        // Optional: Add caption div if you want to display title/year below thumbnail
        // const caption = document.createElement('div');
        // caption.classList.add('caption');
        // caption.innerHTML = `<h4 class="print-title">${printData.title || ''}</h4><p class="print-year">${printData.year || ''}</p>`;
        // item.appendChild(caption);

        return item;
    }


    // --- Fetch Prints from Firestore and Build Gallery ---
    async function loadGallery() {
        if (!grid) {
            console.error("Gallery grid element not found.");
            return;
        }

        grid.innerHTML = ''; // Clear any existing static content or loading indicators

        console.log("Attempting to fetch prints from emulator...");

        try {
            const querySnapshot = await printsCollection.orderBy("order", "asc").get();

            console.log(`Fetched prints snapshot. Size: ${querySnapshot.size}`); // <-- Add Log

            if (querySnapshot.empty) {
                console.log("No documents found in 'prints' collection in the emulator."); // <-- Add Log
                // Optional: Display a message on the page
                // grid.innerHTML = '<p>No prints found.</p>';
                // return; // Exit if empty
            }

            const fragment = document.createDocumentFragment(); // Use fragment for performance

            querySnapshot.forEach((doc) => {
                const printData = doc.data();
                const galleryItemElement = createGalleryItem(printData);
                fragment.appendChild(galleryItemElement);
            });

            grid.appendChild(fragment); // Append all items at once

            // --- Initialize Masonry AFTER items are added and images potentially loaded ---
            initializeMasonryAndAttachListeners();

        } catch (error) {
            console.error("Error fetching prints from Firestore: ", error);
            grid.innerHTML = '<p style="text-align: center; color: red;">Could not load gallery items.</p>';
        }
    }

    // --- Function to Initialize Masonry & Attach Event Listeners ---
    function initializeMasonryAndAttachListeners() {
        if (!grid) return;

        imagesLoaded(grid, function () {
            msnry = new Masonry(grid, {
                itemSelector: '.print-item',
                columnWidth: '.print-item',
                gutter: 20,
                percentPosition: true,
                transitionDuration: '0.4s'
            });
            grid.style.opacity = '1'; // Fade in grid
            console.log('Masonry initialized after dynamic load!');

            // Now select the dynamically added items
            const galleryItems = grid.querySelectorAll('.thumbnail-container');

            // Re-attach Lightbox listeners
            galleryItems.forEach(item => {
                item.addEventListener('click', () => {
                    const img = item.querySelector('img');
                    if (img) openLightbox(img);
                });
                item.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        const img = item.querySelector('img');
                        if (img) openLightbox(img);
                    }
                });
            });

            // Re-attach Hover effect listeners
            attachHoverEffects(galleryItems);
        });
    }


    // --- Artist Statement Loading ---
    function createArtistStatementElement(statementData) {
        const statementElement = document.createElement('div');
        statementElement.classList.add('artist-statement');
        statementElement.innerHTML = marked.parse(statementData.text);
        return statementElement;
    }

    async function loadArtistStatement() {
        const artistStatementCollection = db.collection("artistStatements");
        const artistStatementSnapshot = await artistStatementCollection.get();
        console.log(`Fetched artist statement snapshot. Size: ${artistStatementSnapshot.size}`);

        if (artistStatementSnapshot.empty) {
            console.log("No documents found in 'artistStatement' collection in the emulator.");
            return;
        }

        const fragment = document.createDocumentFragment();

        const aboutContent = document.getElementsByClassName('about-content')[0];
        if (!aboutContent) {
            console.error("About content element not found.");
            return;
        }

        aboutContent.innerHTML = ''; // Clear any existing content

        artistStatementSnapshot.forEach((doc) => {
            const statementData = doc.data();
            const statementElement = createArtistStatementElement(statementData);
            fragment.appendChild(statementElement);
        });

        aboutContent.appendChild(fragment);
        aboutContent.style.opacity = '1'; // Fade in content
    }

    // --- Lightbox Functionality (Keep openLightbox & closeLightbox as they are) ---
    function openLightbox(imgElement) {
        if (!imgElement || !lightbox) return; // Safety check

        // Get data from the image element's data attributes
        const fullSrc = imgElement.getAttribute('data-fullsrc');
        const title = imgElement.getAttribute('data-title');
        const year = imgElement.getAttribute('data-year');
        const dimensions = imgElement.getAttribute('data-dimensions');
        const price = imgElement.getAttribute('data-price');
        const description = imgElement.getAttribute('data-description');

        // Populate lightbox elements
        lightboxImg.setAttribute('src', fullSrc);
        lightboxImg.setAttribute('alt', title || 'Enlarged print'); // Set alt text
        lightboxTitle.textContent = title || '';
        lightboxYear.textContent = year || '';
        lightboxDimensions.textContent = dimensions || '';
        lightboxPrice.textContent = price || '';
        lightboxDescription.textContent = description || '';

        // Hide description paragraph if description is empty
        lightboxDescription.style.display = description ? 'block' : 'none';

        // Show the lightbox
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
        if (!lightbox) return; // Safety check
        lightbox.classList.remove('active');
        document.body.style.overflow = 'auto';
        // Optional: Clear image src to stop loading if closed quickly
        // lightboxImg.setAttribute('src', '');
    }

    // Add listeners for closing lightbox (these can stay outside the dynamic part)
    if (lightboxCloseBtn) {
        lightboxCloseBtn.addEventListener('click', closeLightbox);
    }
    if (lightbox) {
        lightbox.addEventListener('click', (event) => {
            if (event.target === lightbox) closeLightbox();
        });
    }
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && lightbox.classList.contains('active')) {
            closeLightbox();
        }
    });
    // --- End Lightbox ---


    // --- Apple TV Hover Effect (Wrap in a function to call after dynamic load) ---
    function attachHoverEffects(items) {
        items.forEach(container => {
            const img = container.querySelector('img');
            if (!img) return;

            // Apply perspective to the container
            container.style.perspective = '1000px';

            let scheduledAnimationFrame = false;

            container.addEventListener('mousemove', (e) => {
                if (scheduledAnimationFrame) return;
                scheduledAnimationFrame = true;

                requestAnimationFrame(() => {
                    const rect = container.getBoundingClientRect();
                    const x = e.clientX - rect.left - rect.width / 2;
                    const y = e.clientY - rect.top - rect.height / 2;
                    const rotateY = (x / rect.width) * 8;
                    const rotateX = (-y / rect.height) * 8;
                    img.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
                    scheduledAnimationFrame = false;
                });
            });

            container.addEventListener('mouseleave', () => {
                img.style.transform = 'rotateX(0deg) rotateY(0deg) scale(1)';
                img.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
            });

            // --- Basic Touch Handling --- (Keep as is)
            let isTouching = false;
            container.addEventListener('touchstart', (e) => {
                isTouching = true;
                img.style.transform = 'scale(1.05)';
                img.style.transition = 'transform 0.1s ease-out';
            }, { passive: true });
            container.addEventListener('touchend', () => {
                if (isTouching) {
                    img.style.transform = 'scale(1)';
                    img.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
                    isTouching = false;
                }
            });
            container.addEventListener('touchcancel', () => {
                if (isTouching) {
                    img.style.transform = 'scale(1)';
                    img.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
                    isTouching = false;
                }
            });
        });
    }
    // --- End Hover Effect ---


    // --- Footer Year ---
    if (currentYearSpan) {
        currentYearSpan.textContent = new Date().getFullYear();
    }

    // --- Contact Form (Keep Asynchronous Submission as is) ---
    if (contactForm && formStatus && submitButton) {
        contactForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            submitButton.disabled = true;
            submitButton.textContent = 'Sending...';
            formStatus.textContent = '';
            formStatus.style.color = 'inherit';
            const formData = new FormData(contactForm);
            const formDataObject = Object.fromEntries(formData.entries());

            try {
                const response = await fetch('/api/sendMessage', { // Assumes you have a Cloud Function endpoint
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', },
                    body: JSON.stringify(formDataObject),
                });
                const result = await response.json();
                if (response.ok && result.success) {
                    formStatus.textContent = 'Message sent successfully! Thank you.';
                    formStatus.style.color = 'var(--color-accent)';
                    contactForm.reset();
                } else {
                    formStatus.textContent = result.error || 'An error occurred server-side. Please try again.';
                    formStatus.style.color = 'red';
                }
            } catch (error) {
                console.error('Network or fetch error submitting form:', error.message);
                formStatus.textContent = 'Network error. Please check connection and try again.';
                formStatus.style.color = 'red';
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Send Message';
            }
        });
    } else {
        if (!contactForm) console.error("Contact form element not found.");
        if (!formStatus) console.error("Form status element not found.");
        if (!submitButton) console.error("Form submit button not found.");
    }
    // --- End Contact Form ---

    // --- Initial Load ---
    console.log('Calling loadGallery()...');
    loadGallery(); // Call the function to fetch data and build the gallery
    loadArtistStatement(); //Call the function to fetch artist statement

}); // End DOMContentLoaded