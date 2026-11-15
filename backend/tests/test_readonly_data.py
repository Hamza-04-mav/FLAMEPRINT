"""Vercel layout: the bundled data dir is read-only, uploads go to a separate writable dir (FLAMEPRINT_UPLOAD_DIR).

The read-only data dir is enforced two ways, so the test means the same thing on every OS:
  * real permissions (files 0o444, dirs 0o555 where the OS honours them), and
  * a guard that raises EROFS for any write, mkdir, unlink or rename under the data dir.
`app.main` is reloaded with the env under test, then reloaded again afterwards so other tests see the defaults.
"""
import builtins
import errno
import importlib
import json
import os
import shutil
import stat
from pathlib import Path

import pytest

from tests.conftest import ROOT, SYNTHETIC_CSV

SEED_COUNT = len(json.loads((ROOT / "data" / "seed" / "investigations.json").read_text("utf-8"))["investigations"])


def _inside(path, root: Path) -> bool:
    try:
        Path(path).resolve().relative_to(root.resolve())
        return True
    except (ValueError, OSError, TypeError):
        return False


@pytest.fixture()
def project(tmp_path):
    """A deployed project root: <root>/data/{seed,templates} copied from the repo, like the Vercel bundle."""
    root = tmp_path / "project"
    (root / "data" / "seed").mkdir(parents=True)
    for name in ("investigations.json", "materials.json"):
        shutil.copy(ROOT / "data" / "seed" / name, root / "data" / "seed" / name)
    shutil.copytree(ROOT / "data" / "templates", root / "data" / "templates")
    return root


@pytest.fixture()
def read_only(monkeypatch):
    """Make a directory tree read-only. Returns a function(dir) -> dir."""
    locked: list[Path] = []

    def lock(root: Path) -> Path:
        locked.append(root)
        for p in sorted(root.rglob("*"), reverse=True) + [root]:
            os.chmod(p, (0o555 if p.is_dir() else 0o444))

        def deny(target, *a, **k):
            if _inside(target, root):
                raise OSError(errno.EROFS, "Read-only file system", str(target))

        for meth in ("mkdir", "write_text", "write_bytes", "touch", "unlink", "rename", "replace"):
            orig = getattr(Path, meth)
            monkeypatch.setattr(Path, meth, lambda self, *a, _o=orig, **k: (deny(self), _o(self, *a, **k))[1])
        real_open = builtins.open

        def guarded_open(file, mode="r", *a, **k):
            if any(c in mode for c in "wax+"):
                deny(file)
            return real_open(file, mode, *a, **k)

        monkeypatch.setattr(builtins, "open", guarded_open)
        return root

    yield lock
    for root in locked:  # let pytest clean tmp_path up
        for p in [root, *root.rglob("*")]:
            os.chmod(p, stat.S_IRWXU if p.is_dir() else stat.S_IREAD | stat.S_IWRITE)


@pytest.fixture()
def load_app(monkeypatch):
    """Reload app.main under the current env; restore the default module afterwards."""
    from app import main

    def load():
        monkeypatch.setenv("FLAMEPRINT_LLM", "off")
        return importlib.reload(main)

    yield load
    monkeypatch.undo()
    importlib.reload(main)


def _snapshot(root: Path) -> dict:
    return {p.relative_to(root).as_posix(): p.stat().st_size for p in root.rglob("*")}


def test_health_and_dataset_with_readonly_data_and_writable_uploads(project, read_only, load_app, monkeypatch, tmp_path):
    uploads = tmp_path / "tmp" / "flameprint" / "imported"  # like /tmp on Vercel: does not exist yet
    monkeypatch.chdir(project)  # Vercel runs from the project root, so the relative value resolves there
    monkeypatch.setenv("FLAMEPRINT_DATA_DIR", "data")
    monkeypatch.setenv("FLAMEPRINT_UPLOAD_DIR", str(uploads))
    data = read_only(project / "data")
    before = _snapshot(data)

    main = load_app()
    from fastapi.testclient import TestClient
    client = TestClient(main.app)

    h = client.get("/api/health")
    assert h.status_code == 200
    h = h.json()
    assert h["ok"] is True
    assert Path(h["dataDir"]) == data.resolve()
    assert Path(h["uploadDir"]) == uploads.resolve() and h["uploadsWritable"] is True
    assert h["stats"]["investigations"] == SEED_COUNT

    d = client.get("/api/dataset")
    assert d.status_code == 200
    d = d.json()
    assert len(d["investigations"]) == SEED_COUNT
    assert any(s["name"] == "seed/investigations.json" for s in d["sources"])

    # uploads land in the writable dir and show up in the dataset; the data dir is untouched
    files = {"file": ("BASS-II_synthetic.csv", SYNTHETIC_CSV.encode(), "text/csv")}
    r = client.post("/api/ingest", files=files)
    assert r.status_code == 200 and r.json()["stats"]["tests"] == 3
    assert (uploads / "BASS-II_synthetic.csv").is_file() and (uploads / "_manifest.json").is_file()
    assert client.get("/api/dataset").json()["stats"]["tests"] == 3
    src = client.get("/api/sources").json()
    assert [u["file"] for u in src["uploads"]] == ["BASS-II_synthetic.csv"]
    assert any(rep["file"] == "imported/BASS-II_synthetic.csv" for rep in src["reports"])
    assert client.delete("/api/uploads/BASS-II_synthetic.csv").json()["stats"]["tests"] == 0
    assert _snapshot(data) == before


def test_readonly_data_without_upload_dir_still_serves(project, read_only, load_app, monkeypatch):
    """Vercel with FLAMEPRINT_UPLOAD_DIR unset: the default upload dir can't be created. Must not crash at import."""
    monkeypatch.setenv("FLAMEPRINT_DATA_DIR", str(project / "data"))
    monkeypatch.delenv("FLAMEPRINT_UPLOAD_DIR", raising=False)
    read_only(project / "data")

    main = load_app()
    from fastapi.testclient import TestClient
    client = TestClient(main.app)

    h = client.get("/api/health").json()
    assert h["ok"] is True and h["uploadsWritable"] is False
    assert h["stats"]["investigations"] == SEED_COUNT
    assert len(client.get("/api/dataset").json()["investigations"]) == SEED_COUNT
    assert client.get("/api/sources").json()["uploads"] == []
    files = {"file": ("BASS-II_synthetic.csv", SYNTHETIC_CSV.encode(), "text/csv")}
    r = client.post("/api/ingest", files=files)
    assert r.status_code == 503 and "FLAMEPRINT_UPLOAD_DIR" in r.json()["detail"]


def test_local_defaults_unchanged(load_app, monkeypatch):
    monkeypatch.delenv("FLAMEPRINT_DATA_DIR", raising=False)
    monkeypatch.delenv("FLAMEPRINT_UPLOAD_DIR", raising=False)
    main = load_app()
    assert main.DATA_DIR == ROOT / "data"
    assert main.UPLOAD_DIR == ROOT / "data" / "imported" == main.store.upload_dir


def test_empty_settings_fall_back_to_defaults(load_app, monkeypatch):
    monkeypatch.setenv("FLAMEPRINT_DATA_DIR", "")
    monkeypatch.setenv("FLAMEPRINT_UPLOAD_DIR", "  ")
    main = load_app()
    assert main.DATA_DIR == ROOT / "data" and main.UPLOAD_DIR == ROOT / "data" / "imported"
