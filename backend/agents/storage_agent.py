"""Team Gamma — Data & Storage agent: file I/O helpers for uploads and exports."""
import os
import uuid
from pathlib import Path


class StorageAgent:
    def __init__(self, upload_dir: str = "uploads", export_dir: str = "exports"):
        self.upload_dir = Path(upload_dir)
        self.export_dir = Path(export_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.export_dir.mkdir(parents=True, exist_ok=True)

    def save_upload(self, data: bytes, original_name: str) -> tuple[str, str]:
        """Save uploaded bytes to disk. Returns (stored_filename, full_path)."""
        ext = Path(original_name).suffix
        stored = f"{uuid.uuid4().hex}{ext}"
        path = self.upload_dir / stored
        path.write_bytes(data)
        return stored, str(path)

    def get_upload_path(self, filename: str) -> Path:
        return self.upload_dir / filename

    def save_export(self, data: bytes, suffix: str) -> tuple[str, str]:
        """Save export bytes to disk. Returns (stored_filename, full_path)."""
        stored = f"{uuid.uuid4().hex}.{suffix}"
        path = self.export_dir / stored
        path.write_bytes(data)
        return stored, str(path)

    def get_export_path(self, filename: str) -> Path:
        return self.export_dir / filename

    def delete_upload(self, filename: str) -> None:
        path = self.upload_dir / filename
        if path.exists():
            path.unlink()
