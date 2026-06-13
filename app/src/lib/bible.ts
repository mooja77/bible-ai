import { invoke } from "@tauri-apps/api/core";

export type Testament = "OT" | "NT" | "DC";

export interface Book {
  id: number;
  osis_code: string;
  name: string;
  testament: Testament;
  chapter_count: number;
}

export interface Translation {
  code: string;
  name: string;
  language: string;
  year: number | null;
  license: string;
  kind: "translation" | "original" | "manuscript";
}

export interface Verse {
  verse_id: number;
  book_name: string;
  chapter: number;
  verse: number;
  text: string;
}

export type SearchStrategy = "keyword" | "semantic" | "hybrid";

export interface SearchHit {
  verse_id: number;
  translation_code: string;
  book_id: number;
  book_name: string;
  book_osis: string;
  chapter: number;
  verse: number;
  text: string;
  /** May contain <mark>...</mark>. Empty string for meaning-only hits. */
  snippet: string;
  /** "keyword" | "meaning" | "both" */
  match_kind: "keyword" | "meaning" | "both";
  /** Cosine similarity 0..1, present for meaning/both. */
  semantic_score?: number | null;
}

export interface SearchResponse {
  hits: SearchHit[];
  strategy_requested: SearchStrategy;
  strategy_used: SearchStrategy;
  degraded: boolean;
  degraded_reason: string | null;
}

export const listBooks = () => invoke<Book[]>("list_books");
export const listTranslations = () => invoke<Translation[]>("list_translations");
export const getChapter = (translationCode: string, bookId: number, chapter: number) =>
  invoke<Verse[]>("get_chapter", {
    translationCode,
    bookId,
    chapter,
  });
export const getVerseRange = (
  translationCode: string,
  startVerseId: number,
  endVerseId: number,
  limit = 200,
) =>
  invoke<Verse[]>("get_verse_range", {
    translationCode,
    startVerseId,
    endVerseId,
    limit,
  });
export const search = (
  query: string,
  translationCode: string | null,
  limit = 50,
  bookId?: number | null,
  testament?: Testament | null,
  strategy: SearchStrategy = "keyword",
  ollamaHost?: string | null,
) =>
  invoke<SearchResponse>("search", {
    query,
    translationCode,
    limit,
    bookId,
    testament,
    strategy,
    ollamaHost: ollamaHost ?? null,
  });

export interface CrossRef {
  from_verse_id: number;
  to_verse_id: number;
  book_id: number;
  book_name: string;
  book_osis: string;
  chapter: number;
  verse: number;
  text: string;
  source: string;
  weight: number | null;
}

export const getCrossRefs = (
  verseId: number,
  textTranslation: string = "KJV",
  limit = 20,
) =>
  invoke<CrossRef[]>("get_cross_refs", {
    verseId,
    textTranslation,
    limit,
  });

export interface CouncilEvidence {
  verse_id: number;
  citation: string;
  translation_code: string;
  quote: string;
  reasoning: string;
}

export interface CouncilEvidenceClassification {
  verse_id: number;
  status: "used" | "supporting" | "conflicting" | "ignored";
  reasoning: string;
}

export interface ResearchTrailEvent {
  id: string;
  label: string;
  detail: string;
  event_type:
    | "question"
    | "retrieval"
    | "evidence"
    | "voice"
    | "synthesis"
    | "judgment"
    | "limitation";
  status?: "complete" | "warning" | "error";
  related_position?: string | null;
  related_verse_ids?: number[];
}

export interface ArgumentMapNode {
  id: string;
  kind: "claim" | "support" | "challenge" | "assumption" | "weakness" | "question";
  label: string;
  detail: string;
  verse_ids?: number[];
}

export interface ArgumentMapEdge {
  from: string;
  to: string;
  label?: string;
}

export interface ArgumentMap {
  nodes: ArgumentMapNode[];
  edges: ArgumentMapEdge[];
}

export interface CouncilPosition {
  label: string;
  weight: number;
  raw_weight?: number;
  summary: string;
  evidence: CouncilEvidence[];
  supporting_evidence_ids?: number[];
  challenging_evidence_ids?: number[];
  why_not_higher?: string;
  confidence_rationale?: string;
  cluster_id?: string;
  source_position_labels?: string[];
  weakest_link?: string;
  what_would_change_this?: string;
  interpretive_moves?: string[];
  argument_map?: ArgumentMap;
}

