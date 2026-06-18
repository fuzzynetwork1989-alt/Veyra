from prometheus_client import Counter, Gauge, Histogram, generate_latest

REQUEST_COUNT = Counter(
    "veyra_http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status"],
)
REQUEST_LATENCY = Histogram(
    "veyra_http_request_duration_seconds",
    "HTTP request latency",
    ["method", "endpoint"],
)
ACTIVE_TASKS = Gauge("veyra_tasks_active", "Tasks pending or running")
COMPLETED_TASKS = Counter("veyra_tasks_completed_total", "Tasks completed successfully")
FAILED_TASKS = Counter("veyra_tasks_failed_total", "Tasks failed")


def metrics_payload() -> bytes:
    return generate_latest()


def refresh_task_gauges() -> None:
    try:
        from app.database import fetch_one

        row = fetch_one(
            "SELECT COUNT(*) AS count FROM tasks WHERE status IN ('pending', 'running')"
        )
        ACTIVE_TASKS.set(int(row["count"]) if row else 0)
    except Exception:
        ACTIVE_TASKS.set(0)