"""Fixture-driven tests for scripts/scrape-palegis.py.

Every test runs against a snapshot of palegis.us HTML committed under
tests/fixtures/palegis/. Tests assert on:

  - Output shape: top-level keys, list/dict types, field types per record.
  - Exact ground-truth values for legislators / committees / bills that are
    stable for the 2025-2026 session — verified by hand on palegis.us when
    fixtures were snapshotted.
  - Counts: e.g. "Senate roster fixture parses to exactly 50 senators".
  - Absence: e.g. no member has a null name, no district number outside
    the chamber's valid range.

When palegis legitimately changes upstream (new committee, member retired,
etc.), regenerate fixtures with `python scripts/refetch-fixtures.py` and
update the assertions here that shifted.
"""
from __future__ import annotations

from pathlib import Path

import pytest

import scrape_palegis as sp

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "palegis"


def fixture(name: str) -> str:
    return (FIXTURE_DIR / name).read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# Senate roster
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def senate_members():
    return sp.parse_roster(fixture("senate-roster.html"), "S")


@pytest.fixture(scope="module")
def house_members():
    return sp.parse_roster(fixture("house-roster.html"), "H")


def test_senate_roster_count(senate_members):
    # Senate has 50 seats; the fixture pins to all 50 cards.
    assert len(senate_members) == 50


def test_senate_roster_shape(senate_members):
    for m in senate_members:
        assert m.chamber == "S"
        assert m.name and isinstance(m.name, str)
        assert m.party in {"R", "D", "I"}
        assert 1 <= m.district <= 50
        assert m.palegis_id.isdigit()
        assert m.bio_url.startswith("https://www.palegis.us/")


def test_senate_no_duplicate_districts(senate_members):
    districts = [m.district for m in senate_members]
    assert len(set(districts)) == len(districts), "duplicate Senate districts"


def test_senate_no_duplicate_palegis_ids(senate_members):
    ids = [m.palegis_id for m in senate_members]
    assert len(set(ids)) == len(ids), "duplicate Senate palegis IDs"


@pytest.mark.parametrize(
    "palegis_id,district,party,name,role",
    [
        # PA Senate Majority Leader (R-41) — stable for 2025-2026 session
        ("1870", 41, "R", "Joe Pittman", "Majority Floor Leader"),
        # President Pro Tempore (R-39)
        ("1188", 39, "R", "Kim L. Ward", "President Pro Tempore"),
        # Minority (Democratic) Leader (D-43)
        ("254", 43, "D", "Jay Costa", "Minority Floor Leader"),
    ],
)
def test_senate_ground_truth_leaders(senate_members, palegis_id, district, party, name, role):
    m = next((m for m in senate_members if m.palegis_id == palegis_id), None)
    assert m is not None, f"senator with palegis_id={palegis_id} missing"
    assert m.name == name
    assert m.district == district
    assert m.party == party
    assert m.role == role


# ---------------------------------------------------------------------------
# House roster
# ---------------------------------------------------------------------------

def test_house_roster_count(house_members):
    # PA House has 203 seats; fixture pinned to whatever count was live when
    # snapshotted. If a special election fills a vacancy, regenerate fixtures.
    assert 195 <= len(house_members) <= 203
    # Pin the exact count too — surfaces meaningful events.
    assert len(house_members) == 201


def test_house_roster_shape(house_members):
    for m in house_members:
        assert m.chamber == "H"
        assert m.name and isinstance(m.name, str)
        assert m.party in {"R", "D", "I"}
        assert 1 <= m.district <= 203


@pytest.mark.parametrize(
    "palegis_id,district,party,name,role",
    [
        # Speaker of the House (D-191)
        ("1734", 191, "D", "Joanna E. McClinton", "Speaker"),
        # House Majority Leader (D-70)
        ("1161", 70, "D", "Matthew D. Bradford", "Majority Leader"),
        # House Republican Leader (R-78)
        ("1681", 78, "R", "Jesse Topper", "Republican Leader"),
    ],
)
def test_house_ground_truth_leaders(house_members, palegis_id, district, party, name, role):
    m = next((m for m in house_members if m.palegis_id == palegis_id), None)
    assert m is not None, f"representative with palegis_id={palegis_id} missing"
    assert m.name == name
    assert m.district == district
    assert m.party == party
    assert m.role == role


# ---------------------------------------------------------------------------
# Officers pages — leadership-name -> title fallback
# ---------------------------------------------------------------------------

def test_senate_officers_basic_titles():
    titles = sp.parse_officers(fixture("senate-officers.html"))
    # Officers page lists leadership names with their titles.
    assert titles.get("Joe Pittman") == "Majority Floor Leader"
    assert titles.get("Kim Ward") == "President Pro Tempore"


