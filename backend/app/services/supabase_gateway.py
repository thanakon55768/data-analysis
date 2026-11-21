"""User-scoped Supabase transport. Authorization is always the end user's token."""

import os
from uuid import UUID

import httpx

from app.schemas import AnalysisError


class SupabaseGateway:
    def __init__(self, token: str):
        self.url = os.environ.get("SUPABASE_URL", "").rstrip("/")
        key = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "")
        if not self.url.startswith("https://") or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required")
        self.client = httpx.Client(
            base_url=self.url,
            headers={"apikey": key, "Authorization": f"Bearer {token}"},
            timeout=30,
            follow_redirects=False,
        )
        try:
            response = self.client.get("/auth/v1/user")
            if response.status_code in (401, 403):
                raise AnalysisError("unauthorized", "กรุณาเข้าสู่ระบบอีกครั้ง", 401)
            response.raise_for_status()
            self.owner = str(UUID(response.json()["id"]))
        except Exception:
            self.client.close()
            raise

    def call(self, method, path, **kwargs):
        try:
            response = self.client.request(method, path, **kwargs)
        except httpx.HTTPError:
            raise AnalysisError(
                "storage_unavailable", "เชื่อมต่อที่จัดเก็บข้อมูลไม่ได้ กรุณาลองอีกครั้ง", 503
            ) from None
        if response.status_code in (401, 403):
            raise AnalysisError("unauthorized", "กรุณาเข้าสู่ระบบอีกครั้ง", 401)
        if response.status_code >= 400:
            raise AnalysisError("storage_failed", "จัดเก็บข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง", 503)
        return response

    def close(self):
        self.client.close()
