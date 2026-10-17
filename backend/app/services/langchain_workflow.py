"""LangChain orchestration and persistent Chroma retrieval for the FRA DSS."""
from functools import lru_cache
from typing import Any, Dict, List, Optional, Sequence, Tuple

from app.core.config import settings


def _langchain_imports():
    from langchain_chroma import Chroma
    from langchain_core.documents import Document
    from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
    from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
    from langchain_groq import ChatGroq
    from langchain_huggingface import HuggingFaceEmbeddings
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    return Chroma, Document, AIMessage, HumanMessage, SystemMessage, ChatPromptTemplate, MessagesPlaceholder, ChatGroq, HuggingFaceEmbeddings, RecursiveCharacterTextSplitter


@lru_cache(maxsize=1)
def _embeddings():
    *_, HuggingFaceEmbeddings, _Splitter = _langchain_imports()
    return HuggingFaceEmbeddings(
        model_name=settings.DSS_EMBEDDING_MODEL,
        model_kwargs={"device": settings.DSS_EMBEDDING_DEVICE},
        encode_kwargs={"normalize_embeddings": True},
        cache_folder=settings.HF_HOME,
    )


def _vector_store():
    Chroma, *_ = _langchain_imports()
    return Chroma(
        collection_name=settings.DSS_CHROMA_COLLECTION,
        embedding_function=_embeddings(),
        persist_directory=settings.DSS_CHROMA_DIR,
        collection_metadata={"hnsw:space": "cosine"},
    )


def split_policy_pages(pages: Sequence[Tuple[str, int]], metadata: Dict[str, Any], chunk_size: int = 900, overlap: int = 140):
    """Split extracted page text while preserving page number and source metadata."""
    _, Document, *_ = _langchain_imports()
    splitter = _langchain_imports()[-1](
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        add_start_index=True,
        separators=["\n\n", "\n", ". ", "? ", "! ", "; ", ", ", " ", ""],
    )
    output = []
    for text, page_number in pages:
        clean = " ".join(text.split())
        if not clean:
            continue
        for split_document in splitter.create_documents([clean]):
            part = split_document.page_content
            if len(part.strip()) < 40:
                continue
            output.append(Document(
                page_content=part.strip(),
                metadata={**metadata, "page_number": page_number, "start_index": split_document.metadata["start_index"]},
            ))
    return output


def upsert_documents(documents, ids: Sequence[str]) -> None:
    if not documents:
        return
    store = _vector_store()
    # Chroma.add_documents upserts IDs in supported Chroma versions; delete first for compatibility.
    try:
        store.delete(ids=list(ids))
    except Exception:
        pass
    store.add_documents(documents=list(documents), ids=list(ids))


def delete_document_chunks(ids: Sequence[str]) -> None:
    if ids:
        _vector_store().delete(ids=list(ids))


def existing_chroma_ids():
    collection = _vector_store()._collection
    return set(collection.get(include=["metadatas"]).get("ids", []))


def retrieve_policy_documents(query: str, top_k: int, scheme_code: Optional[str] = None):
    store = _vector_store()
    where = {"scheme_code": scheme_code} if scheme_code else None
    return store.similarity_search_with_relevance_scores(query, k=max(1, min(top_k, 10)), filter=where)


def run_langchain_answer(query: str, system_prompt: str, history: Sequence[Dict[str, str]] = (), tools=()) -> Tuple[Optional[str], Optional[str]]:
    """Run the existing grounded DSS context through a LangChain ChatGroq workflow."""
    if not settings.GROQ_API_KEY:
        return None, None
    try:
        _, _, AIMessage, HumanMessage, _, ChatPromptTemplate, MessagesPlaceholder, ChatGroq, _, _ = _langchain_imports()
        from langchain_core.messages import ToolMessage
        llm = ChatGroq(model=settings.GROQ_MODEL, groq_api_key=settings.GROQ_API_KEY, temperature=0.2, max_tokens=1800)
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            MessagesPlaceholder("history", optional=True),
            ("human", "{question}"),
        ])
        messages = []
        recent_history = list(history[-8:])
        if recent_history and recent_history[-1].get("role") == "user" and recent_history[-1].get("content", "").strip() == query.strip():
            recent_history = recent_history[:-1]
        for item in recent_history:
            role, content = item.get("role"), item.get("content", "")
            if role == "user": messages.append(HumanMessage(content=content[:4000]))
            elif role == "assistant": messages.append(AIMessage(content=content[:4000]))
        prompt_messages = prompt.invoke({"history": messages, "question": query[:4000]}).to_messages()
        active_llm = llm.bind_tools(list(tools)) if tools else llm
        result = active_llm.invoke(prompt_messages)
        allowed_tools = {tool.name: tool for tool in tools}
        for _ in range(3):
            calls = getattr(result, "tool_calls", []) or []
            if not calls:
                break
            prompt_messages.append(result)
            for call in calls:
                tool = allowed_tools.get(call.get("name"))
                if tool is None:
                    tool_result = "Tool not available."
                else:
                    try:
                        tool_result = str(tool.invoke(call.get("args", {})))[:12000]
                    except Exception:
                        tool_result = "The requested application data could not be retrieved."
                prompt_messages.append(ToolMessage(content=tool_result, tool_call_id=call.get("id", "")))
            result = active_llm.invoke(prompt_messages)
        content = result.content
        if isinstance(content, list):
            content = "".join(block.get("text", "") if isinstance(block, dict) else str(block) for block in content)
        return str(content).strip() or None, settings.GROQ_MODEL
    except Exception:
        return None, None
