import asyncio
import json

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[int, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.setdefault(user_id, set()).add(websocket)

    async def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        async with self._lock:
            sockets = self._connections.get(user_id)
            if not sockets:
                return
            sockets.discard(websocket)
            if not sockets:
                self._connections.pop(user_id, None)

    async def send_to_user(self, user_id: int, payload: dict) -> None:
        async with self._lock:
            sockets = list(self._connections.get(user_id, set()))

        if not sockets:
            return

        message = json.dumps(payload, default=str)
        results = await asyncio.gather(
            *(socket.send_text(message) for socket in sockets),
            return_exceptions=True,
        )

        for socket, result in zip(sockets, results):
            if isinstance(result, Exception):
                await self.disconnect(user_id, socket)

    async def has_user(self, user_id: int) -> bool:
        async with self._lock:
            return user_id in self._connections


manager = ConnectionManager()
