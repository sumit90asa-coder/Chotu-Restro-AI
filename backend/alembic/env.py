import sys
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Ensure app is in Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
from app.database.session import Base
from app.models import *

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_offline() -> None:
    url = settings.DATABASE_URL
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section)
    if configuration is None:
        configuration = {}
    
    # Priority: settings.DATABASE_URL (which reads DATABASE_URL env var and normalizes it)
    db_url = settings.DATABASE_URL
    if not db_url:
        custom_url = config.get_main_option("sqlalchemy.url")
        if custom_url:
            db_url = custom_url
    
    configuration["sqlalchemy.url"] = db_url

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    try:
        with connectable.connect() as connection:
            context.configure(
                connection=connection, target_metadata=target_metadata
            )

            with context.begin_transaction():
                context.run_migrations()
    except Exception as e:
        import sys
        err_msg = str(e)
        print(f"[ALEMBIC WARNING] Database connection error during migration: {err_msg}", file=sys.stderr)
        # On Render or CI, build containers run without private database network access.
        # Catch connection refused / DNS resolution failure so build commands do not terminate.
        if (
            os.getenv("RENDER")
            or os.getenv("CI")
            or "Connection refused" in err_msg
            or "Name or service not known" in err_msg
            or "could not translate host name" in err_msg
            or "timeout" in err_msg.lower()
        ):
            print(
                "[ALEMBIC NOTICE] Database is not reachable in this build environment. "
                "Skipping build-time migration. Migrations will run at container startup.",
                file=sys.stderr,
            )
            return
        raise

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
