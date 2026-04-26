"""Qdrant-backed constitution store.

Collections:
  semantic_facts  — SPO triples (subject/predicate/object) from GitHub profiling
  episodes        — resolved incidents written back after each PR push

Usage:
  from constitution.store import ConstitutionStore
  store = ConstitutionStore()
  store.upsert_facts(user_id, tenant_id, facts)
  results = store.search(user_id, tenant_id, query_text, top_k=5)
  grouped = store.get_by_user(user_id, tenant_id)
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache
from typing import Any
from uuid import uuid4

logger = logging.getLogger(__name__)

COLLECTION_FACTS    = "semantic_facts"
COLLECTION_EPISODES = "episodes"
EMBEDDING_DIM       = 384   # all-MiniLM-L6-v2


# ---------------------------------------------------------------------------
# Embeddings (local, free — no API credits)
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _get_model():
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer("all-MiniLM-L6-v2")


def embed(text: str) -> list[float]:
    return _get_model().encode(text, normalize_embeddings=True).tolist()


# ---------------------------------------------------------------------------
# Qdrant client
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _get_client():
    from qdrant_client import QdrantClient
    url     = os.getenv("QDRANT_URL", "http://localhost:6333")
    api_key = os.getenv("QDRANT_API_KEY")
    return QdrantClient(url=url, api_key=api_key)


def _ensure_collection(name: str) -> None:
    from qdrant_client.models import Distance, VectorParams
    client = _get_client()
    existing = {c.name for c in client.get_collections().collections}
    if name not in existing:
        client.create_collection(
            collection_name=name,
            vectors_config=VectorParams(size=EMBEDDING_DIM, distance=Distance.COSINE),
        )
        logger.info("Created Qdrant collection: %s", name)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

class ConstitutionStore:
    def __init__(self) -> None:
        _ensure_collection(COLLECTION_FACTS)
        _ensure_collection(COLLECTION_EPISODES)

    # ---- Write ----------------------------------------------------------------

    def upsert_facts(
        self,
        user_id: str,
        tenant_id: str,
        facts: list[dict[str, Any]],
    ) -> int:
        """Store SPO triples into semantic_facts. Returns count stored."""
        from qdrant_client.models import PointStruct

        client = _get_client()
        points: list[PointStruct] = []
        for fact in facts:
            text   = f"{fact.get('subject','')} {fact.get('predicate','')} {fact.get('object','')}"
            vector = embed(text)
            points.append(PointStruct(
                id=str(uuid4()),
                vector=vector,
                payload={
                    "user_id":    user_id,
                    "tenant_id":  tenant_id,
                    "subject":    fact.get("subject", ""),
                    "predicate":  fact.get("predicate", ""),
                    "object":     fact.get("object", ""),
                    "confidence": fact.get("confidence", 0.7),
                    "category":   fact.get("category", "general"),
                },
            ))

        if points:
            client.upsert(collection_name=COLLECTION_FACTS, points=points)
        logger.info("Stored %d facts for user %s", len(points), user_id)
        return len(points)

    def add_episode(
        self,
        user_id: str,
        tenant_id: str,
        episode: dict[str, Any],
    ) -> None:
        """Record a resolved incident/episode."""
        from qdrant_client.models import PointStruct

        text   = f"{episode.get('predicate','')} {episode.get('object','')}"
        vector = embed(text)
        _get_client().upsert(
            collection_name=COLLECTION_EPISODES,
            points=[PointStruct(
                id=str(uuid4()),
                vector=vector,
                payload={
                    "user_id":    user_id,
                    "tenant_id":  tenant_id,
                    "subject":    episode.get("subject", user_id),
                    "predicate":  episode.get("predicate", "resolved"),
                    "object":     episode.get("object", ""),
                    "confidence": episode.get("confidence", 0.9),
                    "category":   "episodes",
                },
            )],
        )

    # ---- Read -----------------------------------------------------------------

    def search(
        self,
        user_id: str,
        tenant_id: str,
        query: str,
        top_k: int = 8,
        collection: str = COLLECTION_FACTS,
    ) -> list[dict[str, Any]]:
        """Semantic search over a user's facts. Returns payload dicts."""
        from qdrant_client.models import FieldCondition, Filter, MatchValue

        vector = embed(query)
        results = _get_client().search(
            collection_name=collection,
            query_vector=vector,
            query_filter=Filter(must=[
                FieldCondition(key="user_id",   match=MatchValue(value=user_id)),
                FieldCondition(key="tenant_id", match=MatchValue(value=tenant_id)),
            ]),
            limit=top_k,
        )
        return [
            {**hit.payload, "_score": hit.score}
            for hit in results
        ]

    def get_by_user(
        self,
        user_id: str,
        tenant_id: str,
        limit: int = 100,
    ) -> dict[str, list[dict[str, Any]]]:
        """Fetch all facts for a user grouped by category."""
        from qdrant_client.models import FieldCondition, Filter, MatchValue

        results, _offset = _get_client().scroll(
            collection_name=COLLECTION_FACTS,
            scroll_filter=Filter(must=[
                FieldCondition(key="user_id",   match=MatchValue(value=user_id)),
                FieldCondition(key="tenant_id", match=MatchValue(value=tenant_id)),
            ]),
            limit=limit,
            with_payload=True,
            with_vectors=False,
        )

        grouped: dict[str, list] = {}
        for point in results:
            cat = point.payload.get("category", "general")
            grouped.setdefault(cat, []).append(point.payload)
        return grouped

    def delete_user(self, user_id: str, tenant_id: str) -> None:
        from qdrant_client.models import FieldCondition, Filter, MatchValue

        filt = Filter(must=[
            FieldCondition(key="user_id",   match=MatchValue(value=user_id)),
            FieldCondition(key="tenant_id", match=MatchValue(value=tenant_id)),
        ])
        for col in (COLLECTION_FACTS, COLLECTION_EPISODES):
            _get_client().delete(collection_name=col, points_selector=filt)
