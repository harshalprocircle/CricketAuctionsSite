"""Backend tests for IPL-style Auction app"""
import os
import io
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://draft-exchange-pro.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module", autouse=True)
def reset_state():
    # Clean slate
    owners = requests.get(f"{API}/owners").json()
    for o in owners:
        requests.delete(f"{API}/owners/{o['id']}")
    players = requests.get(f"{API}/players").json()
    for p in players:
        requests.delete(f"{API}/players/{p['id']}")
    requests.post(f"{API}/auction/reset")
    yield


# Settings
def test_get_settings_default_budget():
    r = requests.get(f"{API}/settings")
    assert r.status_code == 200
    assert r.json()["starting_budget"] == 10000


def test_update_settings():
    r = requests.put(f"{API}/settings", json={"starting_budget": 8000, "tournament_name": "TEST_Cup"})
    assert r.status_code == 200
    assert r.json()["starting_budget"] == 8000
    g = requests.get(f"{API}/settings").json()
    assert g["starting_budget"] == 8000
    # restore
    requests.put(f"{API}/settings", json={"starting_budget": 10000, "tournament_name": "Champions Auction 2026"})


# Owners CRUD
def test_owner_crud_and_budget_fields():
    r = requests.post(f"{API}/owners", json={"name": "TEST_O1", "team_name": "TEST_T1", "photo_url": ""})
    assert r.status_code == 200
    o = r.json()
    assert o["starting_budget"] == 10000
    assert o["spent"] == 0
    assert o["remaining"] == 10000
    assert o["players_count"] == 0
    assert "_id" not in o
    oid = o["id"]

    # Update
    u = requests.put(f"{API}/owners/{oid}", json={"team_name": "TEST_T1B"})
    assert u.status_code == 200 and u.json()["team_name"] == "TEST_T1B"

    # List
    lst = requests.get(f"{API}/owners").json()
    assert any(x["id"] == oid for x in lst)
    assert all("_id" not in x for x in lst)

    # Delete
    d = requests.delete(f"{API}/owners/{oid}")
    assert d.status_code == 200


# Players CRUD + set-current
def test_player_crud_and_set_current():
    p1 = requests.post(f"{API}/players", json={"name": "TEST_P1", "role": "Batsman", "base_price": 500}).json()
    p2 = requests.post(f"{API}/players", json={"name": "TEST_P2", "role": "Bowler", "base_price": 300}).json()
    assert "_id" not in p1
    assert p1["status"] == "unsold"

    requests.post(f"{API}/players/{p1['id']}/set-current")
    p1r = next(x for x in requests.get(f"{API}/players").json() if x["id"] == p1["id"])
    assert p1r["status"] == "current"

    # Setting p2 should demote p1
    requests.post(f"{API}/players/{p2['id']}/set-current")
    pls = requests.get(f"{API}/players").json()
    p1r = next(x for x in pls if x["id"] == p1["id"])
    p2r = next(x for x in pls if x["id"] == p2["id"])
    assert p1r["status"] == "unsold"
    assert p2r["status"] == "current"

    requests.delete(f"{API}/players/{p1['id']}")
    requests.delete(f"{API}/players/{p2['id']}")


# Sell + validations
def test_sell_flow_and_validations():
    o = requests.post(f"{API}/owners", json={"name": "TEST_OS", "team_name": "TEST_TS"}).json()
    p = requests.post(f"{API}/players", json={"name": "TEST_PS", "base_price": 500}).json()

    # below base price
    r = requests.post(f"{API}/players/{p['id']}/sell", json={"owner_id": o["id"], "sold_price": 100})
    assert r.status_code == 400

    # over budget
    r = requests.post(f"{API}/players/{p['id']}/sell", json={"owner_id": o["id"], "sold_price": 99999})
    assert r.status_code == 400

    # successful sell
    r = requests.post(f"{API}/players/{p['id']}/sell", json={"owner_id": o["id"], "sold_price": 1500})
    assert r.status_code == 200
    res = r.json()
    assert res["player"]["status"] == "sold"
    assert res["player"]["sold_price"] == 1500
    assert res["owner"]["remaining"] == 10000 - 1500
    assert res["owner"]["spent"] == 1500
    assert res["owner"]["players_count"] == 1
    tx_id = res["transaction"]["id"]

    # double sell
    r = requests.post(f"{API}/players/{p['id']}/sell", json={"owner_id": o["id"], "sold_price": 1500})
    assert r.status_code == 400

    # transactions sorted
    txs = requests.get(f"{API}/transactions").json()
    assert any(t["id"] == tx_id for t in txs)
    assert all("_id" not in t for t in txs)

    # rollback
    rb = requests.post(f"{API}/transactions/{tx_id}/rollback")
    assert rb.status_code == 200
    pl = next(x for x in requests.get(f"{API}/players").json() if x["id"] == p["id"])
    assert pl["status"] == "unsold" and pl["sold_price"] is None
    ow = next(x for x in requests.get(f"{API}/owners").json() if x["id"] == o["id"])
    assert ow["remaining"] == 10000

    requests.delete(f"{API}/players/{p['id']}")
    requests.delete(f"{API}/owners/{o['id']}")


def test_auction_reset():
    o = requests.post(f"{API}/owners", json={"name": "TEST_OR", "team_name": "TEST_TR"}).json()
    p = requests.post(f"{API}/players", json={"name": "TEST_PR", "base_price": 100}).json()
    requests.post(f"{API}/players/{p['id']}/sell", json={"owner_id": o["id"], "sold_price": 200})
    r = requests.post(f"{API}/auction/reset")
    assert r.status_code == 200
    pl = next(x for x in requests.get(f"{API}/players").json() if x["id"] == p["id"])
    assert pl["status"] == "unsold"
    txs = requests.get(f"{API}/transactions").json()
    assert all(t["player_id"] != p["id"] for t in txs)
    ow = next(x for x in requests.get(f"{API}/owners").json() if x["id"] == o["id"])
    assert ow["remaining"] == 10000
    requests.delete(f"{API}/players/{p['id']}")
    requests.delete(f"{API}/owners/{o['id']}")


def test_bulk_import():
    csv_owners = "name,team_name,photo_url\nTEST_BO1,TEST_BT1,\nTEST_BO2,TEST_BT2,\n"
    r = requests.post(f"{API}/owners/bulk-import", files={"file": ("o.csv", io.BytesIO(csv_owners.encode()), "text/csv")})
    assert r.status_code == 200 and r.json()["created"] == 2

    csv_players = "name,role,base_price,photo_url\nTEST_BP1,Batsman,500,\nTEST_BP2,Bowler,300,\n"
    r = requests.post(f"{API}/players/bulk-import", files={"file": ("p.csv", io.BytesIO(csv_players.encode()), "text/csv")})
    assert r.status_code == 200 and r.json()["created"] == 2


def test_stats():
    r = requests.get(f"{API}/stats")
    assert r.status_code == 200
    s = r.json()
    for k in ("total_players", "sold", "current", "unsold", "owners", "transactions"):
        assert k in s
