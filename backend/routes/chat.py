"""
Chat feature – REST + WebSocket

REST endpoints:
  POST   /api/chat/conversations          start or get existing conversation
  GET    /api/chat/conversations          list my conversations
  GET    /api/chat/conversations/{id}     get conversation + messages
  POST   /api/chat/conversations/{id}/messages   send a message
  PUT    /api/chat/conversations/{id}/read       mark all as read
  DELETE /api/chat/messages/{msg_id}             soft-delete own message

WebSocket:
  WS /ws/chat/{conversation_id}?token=JWT
     – Sends / receives JSON chat frames
     – Frame format: {"type": "message", "data": ChatMessageResponse}
"""

from datetime import datetime
from typing import List
from fastapi import (
    APIRouter, Depends, HTTPException, WebSocket,
    WebSocketDisconnect, Query, UploadFile, File
)
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc

from ..database import get_db
from .. import models, schemas
from ..utils.auth import get_current_user, decode_access_token
from ..utils.cloudinary import upload_image
import json

router = APIRouter(prefix="/api/chat", tags=["Chat"])


# ══════════════════════════════════════════════════════════════════
#  WebSocket Connection Manager
# ══════════════════════════════════════════════════════════════════

class ChatManager:
    def __init__(self):
        # conversation_id -> {user_id: WebSocket}
        self.rooms: dict[str, dict[str, WebSocket]] = {}

    async def join(self, conversation_id: str, user_id: str, ws: WebSocket):
        await ws.accept()
        if conversation_id not in self.rooms:
            self.rooms[conversation_id] = {}
        self.rooms[conversation_id][user_id] = ws

    def leave(self, conversation_id: str, user_id: str):
        if conversation_id in self.rooms:
            self.rooms[conversation_id].pop(user_id, None)
            if not self.rooms[conversation_id]:
                del self.rooms[conversation_id]

    async def broadcast_to_room(self, conversation_id: str, payload: dict, exclude_user: str = None):
        """Send JSON payload to all sockets in a conversation room."""
        if conversation_id not in self.rooms:
            return
        dead = []
        for uid, ws in self.rooms[conversation_id].items():
            if uid == exclude_user:
                continue
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(uid)
        for uid in dead:
            self.rooms[conversation_id].pop(uid, None)

    async def send_to_user_in_room(self, conversation_id: str, user_id: str, payload: dict):
        """Send directly to one user in a room."""
        ws = self.rooms.get(conversation_id, {}).get(user_id)
        if ws:
            try:
                await ws.send_json(payload)
            except Exception:
                self.leave(conversation_id, user_id)


chat_manager = ChatManager()


# ══════════════════════════════════════════════════════════════════
#  Helpers
# ══════════════════════════════════════════════════════════════════

def _serialize_message(msg: models.Message) -> dict:
    sender = msg.sender
    return {
        "id": msg.id,
        "conversation_id": msg.conversation_id,
        "sender_id": msg.sender_id,
        "sender": {
            "id": sender.id,
            "full_name": sender.full_name,
            "avatar_url": sender.avatar_url,
        } if sender else None,
        "content": msg.content if not msg.is_deleted else "This message was deleted.",
        "type": msg.type.value if hasattr(msg.type, "value") else msg.type,
        "file_url": msg.file_url if not msg.is_deleted else None,
        "is_read": msg.is_read,
        "is_deleted": msg.is_deleted,
        "created_at": msg.created_at.isoformat(),
    }


def _serialize_conversation(conv: models.Conversation, current_user_id: str, db: Session) -> dict:
    unread = db.query(models.Message).filter(
        models.Message.conversation_id == conv.id,
        models.Message.sender_id != current_user_id,
        models.Message.is_read == False,
    ).count()

    # Last message preview
    last_msg = (
        db.query(models.Message)
        .filter(models.Message.conversation_id == conv.id)
        .order_by(desc(models.Message.created_at))
        .first()
    )

    other = conv.participant if conv.client_id == current_user_id else conv.client

    return {
        "id": conv.id,
        "client_id": conv.client_id,
        "participant_id": conv.participant_id,
        "other_user": {
            "id": other.id,
            "full_name": other.full_name,
            "avatar_url": other.avatar_url,
        } if other else None,
        "task_id": conv.task_id,
        "task_title": conv.task.title if conv.task else None,
        "last_message": _serialize_message(last_msg) if last_msg else None,
        "unread_count": unread,
        "last_message_at": conv.last_message_at.isoformat(),
        "created_at": conv.created_at.isoformat(),
    }


