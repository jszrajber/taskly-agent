from unittest.mock import Mock, patch

from app.core.database import create_database_engine, create_session_factory, initialize
from app.features.todos.models import Base


def test_engine_uses_the_postgresql_psycopg_driver():
    url = "postgresql+psycopg://taskly:taskly@localhost:5432/taskly"
    engine = create_database_engine(url)
    try:
        assert engine.url.drivername == "postgresql+psycopg"
        assert engine.dialect.name == "postgresql"
        assert engine.dialect.driver == "psycopg"
        assert engine.url.database == "taskly"
    finally:
        engine.dispose()


def test_session_factory_keeps_objects_loaded_after_commit():
    engine = create_database_engine("postgresql+psycopg://u:p@localhost:5432/db")
    try:
        factory = create_session_factory(engine)
        with factory() as session:
            assert session.bind is engine
            assert session.expire_on_commit is False
    finally:
        engine.dispose()


def test_initialize_creates_all_tables_on_engine():
    engine = Mock()
    with patch.object(Base.metadata, "create_all") as create_all:
        initialize(engine)
    create_all.assert_called_once_with(engine)
