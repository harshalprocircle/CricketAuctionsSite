from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import csv
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------- Models ----------
def _now_iso():
    return datetime.now(timezone.utc).isoformat()


class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    starting_budget: int = 10000
    tournament_name: str = "Champions Auction 2026"


class Owner(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    team_name: str
    photo_url: Optional[str] = ""
    created_at: str = Field(default_factory=_now_iso)


class OwnerCreate(BaseModel):
    name: str
    team_name: str
    photo_url: Optional[str] = ""


class OwnerUpdate(BaseModel):
    name: Optional[str] = None
    team_name: Optional[str] = None
    photo_url: Optional[str] = None


class Player(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    role: str = "All-Rounder"  # Batsman / Bowler / All-Rounder / Wicket-Keeper
    base_price: int = 100
    photo_url: Optional[str] = ""
    status: str = "unsold"  # unsold | current | sold
    sold_price: Optional[int] = None
    owner_id: Optional[str] = None
    created_at: str = Field(default_factory=_now_iso)


class PlayerCreate(BaseModel):
    name: str
    role: str = "All-Rounder"
    base_price: int = 100
    photo_url: Optional[str] = ""


class PlayerUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    base_price: Optional[int] = None
    photo_url: Optional[str] = None


class SellPayload(BaseModel):
    owner_id: str
    sold_price: int


class Transaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    player_id: str
    player_name: str
    player_photo_url: Optional[str] = ""
    owner_id: str
    owner_name: str
    team_name: str
    amount: int
    created_at: str = Field(default_factory=_now_iso)


# ---------- Helpers ----------
async def _get_settings_doc():
    doc = await db.settings.find_one({"_id": "singleton"}, {"_id": 0})
    if not doc:
        defaults = Settings().model_dump()
        await db.settings.insert_one({"_id": "singleton", **defaults})
        return defaults
    return doc


async def _owner_with_budget(owner_doc):
    settings = await _get_settings_doc()
    spent_cur = db.transactions.aggregate([
        {"$match": {"owner_id": owner_doc["id"]}},
        {"$group": {"_id": "$owner_id", "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ])
    spent = 0
    count = 0
    async for row in spent_cur:
        spent = row["total"]
        count = row["count"]
    starting = settings["starting_budget"]
    return {
        **owner_doc,
        "starting_budget": starting,
        "spent": spent,
        "remaining": starting - spent,
        "players_count": count,
    }


# ---------- Settings ----------
@api_router.get("/settings")
async def get_settings():
    return await _get_settings_doc()


@api_router.put("/settings")
async def update_settings(payload: Settings):
    data = payload.model_dump()
    await db.settings.update_one({"_id": "singleton"}, {"$set": data}, upsert=True)
    return data


# ---------- Owners ----------
@api_router.get("/owners")
async def list_owners():
    docs = await db.owners.find({}, {"_id": 0}).to_list(1000)
    return [await _owner_with_budget(d) for d in docs]


async def _owner_name_exists(name: str, exclude_id: Optional[str] = None) -> bool:
    q = {"name": {"$regex": f"^{name.strip()}$", "$options": "i"}}
    if exclude_id:
        q["id"] = {"$ne": exclude_id}
    return await db.owners.find_one(q, {"_id": 1}) is not None


async def _team_name_exists(team_name: str, exclude_id: Optional[str] = None) -> bool:
    q = {"team_name": {"$regex": f"^{team_name.strip()}$", "$options": "i"}}
    if exclude_id:
        q["id"] = {"$ne": exclude_id}
    return await db.owners.find_one(q, {"_id": 1}) is not None


async def _player_name_exists(name: str, exclude_id: Optional[str] = None) -> bool:
    q = {"name": {"$regex": f"^{name.strip()}$", "$options": "i"}}
    if exclude_id:
        q["id"] = {"$ne": exclude_id}
    return await db.players.find_one(q, {"_id": 1}) is not None


@api_router.post("/owners")
async def create_owner(payload: OwnerCreate):
    if await _owner_name_exists(payload.name):
        raise HTTPException(400, f"An owner named '{payload.name}' already exists")
    if await _team_name_exists(payload.team_name):
        raise HTTPException(400, f"Team '{payload.team_name}' already exists")
    owner = Owner(**payload.model_dump())
    await db.owners.insert_one(owner.model_dump())
    return await _owner_with_budget(owner.model_dump())


@api_router.put("/owners/{owner_id}")
async def update_owner(owner_id: str, payload: OwnerUpdate):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(400, "No fields to update")
    if "name" in update and await _owner_name_exists(update["name"], exclude_id=owner_id):
        raise HTTPException(400, f"An owner named '{update['name']}' already exists")
    if "team_name" in update and await _team_name_exists(update["team_name"], exclude_id=owner_id):
        raise HTTPException(400, f"Team '{update['team_name']}' already exists")
    res = await db.owners.update_one({"id": owner_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Owner not found")
    # also update name/team_name in transactions for consistency
    tx_update = {k: update[k] for k in ("name", "team_name") if k in update}
    if tx_update:
        rename = {}
        if "name" in tx_update:
            rename["owner_name"] = tx_update["name"]
        if "team_name" in tx_update:
            rename["team_name"] = tx_update["team_name"]
        await db.transactions.update_many({"owner_id": owner_id}, {"$set": rename})
    doc = await db.owners.find_one({"id": owner_id}, {"_id": 0})
    return await _owner_with_budget(doc)


@api_router.delete("/owners/{owner_id}")
async def delete_owner(owner_id: str):
    # release any players bought by this owner; refund by removing transactions
    await db.players.update_many({"owner_id": owner_id}, {"$set": {"status": "unsold", "sold_price": None, "owner_id": None}})
    await db.transactions.delete_many({"owner_id": owner_id})
    await db.owners.delete_one({"id": owner_id})
    return {"ok": True}


# ---------- Players ----------
@api_router.get("/players")
async def list_players():
    return await db.players.find({}, {"_id": 0}).to_list(2000)


@api_router.post("/players")
async def create_player(payload: PlayerCreate):
    if await _player_name_exists(payload.name):
        raise HTTPException(400, f"A player named '{payload.name}' already exists")
    player = Player(**payload.model_dump())
    await db.players.insert_one(player.model_dump())
    return player.model_dump()


@api_router.put("/players/{player_id}")
async def update_player(player_id: str, payload: PlayerUpdate):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(400, "No fields to update")
    if "name" in update and await _player_name_exists(update["name"], exclude_id=player_id):
        raise HTTPException(400, f"A player named '{update['name']}' already exists")
    res = await db.players.update_one({"id": player_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Player not found")
    # mirror name change in transactions
    if "name" in update:
        await db.transactions.update_many({"player_id": player_id}, {"$set": {"player_name": update["name"]}})
    if "photo_url" in update:
        await db.transactions.update_many({"player_id": player_id}, {"$set": {"player_photo_url": update["photo_url"]}})
    return await db.players.find_one({"id": player_id}, {"_id": 0})


@api_router.delete("/players/{player_id}")
async def delete_player(player_id: str):
    await db.transactions.delete_many({"player_id": player_id})
    await db.players.delete_one({"id": player_id})
    return {"ok": True}


@api_router.post("/players/{player_id}/set-current")
async def set_current_player(player_id: str):
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player:
        raise HTTPException(404, "Player not found")
    if player["status"] == "sold":
        raise HTTPException(400, "Player already sold")
    # demote any other 'current' back to 'unsold'
    await db.players.update_many({"status": "current"}, {"$set": {"status": "unsold"}})
    await db.players.update_one({"id": player_id}, {"$set": {"status": "current"}})
    return await db.players.find_one({"id": player_id}, {"_id": 0})


@api_router.post("/players/{player_id}/mark-unsold")
async def mark_unsold(player_id: str):
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player:
        raise HTTPException(404, "Player not found")
    if player["status"] == "sold":
        raise HTTPException(400, "Player already sold; use rollback instead")
    await db.players.update_one({"id": player_id}, {"$set": {"status": "unsold"}})
    return await db.players.find_one({"id": player_id}, {"_id": 0})


@api_router.post("/players/{player_id}/sell")
async def sell_player(player_id: str, payload: SellPayload):
    player = await db.players.find_one({"id": player_id}, {"_id": 0})
    if not player:
        raise HTTPException(404, "Player not found")
    if player["status"] == "sold":
        raise HTTPException(400, "Player already sold")
    owner_doc = await db.owners.find_one({"id": payload.owner_id}, {"_id": 0})
    if not owner_doc:
        raise HTTPException(404, "Owner not found")
    if payload.sold_price <= 0:
        raise HTTPException(400, "Sold price must be positive")
    if payload.sold_price < player["base_price"]:
        raise HTTPException(400, f"Bid must be at least base price ({player['base_price']})")
    owner_view = await _owner_with_budget(owner_doc)
    if payload.sold_price > owner_view["remaining"]:
        raise HTTPException(400, f"Owner does not have enough points. Remaining: {owner_view['remaining']}")

    # create transaction
    tx = Transaction(
        player_id=player_id,
        player_name=player["name"],
        player_photo_url=player.get("photo_url", ""),
        owner_id=payload.owner_id,
        owner_name=owner_doc["name"],
        team_name=owner_doc["team_name"],
        amount=payload.sold_price,
    )
    await db.transactions.insert_one(tx.model_dump())
    await db.players.update_one(
        {"id": player_id},
        {"$set": {"status": "sold", "sold_price": payload.sold_price, "owner_id": payload.owner_id}}
    )
    return {
        "player": await db.players.find_one({"id": player_id}, {"_id": 0}),
        "transaction": tx.model_dump(),
        "owner": await _owner_with_budget(await db.owners.find_one({"id": payload.owner_id}, {"_id": 0})),
    }


@api_router.post("/transactions/{tx_id}/rollback")
async def rollback_transaction(tx_id: str):
    tx = await db.transactions.find_one({"id": tx_id}, {"_id": 0})
    if not tx:
        raise HTTPException(404, "Transaction not found")
    await db.players.update_one(
        {"id": tx["player_id"]},
        {"$set": {"status": "unsold", "sold_price": None, "owner_id": None}}
    )
    await db.transactions.delete_one({"id": tx_id})
    return {"ok": True}


# ---------- Transactions ----------
@api_router.get("/transactions")
async def list_transactions():
    docs = await db.transactions.find({}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    return docs


# ---------- Bulk import ----------
def _norm_key(k: str) -> str:
    """Normalize a CSV header to a comparable token (lowercase, alphanumeric only)."""
    return "".join(ch for ch in (k or "").lower() if ch.isalnum())


def _row_get(row: dict, aliases: list) -> str:
    """Pick the first column whose normalized header matches any alias."""
    norm_map = { _norm_key(k): v for k, v in row.items() if k is not None }
    for a in aliases:
        v = norm_map.get(_norm_key(a))
        if v is not None and str(v).strip():
            return str(v).strip()
    return ""


@api_router.post("/owners/bulk-import")
async def bulk_import_owners(file: UploadFile = File(...)):
    content = (await file.read()).decode("utf-8-sig", errors="ignore")
    reader = csv.DictReader(io.StringIO(content))
    created = 0
    skipped = 0
    for row in reader:
        name = _row_get(row, ["name", "owner name", "owner"])
        team = _row_get(row, ["team_name", "team name", "team", "franchise"])
        photo = _row_get(row, ["photo_url", "photo", "image", "logo", "team logo", "photo google drive link", "photo google drive", "drive link", "logo url"])
        if not name or not team:
            skipped += 1
            continue
        if await _owner_name_exists(name) or await _team_name_exists(team):
            skipped += 1
            continue
        owner = Owner(name=name, team_name=team, photo_url=photo)
        await db.owners.insert_one(owner.model_dump())
        created += 1
    return {"created": created, "skipped": skipped}


@api_router.post("/players/bulk-import")
async def bulk_import_players(file: UploadFile = File(...)):
    content = (await file.read()).decode("utf-8-sig", errors="ignore")
    reader = csv.DictReader(io.StringIO(content))
    created = 0
    skipped = 0
    for row in reader:
        name = _row_get(row, ["name", "player name", "player"])
        role_raw = _row_get(row, ["role", "position", "type"]) or "All-Rounder"
        # normalize common role variants
        rn = role_raw.lower().replace("-", " ").replace("_", " ").strip()
        if "all" in rn and "round" in rn:
            role = "All-Rounder"
        elif "wicket" in rn or "keeper" in rn or rn == "wk":
            role = "Wicket-Keeper"
        elif "bowl" in rn:
            role = "Bowler"
        elif "bat" in rn:
            role = "Batsman"
        else:
            role = role_raw or "All-Rounder"
        base_str = _row_get(row, ["base_price", "base price", "price", "baseprice"]) or "100"
        try:
            base = int(float(base_str))
        except ValueError:
            base = 100
        photo = _row_get(row, ["photo_url", "photo", "image", "picture", "drive link", "photo google drive link", "photo google drive", "google drive link"])
        if not name:
            skipped += 1
            continue
        if await _player_name_exists(name):
            skipped += 1
            continue
        player = Player(name=name, role=role, base_price=base, photo_url=photo)
        await db.players.insert_one(player.model_dump())
        created += 1
    return {"created": created, "skipped": skipped}


@api_router.delete("/owners")
async def delete_all_owners():
    # release any sold players & clear all transactions
    await db.players.update_many(
        {"owner_id": {"$ne": None}},
        {"$set": {"status": "unsold", "sold_price": None, "owner_id": None}},
    )
    await db.transactions.delete_many({})
    res = await db.owners.delete_many({})
    return {"deleted": res.deleted_count}


@api_router.delete("/players")
async def delete_all_players():
    await db.transactions.delete_many({})
    res = await db.players.delete_many({})
    return {"deleted": res.deleted_count}


# ---------- Reset ----------
@api_router.post("/auction/reset")
async def reset_auction():
    await db.players.update_many({}, {"$set": {"status": "unsold", "sold_price": None, "owner_id": None}})
    await db.transactions.delete_many({})
    return {"ok": True}


# ---------- Stats ----------
@api_router.get("/stats")
async def stats():
    total_players = await db.players.count_documents({})
    sold = await db.players.count_documents({"status": "sold"})
    current = await db.players.count_documents({"status": "current"})
    unsold = await db.players.count_documents({"status": "unsold"})
    owners = await db.owners.count_documents({})
    tx_count = await db.transactions.count_documents({})
    return {
        "total_players": total_players,
        "sold": sold,
        "current": current,
        "unsold": unsold,
        "owners": owners,
        "transactions": tx_count,
    }


@api_router.get("/")
async def root():
    return {"message": "Auction API ready"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
