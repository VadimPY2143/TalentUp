from __future__ import annotations

import hashlib
import hmac
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any


WFP_CHECKOUT_URL = "https://secure.wayforpay.com/pay"
WFP_API_URL = "https://api.wayforpay.com/api"


def _to_decimal_amount(value: object) -> Decimal:
    try:
        amount = Decimal(str(value))
    except (TypeError, ValueError, InvalidOperation):
        raise ValueError("Invalid amount")
    return amount.quantize(Decimal("0.01"))


class WayForPayProvider:
    def __init__(
        self,
        *,
        merchant_account: str,
        secret_key: str,
        merchant_domain_name: str,
        api_version: int = 1,
        checkout_url: str = WFP_CHECKOUT_URL,
        api_url: str = WFP_API_URL,
    ):
        self.merchant_account = merchant_account
        self.secret_key = secret_key
        self.merchant_domain_name = merchant_domain_name
        self.api_version = int(api_version)
        self.checkout_url = checkout_url
        self.api_url = api_url

    def _sign(self, parts: list[str]) -> str:
        sign_string = ";".join(parts)
        digest = hmac.new(
            self.secret_key.encode("utf-8"),
            sign_string.encode("utf-8"),
            hashlib.md5,
        ).hexdigest()
        return digest

    def build_checkout_fields(
        self,
        *,
        order_reference: str,
        amount_uah: int | float | Decimal,
        service_url: str,
        return_url: str | None,
        product_name: str,
        order_date: int | None = None,
    ) -> dict[str, str | int]:
        order_date_value = int(order_date or datetime.now(timezone.utc).timestamp())
        amount_str = f"{_to_decimal_amount(amount_uah):.2f}"

        merchant_signature = self._sign(
            [
                self.merchant_account,
                self.merchant_domain_name,
                order_reference,
                str(order_date_value),
                amount_str,
                "UAH",
                product_name,
                "1",
                amount_str,
            ]
        )

        fields: dict[str, str | int] = {
            "merchantAccount": self.merchant_account,
            "merchantDomainName": self.merchant_domain_name,
            "merchantAuthType": "SimpleSignature",
            "merchantSignature": merchant_signature,
            "apiVersion": self.api_version,
            "orderReference": order_reference,
            "orderDate": order_date_value,
            "amount": amount_str,
            "currency": "UAH",
            "productName[]": product_name,
            "productCount[]": "1",
            "productPrice[]": amount_str,
            "serviceUrl": service_url,
            "language": "UA",
        }
        if return_url:
            fields["returnUrl"] = return_url
        return fields

    def verify_callback_signature(self, payload: dict[str, Any]) -> bool:
        signature = str(payload.get("merchantSignature") or "")
        parts = [
            str(payload.get("merchantAccount") or ""),
            str(payload.get("orderReference") or ""),
            str(payload.get("amount") or ""),
            str(payload.get("currency") or ""),
            str(payload.get("authCode") or ""),
            str(payload.get("cardPan") or ""),
            str(payload.get("transactionStatus") or ""),
            str(payload.get("reasonCode") or ""),
        ]
        expected = self._sign(parts)
        return hmac.compare_digest(expected, signature)

    def build_check_status_request(self, *, order_reference: str) -> dict[str, str | int]:
        signature = self._sign([self.merchant_account, order_reference])
        return {
            "transactionType": "CHECK_STATUS",
            "merchantAccount": self.merchant_account,
            "orderReference": order_reference,
            "merchantSignature": signature,
            "apiVersion": self.api_version,
        }

    def verify_check_status_signature(self, payload: dict[str, Any]) -> bool:
        signature = str(payload.get("merchantSignature") or "")
        parts = [
            str(payload.get("merchantAccount") or ""),
            str(payload.get("orderReference") or ""),
            str(payload.get("amount") or ""),
            str(payload.get("currency") or ""),
            str(payload.get("authCode") or ""),
            str(payload.get("cardPan") or ""),
            str(payload.get("transactionStatus") or ""),
            str(payload.get("reasonCode") or ""),
        ]
        expected = self._sign(parts)
        return hmac.compare_digest(expected, signature)

    def build_ack(self, *, order_reference: str, status: str = "accept") -> dict[str, Any]:
        ack_time = int(datetime.now(timezone.utc).timestamp())
        signature = self._sign([order_reference, status, str(ack_time)])
        return {
            "orderReference": order_reference,
            "status": status,
            "time": ack_time,
            "signature": signature,
        }

    def normalize_order_status(self, transaction_status: str) -> str:
        value = str(transaction_status or "").strip().lower()
        if value in {"approved"}:
            return "success"
        if value in {"expired"}:
            return "expired"
        if value in {
            "pending",
            "processing",
        }:
            return "pending"
        return "failed"

    def is_approved(self, transaction_status: str) -> bool:
        return str(transaction_status or "").strip().lower() == "approved"
