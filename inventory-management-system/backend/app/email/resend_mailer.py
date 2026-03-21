"""Send transactional email via Resend REST API."""

import httpx
import structlog

from app.config import get_settings

log = structlog.get_logger()


async def send_invitation_email(*, to_email: str, invite_url: str, app_name: str = "IMS") -> None:
    settings = get_settings()
    if not settings.resend_api_key:
        raise RuntimeError("RESEND_API_KEY is not set")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {settings.resend_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": settings.resend_from_email,
                "to": [to_email],
                "subject": f"Complete your {app_name} account",
                "html": (
                    f"<p>You've been invited to join <strong>{app_name}</strong>.</p>"
                    f'<p><a href="{invite_url}">Create your account</a></p>'
                    f"<p>If the link doesn't work, copy and paste this URL into your browser:</p>"
                    f'<p style="word-break:break-all;font-size:12px;color:#444">{invite_url}</p>'
                    f"<p>This invitation expires in a few days.</p>"
                ),
            },
        )
        if response.status_code >= 400:
            log.warning(
                "resend_invite_failed",
                status=response.status_code,
                body=response.text[:500],
            )
            response.raise_for_status()
