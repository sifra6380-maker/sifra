"""
Input sanitization helpers.

These functions are the *last line of defence* against:
  - SQL injection  (SQLAlchemy ORM parameterisation is the first line)
  - XSS via stored content
  - Unicode / null-byte smuggling

Rules
-----
* NEVER pass user-supplied strings directly into text() or raw SQL.
* Use these helpers on any field that is echoed back in HTML or stored as-is.
* Numeric / enum fields validated by Pydantic don't need these helpers.
"""

import re
import bleach

# ── Allowed HTML for rich-text fields (descriptions, bios) ────────────────────
_ALLOWED_TAGS:  list[str] = []           # strip ALL HTML — plain text only
_ALLOWED_ATTRS: dict      = {}


def strip_html(value: str) -> str:
    """Remove every HTML tag and attribute. Returns plain text."""
    if not value:
        return value
    return bleach.clean(value, tags=_ALLOWED_TAGS, attributes=_ALLOWED_ATTRS, strip=True)


def sanitize_text(value: str, max_length: int = 2000) -> str:
    """
    Strip HTML, null bytes, control chars, and trim whitespace.
    Truncates to `max_length` as an extra safety cap.
    """
    if not value:
        return value
    # Remove null bytes (poison for some DB drivers)
    value = value.replace("\x00", "")
    # Remove other ASCII control characters except \n \r \t
    value = re.sub(r"[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]", "", value)
    # Strip HTML
    value = strip_html(value)
    # Collapse multiple blank lines
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()[:max_length]


def sanitize_search(query: str, max_length: int = 200) -> str:
    """
    Sanitise a free-text search string before it is fed into .ilike().

    SQLAlchemy *parameterises* the query so SQL injection is not possible
    via ilike — but we still:
      1. Strip HTML / control chars
      2. Escape the LIKE wildcards the user themselves typed so they
         cannot craft unbounded % patterns that cause full-table scans.
      3. Trim to a safe maximum length.
    """
    if not query:
        return query
    value = sanitize_text(query, max_length)
    # Escape LIKE metacharacters typed by the user
    # (SQLAlchemy's ilike does NOT do this automatically)
    value = value.replace("\\", "\\\\")
    value = value.replace("%",  "\\%")
    value = value.replace("_",  "\\_")
    return value


def sanitize_slug(value: str) -> str:
    """Produce a URL-safe lowercase slug (letters, digits, hyphens only)."""
    value = value.lower().strip()
    value = re.sub(r"[^a-z0-9\-]", "-", value)
    value = re.sub(r"-{2,}", "-", value)
    return value.strip("-")[:100]


def sanitize_url(value: str) -> str:
    """
    Allow only http/https URLs. Returns empty string for anything else.
    Prevents javascript: / data: scheme injection.
    """
    if not value:
        return value
    value = value.strip()
    if not re.match(r"^https?://", value, re.IGNORECASE):
        return ""
    # Strip any embedded null bytes
    return value.replace("\x00", "")[:500]


def sanitize_filename(name: str) -> str:
    """Return a safe filename — letters, digits, dots, hyphens, underscores."""
    name = re.sub(r"[^\w.\-]", "_", name)
    # Remove leading dots (hidden files)
    return name.lstrip(".") or "file"


# ── Audit helper: guard against raw SQL text() usage ─────────────────────────

def safe_like(value: str) -> str:
    """
    Convenience alias — use when building an ORM .filter(col.ilike(...)).
    Escapes LIKE wildcards so the search is always an exact-prefix/infix match,
    never a wildcard injection.

    Example:
        query.filter(Task.title.ilike(f"%{safe_like(search)}%", escape="\\"))
    """
    if not value:
        return value
    return (
        value
        .replace("\\", "\\\\")
        .replace("%",  "\\%")
        .replace("_",  "\\_")
    )
