import os

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from payments.models import (
    CreatePaymentOrderRequest,
    CreatePaymentOrderResponse,
    CreditPackageResponse,
    CreditsBalanceResponse,
    CreditTransactionResponse,
    PaymentWebhookResponse,
)
from payments.repositories import PaymentsRepository
from payments.services import PaymentsService
from payments.billing import CreditBillingService
from users.auth import get_current_user


router = APIRouter(prefix="/payments", tags=["Payments"])

payments_service = PaymentsService(
    repository=PaymentsRepository(),
    credit_billing_service=CreditBillingService(),
)


@router.get("/packages", response_model=list[CreditPackageResponse])
async def list_packages(
    session: AsyncSession = Depends(get_session),
) -> list[CreditPackageResponse]:
    packages = await payments_service.list_packages(session=session)
    return [CreditPackageResponse(**row) for row in packages]


@router.post("/orders", response_model=CreatePaymentOrderResponse)
async def create_payment_order(
    payload: CreatePaymentOrderRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(get_current_user),
) -> CreatePaymentOrderResponse:
    server_origin = os.getenv("SERVER_ORIGIN", str(request.base_url)).rstrip("/")
    webhook_url = f"{server_origin}/payments/webhook/wayforpay"
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"SERVER_ORIGIN env var: {os.getenv('SERVER_ORIGIN')}")
    logger.info(f"request.base_url: {request.base_url}")
    logger.info(f"server_origin used: {server_origin}")
    logger.info(f"webhook_url: {webhook_url}")
    result_url = (os.getenv("WFP_RETURN_URL") or f"{server_origin}/payments/return").strip()
    order = await payments_service.create_order(
        session=session,
        user_id=int(current_user["id"]),
        payload=payload,
        service_url=webhook_url,
        return_url=result_url,
    )
    return CreatePaymentOrderResponse(**order)


async def _wayforpay_webhook_handler(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> PaymentWebhookResponse:
    payload: dict = {}
    try:
        parsed = await request.json()
        if isinstance(parsed, dict):
            payload = parsed
    except Exception:
        form = await request.form()
        payload = dict(form)

    if not payload:
        raise HTTPException(status_code=400, detail="Webhook payload is required")

    response_payload = await payments_service.process_wayforpay_webhook(
        session=session,
        payload=payload,
    )
    return PaymentWebhookResponse(**response_payload)


@router.post("/webhook/wayforpay", response_model=PaymentWebhookResponse)
async def wayforpay_webhook(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> PaymentWebhookResponse:
    return await _wayforpay_webhook_handler(request=request, session=session)


@router.post("/webhook/liqpay", response_model=PaymentWebhookResponse, deprecated=True)
async def liqpay_webhook_alias(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> PaymentWebhookResponse:
    return await _wayforpay_webhook_handler(request=request, session=session)


@router.get("/balance", response_model=CreditsBalanceResponse)
async def get_credits_balance(
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(get_current_user),
) -> CreditsBalanceResponse:
    balance = await payments_service.get_balance(session=session, user_id=int(current_user["id"]))
    return CreditsBalanceResponse(credits=balance)


@router.get("/transactions", response_model=list[CreditTransactionResponse])
async def list_credit_transactions(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
    current_user: dict = Depends(get_current_user),
) -> list[CreditTransactionResponse]:
    rows = await payments_service.list_transactions(
        session=session,
        user_id=int(current_user["id"]),
        limit=limit,
        offset=offset,
    )
    return [CreditTransactionResponse(**row) for row in rows]


@router.post("/return")
@router.get("/return")
async def payment_return(request: Request) -> RedirectResponse:
    return_url = (
        os.getenv("FRONTEND_URL")
        or os.getenv("FRONTEND_ORIGIN")
        or "http://localhost:5173/"
    )
    # WFP may call returnUrl with POST, so force GET redirect for SPA.
    return RedirectResponse(url=return_url, status_code=303)
