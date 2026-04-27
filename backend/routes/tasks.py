"""
Task routes.

SQL-injection defence:
  - All queries use SQLAlchemy ORM with parameterised bindings.
  - Free-text search is sanitised with safe_like() before being fed into
    .ilike() — this escapes % and _ so users cannot craft wildcard floods.
  - sort_by is validated against a hard-coded whitelist before being used,
    so there is no dynamic column-name injection path.
  - Pagination values are constrained by ge/le validators in Query().
  - No raw text() SQL is used anywhere in this file.

Rate limits:
  POST /tasks           20/hour   — prevent task spam
  POST /{id}/apply      30/hour   — prevent application flooding
  POST /{id}/images     20/hour   — file-upload abuse
"""

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, BackgroundTasks, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc
from typing import Optional, List
from math import ceil

from ..database import get_db
from .. import models, schemas
from ..utils.auth import get_current_user
from ..utils.cloudinary import upload_task_image
from ..utils.email import send_application_notification_email
from ..utils.limiter import limiter
from ..utils.sanitize import sanitize_search, sanitize_text, safe_like
from ..config import settings

router = APIRouter(prefix="/api/tasks", tags=["Tasks"])

# Whitelist of allowed sort columns — never interpolate user input into ORDER BY
_SORT_WHITELIST = {"newest", "budget_high", "budget_low", "deadline"}


@router.get("", response_model=schemas.TaskListResponse)
async def list_tasks(
    page:       int            = Query(default=1,  ge=1),
    per_page:   int            = Query(default=20, ge=1, le=100),
    category:   Optional[str]  = None,
    status:     Optional[str]  = None,
    search:     Optional[str]  = Query(default=None, max_length=200),
    min_budget: Optional[float] = Query(default=None, ge=0),
    max_budget: Optional[float] = Query(default=None, ge=0),
    sort_by:    str            = Query(default="newest"),
    db: Session = Depends(get_db),
):
    # Validate sort against whitelist (never pass user value to ORDER BY directly)
    if sort_by not in _SORT_WHITELIST:
        sort_by = "newest"

    query = db.query(models.Task).filter(
        models.Task.is_spam  == False,
        models.Task.status   != models.TaskStatus.cancelled,
    )

    if category:
        # Exact enum-style match — no LIKE needed
        query = query.filter(models.Task.category == category)

    if status and status in {s.value for s in models.TaskStatus}:
        query = query.filter(models.Task.status == status)

    if search:
        # Sanitise + escape LIKE wildcards before parameterised .ilike()
        safe = safe_like(sanitize_search(search, max_length=200))
        query = query.filter(
            or_(
                models.Task.title.ilike(f"%{safe}%",       escape="\\"),
                models.Task.description.ilike(f"%{safe}%", escape="\\"),
            )
        )

    if min_budget is not None:
        query = query.filter(models.Task.budget_max >= min_budget)
    if max_budget is not None:
        query = query.filter(models.Task.budget_min <= max_budget)

    # Safe: column references are code constants, not user input
    if sort_by == "newest":
        query = query.order_by(desc(models.Task.created_at))
    elif sort_by == "budget_high":
        query = query.order_by(desc(models.Task.budget_max))
    elif sort_by == "budget_low":
        query = query.order_by(models.Task.budget_min)
    elif sort_by == "deadline":
        query = query.order_by(models.Task.deadline)

    total = query.count()
    tasks = query.offset((page - 1) * per_page).limit(per_page).all()

    return {
        "tasks":    tasks,
        "total":    total,
        "page":     page,
        "per_page": per_page,
        "pages":    ceil(total / per_page) if total > 0 else 0,
    }


