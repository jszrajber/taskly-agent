import asyncio
from unittest.mock import Mock

import pytest
from fastapi import FastAPI

from app.core.lifespan import lifespan


@pytest.fixture
def db(monkeypatch):
    engine = Mock(name="engine")
    factory = Mock(name="session_factory")
    mocks = Mock(engine=engine, factory=factory)
    mocks.create_engine = Mock(return_value=engine)
    mocks.create_factory = Mock(return_value=factory)
    mocks.initialize = Mock()
    monkeypatch.setattr("app.core.lifespan.create_database_engine", mocks.create_engine)
    monkeypatch.setattr("app.core.lifespan.create_session_factory", mocks.create_factory)
    monkeypatch.setattr("app.core.lifespan.initialize", mocks.initialize)
    return mocks


def test_lifespan_sets_up_and_disposes(db):
    app = FastAPI()
    app.state.database_url = "postgresql://x/y"

    async def run():
        async with lifespan(app):
            db.create_engine.assert_called_once_with("postgresql://x/y")
            db.initialize.assert_called_once_with(db.engine)
            assert app.state.session_factory is db.factory
            db.engine.dispose.assert_not_called()

    asyncio.run(run())

    db.engine.dispose.assert_called_once_with()


def test_lifespan_disposes_engine_when_initialize_fails(db):
    db.initialize.side_effect = RuntimeError("boom")
    app = FastAPI()
    app.state.database_url = "postgresql://x/y"

    async def run():
        async with lifespan(app):
            pass

    with pytest.raises(RuntimeError):
        asyncio.run(run())

    db.engine.dispose.assert_called_once_with()
