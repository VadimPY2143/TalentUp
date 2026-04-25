import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from payments.provider_wayforpay import WayForPayProvider


def _provider() -> WayForPayProvider:
    return WayForPayProvider(
        merchant_account="merchant_test",
        secret_key="secret_test_key",
        merchant_domain_name="example.com",
    )


def test_checkout_fields_contains_signature() -> None:
    provider = _provider()
    fields = provider.build_checkout_fields(
        order_reference="wfp_order_1",
        amount_uah=249,
        service_url="https://example.com/payments/webhook/wayforpay",
        return_url="https://example.com/thanks",
        product_name="Credits package Start 50",
        order_date=1700000000,
    )
    assert fields["merchantAccount"] == "merchant_test"
    assert fields["orderReference"] == "wfp_order_1"
    assert fields["currency"] == "UAH"
    assert isinstance(fields["merchantSignature"], str)
    assert len(str(fields["merchantSignature"])) == 32


def test_callback_signature_verification_roundtrip() -> None:
    provider = _provider()
    payload = {
        "merchantAccount": "merchant_test",
        "orderReference": "wfp_order_1",
        "amount": "249.00",
        "currency": "UAH",
        "authCode": "123456",
        "cardPan": "41****1234",
        "transactionStatus": "Approved",
        "reasonCode": "1100",
    }
    payload["merchantSignature"] = provider._sign(  # noqa: SLF001 - acceptable in focused unit test
        [
            payload["merchantAccount"],
            payload["orderReference"],
            payload["amount"],
            payload["currency"],
            payload["authCode"],
            payload["cardPan"],
            payload["transactionStatus"],
            payload["reasonCode"],
        ]
    )
    assert provider.verify_callback_signature(payload) is True


def test_ack_signature_verification() -> None:
    provider = _provider()
    ack = provider.build_ack(order_reference="wfp_order_1")
    expected = provider._sign(  # noqa: SLF001 - acceptable in focused unit test
        [ack["orderReference"], ack["status"], str(ack["time"])]
    )
    assert ack["signature"] == expected
