"""Pytest setup for the scraper tests.

Production scripts live at `scripts/scrape-*.py` (hyphenated, so the
GitHub Actions workflows can invoke them as `python scripts/scrape-X.py`),
but Python module names can't contain hyphens. This loads each one via
importlib under an underscored name so tests can do
`from scrape_palegis import ...`, `from scrape_pjm_markets import ...`, etc.

Add new scrapers to SCRAPERS below. Tests then import their parse functions
without any further plumbing.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# (module_name, script_filename) — must match scripts/<filename>.py.
SCRAPERS: list[tuple[str, str]] = [
    ("scrape_palegis", "scrape-palegis.py"),
    ("scrape_pjm_markets", "scrape-pjm-markets.py"),
]


def _load_scraper(module_name: str, filename: str) -> None:
    path = REPO_ROOT / "scripts" / filename
    spec = importlib.util.spec_from_file_location(module_name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"could not load {path}")
    mod = importlib.util.module_from_spec(spec)
    # Register before exec so @dataclass can resolve forward references via sys.modules.
    sys.modules[module_name] = mod
    spec.loader.exec_module(mod)


for name, file in SCRAPERS:
    _load_scraper(name, file)
