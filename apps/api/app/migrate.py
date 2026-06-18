import logging
from pathlib import Path

from app.database import get_connection

logger = logging.getLogger(__name__)


def _resolve_migrations_dir(migrations_dir: str) -> Path:
    configured = Path(migrations_dir)
    if configured.is_absolute():
        return configured

    api_root = Path(__file__).resolve().parents[1]
    candidates = [
        (api_root / configured).resolve(),
        (api_root.parent.parent / "migrations").resolve(),
        Path("/migrations"),
    ]

    for candidate in candidates:
        if candidate.exists():
            return candidate

    return (api_root / configured).resolve()


def run_migrations(migrations_dir: str) -> None:
    directory = _resolve_migrations_dir(migrations_dir)
    if not directory.exists():
        raise FileNotFoundError(f"Migrations directory not found: {directory}")

    migration_files = sorted(directory.glob("*.sql"))
    if not migration_files:
        logger.warning("No SQL migration files found in %s", directory)
        return

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    filename VARCHAR(255) PRIMARY KEY,
                    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
                """
            )

            cur.execute("SELECT filename FROM schema_migrations")
            applied = {row[0] for row in cur.fetchall()}

            for migration_file in migration_files:
                if migration_file.name in applied:
                    continue

                sql = migration_file.read_text(encoding="utf-8")
                logger.info("Applying migration: %s", migration_file.name)
                cur.execute(sql)
                cur.execute(
                    "INSERT INTO schema_migrations (filename) VALUES (%s)",
                    (migration_file.name,),
                )

    logger.info("Database migrations are up to date")