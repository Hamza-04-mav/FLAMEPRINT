import shutil
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))


@pytest.fixture()
def data_dir(tmp_path, monkeypatch):
    """Isolated copy of the seed catalog; no PSI files, no uploads. LLM forced off."""
    (tmp_path / "seed").mkdir()
    shutil.copy(ROOT / "data" / "seed" / "investigations.json", tmp_path / "seed" / "investigations.json")
    shutil.copytree(ROOT / "data" / "templates", tmp_path / "templates")
    monkeypatch.setenv("FLAMEPRINT_LLM", "off")
    return tmp_path


@pytest.fixture()
def store(data_dir):
    from app.store import Store
    return Store(data_dir)


@pytest.fixture()
def client(data_dir, monkeypatch):
    from fastapi.testclient import TestClient
    from app import main
    from app.store import Store
    monkeypatch.setattr(main, "store", Store(data_dir))
    monkeypatch.setattr(main, "DATA_DIR", data_dir)
    return TestClient(main.app)


# Synthetic fixture: NOT NASA data. Used only to exercise the parser.
SYNTHETIC_CSV = """# SYNTHETIC TEST FIXTURE - not real data
Test ID,Sample Material,Oxygen (mole fraction),Pressure (psia),Flow Velocity (mm/s),Result,Spread rate (mm/s)
T1,PMMA,0.21,14.7,100,Burn,1.2
T2,PMMA,0.17,14.7,50,No ignition,
T3,PMMA,0.19,10.2,30,Extinguished,0.4
"""
