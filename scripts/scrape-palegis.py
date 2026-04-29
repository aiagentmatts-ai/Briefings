#!/usr/bin/env python3
"""
PA GA Guide — palegis.us scraper.

Refreshes pa-ga-guide/data/legislators.json and pa-ga-guide/data/bills.json
from www.palegis.us. The hand-curated overlay at pa-ga-guide/data/rea-overlay.json
is intentionally never read or written here — the front-end merges it on top
at load time.

Run weekly via .github/workflows/refresh-pa-ga-guide.yml. Locally:

    python scripts/scrape-palegis.py                   # full refresh, writes pa-ga-guide/data/
    python scripts/scrape-palegis.py --dry-run         # write to a temp dir instead
    python scripts/scrape-palegis.py --out-dir /tmp/x  # custom destination
    python scripts/scrape-palegis.py --limit 5         # scrape only the first 5 members per chamber (smoke test)
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE = "https://www.palegis.us"
SESSION_YEAR = 2025  # 2025-2026 regular session
USER_AGENT = "pa-ga-guide-scraper/1.0 (+https://github.com/aiagentmatts-ai)"
REQUEST_DELAY_SEC = 0.3
REQUEST_TIMEOUT = 30
MAX_BILLS_PER_MEMBER = 15

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT_DIR = REPO_ROOT / "pa-ga-guide" / "data"

# Stable short ids for committees that already exist in the prototype data.
# Keyed by (chamber, normalized name). Anything not in this table falls back
# to a deterministic slug.
COMMITTEE_ID_ALIASES: dict[tuple[str, str], str] = {
    ("S", "Environmental Resources & Energy"): "sen-envres",
    ("S", "Communications & Technology"): "sen-comms",
    ("S", "Consumer Protection & Professional Licensure"): "sen-conscom",
    ("S", "Agriculture & Rural Affairs"): "sen-agrural",
    ("S", "Finance"): "sen-finance",
    ("S", "Banking & Insurance"): "sen-banking",
    ("S", "Local Government"): "sen-localgov",
    ("S", "Labor & Industry"): "sen-laborind",
    ("S", "State Government"): "sen-stategov",
    ("S", "Transportation"): "sen-transport",
    ("S", "Appropriations"): "sen-approps",
    ("S", "Rules & Executive Nominations"): "sen-rules",
    ("H", "Consumer Protection, Technology & Utilities"): "hse-consumer",
    ("H", "Agriculture & Rural Affairs"): "hse-agrural",
    ("H", "Environmental Resources & Energy"): "hse-envres",
    ("H", "Commerce"): "hse-commerce",
    ("H", "Insurance"): "hse-insurance",
    ("H", "Finance"): "hse-finance",
    ("H", "Local Government"): "hse-localgov",
    ("H", "Labor & Industry"): "hse-laborind",
    ("H", "Transportation"): "hse-transport",
    ("H", "State Government"): "hse-stategov",
    ("H", "Judiciary"): "hse-judiciary",
    ("H", "Veterans Affairs & Emergency Preparedness"): "hse-veterans",
    ("H", "Appropriations"): "hse-approps",
    ("H", "Game & Fisheries"): "hse-gameFish",
}

# Topic heuristic: ordered list — first match wins.
TOPIC_RULES: list[tuple[str, re.Pattern[str]]] = [
    ("Energy", re.compile(r"\b(energy|electric|utility|utilities|grid|solar|wind|gas|pipeline|net.?metering|distribut(ion|ed generation)|pjm|coal|nuclear|renewable)\b", re.I)),
    ("Telecom", re.compile(r"\b(broadband|telecom|fiber|internet|wireless|5g|cellular|telemarket\w*|spoof\w*|caller.?id)\b", re.I)),
    ("Tax", re.compile(r"\b(tax|taxation|revenue|fiscal|property.tax|tax.credit|appropriation)\b", re.I)),
    ("Education", re.compile(r"\b(school|education|teacher|student|college|university|tuition)\b", re.I)),
    ("Health", re.compile(r"\b(health|medical|medicaid|medicare|hospital|insurance|telehealth|behavioral)\b", re.I)),
    ("Ag", re.compile(r"\b(agricultur|farm|forestry|timber|dairy|livestock|rural|game.lands|fisheries)\b", re.I)),
    ("Labor", re.compile(r"\b(labor|workforce|apprentic|wage|employment|union|workers)\b", re.I)),
    ("Transportation", re.compile(r"\b(transport|highway|road|bridge|truck|vehicle|transit|rail|driver)\b", re.I)),
    ("Public Safety", re.compile(r"\b(police|fire|emergency|crime|firearm|sentencing|judicial)\b", re.I)),
    ("Government", re.compile(r"\b(open.meeting|sunshine|election|voter|right.to.know|ethics|lobbying|state.government)\b", re.I)),
]

# Status -> statusKind heuristic. Order matters; first hit wins.
STATUS_STOP = re.compile(r"\b(veto|failed|tabled|withdrawn|defeated)\b", re.I)
STATUS_GO = re.compile(r"\b(passed|signed|adopted|reported.out|act\s+no|second consideration|third consideration|approved by governor)\b", re.I)


@dataclass
class Member:
    palegis_id: str
    chamber: str  # "S" or "H"
    name: str
    party: str  # "R" or "D"
    district: int
    bio_url: str
    canonical_id: str = ""
    initials: str = ""
    counties: list[str] = field(default_factory=list)
    role: str = ""
    committees: list[dict] = field(default_factory=list)
    office: dict = field(default_factory=dict)
    phone: str = ""
    email: str = ""

    def to_json(self) -> dict:
        out = {
            "id": self.canonical_id,
            "chamber": self.chamber,
            "name": self.name,
            "party": self.party,
            "district": self.district,
            "initials": self.initials,
            "counties": self.counties,
            "role": self.role,
            "committees": self.committees,
            "office": self.office,
            "phone": self.phone,
            "email": self.email,
            "photo": f"https://www.palegis.us/resources/images/members/300/{self.palegis_id}.jpg",
        }
        return out


# -- HTTP -----------------------------------------------------------------

_session: requests.Session | None = None


def http() -> requests.Session:
    global _session
    if _session is None:
        s = requests.Session()
        s.headers.update({"User-Agent": USER_AGENT})
        _session = s
    return _session


def fetch(url: str) -> str:
    """GET with one retry on 5xx and a small politeness delay."""
    full = url if url.startswith("http") else urljoin(BASE, url)
    for attempt in range(2):
        try:
            r = http().get(full, timeout=REQUEST_TIMEOUT)
            if r.status_code >= 500 and attempt == 0:
                time.sleep(1.0)
                continue
            r.raise_for_status()
            time.sleep(REQUEST_DELAY_SEC)
            return r.text
        except requests.RequestException:
            if attempt == 0:
                time.sleep(1.0)
                continue
            raise
    raise RuntimeError(f"unreachable: {full}")


def soup(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "lxml")


# -- ID + name helpers ----------------------------------------------------

_NAME_SUFFIX_RE = re.compile(r"\b(jr|sr|ii|iii|iv|esq)\.?$", re.I)


def last_name(full_name: str) -> str:
    parts = full_name.replace(",", "").strip().split()
    if not parts:
        return ""
    if _NAME_SUFFIX_RE.match(parts[-1]) and len(parts) >= 2:
        parts = parts[:-1]
    return parts[-1]


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def assign_canonical_id(name: str, district: int, taken: set[str]) -> str:
    base = slugify(last_name(name))
    if not base:
        base = f"member{district}"
    if base not in taken:
        taken.add(base)
        return base
    suffixed = f"{base}{district}"
    taken.add(suffixed)
    return suffixed


def compute_initials(name: str) -> str:
    """Two-letter initials: first letter of given name + first letter of last name."""
    parts = [p for p in re.split(r"[\s.,-]+", name) if p]
    if not parts:
        return ""
    given = parts[0][:1].upper()
    last = last_name(name)[:1].upper()
    return (given + last) or given


# -- Field parsers --------------------------------------------------------

_PHONE_RE = re.compile(r"\(\d{3}\)\s*\d{3}-\d{4}")
_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_COUNTY_LIST_RE = re.compile(r"([A-Z][A-Za-z'\.\- ]+?(?:\s*\([^)]*\))?)\s*(?:,|&|and|$)")


def parse_office(addr: str) -> dict:
    """Best-effort parse of a capitol office address line.

    Examples seen on palegis:
        "177 Main Capitol, Senate Box 203029, Harrisburg, PA 17120-3029"
        "362 Main Capitol, Senate Box 203023"
        "423 Irvis Office Building, House Box 202057"
    """
    if not addr:
        return {}
    head = addr.split(",", 1)[0].strip()
    m = re.match(r"^(\d+[A-Za-z]?)\s+(.*)$", head)
    if not m:
        return {}
    room = m.group(1)
    building_raw = m.group(2).strip()
    # Normalise common building names to match the prototype's wording.
    building = building_raw
    building = re.sub(r"\bIrvis Office Building\b", "Irvis Office Bldg", building, flags=re.I)
    building = re.sub(r"\bRyan Office Building\b", "Ryan Office Bldg", building, flags=re.I)
    building = re.sub(r"\bMain Capitol Building\b", "Main Capitol", building, flags=re.I)
    floor: int | str = ""
    floor_digits = re.match(r"^(\d+)", room)
    if floor_digits:
        # Senate/House office rooms are floor-prefixed (177 -> 1, 362 -> 3, 423 -> 4).
        room_num = int(floor_digits.group(1))
        if room_num >= 100:
            floor = room_num // 100
    out: dict = {"room": room, "building": building}
    if floor != "":
        out["floor"] = floor
    return out


def parse_counties(text: str) -> list[str]:
    if not text:
        return []
    cleaned = re.sub(r"\s*Counties?\b\.?", "", text, flags=re.I)
    cleaned = cleaned.replace("&", ",").replace(" and ", ", ")
    out: list[str] = []
    for chunk in cleaned.split(","):
        c = chunk.strip().rstrip(".")
        c = re.sub(r"\s*\([^)]*\)\s*", "", c).strip()
        if c and c not in out:
            out.append(c)
    return out


def derive_status_kind(status: str) -> str:
    if not status:
        return "wait"
    if STATUS_STOP.search(status):
        return "stop"
    if STATUS_GO.search(status):
        return "go"
    return "wait"


def derive_topic(title: str) -> str:
    if not title:
        return "Other"
    for label, pat in TOPIC_RULES:
        if pat.search(title):
            return label
    return "Other"


_MONTH_ABBR = {
    "January": "Jan", "February": "Feb", "March": "Mar", "April": "Apr",
    "May": "May", "June": "Jun", "July": "Jul", "August": "Aug",
    "September": "Sep", "October": "Oct", "November": "Nov", "December": "Dec",
}


def format_last_action(text: str) -> str:
    """Pull the most recent date out of a status/action string and format it 'Mon DD'."""
    if not text:
        return ""
    m = re.search(r"\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})", text)
    if m:
        return f"{_MONTH_ABBR[m.group(1)]} {int(m.group(2)):02d}"
    m = re.search(r"\b(\d{1,2})/(\d{1,2})(?:/\d{2,4})?\b", text)
    if m:
        try:
            month = int(m.group(1))
            day = int(m.group(2))
            return f"{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month-1]} {day:02d}"
        except (IndexError, ValueError):
            return ""
    return ""


# -- Roster parsing -------------------------------------------------------

_BIO_PATH_RE = re.compile(r"/(senate|house)/members/bio/(\d+)/(sen|rep)-([a-z0-9-]+)")


def _titlecase_county(c: str) -> str:
    parts = re.split(r"(\s+|-)", c.strip())
    return "".join(p.capitalize() if p.strip() and p != "-" else p for p in parts)


def parse_roster(html: str, chamber: str) -> list[Member]:
    """Read member cards from /{chamber}/members.

    Cards are <div class="member" data-name="..." data-district="..." data-party="..."
    data-county="..." data-leadership="...">, each containing a bio <a> and a clean
    <span class="thumb-info-inner">Name</span>. We pull everything from data-* attributes
    so we don't have to scrape display fragments.
    """
    s = soup(html)
    members: list[Member] = []
    seen_ids: set[str] = set()

    for card in s.select("div.member[data-name]"):
        bio_a = card.find("a", href=_BIO_PATH_RE)
        if not bio_a:
            continue
        m = _BIO_PATH_RE.search(bio_a["href"])
        if not m or (chamber == "S") != (m.group(1) == "senate"):
            continue
        palegis_id = m.group(2)
        if palegis_id in seen_ids:
            continue
        seen_ids.add(palegis_id)

        # Display name: prefer the inner span — already in "First Middle Last" form.
        inner = card.select_one("span.thumb-info-inner")
        name = inner.get_text(" ", strip=True) if inner else ""
        if not name:
            # Fallback: data-name is "Last First Middle" — flip to "First Middle Last".
            raw = (card.get("data-name") or "").strip()
            if "," in raw:
                last, first = [p.strip() for p in raw.split(",", 1)]
                name = f"{first} {last}".strip()
            else:
                parts = raw.split()
                if len(parts) >= 2:
                    name = " ".join(parts[1:] + parts[:1])
                else:
                    name = raw

        district_str = (card.get("data-district") or "").lstrip("0") or "0"
        try:
            district = int(district_str)
        except ValueError:
            continue

        party_raw = (card.get("data-party") or "").upper()
        party = "R" if party_raw.startswith("R") else "D" if party_raw.startswith("D") else "I"

        counties: list[str] = []
        county_attr = card.get("data-county") or ""
        for c in county_attr.split(","):
            c = c.strip()
            if c:
                counties.append(_titlecase_county(c))

        role = (card.get("data-leadership") or "").strip()

        bio_url = urljoin(BASE, bio_a["href"].strip())
        member = Member(
            palegis_id=palegis_id,
            chamber=chamber,
            name=name,
            party=party,
            district=district,
            bio_url=bio_url,
        )
        member.counties = counties
        member.role = role
        members.append(member)

    members.sort(key=lambda x: (x.chamber, x.district))
    return members


# -- Officers -------------------------------------------------------------

def parse_officers(html: str) -> dict[str, str]:
    """Extract leadership-name -> title map from a chamber officers page.

    Officers pages reuse the same card layout as the roster — each card has
    <span class="thumb-info-inner">Name</span> and <span class="thumb-info-type">Role</span>.
    """
    s = soup(html)
    out: dict[str, str] = {}
    for inner in s.select("span.thumb-info-inner"):
        name = inner.get_text(" ", strip=True)
        if not name:
            continue
        role_span = inner.find_next("span", class_="thumb-info-type")
        if not role_span:
            continue
        role = role_span.get_text(" ", strip=True)
        # Strip any party/district fragments (e.g. " Republican\nDistrict 23").
        role = re.sub(r"\s+(Republican|Democrat|Democratic|Independent)\b.*$", "", role).strip()
        role = re.sub(r"\s+District\s+\d+.*$", "", role).strip()
        if role and "District" not in role:
            out.setdefault(name, role)
    return out


# -- Bio page -------------------------------------------------------------

_EMAIL_JS_RE = re.compile(
    r'var\s+Name\s*=\s*"([^"]+)"\s*;\s*var\s+Domain\s*=\s*"([^"]+)"\s*;\s*var\s+Ext\s*=\s*"([^"]+)"',
    re.S,
)


def enrich_from_bio(member: Member, html: str) -> None:
    s = soup(html)

    # Capitol office + phone come from the same <ul> on palegis. Pull them together
    # so we don't accidentally grab a district-office phone instead of the Capitol one.
    member.office, member.phone = _extract_capitol_block(s)

    # Email — palegis assembles it client-side from three JS vars to thwart scrapers.
    em = _EMAIL_JS_RE.search(html)
    if em:
        member.email = f"{em.group(1)}@{em.group(2)}{em.group(3)}".lower()
    else:
        member.email = synthesize_email(member)

    # Committees: every assignment is an <a class="committee"> link with optional
    # role badge in the same row.
    member.committees = _extract_committees(s)


def synthesize_email(member: Member) -> str:
    last = slugify(last_name(member.name))
    given = slugify(member.name.split()[0]) if member.name.split() else ""
    initial = given[:1] if given else ""
    if member.chamber == "S":
        domain = "pasen.gov" if member.party == "R" else "pasenate.com"
    else:
        domain = "pahousegop.com" if member.party == "R" else "pahouse.net"
    return f"{initial}{last}@{domain}"


def _extract_capitol_block(s: BeautifulSoup) -> tuple[dict, str]:
    """Find the <ul> that holds the Capitol-office address line, and return both
    the parsed office dict and the Capitol phone from the same list. This avoids
    capturing a district-office phone (members may have several)."""
    office: dict = {}
    phone = ""
    for icon in s.select("i[title='Capitol Office']"):
        office_li = icon.find_parent("li")
        if not office_li:
            continue
        ul = office_li.find_parent("ul")
        if ul is None:
            continue
        text = office_li.get_text(" ", strip=True)
        m = re.match(r"^(\d+[A-Za-z]?)\s+(.+?)\s*$", text)
        if m:
            office = parse_office(f"{m.group(1)} {m.group(2)}")
        # First <i title='Phone'> after the Capitol Office <li> — same <ul>.
        for li in ul.find_all("li"):
            if li.find("i", title="Phone"):
                phm = _PHONE_RE.search(li.get_text(" ", strip=True))
                if phm:
                    phone = phm.group(0)
                    break
        if office or phone:
            break
    if not office:
        # Fallback if the icon attribute is absent: scan body text.
        full = s.get_text(" ", strip=True)
        m = re.search(r"\b(\d+[A-Za-z]?)\s+(Main Capitol|Irvis Office Building|Irvis Office Bldg|Ryan Office Building|Ryan Office Bldg|North Office)\b", full)
        if m:
            office = parse_office(f"{m.group(1)} {m.group(2)}")
    return office, phone


_BADGE_ROLE_RE = re.compile(r"\b(Chair|Vice\s*Chair|Minority\s*Chair|Ex[\s-]*Officio)\b", re.I)


def _extract_committees(s: BeautifulSoup) -> list[dict]:
    """Each assignment is <a class='committee'>Name</a> with an optional sibling
    <span class='badge'>Role</span> in the same row block.
    """
    out: list[dict] = []
    seen: set[str] = set()
    for a in s.select("a.committee"):
        name = a.get_text(" ", strip=True)
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        # Look for a role badge in the same row container.
        row = a.find_parent(["div", "li"])
        role = ""
        if row:
            badge = row.find("span", class_="badge")
            if badge:
                txt = badge.get_text(" ", strip=True)
                rm = _BADGE_ROLE_RE.search(txt)
                if rm:
                    raw = rm.group(1).lower().replace("  ", " ").strip()
                    if raw == "chair":
                        role = "CHAIR"
                    elif raw == "minority chair":
                        role = "MIN. CHAIR"
                    elif raw == "vice chair":
                        role = "VICE CHAIR"
        entry: dict = {"name": name}
        if role:
            entry["role"] = role
        out.append(entry)
    return out


# -- Committees pages -----------------------------------------------------

_COMMITTEE_PATH_RE = re.compile(r"/(senate|house)/committees/(\d+)/([a-z0-9-]+)")


@dataclass
class Committee:
    palegis_id: str
    chamber: str
    slug: str
    name: str
    detail_url: str
    chair_id: str = ""
    min_chair_id: str = ""
    member_ids: list[str] = field(default_factory=list)
    active_bills: list[str] = field(default_factory=list)

    def to_json(self) -> dict:
        return {
            "id": committee_short_id(self.chamber, self.name, self.slug),
            "chamber": self.chamber,
            "name": self.name,
            "chair": self.chair_id or None,
            "minChair": self.min_chair_id or None,
            "members": self.member_ids,
            "activeBills": self.active_bills,
        }


def committee_short_id(chamber: str, name: str, slug: str) -> str:
    if (chamber, name) in COMMITTEE_ID_ALIASES:
        return COMMITTEE_ID_ALIASES[(chamber, name)]
    prefix = "sen" if chamber == "S" else "hse"
    return f"{prefix}-{slug}"


def parse_committee_index(html: str, chamber: str) -> list[Committee]:
    s = soup(html)
    out: list[Committee] = []
    seen: set[str] = set()
    for a in s.find_all("a", href=True):
        href = a["href"].strip()
        m = _COMMITTEE_PATH_RE.search(href)
        if not m:
            continue
        if (chamber == "S") != (m.group(1) == "senate"):
            continue
        cid = m.group(2)
        if cid in seen:
            continue
        slug = m.group(3)
        name = a.get_text(" ", strip=True)
        # Drop generic nav links and roll-call summaries.
        if not name or name.lower() in {"committee list", "committees", "view committee", "more", "view all"}:
            continue
        if "rollcallid" in href.lower() or "vote-summary" in href.lower():
            continue
        seen.add(cid)
        detail = urljoin(BASE, href)
        if "?" not in detail:
            detail = f"{detail}?sessyr={SESSION_YEAR}"
        out.append(Committee(
            palegis_id=cid,
            chamber=chamber,
            slug=slug,
            name=name,
            detail_url=detail,
        ))
    return out


def parse_committee_detail(html: str, palegis_to_id: dict[str, str]) -> dict:
    """Extract chair/min-chair/members/bills from a committee detail page.

    Member identity is resolved via the palegis member ID embedded in each bio
    link (more reliable than display-name matching). Chair/minority chair are
    inferred from the role badges adjacent to each member card.
    """
    s = soup(html)

    chair_id = ""
    min_chair_id = ""
    member_ids: list[str] = []
    seen: set[str] = set()

    for a in s.find_all("a", href=True):
        bm = _BIO_PATH_RE.search(a["href"])
        if not bm:
            continue
        palegis_id = bm.group(2)
        canonical = palegis_to_id.get(palegis_id)
        if not canonical or canonical in seen:
            continue
        seen.add(canonical)

        # Inspect the surrounding card for a role badge.
        card = a
        for _ in range(4):
            if card.parent is None:
                break
            card = card.parent
            if card.name in {"div", "section", "article"} and len(card.get_text(" ", strip=True)) > 30:
                break
        role_text = ""
        if card:
            for badge in card.select("span.badge"):
                t = badge.get_text(" ", strip=True)
                if _BADGE_ROLE_RE.search(t):
                    role_text = t
                    break

        if re.search(r"\bMinority\s*Chair\b", role_text, re.I) and not min_chair_id:
            min_chair_id = canonical
        elif re.fullmatch(r"\s*Chair\s*", role_text, re.I) and not chair_id:
            chair_id = canonical
        # All cards (chair, min chair, vice chair, members) become members.
        member_ids.append(canonical)

    bill_ids: list[str] = []
    bill_seen: set[str] = set()
    for a in s.find_all("a", href=True):
        bm = re.search(r"/legislation/bills/\d+/([a-z]+)(\d+)", a["href"])
        if bm:
            num = f"{bm.group(1).upper()} {int(bm.group(2))}"
            if num not in bill_seen:
                bill_seen.add(num)
                bill_ids.append(num)

    return {
        "chair_id": chair_id,
        "min_chair_id": min_chair_id,
        "member_ids": member_ids,
        "active_bills": bill_ids[:30],
    }


# -- Bills ----------------------------------------------------------------

_BILL_PATH_RE = re.compile(r"/legislation/bills/(\d+)/([a-z]+)(\d+)")


def primary_sponsor_bill_urls(member: Member) -> list[str]:
    """Fetch the primary-sponsor bill list for a member.

    The palegis form posts to /legislation/bills/by-sponsor?memberid={id}&billbody={s|h}&sessyr=YYYY
    where billbody filters to the member's chamber (matches existing prototype data
    which only carries SB/HB-style numbering for in-chamber bills).
    """
    body = "s" if member.chamber == "S" else "h"
    url = (
        f"{BASE}/legislation/bills/by-sponsor"
        f"?sessind=0&memberid={member.palegis_id}&billbody={body}&sessyr={SESSION_YEAR}"
    )
    try:
        html = fetch(url)
    except requests.RequestException as e:
        print(f"  ! sponsor list fetch failed for {member.name}: {e}", file=sys.stderr)
        return []
    seen: set[str] = set()
    out: list[str] = []
    for a in soup(html).find_all("a", href=True):
        m = _BILL_PATH_RE.search(a["href"])
        if not m:
            continue
        full = urljoin(BASE, a["href"])
        if full in seen:
            continue
        seen.add(full)
        out.append(full)
    return out


_BILL_TITLE_TYPE = {
    "Senate Bill": "SB",
    "House Bill": "HB",
    "Senate Resolution": "SR",
    "House Resolution": "HR",
    "Senate Concurrent Resolution": "SCR",
    "House Concurrent Resolution": "HCR",
}


def parse_bill_detail(html: str) -> dict:
    """Read bill number, short topic, and last action from a bill detail page.

    Sources:
    - Bill number from <title>"Senate Bill 992 Information; ..."</title>.
    - Display title preferred from <strong>Memo Subject</strong> (concise) and
      falls back to <strong>Short Title</strong> (legalese).
    - Status + date from "Last Action:" block; chamber badge stripped off.
    """
    s = soup(html)

    num = ""
    title_tag = s.find("title")
    if title_tag:
        ttext = title_tag.get_text(" ", strip=True)
        for prefix, abbr in _BILL_TITLE_TYPE.items():
            tm = re.match(rf"^{re.escape(prefix)}\s+(\d+)\b", ttext)
            if tm:
                num = f"{abbr} {int(tm.group(1))}"
                break

    title_text = ""
    short_title = ""
    for strong in s.find_all("strong"):
        label = strong.get_text(" ", strip=True).rstrip(":").strip().lower()
        if label not in {"memo subject", "short title"}:
            continue
        # The value is in the next .col-10 sibling within the same row.
        row = strong.find_parent("div", class_="row") or strong.find_parent("div")
        if not row:
            continue
        val_div = row.find("div", class_=lambda c: c and "col-10" in c)
        if not val_div:
            continue
        val = val_div.get_text(" ", strip=True)
        if label == "memo subject" and val:
            title_text = val
        elif label == "short title" and val:
            short_title = val
    if not title_text:
        title_text = short_title

    # Last Action: <strong>Last Action: </strong> followed by status text and a chamber badge.
    last_action_raw = ""
    for strong in s.find_all("strong"):
        if strong.get_text(" ", strip=True).rstrip(":").strip().lower() == "last action":
            container = strong.parent
            if container:
                t = container.get_text(" ", strip=True)
                t = re.sub(r"^Last Action:\s*", "", t, flags=re.I)
                # Drop trailing chamber word (House/Senate badge).
                t = re.sub(r"\s+(House|Senate)\s*$", "", t).strip()
                last_action_raw = t
            break

    # Prime sponsor palegis_id — used to filter sponsor-list results down to
    # bills the member actually primarily sponsored (the search returns both
    # prime and co-sponsored).
    prime_sponsor_id = ""
    for h in s.find_all(["div", "h2", "h3"]):
        ht = h.get_text(" ", strip=True).lower()
        if ht == "prime sponsor":
            for sib in h.find_all_next():
                if sib.name == "a":
                    href = sib.get("href", "")
                    bm = _BIO_PATH_RE.search(href)
                    if bm:
                        prime_sponsor_id = bm.group(2)
                        break
                if sib.name in {"h2", "h3"} and "sponsor" not in sib.get_text(" ", strip=True).lower():
                    break
            if prime_sponsor_id:
                break

    # Status = last action with the date stripped off.
    status = re.sub(
        r",?\s*(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}\s*,?\s*\d{0,4}.*$",
        "",
        last_action_raw,
    ).strip(" ,")
    status = re.sub(r"\s+(House|Senate)$", "", status).strip()

    return {
        "num": num,
        "title": (title_text or "").strip(),
        "status": status or last_action_raw,
        "lastAction": format_last_action(last_action_raw),
        "primeSponsorId": prime_sponsor_id,
    }


# -- Orchestration --------------------------------------------------------

def collect_members(limit: int | None) -> list[Member]:
    print("Fetching Senate roster...", file=sys.stderr)
    sen_html = fetch("/senate/members")
    senate = parse_roster(sen_html, "S")

    print("Fetching House roster...", file=sys.stderr)
    house_html = fetch("/house/members")
    house = parse_roster(house_html, "H")

    members = senate + house
    if limit is not None:
        # Keep first N from each chamber for a balanced smoke test.
        members = senate[:limit] + house[:limit]
    print(f"  -> {len(senate)} senators, {len(house)} representatives ({len(members)} after limit)", file=sys.stderr)
    return members


def attach_leadership_titles(members: list[Member]) -> None:
    """Fill in leadership roles for members whose roster card didn't carry data-leadership.

    The Senate officers page sometimes lists titles the roster card omits (Speaker,
    Pro Tempore, etc.). We do not overwrite a role already set from the roster.
    """
    titles: dict[str, str] = {}
    for path in ("/senate/members/senate-officers", "/house/members/house-officers"):
        try:
            titles.update(parse_officers(fetch(path)))
        except requests.RequestException as e:
            print(f"  ! officers fetch failed for {path}: {e}", file=sys.stderr)
    for m in members:
        if m.role:
            continue
        if m.name in titles:
            m.role = titles[m.name]
            continue
        parts = m.name.split()
        if len(parts) >= 2:
            simple = f"{parts[0]} {parts[-1]}"
            if simple in titles:
                m.role = titles[simple]


def build_legislator_records(members: list[Member]) -> None:
    taken: set[str] = set()
    for m in members:
        m.canonical_id = assign_canonical_id(m.name, m.district, taken)
        m.initials = compute_initials(m.name)


def enrich_all_bios(members: list[Member]) -> None:
    for i, m in enumerate(members, 1):
        try:
            html = fetch(m.bio_url)
        except requests.RequestException as e:
            print(f"  ! bio fetch failed for {m.name}: {e}", file=sys.stderr)
            continue
        try:
            enrich_from_bio(m, html)
        except Exception as e:  # defensive: don't let one bad page kill the run
            print(f"  ! bio parse failed for {m.name}: {e}", file=sys.stderr)
        if i % 25 == 0:
            print(f"  bios: {i}/{len(members)}", file=sys.stderr)


def collect_committees(palegis_to_id: dict[str, str]) -> list[dict]:
    committees: list[Committee] = []
    for chamber, path in (
        ("S", "/senate/committees/committee-list"),
        ("H", "/house/committees/committee-list"),
    ):
        try:
            html = fetch(path)
        except requests.RequestException as e:
            print(f"  ! committee index failed for {path}: {e}", file=sys.stderr)
            continue
        committees.extend(parse_committee_index(html, chamber))
    print(f"Found {len(committees)} committees", file=sys.stderr)
    for c in committees:
        try:
            html = fetch(c.detail_url)
        except requests.RequestException as e:
            print(f"  ! committee detail failed for {c.name}: {e}", file=sys.stderr)
            continue
        info = parse_committee_detail(html, palegis_to_id)
        c.chair_id = info["chair_id"]
        c.min_chair_id = info["min_chair_id"]
        c.member_ids = info["member_ids"]
        c.active_bills = info["active_bills"]
    return [c.to_json() for c in committees]


_BILL_NUM_RE = re.compile(r"^\s*(SB|HB|SR|HR|SCR|HCR)\s*0*(\d+)\s*$", re.I)


def bill_number_to_slug(num: str) -> tuple[str, str] | None:
    """'SB 992' -> ('sb992', 'SB 992'). None if unparseable."""
    m = _BILL_NUM_RE.match(num)
    if not m:
        return None
    return f"{m.group(1).lower()}{m.group(2)}", f"{m.group(1).upper()} {int(m.group(2))}"


def collect_tracked_bills(overlay_path: Path, members: list[Member]) -> list[dict]:
    """Build a flat list of bills explicitly tracked via rea-overlay.json's reaBills.

    Reads the overlay (never writes it), fetches each bill's detail page from
    palegis, and attaches the prime sponsor's canonical_id + display name so
    the front-end can cross-link to the legislator profile. Bills the overlay
    lists but palegis doesn't know about (made-up prototype seeds, expired
    session numbers) are skipped silently.
    """
    if not overlay_path.exists():
        print(f"  ! overlay not found at {overlay_path}; skipping tracked bills", file=sys.stderr)
        return []
    try:
        overlay = json.loads(overlay_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(f"  ! could not read overlay: {e}", file=sys.stderr)
        return []
    nums = list(overlay.get("reaBills") or [])
    if not nums:
        return []

    palegis_to_member = {m.palegis_id: m for m in members}
    out: list[dict] = []
    for raw in nums:
        parsed_num = bill_number_to_slug(raw)
        if not parsed_num:
            continue
        slug, canonical_num = parsed_num
        url = f"{BASE}/legislation/bills/{SESSION_YEAR}/{slug}"
        try:
            html = fetch(url)
        except requests.RequestException as e:
            print(f"  ! tracked bill fetch failed for {raw}: {e}", file=sys.stderr)
            continue
        parsed = parse_bill_detail(html)
        if not parsed.get("num"):
            # Page returned 200 but didn't look like a bill page — skip.
            continue
        sponsor = palegis_to_member.get(parsed.get("primeSponsorId") or "")
        out.append({
            "num": parsed["num"],
            "title": parsed["title"],
            "status": parsed["status"],
            "statusKind": derive_status_kind(parsed["status"]),
            "topic": derive_topic(parsed["title"]),
            "lastAction": parsed["lastAction"],
            "primeSponsorId": sponsor.canonical_id if sponsor else "",
            "primeSponsorName": sponsor.name if sponsor else "",
            "primeSponsorChamber": sponsor.chamber if sponsor else "",
        })
    print(f"Tracked bills: {len(out)}/{len(nums)} resolved on palegis", file=sys.stderr)
    return out


def collect_bills(members: list[Member]) -> dict[str, list[dict]]:
    bills_by_sponsor: dict[str, list[dict]] = {}
    bill_cache: dict[str, dict] = {}

    for i, m in enumerate(members, 1):
        urls = primary_sponsor_bill_urls(m)
        records: list[dict] = []
        for url in urls:
            if url not in bill_cache:
                try:
                    html = fetch(url)
                except requests.RequestException as e:
                    print(f"  ! bill fetch failed for {url}: {e}", file=sys.stderr)
                    continue
                bill_cache[url] = parse_bill_detail(html)
            parsed = bill_cache[url]
            if not parsed.get("num"):
                continue
            # The sponsor search returns both prime + co-sponsored bills. Keep only
            # those where this member is the prime sponsor.
            if parsed.get("primeSponsorId") and parsed["primeSponsorId"] != m.palegis_id:
                continue
            records.append({
                "num": parsed["num"],
                "title": parsed["title"],
                "role": "PRIME",
                "status": parsed["status"],
                "statusKind": derive_status_kind(parsed["status"]),
                "topic": derive_topic(parsed["title"]),
                "lastAction": parsed["lastAction"],
            })
            if len(records) >= MAX_BILLS_PER_MEMBER:
                break
        if records:
            bills_by_sponsor[m.canonical_id] = records
        if i % 25 == 0:
            print(f"  bills: {i}/{len(members)}", file=sys.stderr)
    return bills_by_sponsor


def write_outputs(
    out_dir: Path,
    members: list[Member],
    bills_by_sponsor: dict,
    committees: list[dict],
    tracked_bills: list[dict],
) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)

    legislators = {
        "_comment": "Objective legislator data. Populated by scripts/scrape-palegis.py from www.palegis.us. Edit overlays in rea-overlay.json, not here.",
        "lastSync": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "members": [m.to_json() for m in members],
    }
    bills = {
        "_comment": "Objective bills + committee data. Populated by scripts/scrape-palegis.py from www.palegis.us. The 'rea' flag is NOT set here — it is derived at load time from rea-overlay.json's 'reaBills' list. trackedBills is the resolved detail for every bill in rea-overlay.json's reaBills (independent of who prime-sponsored it).",
        "billsBySponsor": bills_by_sponsor,
        "committees": committees,
        "trackedBills": tracked_bills,
    }

    legislators_path = out_dir / "legislators.json"
    bills_path = out_dir / "bills.json"

    legislators_path.write_text(json.dumps(legislators, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    bills_path.write_text(json.dumps(bills, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"Wrote {legislators_path}", file=sys.stderr)
    print(f"Wrote {bills_path}", file=sys.stderr)


def main(argv: Iterable[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Scrape palegis.us into pa-ga-guide JSON files.")
    p.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR,
                   help="Directory for legislators.json + bills.json (default: pa-ga-guide/data/).")
    p.add_argument("--dry-run", action="store_true",
                   help="Write to a temp directory under ./.scrape-output/ instead of --out-dir.")
    p.add_argument("--limit", type=int, default=None,
                   help="Cap members per chamber (smoke test). Leave unset for full refresh.")
    args = p.parse_args(list(argv) if argv is not None else None)

    out_dir = Path("./.scrape-output").resolve() if args.dry_run else args.out_dir

    members = collect_members(args.limit)
    build_legislator_records(members)
    attach_leadership_titles(members)

    palegis_to_id = {m.palegis_id: m.canonical_id for m in members}

    enrich_all_bios(members)
    committees = collect_committees(palegis_to_id)
    bills_by_sponsor = collect_bills(members)
    # Tracked bills come from the hand-curated overlay. We READ it; never write.
    overlay_path = REPO_ROOT / "pa-ga-guide" / "data" / "rea-overlay.json"
    tracked_bills = collect_tracked_bills(overlay_path, members)

    write_outputs(out_dir, members, bills_by_sponsor, committees, tracked_bills)
    return 0


if __name__ == "__main__":
    sys.exit(main())
