from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


PaymentOrderStatus = Literal["pending", "success", "failed", "expired"]
CreditTransactionType = Literal["purchase", "debit", "refund", "manual_adjustment"]


class CreditPackageResponse(BaseModel):
    id: int
    code: str
    name: str
    credits: int
    price_uah: int
    is_active: bool


class CreatePaymentOrderRequest(BaseModel):
    package_code: str = Field(min_length=2, max_length=64)
    idempotency_key: str = Field(min_length=8, max_length=128)


class CreatePaymentOrderResponse(BaseModel):
    order_id: int
    provider: str
    provider_order_id: str
    status: PaymentOrderStatus
    amount_uah: int
    package_code: str
    package_credits: int
    checkout_url: str
    checkout_fields: dict[str, str | int]


class PaymentWebhookResponse(BaseModel):
    orderReference: str
    status: str
    time: int
    signature: str


class CreditsBalanceResponse(BaseModel):
    credits: int


class CreditTransactionResponse(BaseModel):
    id: int
    type: CreditTransactionType
    amount: int
    balance_after: int
    feature_code: str | None
    reference_type: str | None
    reference_id: str | None
    created_at: datetime
    meta: dict[str, Any] | None = None
