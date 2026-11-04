from app.factory import create_app


def test_create_app_resolves_database_url(monkeypatch):
    seen = []

    def fake_resolve(url):
        seen.append(url)
        return "postgresql://resolved/db"

    monkeypatch.setattr("app.factory.resolve_database_url", fake_resolve)

    app = create_app("postgresql://given/db")

    assert seen == ["postgresql://given/db"]
    assert app.state.database_url == "postgresql://resolved/db"


def test_create_app_registers_metadata_and_routes(monkeypatch):
    monkeypatch.setattr("app.factory.resolve_database_url", lambda url: "x")

    app = create_app()
    paths = set(app.openapi()["paths"])

    assert app.title == "Taskly API"
    assert app.version == "1.0.0"
    assert "/api/health" in paths
    assert any(p.startswith("/api/todos") for p in paths)
