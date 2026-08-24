import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.core.database import Base, get_db
from app.core.security import get_password_hash, create_access_token
from app.models.user import User

# In-memory SQLite for isolated test execution
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///./test_fra_atlas.db"

engine = create_engine(SQLALCHEMY_TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    # Create test admin user
    admin = User(
        full_name="Test Administrator",
        email="test.admin@fra.gov.in",
        password_hash=get_password_hash("TestPass@123"),
        role="ADMIN",
        is_active=True
    )
    # Create test citizen user
    citizen = User(
        full_name="Test Citizen",
        email="test.citizen@fra.gov.in",
        password_hash=get_password_hash("TestPass@123"),
        role="CITIZEN",
        is_active=True
    )
    db.add(admin)
    db.add(citizen)
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def admin_token():
    return create_access_token(data={"sub": "test.admin@fra.gov.in", "role": "ADMIN", "id": 1})

@pytest.fixture
def citizen_token():
    return create_access_token(data={"sub": "test.citizen@fra.gov.in", "role": "CITIZEN", "id": 2})
