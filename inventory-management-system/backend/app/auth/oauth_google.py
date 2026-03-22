"""Google OAuth 2.0 authorization-code helpers (Sign in with Google)."""

from urllib.parse import urlencode

import httpx

GOOGLE_AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO = "https://www.googleapis.com/oauth2/v3/userinfo"


def build_authorize_url(*, client_id: str, redirect_uri: str, state: str) -> str:
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
    }
    return f"{GOOGLE_AUTHORIZE}?{urlencode(params)}"


async def exchange_code_for_tokens(
    *, client_id: str, client_secret: str, redirect_uri: str, code: str
) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            GOOGLE_TOKEN,
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        response.raise_for_status()
        return response.json()


async def fetch_userinfo(*, access_token: str) -> dict:
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            GOOGLE_USERINFO,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        response.raise_for_status()
        return response.json()
