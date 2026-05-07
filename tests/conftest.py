"""Pytest setup for the palegis scraper tests.

The production script lives at `scripts/scrape-palegis.py` (hyphen, so the
GitHub Actions workflow can invoke it as `python scripts/scrape-palegis.py`),
but Python module names can't contain hyphens. This loads it via importlib
under the name `scrape_palegis` so tests can `from scrape_palegis import ...`.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRAPER_PATH = REPO_ROOT / "scripts" / "scrape-palegis.py"


def _load_scraper():
    spec = importlib.util.spec_from_file_location("scrape_palegis", SCRAPER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"could not load {SCRAPER_PATH}")
    mod = importlib.util.module_from_spec(spec)
    # Register before exec so @dataclass can resolve forward references via sys.modules.
    sys.modules["scrape_palegis"] = mod
    spec.loader.exec_module(mod)
    return mod


_load_scraper()