export interface CouncilResult {
  positions: CouncilPosition[];
  dissent_notes?: string;
  unresolved_tensions?: string[];
  synthesis: string;
  confidence: "low" | "medium" | "high";
  confidence_rationale?: string;
  evidence_classification?: CouncilEvidenceClassification[];
  research_trail?: ResearchTrailEvent[];
}

export interface CouncilVoice {
  provider: string;
  display_name: string;
  status: "ok" | "error" | "skipped";
  result: CouncilResult | null;
  error: string | null;
  error_category?: string;
  error_hint?: string;
  duration_ms: number;
}

export interface CouncilProviderInfo {
  name: string;
  display_name: string;
  available: boolean;
}

export interface CouncilResponse {
  session_id?: number;
  synthesis: CouncilResult;
  voices: CouncilVoice[];
  manifest: CouncilProviderInfo[];
  retrieval_mode?:
    | "semantic"
    | "fts"
    | "hybrid"
    | "hybrid+xref"
    | "explicit+hybrid"
    | "explicit+hybrid+xref";
  retrieval_fallback_reason?: string | null;
  evidence_count?: number;
  retrieval_options?: CouncilRetrievalOptions;
  retrieved_evidence?: RetrievedEvidence[];
  synthesis_mode?: "consensus" | "single_voice" | "synthesis_failed";
  synthesis_voice?: string;
}

export interface RetrievedEvidence {
  verse_id: number;
  translation_code: string;
  book_id: number;
  book_name: string;
  book_osis: string;
  chapter: number;
  verse: number;
  text: string;
  source: string;
  score?: number;
  from_verse_id?: number;
  matched_terms?: string[];
  semantic_score?: number;
  keyword_score?: number;
  cross_reference_weight?: number;
}

export interface CouncilRetrievalOptions {
  strategy?: "keyword" | "semantic" | "hybrid";
  include_cross_refs?: boolean;
  translation_code?: string;
  book_id?: number | null;
  testament?: Testament | null;
  start_verse_id?: number | null;
  end_verse_id?: number | null;
  evidence_limit?: number;
}

export const askCouncil = (
  question: string,
  model?: string,
  options: CouncilRetrievalOptions = {},
) =>
  invoke<CouncilResponse>("ask_council", {
    question,
    model,
    retrievalStrategy: options.strategy,
    includeCrossRefs: options.include_cross_refs,
    retrievalTranslation: options.translation_code,
    bookId: options.book_id,
    testament: options.testament,
    startVerseId: options.start_verse_id,
    endVerseId: options.end_verse_id,
    evidenceLimit: options.evidence_limit,
  });

export interface PassageExplanation {
  citation: string;
  summary: string;
  context: string;
  key_terms: string[];
  cross_references: string[];
  cautions: string[];
}

export const explainPassage = (
  translationCode: string,
  startVerseId: number,
  endVerseId?: number | null,
) =>
  invoke<PassageExplanation>("explain_passage", {
    translationCode,
    startVerseId,
    endVerseId,
  });

export interface AppSettings {
  google_api_key?: string | null;
  openai_api_key?: string | null;
  anthropic_api_key?: string | null;
  managed_gateway_url?: string | null;
  managed_gateway_token?: string | null;
  claude_model?: string | null;
  openai_model?: string | null;
  gemini_model?: string | null;
  anthropic_model?: string | null;
  ollama_host?: string | null;
  retrieval_translation?: string | null;
  active_translations?: string | null;
  font_scale?: number | null;
  reader_layout?: "columns" | "interleaved" | null;
  reader_density?: "comfortable" | "compact" | null;
  sync_scroll?: boolean | null;
  search_strategy?: SearchStrategy | null;
}

export const getAppSettings = () => invoke<AppSettings>("get_app_settings");

export const saveAppSettings = (settings: AppSettings) =>
  invoke<void>("save_app_settings", { settings });

export interface SetupCheck {
  configured: boolean;
  ok: boolean;
  error: string | null;
  host?: string;
  /** For the Claude check: "api", "subscription", or "disabled". */
  mode?: string;
}

