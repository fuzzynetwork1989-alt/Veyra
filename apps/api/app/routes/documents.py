from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.rate_limit import enforce_rate_limit
from app.retrieval_service import get_project_for_user, list_documents, store_document
from app.routes.auth import get_current_user

router = APIRouter(prefix="/documents", tags=["documents"])

MAX_UPLOAD_BYTES = 2 * 1024 * 1024


@router.post("/upload")
async def upload_document(
    project_id: str = Form(...),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    enforce_rate_limit(f"upload:{current_user['user_id']}", limit=20, window_seconds=60)

    if not get_project_for_user(project_id, current_user["user_id"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large")

    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only UTF-8 text files are supported",
        ) from exc

    document = store_document(
        user_id=current_user["user_id"],
        project_id=project_id,
        filename=file.filename or "upload.txt",
        content=content,
    )
    return {"status": "success", "document": document}


@router.get("/")
async def get_documents(
    project_id: str,
    current_user: dict = Depends(get_current_user),
):
    if not get_project_for_user(project_id, current_user["user_id"]):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return {"documents": list_documents(project_id, current_user["user_id"])}