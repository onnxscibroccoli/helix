#!/usr/bin/env python3
import base64, hashlib, hmac, json, os, sqlite3, ssl, time, urllib.parse, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SECRET = os.environ["HELIX_DCV_LAUNCH_SECRET"].encode()
OWNER = os.environ["HELIX_DESKTOP_OWNER_EMAIL"].strip().lower()
HOSTNAME = "3-237-173-174.sslip.io"
DB = "/var/lib/helix-launch/nonces.db"
def decode(value):
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # Never log proofs or single-use DCV tokens.
    def respond(self, code, body):
        raw = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Content-Security-Policy", "default-src 'none'")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)
    def do_GET(self):
        path = urllib.parse.urlsplit(self.path)
        if path.path == "/health":
            return self.respond(200, "ok")
        if path.path != "/launch" or len(self.path) > 2048:
            return self.respond(404, "Not found")
        try:
            proof = urllib.parse.parse_qs(path.query, strict_parsing=True)["proof"]
            if len(proof) != 1:
                raise ValueError("proof count")
            payload, signature = proof[0].split(".")
            expected = hmac.new(SECRET, payload.encode("ascii"), hashlib.sha256).digest()
            if not hmac.compare_digest(expected, decode(signature)):
                raise ValueError("signature")
            data = json.loads(decode(payload))
            now = int(time.time())
            if (not isinstance(data, dict) or data.get("workspace") != "helix-workspace"
                or str(data.get("email", "")).lower() != OWNER
                or not isinstance(data.get("sub"), str) or not data["sub"]
                or not isinstance(data.get("nonce"), str) or len(data["nonce"]) > 80
                or not isinstance(data.get("exp"), int)
                or not now <= data["exp"] <= now + 60):
                raise ValueError("claims")
            with sqlite3.connect(DB) as db:
                db.execute("DELETE FROM nonces WHERE expires < ?", (now - 60,))
                db.execute("INSERT INTO nonces (nonce, expires) VALUES (?, ?)", (data["nonce"], data["exp"]))
                db.commit()
            request = urllib.request.Request("http://127.0.0.1:8080/create-token",
                data=urllib.parse.urlencode({"user": "helix", "session": "helix-workspace", "ttl": 120}).encode(),
                method="POST")
            with urllib.request.urlopen(request, timeout=4) as response:
                token = json.load(response)["authToken"]
            location = "https://" + HOSTNAME + ":8443/?authToken=" + urllib.parse.quote(token, safe="") + "#helix-workspace"
            self.send_response(303)
            self.send_header("Location", location)
            self.send_header("Cache-Control", "no-store")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header("Content-Length", "0")
            self.end_headers()
        except Exception:
            self.respond(403, "Launch denied. Return to Helix and open the desktop again.")
os.makedirs("/var/lib/helix-launch", mode=0o700, exist_ok=True)
with sqlite3.connect(DB) as db:
    db.execute("CREATE TABLE IF NOT EXISTS nonces(nonce TEXT PRIMARY KEY, expires INTEGER NOT NULL)")
server = ThreadingHTTPServer(("0.0.0.0", 9443), Handler)
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.minimum_version = ssl.TLSVersion.TLSv1_2
context.load_cert_chain("/etc/letsencrypt/live/" + HOSTNAME + "/fullchain.pem",
                        "/etc/letsencrypt/live/" + HOSTNAME + "/privkey.pem")
server.socket = context.wrap_socket(server.socket, server_side=True)
server.serve_forever()
