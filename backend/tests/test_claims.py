def test_create_and_get_claim(client, admin_token):
    claim_payload = {
        "claim_id": "FRA-TEST-001",
        "claim_type": "IFR",
        "applicant_name": "Ramu Majhi",
        "father_or_husband_name": "Sunder Majhi",
        "age": 42,
        "gender": "Male",
        "village": "Gopabandhunagar",
        "block": "Badasahi",
        "district": "Mayurbhanj",
        "state": "Odisha",
        "survey_number": "SY-401/3",
        "area_claimed": 2.20,
        "area_unit": "hectares",
        "land_use": "Agriculture & Minor Forest Produce",
        "application_date": "2024-03-15"
    }

    # Create claim
    create_resp = client.post(
        "/api/claims",
        json=claim_payload,
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert create_resp.status_code == 201
    claim_data = create_resp.json()
    assert claim_data["claim_id"] == "FRA-TEST-001"
    assert claim_data["status"] == "UPLOADED"

    # Get claim by ID
    get_resp = client.get(
        f"/api/claims/{claim_data['id']}",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert get_resp.status_code == 200
    assert get_resp.json()["applicant_name"] == "Ramu Majhi"

def test_update_claim_status(client, admin_token):
    # Fetch claim
    claims = client.get("/api/claims", headers={"Authorization": f"Bearer {admin_token}"}).json()
    assert len(claims) > 0
    target_claim = claims[0]

    status_resp = client.patch(
        f"/api/claims/{target_claim['id']}/status?new_status=APPROVED",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert status_resp.status_code == 200
    assert status_resp.json()["status"] == "APPROVED"
    assert status_resp.json()["verification_status"] == "VERIFIED"
