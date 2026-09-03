from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ConversationTurn(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class StructuredContextItem(BaseModel):
    """A piece of authoritative platform data Nest has already fetched
    (college profile, cutoff trend, scholarship match, prediction, financial
    estimate, roadmap milestone). Always included in the prompt — these
    aren't similarity-ranked, they were fetched because the caller's own
    business logic (repository/service queries) already decided they're
    relevant to this student and this query.
    """

    type: str  # college | cutoff | scholarship | prediction | financial | roadmap | exam
    id: str
    title: str
    content: str


class RagQueryRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    session_id: Optional[str] = None
    student_context: Dict[str, Any] = Field(default_factory=dict)
    structured_context: List[StructuredContextItem] = Field(default_factory=list)
    conversation_history: List[ConversationTurn] = Field(default_factory=list)


class SourceCitation(BaseModel):
    tag: str
    source_type: str
    source_id: str
    title: str
    snippet: str


class ActionButton(BaseModel):
    label: str
    action: str
    params: Dict[str, str] = Field(default_factory=dict)


class RagQueryResponse(BaseModel):
    answer: str
    reasoning: str
    intent: str
    confidence_score: float
    confidence_level: str  # high | medium | low
    low_confidence: bool
    sources_cited: List[SourceCitation]
    suggested_questions: List[str]
    related_colleges: List[str]
    action_buttons: List[ActionButton]
    provider: str
    model: str
    degraded: bool


class KnowledgeUploadResponse(BaseModel):
    document_id: str
    title: str
    status: str
    chunk_count: int
    reused_existing: bool


class KnowledgeDocumentStatus(BaseModel):
    id: str
    title: str
    doc_type: str
    status: str
    chunk_count: int
    embedding_model: Optional[str]
    source_filename: Optional[str]
    created_at: str
    updated_at: str


class KnowledgeStatusResponse(BaseModel):
    documents: List[KnowledgeDocumentStatus]
    total_chunks: int


class ReindexRequest(BaseModel):
    document_id: Optional[str] = None  # None = reindex all


class ReindexResponse(BaseModel):
    reindexed_documents: int
    reindexed_chunks: int


class SearchAnalyzeRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)


class SearchEntities(BaseModel):
    exam: Optional[str] = None
    discipline: Optional[str] = None
    college_type: Optional[str] = None
    city: Optional[str] = None
    category: Optional[str] = None
    budget_max: Optional[float] = None
    nirf_max: Optional[int] = None
    rank: Optional[int] = None
    use_profile_rank: bool = False
    hostel_required: bool = False
    placement_focus: bool = False
    scholarship_focus: bool = False
    roi_focus: bool = False
    action: Optional[str] = None
    college_names: List[str] = Field(default_factory=list)
    sort_hint: Optional[str] = None


class SearchAnalyzeResponse(BaseModel):
    intent: str
    confidence: float
    entities: SearchEntities
    expanded_query: str


class PredictMLRequest(BaseModel):
    exam: str
    year: int
    round: Any
    college_code: str
    course_code: str
    category: str
    quota: Optional[str] = None
    college_type: Optional[str] = None


class PredictMLResponse(BaseModel):
    success: bool
    exam: str
    predictedClosingRank: int
    model: str
    modelVersion: str
    confidence: Optional[Any] = None

