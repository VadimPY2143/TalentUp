import os

from celery import Celery


def _build_redis_url() -> str:
    return os.getenv("REDIS_URL", "redis://redis:6379/0")


BROKER_URL = os.getenv("CELERY_BROKER_URL", _build_redis_url())
RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", BROKER_URL)
DISPATCH_INTERVAL_SECONDS = float(os.getenv("VACANCY_DIGEST_DISPATCH_INTERVAL_SECONDS", "1800"))

celery_app = Celery(
    "talentup_messages",
    broker=BROKER_URL,
    backend=RESULT_BACKEND,
    include=["worker.messages.tasks", "employer.candidate_matching.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    broker_connection_retry_on_startup=True,
    broker_connection_max_retries=None,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    beat_schedule={
        "vacancy-subscriptions-dispatch": {
            "task": "worker.messages.tasks.dispatch_due_subscriptions",
            "schedule": DISPATCH_INTERVAL_SECONDS,
        }
    },
)