# ══════════════════════════════════════════════════════════════════
#  REST Endpoints
# ══════════════════════════════════════════════════════════════════

@router.post("/conversations", status_code=201)
async def start_conversation(
    body: schemas.ConversationCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Start a new conversation or return existing one."""
    if body.participant_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot start conversation with yourself")

    other = db.query(models.User).filter(models.User.id == body.participant_id).first()
    if not other:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if conversation already exists between these two users
    existing = db.query(models.Conversation).filter(
        or_(
            and_(
                models.Conversation.client_id == current_user.id,
                models.Conversation.participant_id == body.participant_id,
            ),
            and_(
                models.Conversation.client_id == body.participant_id,
                models.Conversation.participant_id == current_user.id,
            ),
        )
    ).first()

    if existing:
        # If re-opening, just send the opening message
        msg = models.Message(
            conversation_id=existing.id,
            sender_id=current_user.id,
            content=body.opening_message,
            type=models.MessageType.text,
        )
        db.add(msg)
        existing.last_message_at = datetime.utcnow()
        db.commit()
        db.refresh(msg)
        # Push via WS
        await chat_manager.broadcast_to_room(
            existing.id,
            {"type": "message", "data": _serialize_message(msg)},
        )
        return _serialize_conversation(existing, current_user.id, db)

    # Create new conversation
    conv = models.Conversation(
        client_id=current_user.id,
        participant_id=body.participant_id,
        task_id=body.task_id,
    )
    db.add(conv)
    db.flush()  # get conv.id before creating message

    msg = models.Message(
        conversation_id=conv.id,
        sender_id=current_user.id,
        content=body.opening_message,
        type=models.MessageType.text,
    )
    db.add(msg)
    conv.last_message_at = datetime.utcnow()

    # Notify recipient via notification system
    notif = models.Notification(
        user_id=body.participant_id,
        type=models.NotificationType.message,
        title=f"New message from {current_user.full_name}",
        message=body.opening_message[:80] + ("…" if len(body.opening_message) > 80 else ""),
        link=f"/chat/{conv.id}",
        data={"conversation_id": conv.id, "sender_id": current_user.id},
    )
    db.add(notif)
    db.commit()
    db.refresh(conv)

    return _serialize_conversation(conv, current_user.id, db)


@router.get("/conversations")
async def list_conversations(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all conversations for current user, newest first."""
    convs = (
        db.query(models.Conversation)
        .filter(
            or_(
                models.Conversation.client_id == current_user.id,
                models.Conversation.participant_id == current_user.id,
            )
        )
        .order_by(desc(models.Conversation.last_message_at))
        .all()
    )
    return [_serialize_conversation(c, current_user.id, db) for c in convs]


@router.get("/conversations/{conv_id}")
async def get_conversation(
    conv_id: str,
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=100),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get conversation detail with paginated messages (latest first)."""
    conv = db.query(models.Conversation).filter(models.Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if current_user.id not in (conv.client_id, conv.participant_id):
        raise HTTPException(status_code=403, detail="Not a participant")

    total = db.query(models.Message).filter(models.Message.conversation_id == conv_id).count()
    messages = (
        db.query(models.Message)
        .filter(models.Message.conversation_id == conv_id)
        .order_by(desc(models.Message.created_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    # Reverse so chronological on frontend
    messages = list(reversed(messages))

    other = conv.participant if conv.client_id == current_user.id else conv.client

    return {
        "conversation": _serialize_conversation(conv, current_user.id, db),
        "messages": [_serialize_message(m) for m in messages],
        "total": total,
        "page": page,
        "per_page": per_page,
        "has_more": (page * per_page) < total,
    }


@router.post("/conversations/{conv_id}/messages")
async def send_message(
    conv_id: str,
    body: schemas.ChatMessageCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a text message (non-WebSocket fallback)."""
    conv = db.query(models.Conversation).filter(models.Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if current_user.id not in (conv.client_id, conv.participant_id):
        raise HTTPException(status_code=403, detail="Not a participant")

    msg = models.Message(
        conversation_id=conv_id,
        sender_id=current_user.id,
        content=body.content,
        type=models.MessageType.text,
    )
    db.add(msg)
    conv.last_message_at = datetime.utcnow()
    db.commit()
    db.refresh(msg)

    serialized = _serialize_message(msg)
    await chat_manager.broadcast_to_room(conv_id, {"type": "message", "data": serialized})
    return serialized


@router.post("/conversations/{conv_id}/upload")
async def upload_chat_file(
    conv_id: str,
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload an image/file and send as a message."""
    conv = db.query(models.Conversation).filter(models.Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if current_user.id not in (conv.client_id, conv.participant_id):
        raise HTTPException(status_code=403, detail="Not a participant")

    url = await upload_image(file, folder="sifra/chat")
    msg = models.Message(
        conversation_id=conv_id,
        sender_id=current_user.id,
        content="📎 Sent an image",
        type=models.MessageType.image,
        file_url=url,
    )
    db.add(msg)
    conv.last_message_at = datetime.utcnow()
    db.commit()
    db.refresh(msg)

    serialized = _serialize_message(msg)
    await chat_manager.broadcast_to_room(conv_id, {"type": "message", "data": serialized})
    return serialized


@router.put("/conversations/{conv_id}/read")
async def mark_conversation_read(
    conv_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark all messages from the other user as read."""
    conv = db.query(models.Conversation).filter(models.Conversation.id == conv_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if current_user.id not in (conv.client_id, conv.participant_id):
        raise HTTPException(status_code=403, detail="Not a participant")

    db.query(models.Message).filter(
        models.Message.conversation_id == conv_id,
        models.Message.sender_id != current_user.id,
        models.Message.is_read == False,
    ).update({"is_read": True})
    db.commit()

    # Notify the other party that messages were read
    other_id = conv.participant_id if conv.client_id == current_user.id else conv.client_id
    await chat_manager.broadcast_to_room(
        conv_id,
        {"type": "read_receipt", "data": {"conversation_id": conv_id, "reader_id": current_user.id}},
        exclude_user=current_user.id,
    )
    return {"success": True}


@router.delete("/messages/{msg_id}")
async def delete_message(
    msg_id: str,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Soft-delete own message."""
    msg = db.query(models.Message).filter(models.Message.id == msg_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only delete your own messages")

    msg.is_deleted = True
    db.commit()

    await chat_manager.broadcast_to_room(
        msg.conversation_id,
        {"type": "message_deleted", "data": {"message_id": msg_id}},
    )
    return {"success": True}


@router.get("/unread-count")
async def total_unread(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Total unread messages across all conversations."""
    # Get all conversation IDs for this user
    conv_ids = [
        c.id for c in db.query(models.Conversation.id).filter(
            or_(
                models.Conversation.client_id == current_user.id,
                models.Conversation.participant_id == current_user.id,
            )
        ).all()
    ]
    count = db.query(models.Message).filter(
        models.Message.conversation_id.in_(conv_ids),
        models.Message.sender_id != current_user.id,
        models.Message.is_read == False,
    ).count() if conv_ids else 0
    return {"count": count}


# ══════════════════════════════════════════════════════════════════
#  WebSocket Endpoint
# ══════════════════════════════════════════════════════════════════

@router.websocket("/ws/chat/{conv_id}")
async def chat_websocket(
    conv_id: str,
    websocket: WebSocket,
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    """
    Real-time chat WebSocket.
    
    Client sends:
      {"type": "message", "content": "Hello!"}          text message
      {"type": "typing"}                                 typing indicator
      {"type": "stop_typing"}                            stopped typing
      {"type": "ping"}                                   keep-alive

    Server sends:
      {"type": "message",        "data": ChatMessageResponse}
      {"type": "message_deleted","data": {"message_id": "..."}}
      {"type": "read_receipt",   "data": {"conversation_id": "...", "reader_id": "..."}}
      {"type": "typing",         "data": {"user_id": "...", "full_name": "..."}}
      {"type": "stop_typing",    "data": {"user_id": "..."}}
      {"type": "error",          "data": {"detail": "..."}}
      {"type": "pong"}
    """
    # ── Auth ────────────────────────────────────────────────────
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4001, reason="Invalid token")
            return
    except Exception:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user or user.is_banned:
        await websocket.close(code=4003, reason="Forbidden")
        return

    # ── Verify participant ────────────────────────────────────────
    conv = db.query(models.Conversation).filter(models.Conversation.id == conv_id).first()
    if not conv or user_id not in (conv.client_id, conv.participant_id):
        await websocket.close(code=4004, reason="Not a participant")
        return

    # ── Join room ─────────────────────────────────────────────────
    await chat_manager.join(conv_id, user_id, websocket)

    # Auto-mark existing messages as read on connect
    db.query(models.Message).filter(
        models.Message.conversation_id == conv_id,
        models.Message.sender_id != user_id,
        models.Message.is_read == False,
    ).update({"is_read": True})
    db.commit()

    try:
        while True:
            raw = await websocket.receive_text()

            if raw == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            try:
                frame = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "data": {"detail": "Invalid JSON"}})
                continue

            frame_type = frame.get("type")

            # ── Send text message ──────────────────────────────────
            if frame_type == "message":
                content = (frame.get("content") or "").strip()
                if not content:
                    await websocket.send_json({"type": "error", "data": {"detail": "Empty message"}})
                    continue
                if len(content) > 2000:
                    await websocket.send_json({"type": "error", "data": {"detail": "Message too long (max 2000 chars)"}})
                    continue

                # Refresh db session to avoid stale state
                db.expire_all()

                msg = models.Message(
                    conversation_id=conv_id,
                    sender_id=user_id,
                    content=content,
                    type=models.MessageType.text,
                )
                db.add(msg)

                conv_obj = db.query(models.Conversation).filter(models.Conversation.id == conv_id).first()
                if conv_obj:
                    conv_obj.last_message_at = datetime.utcnow()

                db.commit()
                db.refresh(msg)

                serialized = _serialize_message(msg)

                # Send to ALL participants (including sender for confirmation)
                await chat_manager.broadcast_to_room(
                    conv_id,
                    {"type": "message", "data": serialized},
                )

                # Push notification to offline recipient
                other_id = conv.participant_id if conv.client_id == user_id else conv.client_id
                if other_id not in chat_manager.rooms.get(conv_id, {}):
                    notif = models.Notification(
                        user_id=other_id,
                        type=models.NotificationType.message,
                        title=f"New message from {user.full_name}",
                        message=content[:80] + ("…" if len(content) > 80 else ""),
                        link=f"/chat/{conv_id}",
                        data={"conversation_id": conv_id},
                    )
                    db.add(notif)
                    db.commit()

            # ── Typing indicators ────────────────────────────────────
            elif frame_type == "typing":
                await chat_manager.broadcast_to_room(
                    conv_id,
                    {"type": "typing", "data": {"user_id": user_id, "full_name": user.full_name}},
                    exclude_user=user_id,
                )

            elif frame_type == "stop_typing":
                await chat_manager.broadcast_to_room(
                    conv_id,
                    {"type": "stop_typing", "data": {"user_id": user_id}},
                    exclude_user=user_id,
                )

            else:
                await websocket.send_json({"type": "error", "data": {"detail": f"Unknown frame type: {frame_type}"}})

    except WebSocketDisconnect:
        chat_manager.leave(conv_id, user_id)
    except Exception as e:
        chat_manager.leave(conv_id, user_id)
