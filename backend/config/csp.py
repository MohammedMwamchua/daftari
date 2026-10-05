"""Content-Security-Policy for the built screens (production, when Django serves them): only this site's own scripts
run, plus the one small inline theme script in index.html, allowed by its hash. A script slipped in some other way
cannot run, and no other site may show the pages in a frame."""
import base64
import hashlib
import re
from functools import lru_cache
from pathlib import Path

from django.conf import settings


def _browser_text(code):
    """Browsers hash an inline script after the HTML parser turns CRLF (and a lone CR) into LF."""
    return code.replace(b'\r\n', b'\n').replace(b'\r', b'\n')


@lru_cache(maxsize=1)
def policy():
    index = (Path(settings.FRONTEND_DIST) / 'index.html').read_bytes()
    scripts = [_browser_text(code) for code in re.findall(rb'<script>(.*?)</script>', index, re.S)]
    hashes = ' '.join(f"'sha256-{base64.b64encode(hashlib.sha256(code).digest()).decode()}'" for code in scripts)
    return '; '.join([
        "default-src 'self'",
        f"script-src 'self' {hashes}".strip(),
        "style-src 'self' 'unsafe-inline'",  # React and the animation library set style="" attributes
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "worker-src 'self' blob:",  # the close-day confetti draws in a background worker
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    ])


def add_headers(headers, path, url):
    """WhiteNoise hook: the same policy on any HTML file it serves straight from the build."""
    if url.endswith('.html'):
        headers['Content-Security-Policy'] = policy()
