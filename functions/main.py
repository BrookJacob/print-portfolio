import os
# Keep other imports as they are
from firebase_functions import https_fn, options
from firebase_admin import initialize_app
import resend
from flask import jsonify # Only jsonify is really needed from Flask here

# Initialize Firebase Admin SDK (needed for functions deployment)
initialize_app()

# --- CORS Headers --- (Keep as is)
CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*', # Or 'https://yourdomain.com'
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '3600'
}

# --- Cloud Function Definition ---
@https_fn.on_request(
    secrets=["RESEND_API_KEY", "SENDER_EMAIL"], # Make secrets available at runtime
    # memory=options.MemoryOption.MB_256 # Optional
    # region='us-central1' # Optional
)
def sendMessage(req: https_fn.Request) -> tuple:
    print("DEBUG: sendMessage function started.")

    if req.method == 'OPTIONS':
        return ("", 204, CORS_HEADERS)

    response_headers = CORS_HEADERS

    if req.method != 'POST':
        return (jsonify({"success": False, "error": "Method Not Allowed"}), 405, response_headers)

    # --- Access Secrets and Configure Resend ---
    try:
        resend_api_key_runtime = os.environ.get("RESEND_API_KEY")
        sender_email_runtime = os.environ.get("SENDER_EMAIL")

        if not resend_api_key_runtime:
             # Handle missing API key error BEFORE trying to use it
             print("Internal configuration error: Resend API key secret (RESEND_API_KEY) is not available at runtime.")
             return (jsonify({"success": False, "error": "Email service configuration error: API key missing."}), 500, response_headers)
        elif not sender_email_runtime:
             # Handle missing sender email error
             print("Internal configuration error: Sender email secret (SENDER_EMAIL) is not available at runtime.")
             return (jsonify({"success": False, "error": "Email service configuration error: Sender email missing."}), 500, response_headers)
        else:
            # Configure Resend using the Quickstart pattern
            resend.api_key = resend_api_key_runtime # Set API key on the module
            print("Resend API key configured for request.")

    except Exception as e:
         # Catch potential errors during environment variable access (less likely)
         print(f"Error accessing environment variables: {e}")
         return (jsonify({"success": False, "error": f"Configuration error: {e}"}), 500, response_headers)
    # --- End Resend Configuration ---

    # --- Process Request Data (Keep as is) ---
    try:
        data = req.get_json()
        # ... (rest of your data processing logic remains the same) ...
        name = data.get("name")
        email = data.get("email")
        message = data.get("message")
        # ... (validation remains the same) ...
        if not name or not email or not message:
             print("Validation Error: Missing required fields.")
             return (jsonify({"success": False, "error": "Missing required fields."}), 400, response_headers)

    except Exception as e:
        print(f"Error parsing request body: {e}")
        return (jsonify({"success": False, "error": "Invalid request body."}), 400, response_headers)


    # --- Prepare and Send Email (Modify the sending call) ---
    params = {
        "from": sender_email_runtime,
        "to": "brookjacob@gmail.com",
        "reply_to": email,
        "subject": f"Contact Form Message from {name}",
        "html": f"""
            <p>You received a new message from your portfolio contact form:</p>
            <hr>
            <p><strong>Name:</strong> {name}</p>
            <p><strong>Email:</strong> <a href="mailto:{email}">{email}</a></p>
            <p><strong>Message:</strong></p>
            <p>{message.replace('\\n', '<br>')}</p>
            <hr>
        """
    }

    try:
        # MODIFY THIS LINE: Use resend.Emails.send directly
        email_response = resend.Emails.send(params)
        # ... (rest of your response handling logic remains the same) ...
        print(f"Resend API response: {email_response}")
        # NOTE: The structure of email_response might be slightly different now.
        # The quickstart example shows it might directly be the email object.
        # Adapt the success check if needed based on actual response.
        # Assuming it's still a dict with an 'id' on success:
        if isinstance(email_response, dict) and email_response.get('id'):
             print(f"Email sent successfully. ID: {email_response.get('id')}")
             return (jsonify({"success": True}), 200, response_headers)
        else:
             # Adapt error extraction if the response structure changed
             print(f"Resend API returned non-success indication: {email_response}")
             error_detail = "Unknown Resend error"
             if isinstance(email_response, dict):
                  error_detail = email_response.get('message') or email_response.get('error',{}).get('message', error_detail)
             elif hasattr(email_response, 'message'): # Check for potential error object attributes
                  error_detail = email_response.message
             return (jsonify({"success": False, "error": f"Failed to send email: {error_detail}"}), 500, response_headers)


    except Exception as e:
        print(f"Exception occurred sending email via Resend: {e}")
        error_message = str(e)
        # Check if the error object has specific attributes for better messages
        if hasattr(e, 'message'):
            error_message = e.message
        return (jsonify({"success": False, "error": f"An unexpected error occurred: {error_message}"}), 500, response_headers)
   