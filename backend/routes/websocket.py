from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Dict, List
import json
import asyncio
from ..utils.auth import decode_access_token

router = APIRouter(tags=["WebSocket"])


class ConnectionManager:
    def __init__(self):
        # user_id -> list of WebSocket connections
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # broadcast connections (no auth required for public updates)
        self.broadcast_connections: List[WebSocket] = []

    async def connect_user(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)

    async def connect_broadcast(self, websocket: WebSocket):
        await websocket.accept()
        self.broadcast_connections.append(websocket)

    def disconnect_user(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id] = [
                ws for ws in self.active_connections[user_id] if ws != websocket
            ]
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    def disconnect_broadcast(self, websocket: WebSocket):
        if websocket in self.broadcast_connections:
            self.broadcast_connections.remove(websocket)

    async def send_to_user(self, user_id: str, data: dict):
        if user_id in self.active_connections:
            disconnected = []
            for ws in self.active_connections[user_id]:
                try:
                    await ws.send_json(data)
                except Exception:
                    disconnected.append(ws)
            for ws in disconnected:
                self.active_connections[user_id].remove(ws)

    async def broadcast(self, data: dict):
        disconnected = []
        for ws in self.broadcast_connections:
            try:
                await ws.send_json(data)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            self.broadcast_connections.remove(ws)


manager = ConnectionManager()


@router.websocket("/ws/notifications")
async def user_notifications_ws(
    websocket: WebSocket,
    token: str = Query(...),
):
    """Authenticated WebSocket for per-user notifications."""
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4001)
            return
    except Exception:
        await websocket.close(code=4001)
        return

    await manager.connect_user(websocket, user_id)
    try:
        while True:
            # Keep alive with ping/pong
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect_user(websocket, user_id)


@router.websocket("/ws/tasks")
async def public_tasks_ws(websocket: WebSocket):
    """Public WebSocket for broadcasting new task events."""
    await manager.connect_broadcast(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect_broadcast(websocket)


async def notify_user(user_id: str, notification_data: dict):
    """Call this from other routes to push a notification to a user."""
    await manager.send_to_user(user_id, {
        "type": "notification",
        **notification_data,
    })


async def broadcast_task(task_data: dict):
    """Call this to broadcast a new task to all connected clients."""
    await manager.broadcast({
        "type": "new_task",
        **task_data,
    })
