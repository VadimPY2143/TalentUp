from __future__ import annotations

import os
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

import httpx
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from logger import logger as LOGGER
from payments.billing import CreditBillingService
from payments.models import CreatePaymentOrderRequest
from payments.provider_wayforpay import WFP_API_URL, WFP_CHECKOUT_URL, WayForPayProvider
from payments.repositories import PaymentsRepository


def _parse_amount(value: object) -> Decimal:
    try:
        return Decimal(str(value)).quantize(Decimal("0.01"))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid amount in payment payload") from exc


class PaymentsService:
    def __init__(
        self,
        repository: PaymentsRepository,
        credit_billing_service: CreditBillingService,
    ):
        self.repository = repository
        self.credit_billing_service = credit_billing_service

    @staticmethod
    def _build_provider() -> WayForPayProvider:
        merchant_account = (os.getenv("WFP_MERCHANT_ACCOUNT") or "").strip()
        secret_key = (os.getenv("WFP_SECRET_KEY") or "").strip()
        domain_name = (os.getenv("WFP_DOMAIN_NAME") or "").strip()
        if not merchant_account or not secret_key or not domain_name:
            raise HTTPException(status_code=500, detail="WayForPay keys are not configured")

        api_version = int(os.getenv("WFP_API_VERSION", "1"))
        checkout_url = (os.getenv("WFP_CHECKOUT_URL") or WFP_CHECKOUT_URL).strip()
        api_url = (os.getenv("WFP_API_URL") or WFP_API_URL).strip()

        return WayForPayProvider(
            merchant_account=merchant_account,
            secret_key=secret_key,
            merchant_domain_name=domain_name,
            api_version=api_version,
            checkout_url=checkout_url,
            api_url=api_url,
        )

    async def list_packages(self, session: AsyncSession) -> list[dict]:
        return await self.repository.list_active_packages(session=session)

    async def create_order(
        self,
        session: AsyncSession,
        *,
        user_id: int,
        payload: CreatePaymentOrderRequest,
        service_url: str,
        return_url: str | None = None,
    ) -> dict:
        provider = self._build_provider()
        existing = await self.repository.get_order_by_idempotency_key(
            session=session,
            idempotency_key=payload.idempotency_key,
        )
        if existing:
            if int(existing["user_id"]) != user_id:
                raise HTTPException(status_code=409, detail="Idempotency key already used")
            if str(existing["provider"]) != "wayforpay":
                raise HTTPException(status_code=409, detail="Order provider mismatch")
            package = await self.repository.get_package_by_id(
                session=session,
                package_id=int(existing["package_id"]),
            )
            if not package:
                raise HTTPException(status_code=500, detail="Order package not found")

            checkout_fields = provider.build_checkout_fields(
                order_reference=str(existing["provider_order_id"]),
                amount_uah=int(existing["amount_uah"]),
                service_url=service_url,
                return_url=return_url,
                product_name=f"Credit package {package['name']} ({package['credits']} credits)",
            )
            return self._build_order_response(
                provider=provider,
                order=existing,
                package=package,
                checkout_fields=checkout_fields,
            )

        package = await self.repository.get_package_by_code(session=session, code=payload.package_code)
        if not package or not package["is_active"]:
            raise HTTPException(status_code=404, detail="Package not found")

        provider_order_id = f"wfp_{uuid4().hex}"
        order, created = await self.repository.create_order(
            session=session,
            user_id=user_id,
            package_id=int(package["id"]),
            provider="wayforpay",
            provider_order_id=provider_order_id,
            amount_uah=int(package["price_uah"]),
            idempotency_key=payload.idempotency_key,
        )
        if not created:
            if int(order["user_id"]) != user_id:
                raise HTTPException(status_code=409, detail="Idempotency key already used")
            if str(order["provider"]) != "wayforpay":
                raise HTTPException(status_code=409, detail="Order provider mismatch")
            package = await self.repository.get_package_by_id(
                session=session,
                package_id=int(order["package_id"]),
            )
            if not package:
                raise HTTPException(status_code=500, detail="Order package not found")

        checkout_fields = provider.build_checkout_fields(
            order_reference=str(order["provider_order_id"]),
            amount_uah=int(order["amount_uah"]),
            service_url=service_url,
            return_url=return_url,
            product_name=f"Credit package {package['name']} ({package['credits']} credits)",
        )
        if created:
            await session.commit()
            LOGGER.info(
                "WFP order created order_id=%s provider_order_id=%s user_id=%s service_url=%s",
                order["id"],
                provider_order_id,
                user_id,
                service_url,
            )
        else:
            LOGGER.info(
                "WFP idempotent order reuse order_id=%s provider_order_id=%s user_id=%s",
                order["id"],
                order["provider_order_id"],
                user_id,
            )
        return self._build_order_response(
            provider=provider,
            order=order,
            package=package,
            checkout_fields=checkout_fields,
        )

    async def process_wayforpay_webhook(
        self,
        session: AsyncSession,
        *,
        payload: dict,
    ) -> dict:
        LOGGER.info("=== WFP WEBHOOK RECEIVED ===")
        LOGGER.info("Webhook payload: %s", payload)

        provider = self._build_provider()
        if not isinstance(payload, dict):
            LOGGER.error("Invalid webhook payload type: %s", type(payload))
            raise HTTPException(status_code=400, detail="Invalid webhook payload")

        order_reference = str(payload.get("orderReference") or "").strip()
        LOGGER.info("Order reference: %s", order_reference)
        if not order_reference:
            LOGGER.error("Missing orderReference in payload")
            raise HTTPException(status_code=400, detail="Missing orderReference")

        merchant_account = str(payload.get("merchantAccount") or "").strip()
        LOGGER.info("Merchant account from payload: %s, expected: %s", merchant_account, provider.merchant_account)
        if merchant_account != provider.merchant_account:
            LOGGER.error("Invalid merchantAccount: %s != %s", merchant_account, provider.merchant_account)
            raise HTTPException(status_code=400, detail="Invalid merchantAccount")

        LOGGER.info("Verifying callback signature...")
        if not provider.verify_callback_signature(payload):
            LOGGER.error("Invalid callback signature for order: %s", order_reference)
            raise HTTPException(status_code=400, detail="Invalid callback signature")
        LOGGER.info("Signature verified successfully")

        order = await self.repository.get_order_by_provider_order_id_for_update(
            session=session,
            provider_order_id=order_reference,
            provider="wayforpay",
        )
        if not order:
            LOGGER.error("Payment order not found for reference: %s", order_reference)
            raise HTTPException(status_code=404, detail="Payment order not found")
        LOGGER.info("Order found: id=%s, status=%s, user_id=%s", order["id"], order["status"], order["user_id"])

        callback_amount = _parse_amount(payload.get("amount"))
        expected_amount = _parse_amount(order["amount_uah"])
        LOGGER.info("Amount check: callback=%s, expected=%s", callback_amount, expected_amount)
        if callback_amount != expected_amount:
            LOGGER.error("Amount mismatch: %s != %s", callback_amount, expected_amount)
            raise HTTPException(status_code=400, detail="Unexpected amount in callback")

        callback_currency = str(payload.get("currency") or "").upper()
        LOGGER.info("Currency: %s", callback_currency)
        if callback_currency != "UAH":
            LOGGER.error("Invalid currency: %s", callback_currency)
            raise HTTPException(status_code=400, detail="Unexpected currency in callback")

        callback_status = str(payload.get("transactionStatus") or "")
        normalized_callback_status = provider.normalize_order_status(callback_status)
        LOGGER.info("Transaction status: %s (normalized: %s)", callback_status, normalized_callback_status)
        ack = provider.build_ack(order_reference=order_reference)

        if str(order["status"]) == "success":
            LOGGER.info(
                "WFP duplicate callback order_id=%s order_reference=%s",
                order["id"],
                order_reference,
            )
            return ack

        provider_payload: dict[str, object] = {"callback": payload}

        if provider.is_approved(callback_status):
            LOGGER.info("Payment approved by callback, checking status...")
            check_status_payload = await self._check_status(provider=provider, order_reference=order_reference)
            LOGGER.info("CHECK_STATUS response: %s", check_status_payload)
            provider_payload["check_status"] = check_status_payload

            if not provider.verify_check_status_signature(check_status_payload):
                LOGGER.error("Invalid CHECK_STATUS signature")
                raise HTTPException(status_code=502, detail="Invalid CHECK_STATUS signature")

            check_merchant = str(check_status_payload.get("merchantAccount") or "").strip()
            if check_merchant != provider.merchant_account:
                LOGGER.error("Invalid CHECK_STATUS merchantAccount: %s != %s", check_merchant, provider.merchant_account)
                raise HTTPException(status_code=502, detail="Invalid CHECK_STATUS merchantAccount")

            check_reference = str(check_status_payload.get("orderReference") or "").strip()
            if check_reference != order_reference:
                LOGGER.error("Invalid CHECK_STATUS orderReference: %s != %s", check_reference, order_reference)
                raise HTTPException(status_code=502, detail="Invalid CHECK_STATUS orderReference")

            check_amount = _parse_amount(check_status_payload.get("amount"))
            if check_amount != expected_amount:
                LOGGER.error("Invalid CHECK_STATUS amount: %s != %s", check_amount, expected_amount)
                raise HTTPException(status_code=502, detail="Invalid CHECK_STATUS amount")

            check_currency = str(check_status_payload.get("currency") or "").upper()
            if check_currency != "UAH":
                LOGGER.error("Invalid CHECK_STATUS currency: %s", check_currency)
                raise HTTPException(status_code=502, detail="Invalid CHECK_STATUS currency")

            check_transaction_status = str(check_status_payload.get("transactionStatus") or "")
            normalized_check_status = provider.normalize_order_status(check_transaction_status)
            LOGGER.info("CHECK_STATUS transaction status: %s (normalized: %s)", check_transaction_status, normalized_check_status)

            if normalized_check_status == "success":
                await self.repository.update_order_status(
                    session=session,
                    order_id=int(order["id"]),
                    status="success",
                    provider_payload=provider_payload,
                    paid_at=datetime.now(timezone.utc),
                )
                package = await self.repository.get_package_by_id(
                    session=session,
                    package_id=int(order["package_id"]),
                )
                if not package:
                    LOGGER.error("Order package not found for package_id=%s", order["package_id"])
                    raise HTTPException(status_code=500, detail="Order package not found")

                LOGGER.info("Applying credits to user_id=%s, credits=%s", order["user_id"], package["credits"])
                LOGGER.info("Package found: %s, credits: %s", package["name"], package["credits"])
                await self.credit_billing_service.apply_purchase(
                    session=session,
                    user_id=int(order["user_id"]),
                    credits=int(package["credits"]),
                    idempotency_key=f"purchase:order:{order['id']}",
                    reference_type="payment_order",
                    reference_id=str(order["id"]),
                    meta={
                        "provider": "wayforpay",
                        "provider_order_id": order_reference,
                    },
                )
                await session.commit()
                LOGGER.info(
                    "WFP payment approved order_id=%s order_reference=%s check_status=%s credits_applied=%s",
                    order["id"],
                    order_reference,
                    check_transaction_status,
                    package["credits"],
                )
                return ack

            await self.repository.update_order_status(
                session=session,
                order_id=int(order["id"]),
                status=normalized_check_status,
                provider_payload=provider_payload,
            )
            await session.commit()
            LOGGER.info(
                "WFP payment not approved by CHECK_STATUS order_id=%s order_reference=%s check_status=%s",
                order["id"],
                order_reference,
                check_transaction_status,
            )
            return ack

        await self.repository.update_order_status(
            session=session,
            order_id=int(order["id"]),
            status=normalized_callback_status,
            provider_payload=provider_payload,
        )
        await session.commit()
        LOGGER.info(
            "WFP callback non-approved order_id=%s order_reference=%s status=%s reason_code=%s",
            order["id"],
            order_reference,
            callback_status,
            payload.get("reasonCode"),
        )
        return ack

    async def _check_status(self, *, provider: WayForPayProvider, order_reference: str) -> dict:
        request_payload = provider.build_check_status_request(order_reference=order_reference)
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(provider.api_url, json=request_payload)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail="WayForPay CHECK_STATUS request failed") from exc

        try:
            payload = response.json()
        except ValueError as exc:
            raise HTTPException(status_code=502, detail="WayForPay CHECK_STATUS invalid JSON") from exc

        if not isinstance(payload, dict):
            raise HTTPException(status_code=502, detail="WayForPay CHECK_STATUS invalid payload")
        return payload

    async def get_balance(self, session: AsyncSession, *, user_id: int) -> int:
        return await self.credit_billing_service.get_balance(session=session, user_id=user_id)

    async def list_transactions(
        self,
        session: AsyncSession,
        *,
        user_id: int,
        limit: int,
        offset: int,
    ) -> list[dict]:
        return await self.repository.list_credit_transactions(
            session=session,
            user_id=user_id,
            limit=limit,
            offset=offset,
        )

    def _build_order_response(
        self,
        *,
        provider: WayForPayProvider,
        order: dict,
        package: dict,
        checkout_fields: dict[str, str | int],
    ) -> dict:
        return {
            "order_id": int(order["id"]),
            "provider": str(order["provider"]),
            "provider_order_id": str(order["provider_order_id"]),
            "status": str(order["status"]),
            "amount_uah": int(order["amount_uah"]),
            "package_code": str(package["code"]),
            "package_credits": int(package["credits"]),
            "checkout_url": provider.checkout_url,
            "checkout_fields": checkout_fields,
        }
