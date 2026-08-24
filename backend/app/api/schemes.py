import json
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.user import User
from app.models.scheme import Scheme
from app.schemas.scheme import SchemeCreate, SchemeUpdate, SchemeResponse
from app.services.audit_service import record_audit

router = APIRouter(prefix="/schemes", tags=["Government Schemes"])

@router.get("", response_model=List[SchemeResponse])
def get_all_schemes(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    schemes = db.query(Scheme).all()
    results = []
    for s in schemes:
        try:
            elig_rules = json.loads(s.eligibility_rules) if isinstance(s.eligibility_rules, str) else s.eligibility_rules
        except Exception:
            elig_rules = {}
        try:
            docs_req = json.loads(s.documents_required) if isinstance(s.documents_required, str) else s.documents_required
        except Exception:
            docs_req = []

        results.append(SchemeResponse(
            id=s.id,
            name=s.name,
            code=s.code,
            department=s.department,
            description=s.description,
            eligibility_rules=elig_rules,
            benefits=s.benefits,
            documents_required=docs_req,
            active=s.active,
            created_at=s.created_at
        ))
    return results

@router.get("/{scheme_id}", response_model=SchemeResponse)
def get_scheme(scheme_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    s = db.query(Scheme).filter(Scheme.id == scheme_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Scheme not found")

    try: elig_rules = json.loads(s.eligibility_rules)
    except Exception: elig_rules = {}
    try: docs_req = json.loads(s.documents_required)
    except Exception: docs_req = []

    return SchemeResponse(
        id=s.id,
        name=s.name,
        code=s.code,
        department=s.department,
        description=s.description,
        eligibility_rules=elig_rules,
        benefits=s.benefits,
        documents_required=docs_req,
        active=s.active,
        created_at=s.created_at
    )

@router.post("", response_model=SchemeResponse, status_code=status.HTTP_201_CREATED)
def create_scheme(
    scheme_in: SchemeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN"]))
):
    existing = db.query(Scheme).filter((Scheme.name == scheme_in.name) | (Scheme.code == scheme_in.code)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Scheme with this name or code already exists")

    scheme = Scheme(
        name=scheme_in.name,
        code=scheme_in.code,
        department=scheme_in.department,
        description=scheme_in.description,
        eligibility_rules=json.dumps(scheme_in.eligibility_rules),
        benefits=scheme_in.benefits,
        documents_required=json.dumps(scheme_in.documents_required),
        active=scheme_in.active
    )
    db.add(scheme)
    db.commit()
    db.refresh(scheme)

    record_audit(db, action="CREATE_SCHEME", entity="Scheme", entity_id=str(scheme.id), user_id=current_user.id, new_value={"code": scheme.code, "name": scheme.name})

    return SchemeResponse(
        id=scheme.id,
        name=scheme.name,
        code=scheme.code,
        department=scheme.department,
        description=scheme.description,
        eligibility_rules=scheme_in.eligibility_rules,
        benefits=scheme.benefits,
        documents_required=scheme_in.documents_required,
        active=scheme.active,
        created_at=scheme.created_at
    )

@router.put("/{scheme_id}", response_model=SchemeResponse)
def update_scheme(
    scheme_id: int,
    scheme_update: SchemeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["ADMIN"]))
):
    s = db.query(Scheme).filter(Scheme.id == scheme_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Scheme not found")

    old_data = {"name": s.name, "active": s.active}

    if scheme_update.name is not None: s.name = scheme_update.name
    if scheme_update.department is not None: s.department = scheme_update.department
    if scheme_update.description is not None: s.description = scheme_update.description
    if scheme_update.eligibility_rules is not None: s.eligibility_rules = json.dumps(scheme_update.eligibility_rules)
    if scheme_update.benefits is not None: s.benefits = scheme_update.benefits
    if scheme_update.documents_required is not None: s.documents_required = json.dumps(scheme_update.documents_required)
    if scheme_update.active is not None: s.active = scheme_update.active

    db.commit()
    db.refresh(s)

    record_audit(db, action="UPDATE_SCHEME", entity="Scheme", entity_id=str(s.id), user_id=current_user.id, old_value=old_data, new_value={"name": s.name, "active": s.active})

    try: elig_rules = json.loads(s.eligibility_rules)
    except Exception: elig_rules = {}
    try: docs_req = json.loads(s.documents_required)
    except Exception: docs_req = []

    return SchemeResponse(
        id=s.id,
        name=s.name,
        code=s.code,
        department=s.department,
        description=s.description,
        eligibility_rules=elig_rules,
        benefits=s.benefits,
        documents_required=docs_req,
        active=s.active,
        created_at=s.created_at
    )

@router.delete("/{scheme_id}")
def delete_scheme(scheme_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles(["ADMIN"]))):
    s = db.query(Scheme).filter(Scheme.id == scheme_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Scheme not found")
    db.delete(s)
    db.commit()
    record_audit(db, action="DELETE_SCHEME", entity="Scheme", entity_id=str(scheme_id), user_id=current_user.id, old_value={"id": scheme_id, "name": s.name})
    return {"message": "Scheme deleted successfully"}
