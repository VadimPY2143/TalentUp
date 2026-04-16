import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock

import pytest

sys.path.append(str(Path(__file__).resolve().parents[1]))

from payments.billing import ChargeResult, CreditBillingService
from payments.models import CreatePaymentOrderRequest
from payments.services import PaymentsService


class _ProviderStub:
    checkout_url = "https://secure.wayforpay.com/pay"
    merchant_account = "merchant_test"

    def build_checkout_fields(
        self,
        *,
        order_reference: str,
        amount_uah: int,
        service_url: str,
        return_url: str | None,
        product_name: str,
    ) -> dict[str, Any]:
        return {
            "orderReference": order_reference,
            "amount": amount_uah,
            "serviceUrl": service_url,
            "returnUrl": return_url or "",
            "productName[]": product_name,
        }

    def verify_callback_signature(self, payload: dict[str, Any]) -> bool:
        del payload
        return True

    def build_ack(self, *, order_reference: str, status: str = "accept") -> dict[str, Any]:
        return {
            "orderReference": order_reference,
            "status": status,
            "time": 1700000000,
            "signature": "sig",
        }

    def normalize_order_status(self, transaction_status: str) -> str:
        if transaction_status.lower() == "approved":
            return "success"
        return "pending"

    def is_approved(self, transaction_status: str) -> bool:
        return transaction_status.lower() == "approved"

    def verify_check_status_signature(self, payload: dict[str, Any]) -> bool:
        del payload
        return True


class _SessionStub:
    def __init__(self) -> None:
        self.commit_calls = 0

    async def commit(self) -> None:
        self.commit_calls += 1


class _PaymentsRepoStub:
    def __init__(self) -> None:
        self.package = {
            "id": 1,
            "code": "START_50",
            "name": "Start 50",
            "credits": 50,
            "price_uah": 249,
            "is_active": True,
        }
        self.order = {
            "id": 11,
            "user_id": 7,
            "package_id": 1,
            "provider": "wayforpay",
            "provider_order_id": "wfp_existing",
            "amount_uah": 249,
            "status": "pending",
        }

    async def get_order_by_idempotency_key(
        self,
        *,
        session: Any,
        idempotency_key: str,
    ) -> dict[str, Any] | None:
        del session, idempotency_key
        return None

    async def get_package_by_code(self, *, session: Any, code: str) -> dict[str, Any] | None:
        del session
        if code == self.package["code"]:
            return self.package
        return None

    async def create_order(
        self,
        *,
        session: Any,
        user_id: int,
        package_id: int,
        provider: str,
        provider_order_id: str,
        amount_uah: int,
        idempotency_key: str,
    ) -> tuple[dict[str, Any], bool]:
        del session, user_id, package_id, provider, provider_order_id, amount_uah, idempotency_key
        # Simulates race: another request inserted the same idempotency key first.
        return self.order, False

    async def get_package_by_id(self, *, session: Any, package_id: int) -> dict[str, Any] | None:
        del session
        if package_id == self.package["id"]:
            return self.package
        return None


class _WebhookRepoStub:
    def __init__(self) -> None:
        self.order = {
            "id": 17,
            "user_id": 7,
            "package_id": 1,
            "status": "pending",
            "amount_uah": 249,
            "provider_order_id": "wfp_order_1",
        }
        self.package = {"id": 1, "credits": 50, "name": "Start 50"}

    async def get_order_by_provider_order_id_for_update(
        self,
        *,
        session: Any,
        provider_order_id: str,
        provider: str | None = None,
    ) -> dict[str, Any] | None:
        del session, provider
        if provider_order_id == self.order["provider_order_id"]:
            return dict(self.order)
        return None

    async def update_order_status(
        self,
        *,
        session: Any,
        order_id: int,
        status: str,
        provider_payload: dict[str, Any],
        paid_at: Any = None,
    ) -> None:
        del session, order_id, provider_payload, paid_at
        self.order["status"] = status

    async def get_package_by_id(self, *, session: Any, package_id: int) -> dict[str, Any] | None:
        del session
        if package_id == self.package["id"]:
            return self.package
        return None


class _BillingStub:
    def __init__(self) -> None:
        self.purchase_calls = 0

    async def apply_purchase(self, **kwargs: Any) -> ChargeResult:
        del kwargs
        self.purchase_calls += 1
        return ChargeResult(charged=True, balance_after=100)


@pytest.mark.asyncio
async def test_create_order_returns_existing_without_500_on_idempotency_race(monkeypatch: pytest.MonkeyPatch) -> None:
    repo = _PaymentsRepoStub()
    service = PaymentsService(repository=repo, credit_billing_service=SimpleNamespace())
    provider = _ProviderStub()
    monkeypatch.setattr(PaymentsService, "_build_provider", staticmethod(lambda: provider))
    session = _SessionStub()

    payload = CreatePaymentOrderRequest(
        package_code="START_50",
        idempotency_key="idem-key-12345",
    )
    response = await service.create_order(
        session=session,
        user_id=7,
        payload=payload,
        service_url="https://example.com/payments/webhook/wayforpay",
        return_url="https://example.com/payments/return",
    )

    assert response["order_id"] == 11
    assert response["provider_order_id"] == "wfp_existing"
    assert response["amount_uah"] == 249
    assert session.commit_calls == 0


@pytest.mark.asyncio
async def test_duplicate_webhook_does_not_apply_purchase_twice(monkeypatch: pytest.MonkeyPatch) -> None:
    repo = _WebhookRepoStub()
    billing = _BillingStub()
    service = PaymentsService(repository=repo, credit_billing_service=billing)
    provider = _ProviderStub()
    monkeypatch.setattr(PaymentsService, "_build_provider", staticmethod(lambda: provider))
    monkeypatch.setattr(
        service,
        "_check_status",
        AsyncMock(
            return_value={
                "merchantAccount": "merchant_test",
                "orderReference": "wfp_order_1",
                "amount": "249.00",
                "currency": "UAH",
                "authCode": "123456",
                "cardPan": "41****1111",
                "transactionStatus": "Approved",
                "reasonCode": "1100",
                "merchantSignature": "sig",
            }
        ),
    )
    session = _SessionStub()
    payload = {
        "merchantAccount": "merchant_test",
        "orderReference": "wfp_order_1",
        "amount": "249.00",
        "currency": "UAH",
        "authCode": "123456",
        "cardPan": "41****1111",
        "transactionStatus": "Approved",
        "reasonCode": "1100",
        "merchantSignature": "sig",
    }

    first = await service.process_wayforpay_webhook(session=session, payload=payload)
    second = await service.process_wayforpay_webhook(session=session, payload=payload)

    assert first["status"] == "accept"
    assert second["status"] == "accept"
    assert billing.purchase_calls == 1
    assert session.commit_calls == 1


@pytest.mark.asyncio
async def test_charge_for_feature_returns_existing_when_idempotent_tx_appears_after_lock(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = CreditBillingService()
    monkeypatch.setattr(
        service,
        "_get_existing_balance_after",
        AsyncMock(side_effect=[None, 96]),
    )
    monkeypatch.setattr(
        service,
        "_lock_user_credits",
        AsyncMock(return_value=10),
    )
    result = await service.charge_for_feature(
        session=SimpleNamespace(),
        user_id=7,
        feature_code="resume_summary",
        amount=4,
        idempotency_key="resume_summary:7:11:version",
    )

    assert result == ChargeResult(charged=False, balance_after=96)