def test_house_officers_basic_titles():
    titles = sp.parse_officers(fixture("house-officers.html"))
    # Speaker should show up on the officers page.
    speakers = [n for n, t in titles.items() if "Speaker" in t]
    assert speakers, "no Speaker title found on House officers page"


def test_officers_titles_have_no_district_or_party_fragments():
    titles = sp.parse_officers(fixture("senate-officers.html"))
    for name, title in titles.items():
        assert "District" not in title, f"district leaked into title for {name!r}: {title!r}"
        assert "Republican" not in title, f"party leaked into title for {name!r}: {title!r}"
        assert "Democrat" not in title, f"party leaked into title for {name!r}: {title!r}"


# ---------------------------------------------------------------------------
# Bio enrichment — Capitol office, committees, badges
# ---------------------------------------------------------------------------

def test_pittman_bio_enrichment():
    """Sen. Pittman is Senate Majority Floor Leader and chairs Rules. His bio
    should produce a complete office record and a 'CHAIR' badge on Rules.
    """
    member = sp.Member(
        palegis_id="1870",
        chamber="S",
        name="Joe Pittman",
        party="R",
        district=41,
        bio_url="",
    )
    sp.enrich_from_bio(member, fixture("senate-bio-pittman.html"))

    # Capitol office should land in the Main Capitol on the 3rd floor (room 350).
    assert member.office.get("room") == "350"
    assert member.office.get("building") == "Main Capitol"
    assert member.office.get("floor") == 3

    # Email is populated either from the JS-obfuscated block or the synth fallback.
    assert "@" in member.email

    # Committees should at least include Rules (where he is Chair) and Approps (Ex-Officio).
    by_name = {c["name"]: c for c in member.committees}
    assert "Rules & Executive Nominations" in by_name
    assert by_name["Rules & Executive Nominations"].get("role") == "CHAIR"
    assert "Appropriations" in by_name


def test_committee_list_is_deduplicated():
    """No committee should appear twice on a member's bio."""
    member = sp.Member(
        palegis_id="1870", chamber="S", name="Joe Pittman", party="R",
        district=41, bio_url="",
    )
    sp.enrich_from_bio(member, fixture("senate-bio-pittman.html"))
    names = [c["name"] for c in member.committees]
    assert len(set(names)) == len(names), f"duplicate committees: {names}"


# ---------------------------------------------------------------------------
# Committee index
# ---------------------------------------------------------------------------

def test_senate_committee_index_includes_known_committees():
    committees = sp.parse_committee_index(fixture("senate-committee-index.html"), "S")
    names = {c.name for c in committees}
    # Smoke check on stable, well-known Senate committees.
    for required in (
        "Environmental Resources & Energy",
        "Appropriations",
        "Rules & Executive Nominations",
        "Communications & Technology",
    ):
        assert required in names, f"{required!r} missing from Senate committee index"
    # All entries are tagged with chamber S.
    assert all(c.chamber == "S" for c in committees)


def test_committee_index_no_duplicates_or_navlinks():
    committees = sp.parse_committee_index(fixture("senate-committee-index.html"), "S")
    ids = [c.palegis_id for c in committees]
    assert len(set(ids)) == len(ids), f"duplicate committee IDs: {ids}"
    # Generic nav strings should be filtered out.
    for c in committees:
        assert c.name.lower() not in {"committee list", "committees", "view committee", "more"}
    # Detail URLs must include the session year for stable bill lists.
    for c in committees:
        assert "sessyr=" in c.detail_url


def test_house_committee_index_has_committees():
    committees = sp.parse_committee_index(fixture("house-committee-index.html"), "H")
    assert len(committees) > 10
    assert all(c.chamber == "H" for c in committees)


# ---------------------------------------------------------------------------
# Committee detail — chair / minority chair / members / active bills
# ---------------------------------------------------------------------------

