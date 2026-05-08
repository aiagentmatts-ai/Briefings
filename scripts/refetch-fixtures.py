#!/usr/bin/env python3
"""
Refetch tests/fixtures/palegis/ from live www.palegis.us.

Two modes:

    python scripts/refetch-fixtures.py
        Overwrite each fixture file with fresh HTML from the source URL.
        Use this when palegis legitimately changed (new committee, new
        legislator) and the parser tests need to be re-pointed at current
        ground truth. Inspect the diff in `git status` afterward; commit
        only if the changes look reasonable, and update assertions in
        tests/test_palegis.py if any ground-truth values shifted.

    python scripts/refetch-fixtures.py --diff-only
        Fetch each source URL, compare structurally against the saved
        fixture, and exit non-zero if structure differs. The nightly
        drift workflow uses this — do NOT auto-update the fixture, since
        a real source change might silently break parse semantics. Open
        an issue, eyeball the diff, decide.

The source URL for each fixture lives in tests/fixtures/palegis/MANIFEST.json
so this stays in lockstep with whatever the test suite is asserting against.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import requests
from bs4 import BeautifulSoup

REPO_ROOT = Path(__file__).resolve().parent.parent
FIXTURE_DIR = REPO_ROOT / "tests" / "fixtures" / "palegis"
MANIFEST_PATH = FIXTURE_DIR / "MANIFEST.json"
USER_AGENT = "pa-ga-guide-fixture-refresher/1.0 (+https://github.com/aiagentmatts-ai)"
TIMEOUT = 30


def fetch(url: str) -> str:
    r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT)
    r.raise_for_status()
    return r.text


def structural_signature(html: str) -> dict:
    """Reduce an HTML doc to a structural fingerprint that ignores volatile
    text content but trips on anything the parser actually depends on:
    selector counts (div.member, a.committee, span.thumb-info-inner, etc.),
    presence of the data-* attributes we read, and the JS email obfuscation
    pattern.
    """
    s = BeautifulSoup(html, "lxml")
    selectors = [
        "div.member[data-name]",
        "div.member[data-district]",
        "div.member[data-party]",
        "div.member[data-county]",
        "div.member[data-leadership]",
        "span.thumb-info-inner",
        "span.thumb-info-type",
        "a.committee",
        "span.badge",
        "i[title='Capitol Office']",
        "i[title='Phone']",
    ]
    sig = {sel: len(s.select(sel)) for sel in selectors}
    # Bio email obfuscation pattern presence (we don't store the values).
    sig["js_email_block_present"] = "var Name" in html and "var Domain" in html and "var Ext" in html
    # Bio link presence (used by committee detail to map to canonical IDs).
    sig["bio_links_count"] = sum(
        1 for a in s.find_all("a", href=True) if "/members/bio/" in a["href"]
    )
    sig["bill_links_count"] = sum(
        1 for a in s.find_all("a", href=True) if "/legislation/bills/" in a["href"]
    )
    return sig


def load_manifest() -> dict:
    if not MANIFEST_PATH.exists():
        print(f"manifest missing: {MANIFEST_PATH}", file=sys.stderr)
        sys.exit(1)
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def cmd_refetch(manifest: dict) -> int:
    for filename, entry in manifest["fixtures"].items():
        url = entry["url"]
        path = FIXTURE_DIR / filename
        print(f"  fetch {url}", file=sys.stderr)
        try:
            html = fetch(url)
        except requests.RequestException as e:
            print(f"  ! failed: {e}", file=sys.stderr)
            return 2
        path.write_text(html, encoding="utf-8")
    print(f"Wrote {len(manifest['fixtures'])} fixtures.", file=sys.stderr)
    return 0


def cmd_diff_only(manifest: dict) -> int:
    drift: list[str] = []
    for filename, entry in manifest["fixtures"].items():
        url = entry["url"]
        path = FIXTURE_DIR / filename
        if not path.exists():
            drift.append(f"{filename}: fixture missing on disk")
            continue
        try:
            live_html = fetch(url)
        except requests.RequestException as e:
            print(f"  ! fetch failed for {filename}: {e}", file=sys.stderr)
            continue
        saved_sig = structural_signature(path.read_text(encoding="utf-8"))
        live_sig = structural_signature(live_html)
        diffs = [k for k in saved_sig if saved_sig[k] != live_sig.get(k)]
        if diffs:
            drift.append(
                f"{filename}: structural change in {diffs} "
                f"(saved={ {k:saved_sig[k] for k in diffs} }, live={ {k:live_sig.get(k) for k in diffs} })"
            )
    if drift:
        print("DRIFT DETECTED:", file=sys.stderr)
        for d in drift:
            print(f"  - {d}", file=sys.stderr)
        return 1
    print("No structural drift.", file=sys.stderr)
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Refetch palegis fixtures.")
    p.add_argument(
        "--diff-only",
        action="store_true",
        help="Fetch live and compare structural signature against saved fixtures; exit 1 on drift.",
    )
    args = p.parse_args(argv)
    manifest = load_manifest()
    if args.diff_only:
        return cmd_diff_only(manifest)
    return cmd_refetch(manifest)


if __name__ == "__main__":
    sys.exit(main())
