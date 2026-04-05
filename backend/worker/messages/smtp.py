import os
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage


class SMTPTemporaryError(Exception):
    pass


class SMTPPermanentError(Exception):
    pass


@dataclass(slots=True)
class SMTPSettings:
    host: str
    port: int
    user: str | None
    password: str | None
    from_email: str
    use_tls: bool


def _parse_bool(value: str | None, *, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def load_smtp_settings() -> SMTPSettings:
    host = (os.getenv("SMTP_HOST") or "").strip()
    from_email = (os.getenv("SMTP_FROM_EMAIL") or "").strip()
    if not host:
        raise SMTPPermanentError("SMTP_HOST is not configured")
    if not from_email:
        raise SMTPPermanentError("SMTP_FROM_EMAIL is not configured")

    port = int(os.getenv("SMTP_PORT", "587"))
    user = (os.getenv("SMTP_USER") or "").strip() or None
    password = os.getenv("SMTP_PASSWORD")
    use_tls = _parse_bool(os.getenv("SMTP_USE_TLS"), default=True)
    return SMTPSettings(
        host=host,
        port=port,
        user=user,
        password=password,
        from_email=from_email,
        use_tls=use_tls,
    )


def _to_smtp_error(exc: Exception) -> Exception:
    if isinstance(exc, smtplib.SMTPResponseException):
        if 400 <= exc.smtp_code < 500:
            return SMTPTemporaryError(f"Temporary SMTP error {exc.smtp_code}: {exc.smtp_error!r}")
        return SMTPPermanentError(f"SMTP error {exc.smtp_code}: {exc.smtp_error!r}")
    if isinstance(
        exc,
        (
            smtplib.SMTPServerDisconnected,
            smtplib.SMTPConnectError,
            TimeoutError,
            OSError,
        ),
    ):
        return SMTPTemporaryError(str(exc))
    if isinstance(exc, smtplib.SMTPException):
        return SMTPPermanentError(str(exc))
    return SMTPPermanentError(str(exc))


def send_smtp_email(
    *,
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str,
) -> None:
    settings = load_smtp_settings()
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.from_email
    message["To"] = to_email
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")

    try:
        with smtplib.SMTP(settings.host, settings.port, timeout=30) as server:
            server.ehlo()
            if settings.use_tls:
                server.starttls()
                server.ehlo()
            if settings.user:
                server.login(settings.user, settings.password or "")
            server.send_message(message)
    except Exception as exc:
        raise _to_smtp_error(exc) from exc
