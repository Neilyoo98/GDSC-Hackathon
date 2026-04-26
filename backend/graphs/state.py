"""State schemas for AUBI incident graph."""

from __future__ import annotations

from typing import Annotated, Any, Optional
import operator
from typing_extensions import TypedDict


class AUBIIncidentState(TypedDict):
    """State flowing through the incident routing graph."""

    # Input
    incident_text: str

    # Analyzer output
    affected_service: Optional[str]
    affected_files: list[str]
    error_type: Optional[str]
    urgency: Optional[str]

    # Router output
    owner_ids: list[str]

    # Agent querier output — merged across parallel calls
    agent_contexts: Annotated[list[dict[str, Any]], operator.add]

    # Drafter output
    slack_message: Optional[str]
    postmortem: Optional[str]

    # Memory updater output
    memory_updates: list[str]

    # Stream log for frontend
    stream_log: Annotated[list[str], operator.add]
