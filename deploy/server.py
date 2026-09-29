#!/usr/bin/env python3
import json
import mimetypes
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from socketserver import ThreadingMixIn
from urllib.parse import unquote, urlsplit


ROOT = (Path(__file__).resolve().parent / "site").resolve()
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8080"))

mimetypes.add_type("application/manifest+json", ".webmanifest")
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("image/svg+xml", ".svg")


class Handler(BaseHTTPRequestHandler):
    server_version = "DeveloperToolbox/1.0"

    def do_GET(self):
        self._serve(send_body=True)

    def do_HEAD(self):
        self._serve(send_body=False)

    def do_POST(self):
        self.send_response(405)
        self.send_header("Allow", "GET, HEAD")
        self.end_headers()

    def _serve(self, send_body: bool):
        if urlsplit(self.path).path == "/__health":
            body = json.dumps({"ok": True}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            if send_body:
                self.wfile.write(body)
            return

        try:
            relative = unquote(urlsplit(self.path).path).lstrip("/\\")
            candidate = (ROOT / relative).resolve()
            candidate.relative_to(ROOT)
        except (ValueError, OSError):
            self.send_error(403, "Forbidden")
            return

        if candidate.is_dir():
            candidate = candidate / "index.html"
        if not candidate.is_file():
            candidate = ROOT / "index.html"
        if not candidate.is_file():
            self.send_error(404, "Not Found")
            return

        content_type = mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
        if content_type.startswith("text/") or candidate.suffix in {".js", ".json", ".webmanifest"}:
            content_type += "; charset=utf-8"

        normalized = candidate.as_posix()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(candidate.stat().st_size))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        if normalized.endswith(("/index.html", "/sw.js", "/manifest.webmanifest")):
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        elif "/assets/" in normalized:
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        else:
            self.send_header("Cache-Control", "public, max-age=3600")
        if normalized.endswith("/sw.js"):
            self.send_header("Service-Worker-Allowed", "/")
        self.end_headers()

        if send_body:
            with candidate.open("rb") as file:
                chunk = file.read(64 * 1024)
                while chunk:
                    self.wfile.write(chunk)
                    chunk = file.read(64 * 1024)

    def log_message(self, fmt, *args):
        print(f"{self.address_string()} - {fmt % args}")


class CompatibleThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True


if __name__ == "__main__":
    try:
        server = CompatibleThreadingHTTPServer((HOST, PORT), Handler)
        print(f"开发者工具箱正在运行：http://{HOST}:{PORT}")
        server.serve_forever()
    except OSError as error:
        if getattr(error, "errno", None) in {48, 98, 10048}:
            print(
                f"端口 {PORT} 已被占用。可使用 "
                "DEVELOPER_TOOLBOX_PORT=其他端口 ./start.sh 启动。"
            )
        else:
            print(f"启动失败：{error}")
        raise SystemExit(1)
    except KeyboardInterrupt:
        pass
