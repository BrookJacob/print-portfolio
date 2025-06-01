// Wait for the HTML document to be fully loaded and parsed
document.addEventListener('DOMContentLoaded', () => {

    console.log('Admin Gallery script.js: DOMContentLoaded event fired!');

    // --- CONFIGURATION ---
    // IMPORTANT: Replace with YOUR actual admin User ID from Firebase Authentication
    // This UID determines who sees the "Add Print" button and can upload.
    const ADMIN_UID = 't0JEI9gKoLPk3dgC03aFwn3u2Xs1';

    // --- Firebase Refs (Initialized in admin.html) ---
    // const auth = firebase.auth(); // Globally available
    // const db = firebase.firestore(); // Globally available
    // const storage = firebase.storage(); // Globally available
    const printsCollection = db.collection("prints");
    const artistStatementsCollection = db.collection("artistStatements");

    // --- Thumbnail Generation Constants ---
    const THUMBNAIL_MAX_WIDTH = 400; // Max width for thumbnail in pixels
    const THUMBNAIL_MAX_HEIGHT = 400; // Max height for thumbnail in pixels
    const THUMBNAIL_QUALITY = 0.85; // JPEG Quality (0 to 1) or null for PNG
    const THUMBNAIL_FORMAT = 'image/jpeg'; // 'image/jpeg' or 'image/png'

    // --- Element Selections (Gallery & Common) ---
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
    const lightboxDeleteButton = document.getElementById('lightbox-delete-button');
    const lightboxDeleteStatus = document.getElementById('lightbox-delete-status');

    // Contact form elements might not exist or be needed on admin page
    // const contactForm = document.getElementById('contact-form');
    // const formStatus = document.getElementById('form-status');
    // const submitButton = contactForm ? contactForm.querySelector('button[type="submit"]') : null;

    // --- Element Selections (Admin & Modals) ---
    const adminNavArea = document.getElementById('admin-nav-area');
    const loginNavArea = document.getElementById('login-nav-area');
    const userInfoNav = document.getElementById('user-info-nav');
    const userEmailNavSpan = document.getElementById('user-email-nav');
    const loginButtonNav = document.getElementById('login-button-nav');
    const logoutButtonNav = document.getElementById('logout-button-nav');
    const addPrintButton = document.getElementById('add-print-button'); // Button near gallery heading
    const adminOnlyElements = document.querySelectorAll('.admin-only'); // Select all elements needing admin access

    const loginModal = document.getElementById('login-modal');
    const addPrintModal = document.getElementById('add-print-modal');
    const modalCloseButtons = document.querySelectorAll('.close-modal-btn');

    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const googleSignInButton = document.getElementById('google-signin-button');

    const uploadForm = document.getElementById('upload-form');
    const uploadButton = document.getElementById('upload-button');
    const uploadStatus = document.getElementById('upload-status');
    const fullsizeFileInput = document.getElementById('fullsize-file');
    const fullsizeProgressContainer = document.getElementById('fullsize-progress-container');
    const fullsizeProgressBar = document.getElementById('fullsize-progress-bar');
    const thumbnailPreviewContainer = document.getElementById('thumbnail-preview-container');
    const thumbnailPreviewImg = document.getElementById('thumbnail-preview');
    const thumbnailPreviewPlaceholder = document.getElementById('thumbnail-preview-placeholder');
    const thumbnailGenStatus = document.getElementById('thumbnail-gen-status');

    const editAboutButton = document.getElementById('edit-about-button');
    const aboutTextarea = document.getElementById('about-text');
    const aboutStatus = document.getElementById('about-status');

    let generatedThumbnailBlob = null; // Will hold the Blob data

    // --- Masonry Variable ---
    let msnry = null;

    // --- Utility Functions ---
    function showStatus(element, message, isError = false) {
        /* ... same as before ... */
        if (!element) return;
        element.textContent = message;
        element.className = 'status-message';
        if (message) {
            element.classList.add(isError ? 'error' : 'success');
            element.style.display = 'block';
        } else {
            element.style.display = 'none';
        }
    }

    function updateProgressBar(container, bar, percentage) {
        /* ... same as before ... */
        if (!container || !bar) return;
        container.style.display = 'block';
        bar.style.width = percentage + '%';
        bar.textContent = Math.round(percentage) + '%';
    }

    function hideProgressBars() {
        // REMOVE: if(thumbnailProgressContainer) thumbnailProgressContainer.style.display = 'none';
        if(fullsizeProgressContainer) fullsizeProgressContainer.style.display = 'none';
        // REMOVE: if(thumbnailProgressBar) { thumbnailProgressBar.style.width = '0%'; thumbnailProgressBar.textContent = '0%'; }
        if(fullsizeProgressBar) { fullsizeProgressBar.style.width = '0%'; fullsizeProgressBar.textContent = '0%'; }
   }

    // --- Modal Handling ---
    function openModal(modalId) { /* ... same as before ... */
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('active');
    }
    function closeModal(modalId) { /* ... same as before ... */
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
    }
    modalCloseButtons.forEach(button => { /* ... same as before ... */
        button.addEventListener('click', () => {
            const modalId = button.getAttribute('data-modal-id');
            closeModal(modalId);
        });
    });
    window.addEventListener('click', (event) => { /* ... same as before ... */
        if (event.target.classList.contains('modal')) {
            event.target.classList.remove('active');
        }
    });
    document.addEventListener('keydown', (event) => { /* ... same as before ... */
        if (event.key === 'Escape') {
            if (loginModal && loginModal.classList.contains('active')) closeModal('login-modal');
            if (addPrintModal && addPrintModal.classList.contains('active')) closeModal('add-print-modal');
            if (lightbox && lightbox.classList.contains('active')) closeLightbox();
        }
    });

    if (addPrintButton) {
        addPrintButton.addEventListener('click', () => {
            if (uploadForm) uploadForm.reset(); // Resets file inputs too
            showStatus(uploadStatus, null);
            hideProgressBars();
            // Reset thumbnail preview
            generatedThumbnailBlob = null;
            if(thumbnailPreviewImg) {
                thumbnailPreviewImg.style.display = 'none';
                thumbnailPreviewImg.removeAttribute('src');
            }
            if(thumbnailPreviewPlaceholder) thumbnailPreviewPlaceholder.style.display = 'inline';
            showStatus(thumbnailGenStatus, null); // Clear generation status

            openModal('add-print-modal');
        });
    }

    // --- Authentication Logic ---
    auth.onAuthStateChanged(user => {
        if (user) {
            // User is logged in
            console.log("Admin Page: User logged in:", user.email, "UID:", user.uid);
            if (userEmailNavSpan) userEmailNavSpan.textContent = user.email;
            if (loginNavArea) loginNavArea.style.display = 'none';
            if (adminNavArea) adminNavArea.style.display = 'block'; // Show admin area in nav
            closeModal('login-modal'); // Close login modal if open
            showStatus(loginError, null); // Clear login errors

            // Check if the logged-in user is THE admin
            if (user.uid === ADMIN_UID) {
                console.log("Admin user detected.");
                // Show elements specifically for admin
                adminOnlyElements.forEach(el => el.style.display = 'inline-block'); // Or 'block'

                if (aboutTextarea) { // Check if the textarea exists on the page
                    artistStatementsCollection.orderBy('createdAt', 'asc').limit(1).get() // Assuming you want the oldest or first created. Adjust orderBy if needed.
                        .then(querySnapshot => {
                            if (!querySnapshot.empty) {
                                const statementDoc = querySnapshot.docs[0].data();
                                if (statementDoc.text !== undefined) {
                                    aboutTextarea.value = statementDoc.text;
                                    console.log("Loaded artist statement into textarea.");
                                }
                            } else {
                                console.log("No artist statement found in Firestore to load.");
                                // Optionally, you could clear the textarea or set a default placeholder
                                // aboutTextarea.value = "Enter your artist statement here...";
                            }
                        })
                        .catch(error => {
                            console.error("Error fetching artist statement: ", error);
                            showStatus(aboutStatus, "Could not load existing About text.", true);
                        });
                }
            } else {
                console.log("Non-admin user logged in.");
                // Hide elements specifically for admin
                adminOnlyElements.forEach(el => el.style.display = 'none');
            }

        } else {
            // User is logged out
            console.log("Admin Page: User logged out");
            if (loginNavArea) loginNavArea.style.display = 'block'; // Show login button area
            if (adminNavArea) adminNavArea.style.display = 'none'; // Hide admin area
            if (userEmailNavSpan) userEmailNavSpan.textContent = '';
            // Hide elements specifically for admin on logout
            adminOnlyElements.forEach(el => el.style.display = 'none');
            if (aboutTextarea) aboutTextarea.value = "";
            showStatus(aboutStatus, null);
        }
    });

    // Handle Login Button Click (Opens Modal)
    if (loginButtonNav) {
        loginButtonNav.addEventListener('click', () => openModal('login-modal'));
    }

    // Handle Login Form Submission (Email/Password)
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => { /* ... same as before ... */
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            auth.signInWithEmailAndPassword(email, password)
                .then(cred => console.log("Email Login successful", cred.user))
                .catch(err => showStatus(loginError, `Login Failed: ${err.message}`, true));
        });
    }

    // Handle Google Sign-In Button Click
    if (googleSignInButton) {
        googleSignInButton.addEventListener('click', () => { /* ... same as before ... */
            const provider = new firebase.auth.GoogleAuthProvider();
            auth.signInWithPopup(provider)
                .then(result => console.log("Google Sign-In successful:", result.user))
                .catch(err => showStatus(loginError, `Google Sign-In Failed: ${err.message}`, true));
        });
    }

    // Handle Logout Button Click
    if (logoutButtonNav) {
        logoutButtonNav.addEventListener('click', () => { /* ... same as before ... */
            auth.signOut().then(() => console.log("Logout successful"))
                .catch(err => console.error("Logout failed:", err));
        });
    }

    // Handle "Add Print" Button Click (Opens Modal)
    if (addPrintButton) { // Using the button near gallery heading now
        addPrintButton.addEventListener('click', () => {
            if (uploadForm) uploadForm.reset();
            showStatus(uploadStatus, null);
            hideProgressBars();
            openModal('add-print-modal');
        });
    }

    if (editAboutButton && aboutTextarea) {
        editAboutButton.addEventListener('click', async (e) => {
            e.preventDefault();
            const user = auth.currentUser;

            if (!user || user.uid !== ADMIN_UID) {
                showStatus(aboutStatus, "Error: You do not have permission to save.", true);
                return;
            }

            const newText = aboutTextarea.value;
            editAboutButton.disabled = true;
            showStatus(aboutStatus, "Saving About text...", false);

            try {
                const querySnapshot = await artistStatementsCollection.orderBy('createdAt', 'asc').limit(1).get(); // Or however you define "first"

                if (querySnapshot.empty) {
                    // If no document exists, you might want to create one.
                    // For now, we'll assume one should exist if an admin is trying to edit.
                    // Or, you could add it:
                    /*
                    await artistStatementsCollection.add({
                        text: newText,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp() // Optional: add a timestamp
                    });
                    console.log("No existing statement, new one created.");
                    showStatus(aboutStatus, "About text saved successfully (new statement created)!", false);
                    */
                    showStatus(aboutStatus, "Error: No artist statement document found to update.", true);
                    console.error("No document found in artistStatements collection to update.");
                    editAboutButton.disabled = false;
                    return;
                }

                const docToUpdate = querySnapshot.docs[0];
                await docToUpdate.ref.update({
                    text: newText,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp() // Optional: add an update timestamp
                });

                console.log("Artist statement updated successfully in Firestore.");
                showStatus(aboutStatus, "About text saved successfully!", false);

            } catch (error) {
                console.error("Error saving artist statement: ", error);
                showStatus(aboutStatus, `Error saving: ${error.message}`, true);
            } finally {
                editAboutButton.disabled = false;
            }
        });
    }

    // --- Gallery Display Logic (Copied from public script.js) ---
    function createGalleryItem(printData, docId) { // Added docId parameter
        const item = document.createElement('div');
        item.classList.add('print-item');
        item.setAttribute('data-doc-id', docId); // Store doc ID on the item div

        const thumbnailContainer = document.createElement('div');
        thumbnailContainer.classList.add('thumbnail-container');
        thumbnailContainer.setAttribute('tabindex', '0');
        thumbnailContainer.style.outline = 'none';

        const img = document.createElement('img');
        img.src = printData.imgThumbnail || 'https://placehold.co/300x300/eee/ccc?text=Image+Missing';
        img.alt = printData.description || printData.title || 'Print image';
        img.onerror = function() { this.onerror = null; this.src = 'https://placehold.co/300x300/eee/ccc?text=Error'; if(msnry) msnry.layout(); };

        // Store data directly on the img for lightbox access
        img.setAttribute('data-doc-id', docId); // Also store doc ID here
        img.setAttribute('data-fullsrc', printData.imgFullsize || '');
        img.setAttribute('data-thumbsrc', printData.imgThumbnail || ''); // Store thumb src too
        img.setAttribute('data-title', printData.title || '');
        img.setAttribute('data-year', printData.year || '');
        const dimensions = (printData.size_w && printData.size_h) ? `${printData.size_w} x ${printData.size_h} inches` : '';
        const price = printData.price ? `$${printData.price}` : 'Inquire for price';
        img.setAttribute('data-dimensions', dimensions);
        img.setAttribute('data-price', price);
        img.setAttribute('data-description', printData.description || '');

        thumbnailContainer.appendChild(img);
        item.appendChild(thumbnailContainer);
        return item;
    }

    async function loadGallery() {
        if (!grid) return;
        console.log("Admin Page: Attempting to fetch prints...");
        grid.innerHTML = '<p style="text-align:center;">Loading gallery...</p>'; // Loading indicator
        if (msnry) {
             try { msnry.destroy(); } catch(e) { console.warn("Error destroying masonry:", e); }
             msnry = null;
         }

        try {
            const querySnapshot = await printsCollection.orderBy("order", "asc").get();
            console.log(`Admin Page: Fetched prints snapshot. Size: ${querySnapshot.size}`);
            if (querySnapshot.empty) {
                grid.innerHTML = '<p style="text-align:center;">No prints found in the gallery.</p>';
                return;
            }

            const fragment = document.createDocumentFragment();
            const newItems = [];
            querySnapshot.forEach((doc) => {
                const printData = doc.data();
                // Basic validation
                if (printData && printData.title && printData.imgThumbnail && printData.imgFullsize) {
                    // --> Pass doc.id to createGalleryItem <--
                    const galleryItemElement = createGalleryItem(printData, doc.id);
                    fragment.appendChild(galleryItemElement);
                    newItems.push(galleryItemElement);
                } else {
                    console.warn(`Admin Page: Skipping doc ${doc.id} missing essential fields (title, imgThumbnail, imgFullsize). Data:`, printData);
                }
            });

            grid.innerHTML = ''; // Clear loading indicator
            grid.appendChild(fragment);
            initializeOrUpdateMasonry(newItems); // Initialize masonry and attach listeners

        } catch (error) {
            console.error("Admin Page: Error fetching prints: ", error);
            grid.innerHTML = '<p style="text-align: center; color: red;">Could not load gallery items. Check console for errors.</p>';
            if (msnry) { try { msnry.destroy(); } catch(e) {} msnry = null; }
        }
    }

    function initializeOrUpdateMasonry(items) { /* ... same as before ... */
        if (!grid || !items || items.length === 0) { if (msnry) { msnry.destroy(); msnry = null; } return; }
        imagesLoaded(grid, function () {
            if (msnry) { msnry.reloadItems(); msnry.layout(); }
            else { msnry = new Masonry(grid, { itemSelector: '.print-item', columnWidth: '.print-item', gutter: 20, percentPosition: true, transitionDuration: '0.4s' }); }
            grid.style.opacity = '1';
            attachGalleryItemListeners();
        });
    }
    function attachGalleryItemListeners() { /* ... same as before ... */
        const galleryItems = grid.querySelectorAll('.thumbnail-container');
        galleryItems.forEach(item => item.replaceWith(item.cloneNode(true)));
        const freshGalleryItems = grid.querySelectorAll('.thumbnail-container');
        freshGalleryItems.forEach(item => {
            item.addEventListener('click', () => { const img = item.querySelector('img'); if (img) openLightbox(img); });
            item.addEventListener('keydown', (event) => { if (event.key === 'Enter') { const img = item.querySelector('img'); if (img) openLightbox(img); } });
            item.setAttribute('tabindex', '0'); item.style.outline = 'none';
        });
        attachHoverEffects(freshGalleryItems);
    }

    // --- Lightbox Functionality (Copied from public script.js) ---
    function openLightbox(imgElement) {
        if (!imgElement || !lightbox) return;

        // Retrieve all necessary data from the img element
        const docId = imgElement.getAttribute('data-doc-id');
        const fullSrc = imgElement.getAttribute('data-fullsrc');
        const thumbSrc = imgElement.getAttribute('data-thumbsrc'); // Get thumb src
        const title = imgElement.getAttribute('data-title');
        const year = imgElement.getAttribute('data-year');
        const dimensions = imgElement.getAttribute('data-dimensions');
        const price = imgElement.getAttribute('data-price');
        const description = imgElement.getAttribute('data-description');

        if (!docId || !fullSrc || !thumbSrc) {
             console.error("Lightbox Error: Missing essential data attributes (doc-id, fullsrc, thumbsrc) on image element:", imgElement);
             // Optionally show an error to the user in the lightbox
             if(lightboxTitle) lightboxTitle.textContent = "Error";
             if(lightboxDescription) lightboxDescription.textContent = "Could not load details for this item.";
             // Hide delete button if data is missing
             if (lightboxDeleteButton) lightboxDeleteButton.style.display = 'none';
             lightbox.classList.add('active');
             document.body.style.overflow = 'hidden';
             return;
        }


        // Store the data needed for deletion on the lightbox element itself
        lightbox.setAttribute('data-doc-id', docId);
        lightbox.setAttribute('data-fullsrc', fullSrc);
        lightbox.setAttribute('data-thumbsrc', thumbSrc);

        // Populate lightbox display elements
        if(lightboxImg) {
            lightboxImg.setAttribute('src', fullSrc || '');
            lightboxImg.onerror = function() { this.onerror = null; this.alt = 'Image load error'; };
            lightboxImg.setAttribute('alt', title || 'Enlarged print');
        }
        if(lightboxTitle) lightboxTitle.textContent = title || '';
        if(lightboxYear) lightboxYear.textContent = year || '';
        if(lightboxDimensions) lightboxDimensions.textContent = dimensions || '';
        if(lightboxPrice) lightboxPrice.textContent = price || '';
        if(lightboxDescription) {
            lightboxDescription.textContent = description || '';
            lightboxDescription.style.display = description ? 'block' : 'none';
        }

        // Check current auth state to show/hide delete button
        const user = auth.currentUser;
        const isAdmin = user && user.uid === ADMIN_UID;
        if (lightboxDeleteButton) {
            lightboxDeleteButton.style.display = isAdmin ? 'inline-block' : 'none';
            lightboxDeleteButton.disabled = false; // Ensure button is enabled initially
        }
        showStatus(lightboxDeleteStatus, null); // Clear any previous delete status

        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
    function closeLightbox() {
        if (!lightbox) return;
        lightbox.classList.remove('active');
        document.body.style.overflow = 'auto';
        if(lightboxImg) lightboxImg.setAttribute('src', ''); // Clear src
        // Clear stored data
        lightbox.removeAttribute('data-doc-id');
        lightbox.removeAttribute('data-fullsrc');
        lightbox.removeAttribute('data-thumbsrc');
        // Hide status message
         showStatus(lightboxDeleteStatus, null);
    }
    if (lightboxCloseBtn) lightboxCloseBtn.addEventListener('click', closeLightbox);
    // Escape key and overlay click handled by general modal logic

    // --- Apple TV Hover Effect (Copied from public script.js) ---
    function attachHoverEffects(items) { /* ... same as before ... */
        items.forEach(container => {
            const img = container.querySelector('img'); if (!img) return; container.style.perspective = '1000px'; img.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)'; let scheduledAnimationFrame = false;
            container.addEventListener('mousemove', (e) => { if (scheduledAnimationFrame) return; scheduledAnimationFrame = true; requestAnimationFrame(() => { const rect = container.getBoundingClientRect(); const x = e.clientX - rect.left - rect.width / 2; const y = e.clientY - rect.top - rect.height / 2; const rotateY = (x / rect.width) * 8; const rotateX = (-y / rect.height) * 8; img.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`; scheduledAnimationFrame = false; }); });
            container.addEventListener('mouseleave', () => { img.style.transform = 'rotateX(0deg) rotateY(0deg) scale(1)'; });
            let isTouching = false; container.addEventListener('touchstart', (e) => { isTouching = true; img.style.transform = 'scale(1.05)'; img.style.transition = 'transform 0.1s ease-out'; }, { passive: true }); function handleTouchEnd() { if (isTouching) { img.style.transform = 'scale(1)'; img.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)'; isTouching = false; } } container.addEventListener('touchend', handleTouchEnd); container.addEventListener('touchcancel', handleTouchEnd);
        });
    }

    // --- Footer Year ---
    if (currentYearSpan) currentYearSpan.textContent = new Date().getFullYear();

    // --- Contact Form (Probably remove from admin page, but keep logic if needed) ---
    // If you keep the contact form on admin.html, this logic is needed.
    /*
    if (contactForm && formStatus && submitButton) {
         // ... same logic as in public script.js ...
    }
    */

    function generateThumbnail(file) {
        return new Promise((resolve, reject) => {
            if (!file || !file.type.startsWith('image/')) {
                reject(new Error("Invalid file type. Please select an image."));
                return;
            }

            showStatus(thumbnailGenStatus, "Generating thumbnail...", false);
            thumbnailPreviewImg.style.display = 'none';
            thumbnailPreviewPlaceholder.style.display = 'none'; // Hide placeholder during processing

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Calculate new dimensions while maintaining aspect ratio
                    if (width > height) {
                        if (width > THUMBNAIL_MAX_WIDTH) {
                            height = Math.round(height * (THUMBNAIL_MAX_WIDTH / width));
                            width = THUMBNAIL_MAX_WIDTH;
                        }
                    } else {
                        if (height > THUMBNAIL_MAX_HEIGHT) {
                            width = Math.round(width * (THUMBNAIL_MAX_HEIGHT / height));
                            height = THUMBNAIL_MAX_HEIGHT;
                        }
                    }

                    // Ensure dimensions are at least 1px
                    width = Math.max(1, width);
                    height = Math.max(1, height);


                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');

                    // Draw image to canvas (this performs the resize)
                    ctx.drawImage(img, 0, 0, width, height);

                    // Convert canvas to Blob
                    canvas.toBlob((blob) => {
                        if (!blob) {
                            reject(new Error("Canvas to Blob conversion failed."));
                            return;
                        }
                        // Add a filename to the blob
                         blob.name = `thumb_${file.name}`;
                        // Resolve with the blob
                        resolve(blob);

                    }, THUMBNAIL_FORMAT, THUMBNAIL_QUALITY);
                };
                img.onerror = () => {
                     reject(new Error("Failed to load image for thumbnail generation."));
                };
                img.src = e.target.result; // Set source for the Image object
            };
            reader.onerror = () => {
                reject(new Error("Failed to read the selected file."));
            };
            reader.readAsDataURL(file); // Read the file as Data URL
        });
    }

    if (fullsizeFileInput) {
        fullsizeFileInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) {
                // No file selected or selection canceled
                generatedThumbnailBlob = null;
                thumbnailPreviewImg.style.display = 'none';
                thumbnailPreviewImg.removeAttribute('src');
                thumbnailPreviewPlaceholder.style.display = 'inline';
                showStatus(thumbnailGenStatus, null);
                return;
            }

            try {
                generatedThumbnailBlob = await generateThumbnail(file);

                // Display the generated thumbnail preview
                const previewUrl = URL.createObjectURL(generatedThumbnailBlob);
                thumbnailPreviewImg.src = previewUrl;
                thumbnailPreviewImg.style.display = 'block'; // Show the img tag
                thumbnailPreviewPlaceholder.style.display = 'none'; // Hide placeholder
                 // Clean up the object URL when the image is loaded to prevent memory leaks
                 thumbnailPreviewImg.onload = () => {
                     URL.revokeObjectURL(thumbnailPreviewImg.src);
                 }


                showStatus(thumbnailGenStatus, `Thumbnail generated (${(generatedThumbnailBlob.size / 1024).toFixed(1)} KB). Ready to upload.`, false); // Use 'success' class optionally

            } catch (error) {
                console.error("Thumbnail generation failed:", error);
                showStatus(thumbnailGenStatus, `Thumbnail generation failed: ${error.message}`, true);
                generatedThumbnailBlob = null; // Reset blob on error
                thumbnailPreviewImg.style.display = 'none';
                thumbnailPreviewImg.removeAttribute('src');
                thumbnailPreviewPlaceholder.style.display = 'inline'; // Show placeholder again
            }
        });
    }

    // --- Upload Logic ---
    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            showStatus(uploadStatus, "Starting upload...", false);
            if(uploadButton) uploadButton.disabled = true;
            hideProgressBars(); // Hides only fullsize progress now

            const user = auth.currentUser;
            if (!user || user.uid !== ADMIN_UID) { // Combined checks
                showStatus(uploadStatus, "Error: Admin user not logged in or insufficient permissions.", true);
                if(uploadButton) uploadButton.disabled = false;
                return;
            }

            // Get form data
            const title = document.getElementById('title').value;
            const order = parseInt(document.getElementById('order').value, 10);
            const year = document.getElementById('year').value || null;
            const price = parseFloat(document.getElementById('price').value) || null;
            const size_w = parseFloat(document.getElementById('size_w').value) || null;
            const size_h = parseFloat(document.getElementById('size_h').value) || null;
            const description = document.getElementById('description').value || null;

            const fullsizeFile = fullsizeFileInput.files[0];
            // --> Use the generated blob <--
            const thumbnailFileBlob = generatedThumbnailBlob; // Get the stored blob

            // Validation
            if (!title || isNaN(order) || !fullsizeFile || !thumbnailFileBlob) {
                 let errorMsg = "Error: Please fill in Title, Order, select a full-size image, and ensure thumbnail is generated.";
                 if (!fullsizeFile) errorMsg = "Error: Please select a full-size image file.";
                 else if (!thumbnailFileBlob) errorMsg = "Error: Thumbnail not generated. Please re-select the full-size image.";
                 else errorMsg = "Error: Please fill in Title and Order fields.";

                 showStatus(uploadStatus, errorMsg, true);
                 if(uploadButton) uploadButton.disabled = false;
                 return;
            }

            const timestamp = Date.now();
             // Use blob's name if available, otherwise construct one
            const thumbFileName = `${timestamp}_${thumbnailFileBlob.name || 'thumb.jpg'}`;
            const fullFileName = `${timestamp}_full_${fullsizeFile.name}`;
            const thumbStoragePath = `thumbnails/${thumbFileName}`;
            const fullStoragePath = `fullsize/${fullFileName}`;


            try {
                showStatus(uploadStatus, "Uploading images...", false);

                // --- Upload Tasks ---
                // Pass null for thumbnail progress elements as they are removed
                const uploadTaskThumb = uploadFile(storage, thumbStoragePath, thumbnailFileBlob, null, null);
                // Pass fullsize progress elements
                const uploadTaskFull = uploadFile(storage, fullStoragePath, fullsizeFile, fullsizeProgressContainer, fullsizeProgressBar);

                // --> Wait for both uploads <--
                const [thumbUrl, fullUrl] = await Promise.all([uploadTaskThumb, uploadTaskFull]);

                showStatus(uploadStatus, "Images uploaded. Saving metadata...", false);

                const printData = {
                    title: title, order: order, year: year, price: price,
                    size_w: size_w, size_h: size_h, description: description,
                    imgThumbnail: thumbUrl, imgFullsize: fullUrl, // Store URLs
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    uploaderUid: user.uid
                };

                await printsCollection.add(printData);

                showStatus(uploadStatus, "Print successfully uploaded!", false);
                uploadForm.reset(); // Reset form fields
                // --> Manually reset preview state after successful upload <--
                generatedThumbnailBlob = null;
                 if(thumbnailPreviewImg) {
                     thumbnailPreviewImg.style.display = 'none';
                     thumbnailPreviewImg.removeAttribute('src');
                 }
                 if(thumbnailPreviewPlaceholder) thumbnailPreviewPlaceholder.style.display = 'inline';
                 showStatus(thumbnailGenStatus, null);

                closeModal('add-print-modal'); // Close modal on success
                await loadGallery(); // Reload the gallery display

            } catch (error) {
                console.error("Admin Page: Upload failed:", error);
                 let errorMsg = `Upload Failed: ${error.message}`;
                if (error.code === 'storage/unauthorized' || error.code === 'permission-denied') {
                    errorMsg = "Upload Failed: Permission denied. Ensure you are logged in with the admin account and rules are correctly set.";
                }
                showStatus(uploadStatus, errorMsg, true);
            } finally {
                if(uploadButton) uploadButton.disabled = false;
            }
        });
    }

    // --- Reusable File Upload Function ---
    function uploadFile(storageRef, path, file, progressContainer, progressBar) {
        if (!storage) return Promise.reject(new Error("Firebase Storage not initialized."));
        // Handle case where thumbnail progress elements are null
        const showProgress = progressContainer && progressBar;

        return new Promise((resolve, reject) => {
           const fileRef = storageRef.ref(path);
           const uploadTask = fileRef.put(file); // Uploads File or Blob

           uploadTask.on('state_changed',
               (snapshot) => {
                   if (showProgress) { // Only update progress if elements exist
                       const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                       updateProgressBar(progressContainer, progressBar, progress);
                   }
                },
               (error) => { reject(error); },
               () => {
                   uploadTask.snapshot.ref.getDownloadURL().then(resolve).catch(reject);
                }
           );
       });
   }

    async function deletePrint() {
        if (!lightboxDeleteButton || !lightbox) return;

        const docId = lightbox.getAttribute('data-doc-id');
        const fullSrc = lightbox.getAttribute('data-fullsrc');
        const thumbSrc = lightbox.getAttribute('data-thumbsrc');

        if (!docId || !fullSrc || !thumbSrc) {
            showStatus(lightboxDeleteStatus, "Error: Cannot delete. Missing item data.", true);
            return;
        }

        // --- Confirmation ---
        const title = lightboxTitle.textContent || 'this print';
        if (!confirm(`Are you absolutely sure you want to delete "${title}"?\nThis will remove the database entry AND the image files. This action cannot be undone.`)) {
            return; // User canceled
        }

        // --- Deletion Process ---
        lightboxDeleteButton.disabled = true;
        showStatus(lightboxDeleteStatus, "Deleting...", false);

        try {
            // 1. Delete Firestore Document
            showStatus(lightboxDeleteStatus, "Deleting database entry...", false);
            const docRef = db.collection("prints").doc(docId);
            await docRef.delete();
            console.log(`Firestore document ${docId} deleted.`);

            // 2. Delete Full-size Image from Storage
            try {
                 showStatus(lightboxDeleteStatus, "Deleting full-size image...", false);
                 const fullSizeRef = storage.refFromURL(fullSrc);
                 await fullSizeRef.delete();
                 console.log(`Storage file (full-size) ${fullSrc} deleted.`);
            } catch (storageError) {
                 // Log error but continue to delete thumbnail if possible
                 console.error(`Error deleting full-size image ${fullSrc}:`, storageError);
                 // Optionally inform user, but primary goal is DB entry deletion
                 showStatus(lightboxDeleteStatus, "Database entry deleted, but error deleting full-size image (check console).", true);
                 // Do not re-throw yet, try deleting thumbnail
            }


            // 3. Delete Thumbnail Image from Storage
             try {
                 showStatus(lightboxDeleteStatus, "Deleting thumbnail image...", false);
                 const thumbRef = storage.refFromURL(thumbSrc);
                 await thumbRef.delete();
                 console.log(`Storage file (thumbnail) ${thumbSrc} deleted.`);
            } catch (storageError) {
                 // Log error, database entry is already gone.
                 console.error(`Error deleting thumbnail image ${thumbSrc}:`, storageError);
                 showStatus(lightboxDeleteStatus, "Database entry deleted, but error deleting thumbnail image (check console).", true);
                 // Do not re-throw
            }


            // 4. Success Feedback & UI Update
            showStatus(lightboxDeleteStatus, "Print deleted successfully!", false); // Show success briefly
            setTimeout(() => {
                closeLightbox(); // Close the lightbox
                loadGallery(); // Reload the gallery to reflect the change
            }, 1500); // Wait 1.5 seconds before closing


        } catch (error) {
            console.error(`Error deleting print (docId: ${docId}):`, error);
            showStatus(lightboxDeleteStatus, `Error deleting print: ${error.message}. Check console.`, true);
            lightboxDeleteButton.disabled = false; // Re-enable button on error
        }
    }

    if (lightboxDeleteButton) {
        lightboxDeleteButton.addEventListener('click', deletePrint);
    }

    // --- Initial Load ---
    loadGallery(); // Load the gallery when the admin page loads

}); // End DOMContentLoaded
