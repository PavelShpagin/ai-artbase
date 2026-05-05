"""
Credits + Lemon Squeezy integration.

Tables (created via SQLAlchemy `Base.metadata.create_all` on startup):
  user_credits(user_id, balance, updated_at)
  credit_ledger(id, user_id, delta, reason, external_ref, created_at)

Endpoints:
  GET  /credits/balance/{user_id}          -> {balance, free_remaining_today}
  POST /credits/admin/grant                -> dev/admin only, grant credits
  POST /webhooks/lemon-squeezy             -> Lemon Squeezy purchase webhook

Pricing (variant_id -> credits) is read from env LS_VARIANT_CREDITS as JSON, e.g.
  LS_VARIANT_CREDITS='{"123456":100,"123457":350,"123458":1000}'
"""
import os, json, hmac, hashlib, logging
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session
from sqlalchemy import func
from .. import models
from ..utils import get_db

router = APIRouter()
logger = logging.getLogger(__name__)

# Free generations per day (reset midnight UTC)
FREE_GENERATIONS_PER_DAY = int(os.getenv("FREE_GENERATIONS_PER_DAY", "5"))
LS_WEBHOOK_SECRET = os.getenv("LS_WEBHOOK_SECRET", "")
try:
    LS_VARIANT_CREDITS = json.loads(os.getenv("LS_VARIANT_CREDITS", "{}"))
except Exception:
    LS_VARIANT_CREDITS = {}


def _free_used_today(db: Session, user_id: int) -> int:
    """How many generations the user has done today (used for free-tier limit)."""
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    return db.query(func.count(models.Art.id)).filter(
        models.Art.owner_id == user_id,
        models.Art.is_generated == True,
        models.Art.date >= today,
    ).scalar() or 0


def _get_or_create_credits(db: Session, user_id: int) -> models.UserCredits:
    row = db.query(models.UserCredits).filter(models.UserCredits.user_id == user_id).first()
    if row is None:
        row = models.UserCredits(user_id=user_id, balance=0)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def can_generate(db: Session, user_id: int) -> dict:
    """Returns {allowed, source, free_remaining, balance}."""
    row = _get_or_create_credits(db, user_id)
    free_used = _free_used_today(db, user_id)
    free_remaining = max(0, FREE_GENERATIONS_PER_DAY - free_used)
    if free_remaining > 0:
        return {"allowed": True, "source": "free", "free_remaining": free_remaining, "balance": row.balance}
    if row.balance > 0:
        return {"allowed": True, "source": "credits", "free_remaining": 0, "balance": row.balance}
    return {"allowed": False, "source": None, "free_remaining": 0, "balance": row.balance}


def consume_credit_if_paid(db: Session, user_id: int, source: str):
    """Decrement credit balance only if the source was 'credits'."""
    if source != "credits":
        return
    row = _get_or_create_credits(db, user_id)
    if row.balance <= 0:
        raise HTTPException(status_code=402, detail="No credits available")
    row.balance -= 1
    db.add(models.CreditLedger(user_id=user_id, delta=-1, reason="generation", external_ref=None))
    db.commit()


@router.get("/credits/balance/{user_id}")
def get_balance(user_id: int, db: Session = Depends(get_db)):
    row = _get_or_create_credits(db, user_id)
    free_used = _free_used_today(db, user_id)
    return {
        "user_id": user_id,
        "balance": row.balance,
        "free_per_day": FREE_GENERATIONS_PER_DAY,
        "free_used_today": free_used,
        "free_remaining_today": max(0, FREE_GENERATIONS_PER_DAY - free_used),
    }


def _grant_credits(db: Session, user_id: int, amount: int, reason: str, external_ref: Optional[str]):
    if external_ref:
        existing = db.query(models.CreditLedger).filter(models.CreditLedger.external_ref == external_ref).first()
        if existing:
            logger.info(f"Idempotent skip: external_ref={external_ref} already credited")
            return existing
    row = _get_or_create_credits(db, user_id)
    row.balance = (row.balance or 0) + amount
    entry = models.CreditLedger(user_id=user_id, delta=amount, reason=reason, external_ref=external_ref)
    db.add(entry)
    db.commit()
    return entry


@router.post("/credits/admin/grant")
def admin_grant(user_id: int, amount: int, reason: str = "admin", token: str = Header(None, alias="X-Admin-Token"), db: Session = Depends(get_db)):
    expected = os.getenv("ADMIN_TOKEN", "")
    if not expected or token != expected:
        raise HTTPException(status_code=403, detail="forbidden")
    entry = _grant_credits(db, user_id, amount, reason, external_ref=None)
    return {"ok": True, "ledger_id": entry.id}


@router.post("/webhooks/lemon-squeezy")
async def lemon_squeezy_webhook(request: Request, x_signature: str = Header(None), db: Session = Depends(get_db)):
    """
    Lemon Squeezy posts JSON. We verify HMAC-SHA256(LS_WEBHOOK_SECRET, raw_body) == X-Signature.
    On `order_created` (paid) we credit the buyer based on variant_id mapping.
    """
    raw = await request.body()
    if not LS_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="LS_WEBHOOK_SECRET not configured")
    digest = hmac.new(LS_WEBHOOK_SECRET.encode(), raw, hashlib.sha256).hexdigest()
    if not x_signature or not hmac.compare_digest(digest, x_signature):
        raise HTTPException(status_code=401, detail="bad signature")

    payload = json.loads(raw)
    event_name = (payload.get("meta") or {}).get("event_name")
    if event_name not in ("order_created", "subscription_payment_success"):
        return {"ok": True, "ignored": event_name}

    data = payload.get("data") or {}
    attrs = data.get("attributes") or {}
    if attrs.get("status") not in (None, "paid", "completed"):
        return {"ok": True, "ignored_status": attrs.get("status")}

    custom = (((payload.get("meta") or {}).get("custom_data")) or {}) | (attrs.get("custom_data") or {})
    user_id_raw = custom.get("user_id") or custom.get("aiartbase_user_id")
    if not user_id_raw:
        logger.warning(f"webhook missing user_id custom_data: {custom}")
        return {"ok": True, "ignored": "no user_id"}
    try:
        user_id = int(user_id_raw)
    except Exception:
        return {"ok": True, "ignored": "bad user_id"}

    # Determine variant_id from first order item, look up credits
    first_item = (attrs.get("first_order_item") or {})
    variant_id = str(first_item.get("variant_id") or attrs.get("variant_id") or "")
    credits = LS_VARIANT_CREDITS.get(variant_id, 0)
    if credits <= 0:
        logger.warning(f"webhook variant_id={variant_id} not in LS_VARIANT_CREDITS map; payload={attrs.get('first_order_item')}")
        return {"ok": True, "ignored": f"unknown variant {variant_id}"}

    external_ref = f"ls:{data.get('id') or attrs.get('order_id') or attrs.get('identifier')}"
    entry = _grant_credits(db, user_id, credits, reason="purchase", external_ref=external_ref)
    return {"ok": True, "credited": credits, "user_id": user_id, "ledger_id": entry.id}