@router.post("", response_model=schemas.TaskResponse, status_code=201)
@limiter.limit(settings.RATE_TASK_CREATE)
async def create_task(
    request: Request,
    body: schemas.TaskCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Sanitise free-text fields before storage
    task = models.Task(
        **{
            **body.dict(),
            "title":       sanitize_text(body.title,       max_length=200),
            "description": sanitize_text(body.description, max_length=5000),
            "location":    sanitize_text(body.location or "", max_length=200) or None,
        },
        creator_id=current_user.id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.post("/{task_id}/images", response_model=schemas.MessageResponse)
@limiter.limit(settings.RATE_UPLOAD)
async def upload_task_images(
    request: Request,
    task_id: str,
    files: List[UploadFile] = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your task")
    if len(files) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 images per task")

    urls = [await upload_task_image(f) for f in files]
    task.images = (task.images or []) + urls
    db.commit()
    return {"message": f"Uploaded {len(urls)} image(s)", "success": True}


@router.get("/{task_id}", response_model=schemas.TaskResponse)
async def get_task(task_id: str, db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.views_count = (task.views_count or 0) + 1
    db.commit()
    return task


@router.put("/{task_id}", response_model=schemas.TaskResponse)
async def update_task(
    task_id: str,
    body: schemas.TaskUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    update_data = body.dict(exclude_unset=True)

    # Sanitise any text fields in the update payload
    for text_field in ("title", "description", "location"):
        if text_field in update_data and update_data[text_field]:
            update_data[text_field] = sanitize_text(update_data[text_field], max_length=5000)

    for key, value in update_data.items():
        setattr(task, key, value)

    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", response_model=schemas.MessageResponse)
async def delete_task(
    task_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    db.delete(task)
    db.commit()
    return {"message": "Task deleted successfully", "success": True}


# ── Applications ──────────────────────────────────────────────────────────────

@router.post("/{task_id}/apply", response_model=schemas.ApplicationResponse, status_code=201)
@limiter.limit(settings.RATE_APPLY)
async def apply_to_task(
    request: Request,
    task_id: str,
    body: schemas.ApplicationCreate,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.creator_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot apply to your own task")
    if task.status != models.TaskStatus.open:
        raise HTTPException(status_code=400, detail="This task is not accepting applications")

    existing = (
        db.query(models.Application)
        .filter(
            models.Application.task_id      == task_id,
            models.Application.freelancer_id == current_user.id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="You have already applied to this task")

    application = models.Application(
        task_id       = task_id,
        freelancer_id = current_user.id,
        cover_letter  = sanitize_text(body.cover_letter, max_length=3000),
        proposed_budget   = body.proposed_budget,
        proposed_timeline = body.proposed_timeline,
    )
    db.add(application)
    task.applications_count = (task.applications_count or 0) + 1

    notification = models.Notification(
        user_id = task.creator_id,
        type    = models.NotificationType.task_application,
        title   = "New Application",
        message = f"{current_user.full_name} applied to: {task.title}",
        link    = f"/tasks/{task_id}/applications",
        data    = {"task_id": task_id, "freelancer_id": current_user.id},
    )
    db.add(notification)
    db.commit()
    db.refresh(application)

    background_tasks.add_task(
        send_application_notification_email,
        task.creator.email,
        current_user.full_name,
        task.title,
        task_id,
    )
    return application


@router.get("/{task_id}/applications", response_model=List[schemas.ApplicationResponse])
async def get_task_applications(
    task_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return task.applications


@router.put("/{task_id}/applications/{app_id}", response_model=schemas.ApplicationResponse)
async def update_application_status(
    task_id: str,
    app_id: str,
    body: schemas.ApplicationStatusUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task or task.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    application = (
        db.query(models.Application)
        .filter(
            models.Application.id      == app_id,
            models.Application.task_id == task_id,
        )
        .first()
    )
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    application.status = body.status

    if body.status == models.ApplicationStatus.accepted:
        task.status         = models.TaskStatus.in_progress
        task.assigned_to_id = application.freelancer_id
        db.add(models.Notification(
            user_id = application.freelancer_id,
            type    = models.NotificationType.application_accepted,
            title   = "Application Accepted!",
            message = f"Your application for '{task.title}' was accepted.",
            link    = f"/tasks/{task_id}",
        ))
    elif body.status == models.ApplicationStatus.rejected:
        db.add(models.Notification(
            user_id = application.freelancer_id,
            type    = models.NotificationType.application_rejected,
            title   = "Application Update",
            message = f"Your application for '{task.title}' was not selected.",
            link    = f"/tasks/{task_id}",
        ))

    db.commit()
    db.refresh(application)
    return application


@router.get("/my/tasks", response_model=List[schemas.TaskResponse])
async def my_tasks(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.Task)
        .filter(models.Task.creator_id == current_user.id)
        .order_by(desc(models.Task.created_at))
        .all()
    )


@router.get("/my/applications", response_model=List[schemas.ApplicationResponse])
async def my_applications(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.Application)
        .filter(models.Application.freelancer_id == current_user.id)
        .order_by(desc(models.Application.created_at))
        .all()
    )