export interface SetupDiagnostics {
  sidecar: {
    ok: boolean;
    node: string;
    platform: string;
    arch: string;
  };
  providers: CouncilProviderInfo[];
  checks: {
    claude: SetupCheck;
    google: SetupCheck;
    openai: SetupCheck;
    anthropic: SetupCheck;
    gateway: SetupCheck;
    ollama: SetupCheck;
  };
}

export const checkAppSetup = (settings: AppSettings) =>
  invoke<SetupDiagnostics>("check_app_setup", { settings });

// ---------- Study workspaces ----------

export type StudyItemKind =
  | "verse"
  | "verse_range"
  | "note"
  | "search_hit"
  | "search"
  | "council_session"
  | "council_result"
  | "explanation"
  | "module_entry"
  | "freeform";

export interface StudyWorkspaceSummary {
  id: number;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  item_count: number;
}

export interface StudyItem {
  id: number;
  workspace_id: number;
  kind: StudyItemKind;
  title: string | null;
  payload: Record<string, unknown>;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface StudyWorkspace {
  id: number;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  items: StudyItem[];
}

export const listStudyWorkspaces = (includeArchived = false) =>
  invoke<StudyWorkspaceSummary[]>("list_study_workspaces", { includeArchived });

export const createStudyWorkspace = (title: string, description?: string | null) =>
  invoke<number>("create_study_workspace", { title, description });

export const updateStudyWorkspace = (
  id: number,
  title: string,
  description?: string | null,
  archived = false,
) =>
  invoke<number>("update_study_workspace", {
    id,
    title,
    description,
    archived,
  });

export const deleteStudyWorkspace = (id: number) =>
  invoke<number>("delete_study_workspace", { id });

export const getStudyWorkspace = (id: number) =>
  invoke<StudyWorkspace | null>("get_study_workspace", { id });

export const addStudyItem = (
  workspaceId: number,
  kind: StudyItemKind,
  title: string | null,
  payload: Record<string, unknown>,
) =>
  invoke<number>("add_study_item", {
    workspaceId,
    kind,
    title,
    payload,
  });

export const updateStudyItem = (
  id: number,
  title: string | null,
  payload?: Record<string, unknown>,
) =>
  invoke<number>("update_study_item", {
    id,
    title,
    payload: payload ?? null,
  });

export const deleteStudyItem = (id: number) =>
  invoke<number>("delete_study_item", { id });

export const reorderStudyItems = (workspaceId: number, itemIds: number[]) =>
  invoke<void>("reorder_study_items", { workspaceId, itemIds });

export const writeWorkspaceMarkdown = (title: string, markdown: string) =>
  invoke<string>("write_workspace_markdown", { title, markdown });

/** A single file inside a Study Packet folder export (name is a safe leaf). */
export interface PacketFile {
  name: string;
  content: string;
}

/** Write a Study Packet as a folder of files under the export directory.
 *  Returns the created folder path. */
export const exportStudyPacket = (title: string, files: PacketFile[]) =>
  invoke<string>("export_study_packet", { title, files });

export const writeWorkspaceMarkdownToPath = (path: string, markdown: string) =>
  invoke<string>("write_workspace_markdown_to_path", { path, markdown });

export const writeWorkspaceHtml = (title: string, html: string) =>
  invoke<string>("write_workspace_html", { title, html });

export const writeWorkspacePdf = (title: string, markdown: string) =>
  invoke<string>("write_workspace_pdf", { title, markdown });

// ---------- Bookmarks and reading history ----------

export interface Bookmark {
  id: number;
  verse_id: number;
  end_verse_id: number | null;
  label: string | null;
  created_at: string;
}

export interface ReadingHistoryItem {
  id: number;
  book_id: number;
  chapter: number;
  translation_codes: string;
  visited_at: string;
}

export const listBookmarks = () => invoke<Bookmark[]>("list_bookmarks");

export const addBookmark = (
  verseId: number,
  endVerseId?: number | null,
  label?: string | null,
) =>
  invoke<number>("add_bookmark", {
    verseId,
    endVerseId,
    label,
  });

export const deleteBookmark = (id: number) =>
  invoke<number>("delete_bookmark", { id });

export interface Tag {
  id: number;
  name: string;
  created_at: string;
}

export interface ItemTag {
  item_id: number;
  tag_id: number;
  name: string;
}

export const listTags = () => invoke<Tag[]>("list_tags");
export const createTag = (name: string) => invoke<Tag>("create_tag", { name });
export const deleteTag = (id: number) => invoke<number>("delete_tag", { id });
export const tagItem = (tagId: number, itemType: string, itemId: number) =>
  invoke<number>("tag_item", { tagId, itemType, itemId });
export const untagItem = (tagId: number, itemType: string, itemId: number) =>
  invoke<number>("untag_item", { tagId, itemType, itemId });
export const listItemTags = (itemType: string) =>
  invoke<ItemTag[]>("list_item_tags", { itemType });

export interface TagCount {
  id: number;
  name: string;
  count: number;
}

export interface TaggedItem {
  item_type: string;
  verse_id: number;
  citation: string;
  preview: string;
}

export const listTagsWithCounts = () => invoke<TagCount[]>("list_tags_with_counts");
export const listTaggedItems = (tagId: number) =>
  invoke<TaggedItem[]>("list_tagged_items", { tagId });

export const recordReadingLocation = (
  bookId: number,
  chapter: number,
  translationCodes: string,
) =>
  invoke<void>("record_reading_location", {
    bookId,
    chapter,
    translationCodes,
  });

export const listReadingHistory = (limit = 20) =>
  invoke<ReadingHistoryItem[]>("list_reading_history", { limit });

// ---------- Saved searches ----------

export interface SavedSearch {
  id: number;
  title: string;
  query: string;
  translation_code: string | null;
  testament: Testament | null;
  book_id: number | null;
  created_at: string;
  updated_at: string;
}

export const listSavedSearches = () =>
  invoke<SavedSearch[]>("list_saved_searches");

export const createSavedSearch = (
  title: string,
  query: string,
  translationCode?: string | null,
  testament?: Testament | null,
  bookId?: number | null,
) =>
  invoke<number>("create_saved_search", {
    title,
    query,
    translationCode,
    testament,
    bookId,
  });

export const updateSavedSearchTitle = (id: number, title: string) =>
  invoke<number>("update_saved_search_title", { id, title });

export const deleteSavedSearch = (id: number) =>
  invoke<number>("delete_saved_search", { id });

export interface CouncilSessionSummary {
  id: number;
  question: string;
  created_at: string;
  retrieval_mode: string | null;
}

export interface StoredCouncilSession {
  id: number;
  question: string;
  created_at: string;
  retrieval_mode: string | null;
  response: CouncilResponse;
}

export const listCouncilSessions = (limit = 30) =>
  invoke<CouncilSessionSummary[]>("list_council_sessions", { limit });

export const getCouncilSession = (id: number) =>
  invoke<StoredCouncilSession | null>("get_council_session", { id });

export const deleteCouncilSession = (id: number) =>
  invoke<number>("delete_council_session", { id });

export type PositionUserRating =
  | "persuasive"
  | "weak"
  | "unclear"
  | "needs_study"
  | "disagree";

export interface PositionJudgment {
  position_label: string;
  user_rating: PositionUserRating;
  user_weight?: number | null;
  persuasive_evidence?: string | null;
  weak_points?: string | null;
  notes?: string | null;
}

export interface CouncilJudgment {
  id?: number | null;
  council_session_id: number;
  before_judgment?: string | null;
  after_judgment?: string | null;
  personal_conclusion?: string | null;
  confidence?: number | null;
  changed_mind_note?: string | null;
  open_questions?: string | null;
  position_judgments: PositionJudgment[];
  created_at?: string | null;
  updated_at?: string | null;
}

export const getCouncilJudgment = (councilSessionId: number) =>
  invoke<CouncilJudgment | null>("get_council_judgment", {
    councilSessionId,
  });

export const upsertCouncilJudgment = (judgment: CouncilJudgment) =>
  invoke<number>("upsert_council_judgment", { judgment });

export const deleteCouncilJudgment = (councilSessionId: number) =>
  invoke<number>("delete_council_judgment", { councilSessionId });

export const listJudgmentsForWorkspace = (workspaceId: number) =>
  invoke<CouncilJudgment[]>("list_judgments_for_workspace", { workspaceId });

export interface ArgumentAnnotation {
  id?: number | null;
  council_session_id: number;
  node_id: string;
  annotation: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export const listArgumentAnnotations = (councilSessionId: number) =>
  invoke<ArgumentAnnotation[]>("list_argument_annotations", { councilSessionId });

export const upsertArgumentAnnotation = (annotation: ArgumentAnnotation) =>
  invoke<number>("upsert_argument_annotation", { annotation });

export const deleteArgumentAnnotation = (id: number) =>
  invoke<number>("delete_argument_annotation", { id });

export interface TheologyTopic {
  id: number;
  slug: string;
  title: string;
  parent_id?: number | null;
  summary?: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TheologyConclusion {
  id?: number | null;
  topic_id: number;
  conclusion?: string | null;
  confidence?: number | null;
  unresolved_questions?: string | null;
  changed_over_time?: string | null;
  updated_at?: string | null;
}

export interface TheologyPosition {
  id?: number | null;
  topic_id: number;
  label: string;
  tradition_family?: string | null;
  summary?: string | null;
  strengths?: string | null;
  weaknesses?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TheologyLink {
  id?: number | null;
  topic_id: number;
  link_kind:
    | "verse"
    | "verse_range"
    | "workspace_item"
    | "council_session"
    | "resource_entry"
    | "note"
    | "argument_map";
  target_id?: number | null;
  title?: string | null;
  payload_json?: string | null;
  created_at?: string | null;
}

export const listTheologyTopics = () =>
  invoke<TheologyTopic[]>("list_theology_topics");

export const getTheologyTopic = (id: number) =>
  invoke<TheologyTopic | null>("get_theology_topic", { id });

export const createTheologyTopic = (
  title: string,
  summary?: string | null,
  parentId?: number | null,
) =>
  invoke<number>("create_theology_topic", {
    title,
    summary: summary ?? null,
    parentId: parentId ?? null,
  });

export const updateTheologyTopic = (topic: TheologyTopic) =>
  invoke<number>("update_theology_topic", { topic });

export const getTheologyConclusion = (topicId: number) =>
  invoke<TheologyConclusion | null>("get_theology_conclusion", { topicId });

export const upsertTheologyConclusion = (conclusion: TheologyConclusion) =>
  invoke<number>("upsert_theology_conclusion", { conclusion });

export const listTheologyPositions = (topicId: number) =>
  invoke<TheologyPosition[]>("list_theology_positions", { topicId });

export const upsertTheologyPosition = (position: TheologyPosition) =>
  invoke<number>("upsert_theology_position", { position });

export const listTheologyLinks = (topicId: number) =>
  invoke<TheologyLink[]>("list_theology_links", { topicId });

export const createTheologyLink = (link: TheologyLink) =>
  invoke<number>("create_theology_link", { link });

export const deleteTheologyLink = (id: number) =>
  invoke<number>("delete_theology_link", { id });

export const exportTheologyMarkdown = (
  topicId?: number | null,
  includeSubtopics = false,
) =>
  invoke<string>("export_theology_markdown", {
    topicId: topicId ?? null,
    includeSubtopics,
  });

export const writeTheologyPdf = (title: string, markdown: string) =>
  invoke<string>("write_theology_pdf", { title, markdown });

export interface ResourceSource {
  id?: number | null;
  slug: string;
  title: string;
  source_url?: string | null;
  license: string;
  attribution: string;
  version?: string | null;
  imported_at?: string | null;
  metadata_json?: string | null;
}

export interface ResourceCollection {
  id?: number | null;
  source_id: number;
  slug: string;
  title: string;
  kind: string;
  metadata_json?: string | null;
}

export interface ResourceEntry {
  id?: number | null;
  collection_id: number;
  source_id?: number | null;
  source_title?: string | null;
  collection_title?: string | null;
  collection_kind?: string | null;
  ref_value?: string | null;
  title?: string | null;
  body: string;
  search_text?: string | null;
  payload_json?: string | null;
  license?: string | null;
  attribution?: string | null;
  share_alike_requirements?: string | null;
}

export const listResourceSources = () =>
  invoke<ResourceSource[]>("list_resource_sources");

export const listResourceCollections = (sourceId?: number | null) =>
  invoke<ResourceCollection[]>("list_resource_collections", {
    sourceId: sourceId ?? null,
  });

export const searchResources = (
  query: string,
  sourceId?: number | null,
  collectionKind?: string | null,
  license?: string | null,
  topicId?: number | null,
  limit = 30,
) =>
  invoke<ResourceEntry[]>("search_resources", {
    query,
    sourceId: sourceId ?? null,
    collectionKind: collectionKind ?? null,
    license: license ?? null,
    topicId: topicId ?? null,
    limit,
  });

export const getResourceEntry = (id: number) =>
  invoke<ResourceEntry | null>("get_resource_entry", { id });

export interface GuidedStudySession {
  id?: number | null;
  topic_id: number;
  template_slug: string;
  focus_question?: string | null;
  before_response?: string | null;
  after_response?: string | null;
  critique?: string | null;
  review_cards_json?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export const getGuidedStudySession = (topicId: number, templateSlug: string) =>
  invoke<GuidedStudySession | null>("get_guided_study_session", {
    topicId,
    templateSlug,
  });

export const listGuidedStudySessionsForTopic = (topicId: number) =>
  invoke<GuidedStudySession[]>("list_guided_study_sessions_for_topic", { topicId });

export const upsertGuidedStudySession = (session: GuidedStudySession) =>
  invoke<number>("upsert_guided_study_session", { session });

// ---------- Highlights ----------

export interface Highlight {
  verse_id: number;
  color: string;
}

export interface RangeHighlight {
  id: number;
  start_verse_id: number;
  end_verse_id: number;
  color: string;
}

export const listHighlightsForChapter = (bookId: number, chapter: number) =>
  invoke<Highlight[]>("list_highlights_for_chapter", { bookId, chapter });

export const upsertHighlight = (verseId: number, color: string) =>
  invoke<void>("upsert_highlight", { verseId, color });

export const deleteHighlight = (verseId: number) =>
  invoke<number>("delete_highlight", { verseId });

export const listRangeHighlightsForChapter = (bookId: number, chapter: number) =>
  invoke<RangeHighlight[]>("list_range_highlights_for_chapter", { bookId, chapter });

export const upsertRangeHighlight = (
  startVerseId: number,
  endVerseId: number,
  color: string,
) =>
  invoke<void>("upsert_range_highlight", {
    startVerseId,
    endVerseId,
    color,
  });

export const deleteRangeHighlight = (startVerseId: number, endVerseId: number) =>
  invoke<number>("delete_range_highlight", { startVerseId, endVerseId });

// ---------- Notes ----------

export interface Note {
  verse_id: number;
  body: string;
  updated_at: string;
}

export interface RangeNote {
  id: number;
  start_verse_id: number;
  end_verse_id: number;
  body: string;
  updated_at: string;
}

export const getNote = (verseId: number) =>
  invoke<Note | null>("get_note", { verseId });

export const upsertNote = (verseId: number, body: string) =>
  invoke<void>("upsert_note", { verseId, body });

export const deleteNote = (verseId: number) =>
  invoke<number>("delete_note", { verseId });

export const listNotesForChapter = (bookId: number, chapter: number) =>
  invoke<Note[]>("list_notes_for_chapter", { bookId, chapter });

export const getRangeNote = (startVerseId: number, endVerseId: number) =>
  invoke<RangeNote | null>("get_range_note", { startVerseId, endVerseId });

export const upsertRangeNote = (
  startVerseId: number,
  endVerseId: number,
  body: string,
) =>
  invoke<void>("upsert_range_note", {
    startVerseId,
    endVerseId,
    body,
  });

export const deleteRangeNote = (startVerseId: number, endVerseId: number) =>
  invoke<number>("delete_range_note", { startVerseId, endVerseId });

export const listRangeNotesForChapter = (bookId: number, chapter: number) =>
  invoke<RangeNote[]>("list_range_notes_for_chapter", { bookId, chapter });

export interface NoteHit {
  kind: "verse" | "range";
  verse_id: number;
  end_verse_id: number | null;
  citation: string;
  book_id: number;
  chapter: number;
  verse: number;
  body: string;
  updated_at: string;
}

export const searchNotes = (query: string, limit = 50) =>
  invoke<NoteHit[]>("search_notes", { query, limit });

// ---------- Word tokens (Strong's) ----------

export interface WordToken {
  verse_id: number;
  position: number;
  surface: string;
  lemma: string | null;
  /** Comma-separated Strong's codes, e.g. "Hb,H7225". */
  strongs: string | null;
  morph: string | null;
}

export interface StrongsEntry {
  code: string;
  lemma: string;
  translit: string | null;
  gloss: string | null;
  definition: string | null;
}

export interface StrongsOccurrence {
  translation_code: string;
  verse_id: number;
  surface: string;
  lemma: string | null;
  morph: string | null;
  book_id: number;
  book_name: string;
  book_osis: string;
  chapter: number;
  verse: number;
  text: string;
}

export const getWordTokens = (translationCode: string, bookId: number, chapter: number) =>
  invoke<WordToken[]>("get_word_tokens", { translationCode, bookId, chapter });

export const getStrongs = (codes: string[]) =>
  invoke<StrongsEntry[]>("get_strongs", { codes });

export const getStrongsOccurrences = (code: string, limit = 80) =>
  invoke<StrongsOccurrence[]>("get_strongs_occurrences", { code, limit });

// ---------- Modules and backup ----------

export interface ModuleSummary {
  id: number;
  slug: string;
  title: string;
  kind: "commentary" | "lexicon" | "dictionary" | "map" | "timeline";
  source: string | null;
  license: string | null;
  version: string | null;
  installed_at: string;
}

export interface ModuleEntry {
  id: number;
  module_id: number;
  module_title: string;
  key_type: "verse" | "verse_range" | "strongs" | "topic";
  key_value: string;
  title: string | null;
  body: string;
  metadata: Record<string, unknown> | null;
}

export interface ModuleTopic {
  key_value: string;
  title: string | null;
  entry_count: number;
}

export interface ModuleImportManifest {
  slug: string;
  title: string;
  kind: ModuleSummary["kind"];
  source?: string | null;
  license?: string | null;
  version?: string | null;
}

export interface ModuleImportReport {
  module_id: number;
  entry_count: number;
}

export type UserDataImportStrategy = "skip_existing" | "replace_existing" | "duplicate";

export interface UserDataImportReport {
  imported: number;
  skipped: number;
  replaced: number;
  tables: number;
}

export const listModules = () => invoke<ModuleSummary[]>("list_modules");

export const createModule = (
  slug: string,
  title: string,
  kind: ModuleSummary["kind"],
  source?: string | null,
  license?: string | null,
  version?: string | null,
) =>
  invoke<number>("create_module", {
    slug,
    title,
    kind,
    source,
    license,
    version,
  });

export const deleteModule = (id: number) =>
  invoke<number>("delete_module", { id });

export const addModuleEntry = (
  moduleId: number,
  keyType: ModuleEntry["key_type"],
  keyValue: string,
  title: string | null,
  body: string,
  metadata?: Record<string, unknown> | null,
) =>
  invoke<number>("add_module_entry", {
    moduleId,
    keyType,
    keyValue,
    title,
    body,
    metadata,
  });

export const importModuleJsonl = (
  manifest: ModuleImportManifest,
  entriesJsonl: string,
) =>
  invoke<ModuleImportReport>("import_module_jsonl", {
    manifest,
    entriesJsonl,
  });

export const listModuleEntriesForVerse = (verseId: number) =>
  invoke<ModuleEntry[]>("list_module_entries_for_verse", { verseId });

export const listModuleEntriesForRange = (startVerseId: number, endVerseId: number) =>
  invoke<ModuleEntry[]>("list_module_entries_for_range", { startVerseId, endVerseId });

export const listModuleEntriesForStrongs = (codes: string[]) =>
  invoke<ModuleEntry[]>("list_module_entries_for_strongs", { codes });

export const listModuleTopics = () =>
  invoke<ModuleTopic[]>("list_module_topics");

export const listModuleEntriesForTopic = (topic: string) =>
  invoke<ModuleEntry[]>("list_module_entries_for_topic", { topic });

export const exportUserDataJson = () =>
  invoke<Record<string, unknown>>("export_user_data_json");

export const importUserDataJson = (
  payload: Record<string, unknown>,
  conflictStrategy: UserDataImportStrategy,
) =>
  invoke<UserDataImportReport>("import_user_data_json", {
    payload,
    conflictStrategy,
  });

export const writeUserDataBackup = () =>
  invoke<string>("write_user_data_backup");

export const backupUserSqlite = () =>
  invoke<string>("backup_user_sqlite");

export const restoreUserSqlite = (sourcePath: string) =>
  invoke<string>("restore_user_sqlite", { sourcePath });
