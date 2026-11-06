"""One-time desktop OAuth consent for the dedicated Gmail sender (Python 3 stdlib only).
Tokens are saved locally, never printed. Run from backend; see docs/evaluator-invitations.md.
"""
import base64
import hashlib
import json
import os
from pathlib import Path
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer


def main():
    client_id = os.environ.get("EVALHUB_GMAIL_CLIENT_ID", "")
    client_secret = os.environ.get("EVALHUB_GMAIL_CLIENT_SECRET", "")
    if not client_id or not client_secret:
        raise SystemExit("Set EVALHUB_GMAIL_CLIENT_ID and EVALHUB_GMAIL_CLIENT_SECRET for a Desktop OAuth client.")
    output = Path(__file__).resolve().parents[1] / ".gmail-oauth.local.json"
    if output.exists():
        raise SystemExit("Local token file already exists. Move it to a secure location before reconnecting.")
    state, verifier = secrets.token_urlsafe(32), secrets.token_urlsafe(64)
    received = {}

    class Callback(BaseHTTPRequestHandler):
        def do_GET(self):
            query = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
            if query.get("state", [""])[0] != state:
                self.send_error(400, "Invalid OAuth state")
                return
            received.update(query)
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"OAuth response received. You can close this window and return to the terminal.")

        def log_message(self, *_args):
            pass  # Callback URLs contain authorization codes.

    with HTTPServer(("127.0.0.1", 0), Callback) as server:
        server.timeout = 1
        redirect = f"http://127.0.0.1:{server.server_port}/"
        params = urllib.parse.urlencode({
            "client_id": client_id, "redirect_uri": redirect, "response_type": "code",
            "scope": "https://www.googleapis.com/auth/gmail.send", "access_type": "offline",
            "prompt": "consent", "state": state, "code_challenge_method": "S256",
            "code_challenge": base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("="),
        })
        url = "https://accounts.google.com/o/oauth2/v2/auth?" + params
        print("Opening Google consent. Sign in with the dedicated sender account.")
        if not webbrowser.open(url):
            print("Open this authorization URL in your browser:")
            print(url)
        deadline = time.monotonic() + 300
        while not received and time.monotonic() < deadline:
            server.handle_request()
    if "code" not in received:
        raise SystemExit("Authorization was cancelled or timed out. No tokens saved.")
    form = urllib.parse.urlencode({
        "client_id": client_id, "client_secret": client_secret, "code": received["code"][0],
        "code_verifier": verifier, "redirect_uri": redirect, "grant_type": "authorization_code",
    }).encode()
    try:
        with urllib.request.urlopen("https://oauth2.googleapis.com/token", data=form, timeout=30) as response:
            tokens = json.load(response)
    except urllib.error.URLError:
        raise SystemExit("Token exchange failed. Check OAuth configuration and retry.") from None
    if not tokens.get("refresh_token"):
        raise SystemExit("No refresh token returned. Reconnect with offline consent.")
    with output.open("x", encoding="utf-8") as handle:
        json.dump({"refresh_token": tokens["refresh_token"]}, handle, indent=2)
    print(f"Refresh token saved to {output.name}. This file is gitignored; keep it private.")


if __name__ == "__main__":
    main()
