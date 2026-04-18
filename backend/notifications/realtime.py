from __future__ import annotations

import asyncio
import json
import os
from typing import Any

import redis.asyncio as redis
from redis.exceptions import RedisError

from logger import logger

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
redis_client = redis.from_url(REDIS_URL, decode_responses=True)


async def publish_to_user(user_id: int, payload: dict[str, Any]) -> None:
    try:
        await redis_client.publish(f"notif:{user_id}", json.dumps(payload, default=str))
    except RedisError as exc:
        logger.warning(f"Failed to publish notification realtime event: {exc}")


async def relay_pubsub_events_to_local_sockets(
    *,
    send_to_user: Any,
    stop_event: asyncio.Event,
) -> None:
    while not stop_event.is_set():
        pubsub = redis_client.pubsub()
        try:
            await pubsub.psubscribe("notif:*")
            async for event in pubsub.listen():
                if stop_event.is_set():
                    break
                if event.get("type") != "pmessage":
                    continue

                channel = event.get("channel")
                if not isinstance(channel, str) or not channel.startswith("notif:"):
                    continue

                user_id_raw = channel.split(":", 1)[1]
                if not user_id_raw.isdigit():
                    continue

                raw_payload = event.get("data")
                if not isinstance(raw_payload, str):
                    continue

                try:
                    payload = json.loads(raw_payload)
                except json.JSONDecodeError:
                    logger.warning(f"Invalid Redis pubsub payload on channel {channel}")
                    continue

                if not isinstance(payload, dict):
                    continue

                await send_to_user(int(user_id_raw), payload)
        except asyncio.CancelledError:
            raise
        except RedisError as exc:
            logger.error(f"Redis pubsub listener error: {exc}")
            await asyncio.sleep(1)
        except Exception as exc:
            logger.error(f"Unexpected pubsub listener error: {exc}")
            await asyncio.sleep(1)
        finally:
            await pubsub.aclose()

