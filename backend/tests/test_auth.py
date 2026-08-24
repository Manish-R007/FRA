def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_login_success(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "test.admin@fra.gov.in", "password": "TestPass@123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["role"] == "ADMIN"

def test_login_invalid_password(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "test.admin@fra.gov.in", "password": "WrongPassword"}
    )
    assert response.status_code == 401

def test_get_current_user_profile(client, admin_token):
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert response.status_code == 200
    assert response.json()["email"] == "test.admin@fra.gov.in"
