"""
Database engine and session factory.

Security notes:
  - The DATABASE_URL must use a dedicated low-privilege PostgreSQL role:
      CREATE ROLE sifra_app LOGIN PASSWORD '...';
      GRANT CONNECT ON DATABASE sifra_db TO sifra_app;
      GRANT USAGE  ON SCHEMA  public    TO sifra_app;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES     IN SCHEMA public TO sifra_app;
      GRANT USAGE, SELECT                  ON ALL SEQUENCES  IN SCHEMA public TO sifra_app;
      -- DO NOT grant DROP, CREATE, TRUNCATE, REFERENCES, or SUPERUSER.

  - pool_pre_ping=True sends a lightweight 'SELECT 1' before each checkout,
    so stale connections are recycled instead of raising mid-request errors.

  - connect_args options:
      options=-c statement_timeout=30000   → kill any single query that runs
                                             longer than 30 seconds (DoS guard)
      sslmode=require                      → enforce TLS in production
                                             (set PGSSLMODE env var instead if
                                              the URL already contains sslmode)

  - No raw text() SQL is used anywhere in this codebase.
    Always use ORM constructs or sqlalchemy.sql.expression objects.
"""

from sqlalchemy import create_engine, event, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from .config import settings

# ── Build connect_args based on environment ───────────────────────────────────

_connect_args: dict = {
    "options": "-c statement_timeout=30000",   # 30-second query timeout
}

if settings.ENVIRONMENT == "production":
    # Enforce SSL in production. Remove if your DB URL already includes sslmode.
    _connect_args["sslmode"] = "require"


# ── Engine ────────────────────────────────────────────────────────────────────

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_recycle=1800,    # recycle connections every 30 minutes
    connect_args=_connect_args,
    # Echo SQL only in development (never in production — leaks data to logs)
    echo=(settings.ENVIRONMENT == "development"),
)


# ── Session factory ───────────────────────────────────────────────────────────

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


# ── Connection event: harden every new connection ────────────────────────────

@event.listens_for(engine, "connect")
def _on_connect(dbapi_connection, connection_record):
    """
    Runs once per new raw DBAPI connection.

    Sets PostgreSQL session-level guards:
      - lock_timeout    — prevent deadlocks from blocking indefinitely
      - idle_in_transaction_session_timeout — kill idle-in-transaction sessions
    """
    cursor = dbapi_connection.cursor()
    cursor.execute("SET lock_timeout = '10s'")
    cursor.execute("SET idle_in_transaction_session_timeout = '60s'")
    cursor.close()


# ── Dependency ────────────────────────────────────────────────────────────────

def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
