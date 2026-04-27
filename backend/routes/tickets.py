"""
Customer Support Ticket routes.

User:
  POST   /api/tickets                           — create ticket
  GET    /api/tickets                           — list my tickets
  GET    /api/tickets/{ticket_id}               — get ticket + messages
  POST   /api/tickets/{ticket_id}/messages      — send message on ticket

Admin:
  GET    /api/tickets/admin/all                 — all tickets (paginated + filters)
  PUT    /api/tickets/admin/{ticket_id}         — update status / priority
  POST   /api/tickets/admin/{ticket_id}/reply   — admin reply
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional

from ..database import get_db
from .. import models, schemas
from ..utils.auth import get_current_user, get_current_admin

router = APIRouter(prefix="/api/tickets", tags=["Support Tickets"])


# ── User: Create ──────────────────────────────────────────────────────────────

@router.post("", response_model=schemas.TicketResponse, status_code=201)
async def create_ticket(
    body: schemas.TicketCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = models.Ticket(
        user_id=current_user.id,
        subject=body.subject,
        description=body.description,
        priority=body.priority,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


# ── User: List own tickets ────────────────────────────────────────────────────

@router.get("", response_model=List[schemas.TicketResponse])
async def list_my_tickets(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.Ticket)
        .filter(models.Ticket.user_id == current_user.id)
        .order_by(desc(models.Ticket.created_at))
        .all()
    )


# ── User: Get single ticket with messages ────────────────────────────────────

@router.get("/{ticket_id}")
async def get_ticket(
    ticket_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(models.Ticket).filter(
        models.Ticket.id == ticket_id,
        models.Ticket.user_id == current_user.id,
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    messages = (
        db.query(models.TicketMessage)
        .filter(models.TicketMessage.ticket_id == ticket_id)
        .order_by(models.TicketMessage.created_at)
        .all()
    )
    return {
        "ticket": schemas.TicketResponse.model_validate(ticket),
        "messages": [schemas.TicketMessageResponse.model_validate(m) for m in messages],
    }


# ── User: Send message on ticket ──────────────────────────────────────────────

@router.post("/{ticket_id}/messages", response_model=schemas.TicketMessageResponse, status_code=201)
async def send_ticket_message(
    ticket_id: str,
    body: schemas.TicketMessageCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(models.Ticket).filter(
        models.Ticket.id == ticket_id,
        models.Ticket.user_id == current_user.id,
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.status == models.TicketStatus.closed:
        raise HTTPException(status_code=400, detail="Ticket is closed")

    msg = models.TicketMessage(
        ticket_id=ticket_id,
        sender_id=current_user.id,
        message=body.message,
        is_admin=False,
    )
    db.add(msg)
    ticket.status = models.TicketStatus.pending  # user replied → pending admin
    db.commit()
    db.refresh(msg)
    return msg


# ── Admin: List all tickets ───────────────────────────────────────────────────

@router.get("/admin/all")
async def admin_list_tickets(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    status: Optional[str] = Query(default=None),
    priority: Optional[str] = Query(default=None),
    admin: models.Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    query = db.query(models.Ticket)
    if status:
        query = query.filter(models.Ticket.status == status)
    if priority:
        query = query.filter(models.Ticket.priority == priority)

    total = query.count()
    tickets = (
        query.order_by(desc(models.Ticket.updated_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return {"tickets": [schemas.TicketResponse.model_validate(t) for t in tickets], "total": total}


# ── Admin: Update ticket status/priority ─────────────────────────────────────

@router.put("/admin/{ticket_id}", response_model=schemas.TicketResponse)
async def admin_update_ticket(
    ticket_id: str,
    body: schemas.TicketUpdate,
    admin: models.Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(ticket, key, value)

    db.commit()
    db.refresh(ticket)
    return ticket


# ── Admin: Reply on ticket ────────────────────────────────────────────────────

@router.post("/admin/{ticket_id}/reply", response_model=schemas.TicketMessageResponse, status_code=201)
async def admin_reply_ticket(
    ticket_id: str,
    body: schemas.TicketMessageCreate,
    admin: models.Admin = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    msg = models.TicketMessage(
        ticket_id=ticket_id,
        sender_id=admin.id,
        message=body.message,
        is_admin=True,
    )
    db.add(msg)
    ticket.status = models.TicketStatus.open  # admin replied → waiting on user
    db.commit()
    db.refresh(msg)
    return msg
