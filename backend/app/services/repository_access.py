from tempfile import TemporaryDirectory

from fastapi import Request

from app.schemas import AnalysisError
from app.services.supabase_gateway import SupabaseGateway
from app.services.supabase_repository import SupabaseRepository


def get_repository(request: Request):
    if request.app.state.storage_mode == "local":
        yield request.app.state.repository
        return
    authorization = request.headers.get("authorization", "")
    if not authorization.startswith("Bearer ") or not authorization[7:]:
        raise AnalysisError("unauthorized", "กรุณาเข้าสู่ระบบ", 401)
    gateway = SupabaseGateway(authorization[7:])
    try:
        with TemporaryDirectory(prefix="analyst-") as directory:
            from pathlib import Path

            yield SupabaseRepository(Path(directory), gateway)
    finally:
        gateway.close()
