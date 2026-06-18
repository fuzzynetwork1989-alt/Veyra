import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.metrics import REQUEST_COUNT, REQUEST_LATENCY

logger = logging.getLogger("veyra.request")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = int((time.perf_counter() - start) * 1000)
        duration_s = duration_ms / 1000.0
        endpoint = request.url.path
        response.headers["X-Request-ID"] = request_id
        REQUEST_COUNT.labels(request.method, endpoint, str(response.status_code)).inc()
        REQUEST_LATENCY.labels(request.method, endpoint).observe(duration_s)
        logger.info(
            "%s %s %s %sms",
            request.method,
            endpoint,
            response.status_code,
            duration_ms,
            extra={"request_id": request_id},
        )
        return response