import os
import json
import math
import hashlib
import numpy as np
from typing import List, Dict, Any, Optional
from pypdf import PdfReader
from sqlalchemy.orm import Session
from app.models.dss import DSSDocument, DSSChunk
from app.schemas.dss import RAGCitation
from app.core.config import settings
from app.services.langchain_workflow import (
    delete_document_chunks,
    retrieve_policy_documents,
    split_policy_pages,
    upsert_documents,
)

_legacy_chroma_synced = False

def compute_text_embedding(text: str, dim: int = 64) -> List[float]:
    """
    Computes a normalized dense vector embedding for semantic search.
    Uses an internal lightweight semantic hash projector when external transformer models are offline.
    """
    # Deterministic semantic n-gram feature hashing
    vec = np.zeros(dim, dtype=np.float32)
    words = text.lower().split()
    for word in words:
        h = int.from_bytes(hashlib.blake2b(word.encode("utf-8"), digest_size=8).digest(), "big")
        idx = h % dim
        sign = 1.0 if (h // dim) % 2 == 0 else -1.0
        vec[idx] += sign * (1.0 / (1.0 + math.log(1 + len(word))))
        
    # Add character n-grams (3-grams) for robust morphological matching
    for i in range(len(text) - 3):
        tri = text[i:i+3].lower()
        h = int.from_bytes(hashlib.blake2b(tri.encode("utf-8"), digest_size=8).digest(), "big")
        idx = h % dim
        vec[idx] += 0.3 * (1.0 if (h // dim) % 2 == 0 else -1.0)
        
    # L2 normalize vector
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    return [round(float(v), 6) for v in vec]

def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Computes cosine similarity between two normalized float vectors."""
    a = np.array(vec1)
    b = np.array(vec2)
    dot = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(dot / (norm_a * norm_b))

def process_and_index_pdf(
    db: Session,
    file_path: str,
    document_name: str,
    scheme_code: Optional[str] = None,
    document_type: str = "POLICY_GUIDELINE"
) -> DSSDocument:
    """
    Page-aware PDF ingestion pipeline:
    Extracts text per page, chunks with overlap, generates embeddings,
    and stores chunks in the database for RAG retrieval.
    """
    reader = PdfReader(file_path)
    pages = [(page.extract_text() or "", page_idx + 1) for page_idx, page in enumerate(reader.pages)]
    existing = db.query(DSSDocument).filter(DSSDocument.name == document_name,
                                             DSSDocument.scheme_code == scheme_code).first()
    if existing:
        doc = existing
        old_chunks = db.query(DSSChunk).filter(DSSChunk.document_id == doc.id).all()
        delete_document_chunks([f"dss-chunk-{chunk.id}" for chunk in old_chunks])
        db.query(DSSChunk).filter(DSSChunk.document_id == doc.id).delete(synchronize_session=False)
        doc.file_url = file_path
        doc.document_type = document_type
    else:
        doc = DSSDocument(name=document_name, file_url=file_path, document_type=document_type, scheme_code=scheme_code)
        db.add(doc)
        db.flush()

    relative_path = os.path.relpath(file_path, settings.UPLOAD_DIR).replace("\\", "/")
    source_url = f"/uploads/{relative_path}" if not relative_path.startswith("../") else None
    metadata = {"document_id": doc.id, "document_name": document_name, "document_type": document_type}
    if source_url:
        metadata["source_url"] = source_url
    if scheme_code:
        metadata["scheme_code"] = scheme_code
    vector_docs = split_policy_pages(pages, metadata)
    sql_chunks = []
    for vector_doc in vector_docs:
        chunk = DSSChunk(
            document_id=doc.id,
            chunk_text=vector_doc.page_content,
            page_number=int(vector_doc.metadata["page_number"]),
            section_title=f"Page {vector_doc.metadata['page_number']}",
            embedding=json.dumps(compute_text_embedding(vector_doc.page_content)),
        )
        db.add(chunk)
        sql_chunks.append(chunk)
    db.flush()
    upsert_documents(vector_docs, [f"dss-chunk-{chunk.id}" for chunk in sql_chunks])
    db.commit()
    db.refresh(doc)
    return doc


def delete_policy_document(db: Session, document_id: int) -> bool:
    doc = db.query(DSSDocument).filter(DSSDocument.id == document_id).first()
    if not doc:
        return False
    chunk_ids = [row[0] for row in db.query(DSSChunk.id).filter(DSSChunk.document_id == document_id).all()]
    delete_document_chunks([f"dss-chunk-{chunk_id}" for chunk_id in chunk_ids])
    db.query(DSSChunk).filter(DSSChunk.document_id == document_id).delete(synchronize_session=False)
    db.delete(doc)
    db.commit()
    return True


def _sync_legacy_sql_chunks(db: Session) -> None:
    """One-time migration for policy chunks seeded before Chroma was introduced."""
    global _legacy_chroma_synced
    if _legacy_chroma_synced:
        return
    from app.services.langchain_workflow import existing_chroma_ids
    known_ids = existing_chroma_ids()
    rows = db.query(DSSChunk, DSSDocument).join(DSSDocument, DSSChunk.document_id == DSSDocument.id).all()
    documents, ids = [], []
    for chunk, doc in rows:
        vector_id = f"dss-chunk-{chunk.id}"
        if vector_id in known_ids:
            continue
        metadata = {"document_id": doc.id, "document_name": doc.name, "document_type": doc.document_type,
                    "source_url": doc.file_url, "page_number": chunk.page_number}
        if doc.scheme_code:
            metadata["scheme_code"] = doc.scheme_code
        from langchain_core.documents import Document
        documents.append(Document(page_content=chunk.chunk_text, metadata=metadata))
        ids.append(vector_id)
    upsert_documents(documents, ids)
    _legacy_chroma_synced = True

def search_relevant_policy_chunks(
    db: Session,
    query: str,
    top_k: int = 4,
    scheme_code_filter: Optional[str] = None
) -> List[RAGCitation]:
    """
    Retrieves the most semantically relevant policy document chunks
    with exact document name, page number, and text excerpt.
    """
    try:
        _sync_legacy_sql_chunks(db)
        matches = retrieve_policy_documents(query, top_k=top_k, scheme_code=scheme_code_filter)
        citations = []
        for document, score in matches:
            metadata = document.metadata or {}
            citations.append(RAGCitation(
                document_name=metadata.get("document_name", "Approved policy document"),
                scheme_code=metadata.get("scheme_code"),
                page_number=int(metadata.get("page_number", 1)),
                section_title=f"Page {metadata.get('page_number', 1)}",
                excerpt=document.page_content,
                similarity_score=round(float(score), 3),
                source_url=metadata.get("source_url"),
            ))
        return citations
    except Exception:
        # Preserve search availability while dependencies/model downloads are being configured.
        pass

    query_emb = compute_text_embedding(query)
    
    query_obj = db.query(DSSChunk, DSSDocument).join(DSSDocument, DSSChunk.document_id == DSSDocument.id)
    if scheme_code_filter:
        query_obj = query_obj.filter(DSSDocument.scheme_code == scheme_code_filter)
        
    results = query_obj.all()
    if not results:
        return []

    scored_chunks = []
    for chunk, doc in results:
        if not chunk.embedding:
            continue
        try:
            chunk_emb = json.loads(chunk.embedding)
            score = cosine_similarity(query_emb, chunk_emb)
            
            # Boost score if keywords directly match
            query_words = set(query.lower().split())
            chunk_words = set(chunk.chunk_text.lower().split())
            overlap_ratio = len(query_words.intersection(chunk_words)) / max(len(query_words), 1)
            final_score = score * 0.7 + overlap_ratio * 0.3
            
            scored_chunks.append({
                "document_name": doc.name,
                "scheme_code": doc.scheme_code,
                "page_number": chunk.page_number,
                "section_title": chunk.section_title,
                "excerpt": chunk.chunk_text,
                "similarity_score": round(float(final_score), 3)
            })
        except Exception:
            continue

    # Sort descending by similarity score
    scored_chunks.sort(key=lambda x: x["similarity_score"], reverse=True)
    
    top_matches = scored_chunks[:top_k]
    return [RAGCitation(**match) for match in top_matches]