def test_senate_ere_committee_detail():
    """Senate Environmental Resources & Energy:
      - Chair: Sen. Gene Yaw (palegis_id=1186, R-23)
      - Minority Chair: Sen. Carolyn T. Comitta (palegis_id=1790, D-19)
        Note: palegis renders 'Minority\xa0Chair' with a non-breaking space.
    """
    senate = sp.parse_roster(fixture("senate-roster.html"), "S")
    palegis_to_id: dict[str, str] = {}
    taken: set[str] = set()
    for m in senate:
        m.canonical_id = sp.assign_canonical_id(m.name, m.district, taken)
        palegis_to_id[m.palegis_id] = m.canonical_id

    detail = sp.parse_committee_detail(fixture("senate-committee-ere.html"), palegis_to_id)

    assert detail["chair_id"] == palegis_to_id["1186"], "Yaw should be chair of ERE"
    assert detail["min_chair_id"] == palegis_to_id["1790"], "Comitta should be minority chair of ERE"

    # Members list should include both chairs and be a non-empty subset of the Senate.
    assert detail["chair_id"] in detail["member_ids"]
    assert detail["min_chair_id"] in detail["member_ids"]
    assert len(detail["member_ids"]) >= 5

    # Active bills should be a non-empty list of "SB N" / "HB N" strings.
    assert detail["active_bills"], "ERE active bills list unexpectedly empty"
    for b in detail["active_bills"]:
        assert isinstance(b, str)
        assert b.split()[0] in {"SB", "HB", "SR", "HR", "SCR", "HCR"}, f"bad bill format: {b!r}"


# ---------------------------------------------------------------------------
# Bill detail
# ---------------------------------------------------------------------------

def test_bill_detail_sb970():
    """SB 970 ground truth (snapshot 2025-2026 session):

      - num: "SB 970"
      - title: from Memo Subject ("Banning Toxic Oil and Gas Wastewater Injection Wells"),
               which is preferred over the legalese Short Title.
      - primeSponsorId: "1802" (Sen. Katie Muth, D-44).
        IMPORTANT: palegis links the prime sponsor as
        /senate/members/bio/1802/senator-katie-muth (long 'senator-' form)
        rather than /sen-muth as on the roster. The bio-link regex must
        accept both, otherwise the prime-sponsor ID silently rolls onto
        the first co-sponsor's link.
      - lastAction: e.g. "Aug 15" — palegis renders abbreviated month names
        ("Aug.") with non-breaking spaces. format_last_action must handle
        both full and abbreviated month tokens.
    """
    parsed = sp.parse_bill_detail(fixture("bill-sb970.html"))
    assert parsed["num"] == "SB 970"
    assert "Toxic Oil" in parsed["title"]
    assert parsed["primeSponsorId"] == "1802"
    # status should be a non-empty descriptive string (no chamber suffix).
    assert parsed["status"]
    assert not parsed["status"].endswith("Senate")
    assert not parsed["status"].endswith("House")
    # lastAction should be populated whenever the status text contains a date.
    assert parsed["lastAction"], "lastAction should not be empty when source has a date"


# ---------------------------------------------------------------------------
# Helper purity / regression spot-checks
# ---------------------------------------------------------------------------

def test_format_last_action_handles_abbreviations():
    # Spelled-out months
    assert sp.format_last_action("Referred to Foo, August 15, 2025") == "Aug 15"
    # Abbreviated months (palegis bill detail uses these)
    assert sp.format_last_action("Referred to Foo, Aug. 15, 2025") == "Aug 15"
    # Non-breaking space between month abbreviation and day
    assert sp.format_last_action("Referred to Foo, Aug.\xa015,\xa02025") == "Aug 15"
    # Numeric M/D
    assert sp.format_last_action("Reported as committed, 3/12/2025") == "Mar 12"
    # Empty / no date -> empty string (not None)
    assert sp.format_last_action("") == ""
    assert sp.format_last_action("No date here") == ""


def test_assign_canonical_id_dedupes_collisions():
    taken: set[str] = set()
    a = sp.assign_canonical_id("Anthony H. Williams", 8, taken)
    b = sp.assign_canonical_id("Lindsey M. Williams", 38, taken)
    assert a == "williams"
    # Second williams gets disambiguated by district number.
    assert b == "williams38"
    assert a in taken and b in taken


def test_compute_initials():
    assert sp.compute_initials("Christine M. Tartaglione") == "CT"
    assert sp.compute_initials("Joe Pittman") == "JP"
    assert sp.compute_initials("Anthony H. Williams") == "AW"
    assert sp.compute_initials("") == ""


def test_derive_topic_routes_energy_bills():
    assert sp.derive_topic("Banning Toxic Oil and Gas Wastewater Injection Wells") == "Energy"
    assert sp.derive_topic("An act amending the Public Utility Code") == "Energy"
    assert sp.derive_topic("School funding reform") == "Education"
    assert sp.derive_topic("") == "Other"


def test_derive_status_kind():
    assert sp.derive_status_kind("Approved by the Governor") == "go"
    assert sp.derive_status_kind("Vetoed by the Governor") == "stop"
    assert sp.derive_status_kind("Referred to Committee") == "wait"
    assert sp.derive_status_kind("") == "wait"
