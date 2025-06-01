document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const loginSection = document.getElementById('login-section');
    const adminSection = document.getElementById('admin-section');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const googleSignInButton = document.getElementById('google-signin-button'); // Added Google button
    const userInfo = document.getElementById('user-info');
    const userEmailSpan = document.getElementById('user-email');
    const logoutButton = document.getElementById('logout-button');

    const uploadForm = document.getElementById('upload-form');
    const uploadButton = document.getElementById('upload-button');
    const uploadStatus = document.getElementById('upload-status');

    const thumbnailFileInput = document.getElementById('thumbnail-file');
    const fullsizeFileInput = document.getElementById('fullsize-file');
    const thumbnailProgressContainer = document.getElementById('thumbnail-progress-container');
    const thumbnailProgressBar = document.getElementById('thumbnail-progress-bar');
    const fullsizeProgressContainer = document.getElementById('fullsize-progress-container');
    const fullsizeProgressBar = document.getElementById('fullsize-progress-bar');


    // --- Firebase Refs (Initialized in admin.html) ---
    // const auth = firebase.auth(); // Already available from HTML
    // const db = firebase.firestore(); // Already available from HTML
    // const storage = firebase.storage(); // Already available from HTML
    const printsCollection = db.collection("prints");


    // --- Utility Functions ---
    function showStatus(element, message, isError = false) {
        element.textContent = message;
        element.className = 'status-message'; // Reset classes
        if (message) {
            element.classList.add(isError ? 'error' : 'success');
            element.style.display = 'block';
        } else {
            element.style.display = 'none';
        }
    }

    function updateProgressBar(container, bar, percentage) {
        container.style.display = 'block';
        bar.style.width = percentage + '%';
        bar.textContent = Math.round(percentage) + '%';
    }

    function hideProgressBars() {
         thumbnailProgressContainer.style.display = 'none';
         fullsizeProgressContainer.style.display = 'none';
         thumbnailProgressBar.style.width = '0%';
         thumbnailProgressBar.textContent = '0%';
         fullsizeProgressBar.style.width = '0%';
         fullsizeProgressBar.textContent = '0%';
    }


    // --- Authentication Logic ---

    // Listen for auth state changes
    auth.onAuthStateChanged(user => {
        if (user) {
            // User is logged in
            console.log("User logged in:", user.email, "UID:", user.uid); // Log UID too
            userEmailSpan.textContent = user.email;
            loginSection.style.display = 'none';
            adminSection.style.display = 'block';
            showStatus(loginError, null); // Clear login errors
        } else {
            // User is logged out
            console.log("User logged out");
            loginSection.style.display = 'block';
            adminSection.style.display = 'none';
            userEmailSpan.textContent = '';
        }
    });

    // Handle Login Form Submission (Email/Password)
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        auth.signInWithEmailAndPassword(email, password)
            .then((userCredential) => {
                console.log("Email Login successful", userCredential.user);
            })
            .catch((error) => {
                console.error("Email Login failed:", error);
                showStatus(loginError, `Login Failed: ${error.message}`, true);
            });
    });

    // Handle Google Sign-In Button Click --- NEW ---
    googleSignInButton.addEventListener('click', () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        // You could add custom parameters if needed, like login hints
        // provider.setCustomParameters({ login_hint: 'user@example.com' });

        auth.signInWithPopup(provider)
            .then((result) => {
                // This gives you a Google Access Token. You can use it to access the Google API.
                // const credential = result.credential;
                // const token = credential.accessToken;
                // The signed-in user info.
                const user = result.user;
                console.log("Google Sign-In successful:", user);
                // UI update is handled by onAuthStateChanged
            }).catch((error) => {
                // Handle Errors here.
                const errorCode = error.code;
                const errorMessage = error.message;
                // The email of the user's account used.
                const email = error.email;
                // The firebase.auth.AuthCredential type that was used.
                const credential = error.credential;
                console.error("Google Sign-In failed:", errorCode, errorMessage, email, credential);
                showStatus(loginError, `Google Sign-In Failed: ${errorMessage}`, true);
            });
    });
    // --- END NEW ---

    // Handle Logout Button Click
    logoutButton.addEventListener('click', () => {
        auth.signOut().then(() => {
            console.log("Logout successful");
        }).catch((error) => {
            console.error("Logout failed:", error);
        });
    });


    // --- Upload Logic (Remains the same) ---

    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showStatus(uploadStatus, "Starting upload...", false);
        uploadButton.disabled = true;
        hideProgressBars();

        const user = auth.currentUser; // Get current user (could be email or Google)
        if (!user) {
            showStatus(uploadStatus, "Error: Not logged in.", true);
            uploadButton.disabled = false;
            return;
        }

        // Get form data (remains the same)
        const title = document.getElementById('title').value;
        const order = parseInt(document.getElementById('order').value, 10);
        const year = document.getElementById('year').value || null;
        const price = parseFloat(document.getElementById('price').value) || null;
        const size_w = parseFloat(document.getElementById('size_w').value) || null;
        const size_h = parseFloat(document.getElementById('size_h').value) || null;
        const description = document.getElementById('description').value || null;
        const thumbnailFile = thumbnailFileInput.files[0];
        const fullsizeFile = fullsizeFileInput.files[0];

        if (!title || isNaN(order) || !thumbnailFile || !fullsizeFile) {
            showStatus(uploadStatus, "Error: Please fill in Title, Order, and select both image files.", true);
            uploadButton.disabled = false;
            return;
        }

        const timestamp = Date.now();
        const thumbFileName = `${timestamp}_thumb_${thumbnailFile.name}`;
        const fullFileName = `${timestamp}_full_${fullsizeFile.name}`;
        const thumbStoragePath = `thumbnails/${thumbFileName}`;
        const fullStoragePath = `fullsize/${fullFileName}`;

        try {
            showStatus(uploadStatus, "Uploading images...", false);
            const uploadTaskThumb = uploadFile(storage, thumbStoragePath, thumbnailFile, thumbnailProgressContainer, thumbnailProgressBar);
            const uploadTaskFull = uploadFile(storage, fullStoragePath, fullsizeFile, fullsizeProgressContainer, fullsizeProgressBar);
            const [thumbUrl, fullUrl] = await Promise.all([uploadTaskThumb, uploadTaskFull]);

            showStatus(uploadStatus, "Images uploaded. Saving metadata...", false);

            const printData = {
                title: title, order: order, year: year, price: price,
                size_w: size_w, size_h: size_h, description: description,
                imgThumbnail: thumbUrl, imgFullsize: fullUrl,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await printsCollection.add(printData);
            showStatus(uploadStatus, "Print successfully uploaded and saved!", false);
            uploadForm.reset();

        } catch (error) {
            console.error("Upload failed:", error);
            showStatus(uploadStatus, `Upload Failed: ${error.message}`, true);
        } finally {
            uploadButton.disabled = false;
        }
    });


    // --- Reusable File Upload Function (Remains the same) ---
    function uploadFile(storageRef, path, file, progressContainer, progressBar) {
        return new Promise((resolve, reject) => {
            const fileRef = storageRef.ref(path);
            const uploadTask = fileRef.put(file);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    updateProgressBar(progressContainer, progressBar, progress);
                },
                (error) => { reject(error); },
                () => {
                    uploadTask.snapshot.ref.getDownloadURL().then(resolve).catch(reject);
                }
            );
        });
    }

}); // End DOMContentLoaded
