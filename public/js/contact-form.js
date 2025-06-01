// Wait for the HTML document to be fully loaded and parsed
document.addEventListener('DOMContentLoaded', () => {
    console.log('Contact form script loaded!');

    // --- Element Selections for Contact Form ---
    const contactForm = document.getElementById('contact-form');
    const formStatus = document.getElementById('form-status');
    // Ensure contactForm exists before trying to querySelector on it
    const submitButton = contactForm ? contactForm.querySelector('button[type="submit"]') : null;

    // --- Contact Form Submission Logic ---
    if (contactForm && formStatus && submitButton) {
        contactForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Prevent default form submission

            // Disable button and show sending status
            submitButton.disabled = true;
            submitButton.textContent = 'Sending...';
            formStatus.textContent = ''; // Clear previous status
            formStatus.style.color = 'inherit'; // Reset status color

            // Get form data
            const formData = new FormData(contactForm);
            const formDataObject = Object.fromEntries(formData.entries());

            try {
                // Send data to the backend API endpoint
                const response = await fetch('/api/sendMessage', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formDataObject),
                });

                const result = await response.json(); // Parse JSON response from server

                if (response.ok && result.success) {
                    // On successful submission
                    formStatus.textContent = 'Message sent successfully! Thank you.';
                    formStatus.style.color = 'var(--color-accent)'; // Use accent color for success
                    contactForm.reset(); // Clear the form fields
                } else {
                    // On server-side error or non-success response
                    formStatus.textContent = result.error || 'An error occurred server-side. Please try again.';
                    formStatus.style.color = 'red'; // Use red for error messages
                }
            } catch (error) {
                // On network error or other issues with the fetch call
                console.error('Network or fetch error submitting form:', error.message);
                formStatus.textContent = 'Network error. Please check connection and try again.';
                formStatus.style.color = 'red';
            } finally {
                // Re-enable the submit button and reset its text, regardless of success or failure
                submitButton.disabled = false;
                submitButton.textContent = 'Send Message';
            }
        });
    } else {
        // Log errors if essential form elements are not found
        if (!contactForm) console.error("Contact form element with ID 'contact-form' not found.");
        if (!formStatus) console.error("Form status element with ID 'form-status' not found.");
        if (contactForm && !submitButton) console.error("Submit button within the contact form not found.");
    }
});