from contextlib import contextmanager
from typing import Any

import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor

_connection_pool: pool.ThreadedConnectionPool | None = None


def init_pool(database_url: str, min_conn: int = 1, max_conn: int = 10) -> None:
    global _connection_pool
    if _connection_pool is not None:
        return
    _connection_pool = pool.ThreadedConnectionPool(min_conn, max_conn, database_url)


def close_pool() -> None:
    global _connection_pool
    if _connection_pool is not None:
        _connection_pool.closeall()
        _connection_pool = None


def _release_connection(conn, close: bool = False) -> None:
    if _connection_pool is None:
        return
    try:
        _connection_pool.putconn(conn, close=close)
    except Exception:
        try:
            conn.close()
        except Exception:
            pass


@contextmanager
def get_connection():
    if _connection_pool is None:
        raise RuntimeError("Database pool is not initialized")

    conn = _connection_pool.getconn()
    close_after_use = False
    try:
        if conn.closed != 0:
            close_after_use = True
            raise psycopg2.OperationalError("Stale database connection")

        with conn.cursor() as cur:
            cur.execute("SELECT 1")

        yield conn
        conn.commit()
    except (psycopg2.OperationalError, psycopg2.InterfaceError):
        close_after_use = True
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    except Exception:
        try:
            conn.rollback()
        except Exception:
            close_after_use = True
        raise
    finally:
        _release_connection(conn, close=close_after_use)


def fetch_one(query: str, params: tuple[Any, ...] | None = None) -> dict[str, Any] | None:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, params)
            row = cur.fetchone()
            return dict(row) if row else None


def fetch_all(query: str, params: tuple[Any, ...] | None = None) -> list[dict[str, Any]]:
    with get_connection() as conn:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, params)
            return [dict(row) for row in cur.fetchall()]


def execute(query: str, params: tuple[Any, ...] | None = None) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)