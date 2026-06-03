import importlib
import sys
from pathlib import Path

from fastapi.testclient import TestClient


def load_app_with_frontend_dist(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")

    project_root = Path(__file__).resolve().parent.parent
    dist_dir = project_root / "frontend" / "dist"
    dist_dir.mkdir(parents=True, exist_ok=True)
    (dist_dir / "index.html").write_text("<!doctype html><title>DigitalDome</title>", encoding="utf-8")

    sys.modules.pop("main", None)
    sys.modules.pop("database", None)
    monkeypatch.chdir(project_root / "backend")
    return importlib.import_module("main").app


def test_serves_frontend_index_at_root_when_dist_exists(tmp_path, monkeypatch):
    app = load_app_with_frontend_dist(tmp_path, monkeypatch)
    client = TestClient(app)

    response = client.get("/")

    assert response.status_code == 200
    assert "DigitalDome" in response.text


def test_serves_frontend_index_for_spa_routes_when_dist_exists(tmp_path, monkeypatch):
    app = load_app_with_frontend_dist(tmp_path, monkeypatch)
    client = TestClient(app)

    response = client.get("/gateway")

    assert response.status_code == 200
    assert "DigitalDome" in response.text
