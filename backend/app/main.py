import logging
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api.datasets import router
from app.config import DEFAULT_DATA_DIR, LOCAL_ORIGINS, MAX_REQUEST_BYTES
from app.schemas import AnalysisError
from app.services.dataset_repository import DatasetRepository

logger = logging.getLogger(__name__)


def error_response(status: int, code: str, message: str):
    return JSONResponse(
        {"error": {"code": code, "message": message}},
        status_code=status,
        headers={"Cache-Control": "no-store"},
    )


class LocalRequestGuard:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = dict(scope["headers"])
        origin = headers.get(b"origin", b"").decode()
        if origin and origin not in LOCAL_ORIGINS:
            return await error_response(
                403, "origin_forbidden", "ไม่อนุญาตคำขอจากเว็บไซต์อื่น"
            )(scope, receive, send)
        try:
            if int(headers.get(b"content-length", b"0")) > MAX_REQUEST_BYTES:
                return await error_response(
                    413, "file_too_large", "ไฟล์ต้องมีขนาดไม่เกิน 10 MB"
                )(scope, receive, send)
        except ValueError:
            return await error_response(400, "invalid_request", "คำขอไม่ถูกต้อง")(
                scope, receive, send
            )
        # Buffer only a bounded request before multipart parser can spool it to disk.
        messages, length = [], 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            length += len(message.get("body", b""))
            if length > MAX_REQUEST_BYTES:
                return await error_response(
                    413, "file_too_large", "ไฟล์ต้องมีขนาดไม่เกิน 10 MB"
                )(scope, receive, send)
            messages.append(message)
            if not message.get("more_body", False):
                break
        index = 0

        async def bounded_receive():
            nonlocal index
            if index < len(messages):
                message = messages[index]
                index += 1
                return message
            return await receive()

        async def secure_send(message):
            if message["type"] == "http.response.start":
                message["headers"] = list(message.get("headers", [])) + [
                    (b"cache-control", b"no-store"),
                    (b"x-content-type-options", b"nosniff"),
                ]
            await send(message)

        await self.app(scope, bounded_receive, secure_send)


def create_app(data_dir: Path | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(application):
        application.state.repository = DatasetRepository(data_dir or DEFAULT_DATA_DIR)
        application.state.parse_gate = threading.Lock()
        yield

    application = FastAPI(title="AI Data Analyst — Local Core", lifespan=lifespan)
    application.add_middleware(LocalRequestGuard)
    application.add_middleware(
        TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost", "testserver"]
    )

    @application.exception_handler(AnalysisError)
    async def analysis_error(request: Request, exc: AnalysisError):
        return error_response(exc.status, exc.code, exc.message)

    @application.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        return error_response(
            422,
            "invalid_request",
            "ข้อมูลคำขอไม่ถูกต้อง กรุณาตรวจสอบไฟล์ ชีต และค่าการค้นหา/แบ่งหน้า",
        )

    @application.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception):
        logger.error("Analysis request failed (%s)", type(exc).__name__)
        return error_response(500, "internal_error", "ประมวลผลไม่สำเร็จ กรุณาลองอีกครั้ง")

    @application.get("/health")
    def health():
        return {"status": "ok"}

    application.include_router(router)
    return application


app = create_app()
