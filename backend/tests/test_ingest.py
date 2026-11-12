import json

from app.ingest import map_columns, match_investigation, norm_outcome, parse_file
from tests.conftest import SYNTHETIC_CSV

KNOWN = ["BASS", "BASS-II", "FLEX", "FLEX-2", "SAFFIRE-II", "ACME-BRE"]


def test_match_investigation_prefers_longest():
    assert match_investigation("BASS-II_tests", KNOWN) == "BASS-II"
    assert match_investigation("bass2-matrix", KNOWN) == "BASS-II"
    assert match_investigation("flex_runs", KNOWN) == "FLEX"
    assert match_investigation("BRE data", KNOWN) == "ACME-BRE"
    assert match_investigation("unrelated", KNOWN) is None


def test_outcomes():
    assert norm_outcome("Burn") == "burned"
    assert norm_outcome("No ignition") == "no-ignition"
    assert norm_outcome("self-extinguished") == "extinguished"
    assert norm_outcome("") is None


def test_column_mapping_guards():
    m = map_columns(["Fuel flow rate (sccm)", "Air velocity (cm/s)", "Oxygen partial pressure (psi)", "O2 (%)"])
    assert m["flowCmS"] == "Air velocity (cm/s)"
    assert m["o2Pct"] == "O2 (%)"


def test_parse_csv_with_units():
    p = parse_file("BASS-II_synthetic.csv", SYNTHETIC_CSV.encode(), KNOWN)
    r = p.report
    assert r.records == 3 and r.investigations == ["BASS-II"]
    t1 = p.tests[0]
    assert t1.o2Pct == 21.0                      # fraction → %
    assert abs(t1.pressureKpa - 101.35) < 0.1    # psia → kPa
    assert t1.flowCmS == 10.0                    # mm/s → cm/s
    assert t1.outcome == "burned" and t1.fuel == "PMMA"
    assert t1.metricName == "Spread rate (mm/s)" and t1.metricValue == 1.2
    assert p.tests[1].outcome == "no-ignition"
    assert any("psia" in c for c in r.conversions)


def test_unassigned_warning():
    p = parse_file("mystery.csv", b"O2 (%),Result\n21,burn\n", KNOWN)
    assert p.tests[0].investigationId == "UNASSIGNED"
    assert any("investigation" in w for w in p.report.warnings)


def test_default_investigation_from_upload_form():
    p = parse_file("mystery.csv", b"O2 (%),Result\n21,burn\n", KNOWN, default_inv="FLEX")
    assert p.tests[0].investigationId == "FLEX"


def test_json_metadata_and_tests():
    payload = {"investigations": [{"id": "FLEX", "conditions": {"o2Pct": [15, 30], "confidence": "approx"}}],
               "tests": [{"investigation": "FLEX", "o2": 18, "pressure_kpa": 101}]}
    p = parse_file("meta.json", json.dumps(payload).encode(), KNOWN)
    assert p.investigations[0]["id"] == "FLEX"
    assert p.tests[0].o2Pct == 18 and p.tests[0].pressureKpa == 101


def test_text_document():
    p = parse_file("FLEX_notes.txt", b"FLEX studied droplet extinction with helium dilution.", KNOWN)
    assert p.doc_investigation == "FLEX" and "helium" in p.text


def test_unsupported():
    assert parse_file("x.exe", b"..", KNOWN).report.kind == "unsupported"
