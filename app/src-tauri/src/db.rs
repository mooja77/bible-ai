use rusqlite::{types::Value, Connection, Result as SqlResult};
use serde::Serialize;
use std::path::Path;

#[derive(Serialize, Clone)]
pub struct Book {
    pub id: i64,
    pub osis_code: String,
    pub name: String,
    pub testament: String,
    pub chapter_count: i64,
}

#[derive(Serialize, Clone)]
pub struct Translation {
    pub code: String,
    pub name: String,
    pub language: String,
    pub year: Option<i64>,
    pub license: String,
    pub kind: String,
}

#[derive(Serialize, Clone)]
pub struct CorpusTranslationCoverage {
    pub code: String,
    pub name: String,
    pub kind: String,
    pub text_count: i64,
    pub mapping_count: i64,
    pub embedding_count: i64,
}

#[derive(Serialize, Clone)]
pub struct CorpusEmbeddingBuild {
    pub model: String,
    pub model_digest: String,
    pub edition_count: i64,
    pub embedding_count: i64,
    pub generated_at: String,
}

#[derive(Serialize, Clone)]
pub struct CorpusDiagnostics {
    pub ok: bool,
    pub error: Option<String>,
    pub canonical_verse_count: i64,
    pub translation_text_count: i64,
    pub mapping_count: i64,
    pub fts_count: i64,
    pub embedding_count: i64,
    pub translations: Vec<CorpusTranslationCoverage>,
    pub embedding_builds: Vec<CorpusEmbeddingBuild>,
    pub issues: Vec<String>,
}

#[derive(Serialize, Clone)]
pub struct Verse {
    pub verse_id: i64,
    pub book_name: String,
    pub chapter: i64,
    pub verse: i64,
    pub text: String,
}

#[derive(Serialize, Clone)]
pub struct SearchHit {
    pub verse_id: i64,
    pub translation_code: String,
    pub book_id: i64,
    pub book_name: String,
    pub book_osis: String,
    pub chapter: i64,
    pub verse: i64,
    pub text: String,
    pub snippet: String,
}

#[derive(Clone, Copy, Default)]
pub struct VerseSearchScope<'a> {
    pub book_id: Option<i64>,
    pub testament: Option<&'a str>,
    pub start_verse_id: Option<i64>,
    pub end_verse_id: Option<i64>,
}

#[derive(Serialize, Clone)]
pub struct SemanticHit {
    pub verse_id: i64,
    pub translation_code: String,
    pub book_id: i64,
    pub book_name: String,
    pub book_osis: String,
    pub chapter: i64,
    pub verse: i64,
    pub text: String,
    pub score: f32,
}

#[derive(Serialize, Clone)]
pub struct WordToken {
    pub verse_id: i64,
    pub position: i64,
    pub surface: String,
    pub lemma: Option<String>,
    /// Comma-separated Strong's codes (e.g. "Hb,H7225" for prefix+root).
    pub strongs: Option<String>,
    pub morph: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct StrongsEntry {
    pub code: String,
    pub lemma: String,
    pub translit: Option<String>,
    pub gloss: Option<String>,
    pub definition: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct StrongsOccurrence {
    pub translation_code: String,
    pub verse_id: i64,
    pub surface: String,
    pub lemma: Option<String>,
    pub morph: Option<String>,
    pub book_id: i64,
    pub book_name: String,
    pub book_osis: String,
    pub chapter: i64,
    pub verse: i64,
    pub text: String,
}

#[derive(Serialize, Clone)]
pub struct CrossRef {
    pub from_verse_id: i64,
    pub to_verse_id: i64,
    pub book_id: i64,
    pub book_name: String,
    pub book_osis: String,
    pub chapter: i64,
    pub verse: i64,
    pub text: String,
    pub source: String,
    pub weight: Option<f64>,
}

pub fn open(path: &Path) -> SqlResult<Connection> {
    let conn = Connection::open(path)?;
    // Corpus is read-only at runtime — this hint gives SQLite room to optimise.
    conn.execute_batch(
        "PRAGMA query_only = ON;
         PRAGMA journal_mode = OFF;
         PRAGMA synchronous = OFF;",
    )?;
    Ok(conn)
}

pub fn list_books(conn: &Connection) -> SqlResult<Vec<Book>> {
    let mut stmt = conn.prepare(
        "SELECT id, osis_code, name, testament, chapter_count
         FROM books
         ORDER BY canonical_order",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Book {
            id: row.get(0)?,
            osis_code: row.get(1)?,
            name: row.get(2)?,
            testament: row.get(3)?,
            chapter_count: row.get(4)?,
        })
    })?;
    rows.collect()
}

pub fn list_translations(conn: &Connection) -> SqlResult<Vec<Translation>> {
    let mut stmt = conn.prepare(
        "SELECT code, name, language, year, license, kind
         FROM translations
         ORDER BY language, code",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Translation {
            code: row.get(0)?,
            name: row.get(1)?,
            language: row.get(2)?,
            year: row.get(3)?,
            license: row.get(4)?,
            kind: row.get(5)?,
        })
    })?;
    rows.collect()
}

/// Return lightweight identity and coverage information for the exact corpus
/// opened by the running app. This intentionally avoids `PRAGMA quick_check` or
/// hashing the 800MB database during an interactive setup check; the full
/// checksum/integrity contract remains a build and release gate.
pub fn corpus_diagnostics(conn: &Connection) -> SqlResult<CorpusDiagnostics> {
    let canonical_verse_count =
        conn.query_row("SELECT COUNT(*) FROM verses", [], |row| row.get(0))?;
    let translation_text_count =
        conn.query_row("SELECT COUNT(*) FROM translation_text", [], |row| {
            row.get(0)
        })?;
    let mapping_count =
        conn.query_row("SELECT COUNT(*) FROM edition_verse_mappings", [], |row| {
            row.get(0)
        })?;
    let fts_count = conn.query_row("SELECT COUNT(*) FROM translation_text_fts", [], |row| {
        row.get(0)
    })?;
    let embedding_count = conn.query_row("SELECT COUNT(*) FROM verse_embeddings", [], |row| {
        row.get(0)
    })?;

    let mut coverage_stmt = conn.prepare(
        "SELECT t.code, t.name, t.kind,
                (SELECT COUNT(*) FROM translation_text tt WHERE tt.translation_code = t.code),
                (SELECT COUNT(*) FROM edition_verse_mappings m WHERE m.translation_code = t.code),
                (SELECT COUNT(*) FROM verse_embeddings e WHERE e.translation_code = t.code)
         FROM translations t
         ORDER BY t.code",
    )?;
    let translations = coverage_stmt
        .query_map([], |row| {
            Ok(CorpusTranslationCoverage {
                code: row.get(0)?,
                name: row.get(1)?,
                kind: row.get(2)?,
                text_count: row.get(3)?,
                mapping_count: row.get(4)?,
                embedding_count: row.get(5)?,
            })
        })?
        .collect::<SqlResult<Vec<_>>>()?;

    let mut builds_stmt = conn.prepare(
        "SELECT model, model_digest, COUNT(*), SUM(embedding_count), MAX(generated_at)
         FROM embedding_builds
         GROUP BY model, model_digest
         ORDER BY model, model_digest",
    )?;
    let embedding_builds = builds_stmt
        .query_map([], |row| {
            Ok(CorpusEmbeddingBuild {
                model: row.get(0)?,
                model_digest: row.get(1)?,
                edition_count: row.get(2)?,
                embedding_count: row.get(3)?,
                generated_at: row.get(4)?,
            })
        })?
        .collect::<SqlResult<Vec<_>>>()?;

    let mut issues = Vec::new();
    if canonical_verse_count <= 0 {
        issues.push("the corpus has no canonical verses".to_string());
    }
    if translations.is_empty() || translation_text_count <= 0 {
        issues.push("the corpus has no translation text".to_string());
    }
    if fts_count != translation_text_count {
        issues.push(format!(
            "the search index has {fts_count} rows but translation text has {translation_text_count}"
        ));
    }
    if mapping_count < translation_text_count {
        issues.push(format!(
            "only {mapping_count} edition mappings exist for {translation_text_count} text rows"
        ));
    }
    if embedding_count <= 0 || embedding_builds.is_empty() {
        issues.push("the corpus has no recorded semantic index build".to_string());
    }
    for translation in &translations {
        if translation.text_count <= 0 {
            issues.push(format!("{} has no text rows", translation.code));
        }
        if translation.mapping_count < translation.text_count {
            issues.push(format!(
                "{} has fewer mappings than text rows",
                translation.code
            ));
        }
        if translation.embedding_count < translation.text_count {
            issues.push(format!(
                "{} has fewer embeddings than text rows",
                translation.code
            ));
        }
    }

    Ok(CorpusDiagnostics {
        ok: issues.is_empty(),
        error: None,
        canonical_verse_count,
        translation_text_count,
        mapping_count,
        fts_count,
        embedding_count,
        translations,
        embedding_builds,
        issues,
    })
}

pub fn get_chapter(
    conn: &Connection,
    translation_code: &str,
    book_id: i64,
    chapter: i64,
) -> SqlResult<Vec<Verse>> {
    let mut stmt = conn.prepare(
        "SELECT v.id, b.name, v.chapter, v.verse,
                (SELECT group_concat(piece, ' ') FROM (
                   SELECT CASE WHEN m.mapping_kind = 'heading'
                               THEN '[' || t.text || ']'
                               ELSE t.text END AS piece
                   FROM edition_verse_mappings m
                   JOIN translation_text t
                     ON t.translation_code = m.translation_code
                    AND t.verse_id = m.local_verse_id
                   WHERE m.translation_code = ?1
                     AND m.canonical_verse_id = v.id
                   ORDER BY CASE m.mapping_kind WHEN 'heading' THEN 0 ELSE 1 END,
                            m.local_verse_id, m.local_segment
                )) AS text
         FROM verses v
         JOIN books b ON b.id = v.book_id
         WHERE v.book_id = ?2 AND v.chapter = ?3
           AND EXISTS (
             SELECT 1 FROM edition_verse_mappings m
             JOIN translation_text t
               ON t.translation_code = m.translation_code
              AND t.verse_id = m.local_verse_id
             WHERE m.translation_code = ?1 AND m.canonical_verse_id = v.id
           )
         ORDER BY v.verse",
    )?;
    let rows = stmt.query_map(
        rusqlite::params![translation_code, book_id, chapter],
        |row| {
            Ok(Verse {
                verse_id: row.get(0)?,
                book_name: row.get(1)?,
                chapter: row.get(2)?,
                verse: row.get(3)?,
                text: row.get(4)?,
            })
        },
    )?;
    rows.collect()
}

pub fn get_verse_range(
    conn: &Connection,
    translation_code: &str,
    start_verse_id: i64,
    end_verse_id: i64,
    limit: i64,
) -> SqlResult<Vec<Verse>> {
    let mut stmt = conn.prepare(
        "SELECT v.id, b.name, v.chapter, v.verse,
                (SELECT group_concat(piece, ' ') FROM (
                   SELECT CASE WHEN m.mapping_kind = 'heading'
                               THEN '[' || t.text || ']'
                               ELSE t.text END AS piece
                   FROM edition_verse_mappings m
                   JOIN translation_text t
                     ON t.translation_code = m.translation_code
                    AND t.verse_id = m.local_verse_id
                   WHERE m.translation_code = ?1
                     AND m.canonical_verse_id = v.id
                   ORDER BY CASE m.mapping_kind WHEN 'heading' THEN 0 ELSE 1 END,
                            m.local_verse_id, m.local_segment
                )) AS text
         FROM verses v
         JOIN books b ON b.id = v.book_id
         WHERE v.id >= ?2 AND v.id <= ?3
           AND EXISTS (
             SELECT 1 FROM edition_verse_mappings m
             JOIN translation_text t
               ON t.translation_code = m.translation_code
              AND t.verse_id = m.local_verse_id
             WHERE m.translation_code = ?1 AND m.canonical_verse_id = v.id
           )
         ORDER BY v.id
         LIMIT ?4",
    )?;
    let rows = stmt.query_map(
        rusqlite::params![translation_code, start_verse_id, end_verse_id, limit],
        |row| {
            Ok(Verse {
                verse_id: row.get(0)?,
                book_name: row.get(1)?,
                chapter: row.get(2)?,
                verse: row.get(3)?,
                text: row.get(4)?,
            })
        },
    )?;
    rows.collect()
}

/// Conservative cleanup of a user search string so FTS5's MATCH parser does not
/// choke on stray punctuation. Each alphanumeric token is quoted, while an
/// existing OR between tokens is preserved for Council retrieval queries.
/// Empty output means "no searchable tokens".
fn sanitise_fts_query(q: &str) -> String {
    let mut output = Vec::new();
    let mut pending_or = false;

    for raw in q.split_whitespace() {
        if raw.eq_ignore_ascii_case("OR") && !output.is_empty() {
            pending_or = true;
            continue;
        }
        for token in raw.split(|c: char| !c.is_alphanumeric()) {
            if token.chars().count() < 2 {
                continue;
            }
            if pending_or && !matches!(output.last().map(String::as_str), Some("OR")) {
                output.push("OR".to_string());
            }
            pending_or = false;
            output.push(format!("\"{}\"", token.replace('"', "\"\"")));
        }
    }

    output.join(" ")
}

#[cfg(test)]
mod fts_query_tests {
    use super::{
        corpus_diagnostics, sanitise_fts_query, search, semantic_search, VerseSearchScope,
    };
    use rusqlite::Connection;

    #[test]
    fn sanitise_fts_query_quotes_punctuation_fragments() {
        assert_eq!(
            sanitise_fts_query("king's God-man"),
            "\"king\" \"God\" \"man\""
        );
    }

    #[test]
    fn sanitise_fts_query_preserves_or_between_terms() {
        assert_eq!(
            sanitise_fts_query("faith OR works"),
            "\"faith\" OR \"works\""
        );
    }

    #[test]
    fn sanitised_fts_query_handles_apostrophes_and_hyphens() {
        let conn = Connection::open_in_memory().expect("create sqlite");
        conn.execute_batch(
            "CREATE VIRTUAL TABLE docs USING fts5(text);
             INSERT INTO docs(text) VALUES ('the king and the God man');",
        )
        .expect("seed fts");
        let query = sanitise_fts_query("king's God-man");
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM docs WHERE docs MATCH ?",
                [query],
                |row| row.get(0),
            )
            .expect("run fts query");
        assert_eq!(count, 1);
    }

    #[test]
    fn corpus_diagnostics_reports_exact_coverage_and_detects_index_drift() {
        let conn = Connection::open_in_memory().expect("create sqlite");
        conn.execute_batch(
            "CREATE TABLE translations(code TEXT PRIMARY KEY, name TEXT, kind TEXT);
             CREATE TABLE verses(id INTEGER PRIMARY KEY);
             CREATE TABLE translation_text(translation_code TEXT, verse_id INTEGER, text TEXT);
             CREATE VIRTUAL TABLE translation_text_fts USING fts5(verse_id UNINDEXED, translation_code UNINDEXED, text);
             CREATE TABLE edition_verse_mappings(translation_code TEXT, local_verse_id INTEGER, canonical_verse_id INTEGER);
             CREATE TABLE verse_embeddings(translation_code TEXT, verse_id INTEGER, embedding BLOB);
             CREATE TABLE embedding_builds(
               translation_code TEXT, model TEXT, model_digest TEXT,
               embedding_count INTEGER, generated_at TEXT
             );
             INSERT INTO translations VALUES ('KJV', 'King James Version', 'translation');
             INSERT INTO verses VALUES (1001001);
             INSERT INTO translation_text VALUES ('KJV', 1001001, 'In the beginning');
             INSERT INTO translation_text_fts VALUES (1001001, 'KJV', 'In the beginning');
             INSERT INTO edition_verse_mappings VALUES ('KJV', 1001001, 1001001);
             INSERT INTO verse_embeddings VALUES ('KJV', 1001001, X'00000000');
             INSERT INTO embedding_builds VALUES ('KJV', 'test-model', 'abc123', 1, '2026-07-14');",
        )
        .expect("seed diagnostic schema");

        let diagnostics = corpus_diagnostics(&conn).expect("read diagnostics");
        assert!(diagnostics.ok, "{:?}", diagnostics.issues);
        assert_eq!(diagnostics.canonical_verse_count, 1);
        assert_eq!(diagnostics.translation_text_count, 1);
        assert_eq!(diagnostics.mapping_count, 1);
        assert_eq!(diagnostics.fts_count, 1);
        assert_eq!(diagnostics.embedding_count, 1);
        assert_eq!(diagnostics.translations.len(), 1);
        assert_eq!(diagnostics.translations[0].embedding_count, 1);
        assert_eq!(diagnostics.embedding_builds[0].model_digest, "abc123");

        conn.execute("DELETE FROM translation_text_fts", [])
            .expect("create index drift");
        let drifted = corpus_diagnostics(&conn).expect("read drifted diagnostics");
        assert!(!drifted.ok);
        assert!(drifted
            .issues
            .iter()
            .any(|issue| issue.contains("search index")));
    }

    #[test]
    fn search_applies_verse_window_before_limit() {
        let conn = Connection::open_in_memory().expect("create sqlite");
        conn.execute_batch(
            "CREATE TABLE books(id INTEGER PRIMARY KEY, osis_code TEXT, name TEXT, testament TEXT, chapter_count INTEGER);
             CREATE TABLE verses(id INTEGER PRIMARY KEY, book_id INTEGER, chapter INTEGER, verse INTEGER);
             CREATE TABLE edition_verse_mappings(translation_code TEXT, local_verse_id INTEGER, canonical_verse_id INTEGER);
             CREATE VIRTUAL TABLE translation_text_fts USING fts5(verse_id UNINDEXED, translation_code UNINDEXED, text);
             INSERT INTO books(id, osis_code, name, testament, chapter_count) VALUES
               (1, 'GEN', 'Genesis', 'OT', 50),
               (43, 'JHN', 'John', 'NT', 21);
             INSERT INTO verses(id, book_id, chapter, verse) VALUES
               (1001001, 1, 1, 1),
               (43003016, 43, 3, 16);
             INSERT INTO edition_verse_mappings(translation_code, local_verse_id, canonical_verse_id) VALUES
               ('KJV', 1001001, 1001001),
               ('KJV', 43003016, 43003016);
             INSERT INTO translation_text_fts(verse_id, translation_code, text) VALUES
               (1001001, 'KJV', 'love love love'),
               (43003016, 'KJV', 'love');",
        )
        .expect("seed search schema");

        let hits = search(
            &conn,
            "love",
            Some("KJV"),
            1,
            VerseSearchScope {
                start_verse_id: Some(43_003_016),
                end_verse_id: Some(43_003_016),
                ..VerseSearchScope::default()
            },
        )
        .expect("search with verse window");

        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].verse_id, 43_003_016);
    }

    #[test]
    fn semantic_search_applies_verse_window_before_limit() {
        let conn = Connection::open_in_memory().expect("create sqlite");
        conn.execute_batch(
            "CREATE TABLE books(id INTEGER PRIMARY KEY, osis_code TEXT, name TEXT, testament TEXT, chapter_count INTEGER);
             CREATE TABLE verses(id INTEGER PRIMARY KEY, book_id INTEGER, chapter INTEGER, verse INTEGER);
             CREATE TABLE edition_verse_mappings(translation_code TEXT, local_verse_id INTEGER, canonical_verse_id INTEGER);
             CREATE TABLE translation_text(verse_id INTEGER, translation_code TEXT, text TEXT);
             CREATE TABLE verse_embeddings(verse_id INTEGER, translation_code TEXT, model TEXT, dim INTEGER, embedding BLOB);
             INSERT INTO books(id, osis_code, name, testament, chapter_count) VALUES
               (1, 'GEN', 'Genesis', 'OT', 50),
               (43, 'JHN', 'John', 'NT', 21);
             INSERT INTO verses(id, book_id, chapter, verse) VALUES
               (1001001, 1, 1, 1),
               (43003016, 43, 3, 16);
             INSERT INTO edition_verse_mappings(translation_code, local_verse_id, canonical_verse_id) VALUES
               ('KJV', 1001001, 1001001),
               ('KJV', 43003016, 43003016);
             INSERT INTO translation_text(verse_id, translation_code, text) VALUES
               (1001001, 'KJV', 'outside'),
               (43003016, 'KJV', 'inside');",
        )
        .expect("seed semantic schema");
        let outside = [1.0f32, 0.0]
            .into_iter()
            .flat_map(f32::to_le_bytes)
            .collect::<Vec<_>>();
        let inside = [0.5f32, 0.5]
            .into_iter()
            .flat_map(f32::to_le_bytes)
            .collect::<Vec<_>>();
        conn.execute(
            "INSERT INTO verse_embeddings(verse_id, translation_code, model, dim, embedding)
             VALUES (1001001, 'KJV', 'test-model', 2, ?1)",
            rusqlite::params![outside],
        )
        .expect("insert outside embedding");
        conn.execute(
            "INSERT INTO verse_embeddings(verse_id, translation_code, model, dim, embedding)
             VALUES (43003016, 'KJV', 'test-model', 2, ?1)",
            rusqlite::params![inside],
        )
        .expect("insert inside embedding");

        let hits = semantic_search(
            &conn,
            &[1.0, 0.0],
            "KJV",
            "test-model",
            1,
            VerseSearchScope {
                start_verse_id: Some(43_003_016),
                end_verse_id: Some(43_003_016),
                ..VerseSearchScope::default()
            },
        )
        .expect("semantic search with verse window");

        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].verse_id, 43_003_016);
    }
}

pub fn search(
    conn: &Connection,
    query: &str,
    translation_code: Option<&str>,
    limit: i64,
    scope: VerseSearchScope<'_>,
) -> SqlResult<Vec<SearchHit>> {
    let cleaned = sanitise_fts_query(query);
    if cleaned.is_empty() {
        return Ok(Vec::new());
    }

    let mut sql = String::from(
        "SELECT COALESCE(m.canonical_verse_id, fts.verse_id),
                fts.translation_code, v.book_id, b.name, b.osis_code,
                v.chapter, v.verse, fts.text,
                snippet(translation_text_fts, 2, '<mark>', '</mark>', '…', 12)
         FROM translation_text_fts fts
         LEFT JOIN (
           SELECT translation_code, local_verse_id, MIN(canonical_verse_id) AS canonical_verse_id
           FROM edition_verse_mappings
           GROUP BY translation_code, local_verse_id
         ) m ON m.translation_code = fts.translation_code AND m.local_verse_id = fts.verse_id
         JOIN verses v ON v.id = COALESCE(m.canonical_verse_id, fts.verse_id)
         JOIN books b ON b.id = v.book_id
         WHERE fts.text MATCH ?",
    );
    let mut params = vec![Value::Text(cleaned)];
    if let Some(code) = translation_code {
        sql.push_str(" AND fts.translation_code = ?");
        params.push(Value::Text(code.to_string()));
    }
    if let Some(id) = scope.book_id {
        sql.push_str(" AND v.book_id = ?");
        params.push(Value::Integer(id));
    }
    if let Some(t) = scope.testament.filter(|t| matches!(*t, "OT" | "NT" | "DC")) {
        sql.push_str(" AND b.testament = ?");
        params.push(Value::Text(t.to_string()));
    }
    if let Some(start) = scope.start_verse_id {
        sql.push_str(" AND COALESCE(m.canonical_verse_id, fts.verse_id) >= ?");
        params.push(Value::Integer(start));
    }
    if let Some(end) = scope.end_verse_id {
        sql.push_str(" AND COALESCE(m.canonical_verse_id, fts.verse_id) <= ?");
        params.push(Value::Integer(end));
    }
    sql.push_str(" ORDER BY rank LIMIT ?");
    params.push(Value::Integer(limit));

    let mut stmt = conn.prepare(&sql)?;
    let map = |row: &rusqlite::Row| {
        Ok(SearchHit {
            verse_id: row.get(0)?,
            translation_code: row.get(1)?,
            book_id: row.get(2)?,
            book_name: row.get(3)?,
            book_osis: row.get(4)?,
            chapter: row.get(5)?,
            verse: row.get(6)?,
            text: row.get(7)?,
            snippet: row.get(8)?,
        })
    };
    let rows = stmt
        .query_map(rusqlite::params_from_iter(params.iter()), map)?
        .collect();
    rows
}

/// All word tokens for a chapter in a given Strong's-tagged translation.
/// Returns rows ordered by verse_id then position.
pub fn get_word_tokens(
    conn: &Connection,
    translation_code: &str,
    book_id: i64,
    chapter: i64,
) -> SqlResult<Vec<WordToken>> {
    let lo = book_id * 1_000_000 + chapter * 1_000;
    let hi = lo + 1_000;
    let mut stmt = conn.prepare(
        "SELECT m.canonical_verse_id, wt.position, wt.surface, wt.lemma, wt.strongs, wt.morph
         FROM word_tokens wt
         JOIN edition_verse_mappings m
           ON m.translation_code = wt.translation_code AND m.local_verse_id = wt.verse_id
         WHERE wt.translation_code = ?1
           AND m.canonical_verse_id >= ?2 AND m.canonical_verse_id < ?3
         ORDER BY m.canonical_verse_id, wt.position",
    )?;
    let rows = stmt.query_map(rusqlite::params![translation_code, lo, hi], |row| {
        Ok(WordToken {
            verse_id: row.get(0)?,
            position: row.get(1)?,
            surface: row.get(2)?,
            lemma: row.get(3)?,
            strongs: row.get(4)?,
            morph: row.get(5)?,
        })
    })?;
    rows.collect()
}

/// Look up Strong's lexicon entries by their codes (e.g. "H7225"). Codes
/// not in the table are silently skipped — caller compares lengths to
/// detect a partial result.
pub fn get_strongs(conn: &Connection, codes: &[String]) -> SqlResult<Vec<StrongsEntry>> {
    if codes.is_empty() {
        return Ok(Vec::new());
    }
    let placeholders = vec!["?"; codes.len()].join(",");
    let sql = format!(
        "SELECT code, lemma, translit, gloss, definition FROM strongs WHERE code IN ({placeholders})"
    );
    let mut stmt = conn.prepare(&sql)?;
    let params: Vec<&dyn rusqlite::ToSql> =
        codes.iter().map(|c| c as &dyn rusqlite::ToSql).collect();
    let rows = stmt.query_map(rusqlite::params_from_iter(params.iter()), |row| {
        Ok(StrongsEntry {
            code: row.get(0)?,
            lemma: row.get(1)?,
            translit: row.get(2)?,
            gloss: row.get(3)?,
            definition: row.get(4)?,
        })
    })?;
    rows.collect()
}

/// Occurrences of a Strong's code across tagged translations.
///
/// Matches `wt.strongs` exactly. Codes are stored unpadded (`H1`, `H10`,
/// `H100`…) and one per token, so a `LIKE '%code%'` substring match would
/// pull in every code that merely starts with the query (`H1` → `H10`,
/// `H100`, `H1000`, …).
pub fn get_strongs_occurrences(
    conn: &Connection,
    code: &str,
    limit: i64,
) -> SqlResult<Vec<StrongsOccurrence>> {
    let mut stmt = conn.prepare(
        "SELECT wt.translation_code, COALESCE(m.canonical_verse_id, wt.verse_id),
                wt.surface, wt.lemma, wt.morph,
                v.book_id, b.name, b.osis_code, v.chapter, v.verse, tt.text
         FROM word_tokens wt
         LEFT JOIN (
           SELECT translation_code, local_verse_id, MIN(canonical_verse_id) AS canonical_verse_id
           FROM edition_verse_mappings
           GROUP BY translation_code, local_verse_id
         ) m ON m.translation_code = wt.translation_code AND m.local_verse_id = wt.verse_id
         JOIN verses v ON v.id = COALESCE(m.canonical_verse_id, wt.verse_id)
         JOIN books b ON b.id = v.book_id
         JOIN translation_text tt
           ON tt.verse_id = wt.verse_id AND tt.translation_code = wt.translation_code
         WHERE wt.strongs = ?1
         ORDER BY v.id, wt.position
         LIMIT ?2",
    )?;
    let rows = stmt.query_map(rusqlite::params![code, limit], |row| {
        Ok(StrongsOccurrence {
            translation_code: row.get(0)?,
            verse_id: row.get(1)?,
            surface: row.get(2)?,
            lemma: row.get(3)?,
            morph: row.get(4)?,
            book_id: row.get(5)?,
            book_name: row.get(6)?,
            book_osis: row.get(7)?,
            chapter: row.get(8)?,
            verse: row.get(9)?,
            text: row.get(10)?,
        })
    })?;
    rows.collect()
}

/// Cross-references for a given verse. We always render text in a fallback
/// translation (typically KJV) because cross-refs are inherently cross-canon
/// — pulling from the user's active translation means missing text whenever
/// the active translation doesn't contain that verse (e.g. WLC + NT refs).
pub fn get_cross_refs(
    conn: &Connection,
    verse_id: i64,
    text_translation: &str,
    limit: i64,
) -> SqlResult<Vec<CrossRef>> {
    let mut stmt = conn.prepare(
        "SELECT cr.from_verse_id, cr.to_verse_id, v.book_id, b.name, b.osis_code,
                v.chapter, v.verse, COALESCE(t.text, ''), cr.source, cr.weight
         FROM cross_refs cr
         JOIN verses v ON v.id = cr.to_verse_id
         JOIN books b ON b.id = v.book_id
         LEFT JOIN translation_text t
           ON t.verse_id = cr.to_verse_id AND t.translation_code = ?2
         WHERE cr.from_verse_id = ?1
         ORDER BY cr.weight DESC NULLS LAST
         LIMIT ?3",
    )?;
    let rows = stmt.query_map(
        rusqlite::params![verse_id, text_translation, limit],
        |row| {
            Ok(CrossRef {
                from_verse_id: row.get(0)?,
                to_verse_id: row.get(1)?,
                book_id: row.get(2)?,
                book_name: row.get(3)?,
                book_osis: row.get(4)?,
                chapter: row.get(5)?,
                verse: row.get(6)?,
                text: row.get(7)?,
                source: row.get(8)?,
                weight: row.get(9)?,
            })
        },
    )?;
    rows.collect()
}

/// Cosine similarity over raw little-endian f32 BLOBs. Both slices must be
/// the same length; caller guarantees that via the `dim` column.
fn cosine(a: &[f32], b: &[f32]) -> f32 {
    debug_assert_eq!(a.len(), b.len());
    let mut dot = 0f32;
    let mut na = 0f32;
    let mut nb = 0f32;
    for i in 0..a.len() {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    if na == 0.0 || nb == 0.0 {
        0.0
    } else {
        dot / (na.sqrt() * nb.sqrt())
    }
}

fn blob_to_f32s(blob: &[u8]) -> Vec<f32> {
    let n = blob.len() / 4;
    let mut out = Vec::with_capacity(n);
    for chunk in blob.chunks_exact(4) {
        out.push(f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]));
    }
    out
}

/// Semantic similarity search across a single translation's embeddings.
/// Linear scan — fine for ~31k verses. Returns hits ordered by descending
/// similarity, limited to `limit`.
pub fn semantic_search(
    conn: &Connection,
    query_embedding: &[f32],
    translation_code: &str,
    model: &str,
    limit: usize,
    scope: VerseSearchScope<'_>,
) -> SqlResult<Vec<SemanticHit>> {
    let mut sql = String::from(
        "SELECT COALESCE(m.canonical_verse_id, e.verse_id), e.embedding,
                v.book_id, b.name, b.osis_code,
                v.chapter, v.verse, t.text
         FROM verse_embeddings e
         LEFT JOIN (
           SELECT translation_code, local_verse_id, MIN(canonical_verse_id) AS canonical_verse_id
           FROM edition_verse_mappings
           GROUP BY translation_code, local_verse_id
         ) m ON m.translation_code = e.translation_code AND m.local_verse_id = e.verse_id
         JOIN verses v ON v.id = COALESCE(m.canonical_verse_id, e.verse_id)
         JOIN books b ON b.id = v.book_id
         JOIN translation_text t
           ON t.verse_id = e.verse_id AND t.translation_code = e.translation_code
         WHERE e.translation_code = ? AND e.model = ?",
    );
    let mut params = vec![
        Value::Text(translation_code.to_string()),
        Value::Text(model.to_string()),
    ];
    if let Some(id) = scope.book_id {
        sql.push_str(" AND v.book_id = ?");
        params.push(Value::Integer(id));
    }
    if let Some(t) = scope.testament.filter(|t| matches!(*t, "OT" | "NT" | "DC")) {
        sql.push_str(" AND b.testament = ?");
        params.push(Value::Text(t.to_string()));
    }
    if let Some(start) = scope.start_verse_id {
        sql.push_str(" AND COALESCE(m.canonical_verse_id, e.verse_id) >= ?");
        params.push(Value::Integer(start));
    }
    if let Some(end) = scope.end_verse_id {
        sql.push_str(" AND COALESCE(m.canonical_verse_id, e.verse_id) <= ?");
        params.push(Value::Integer(end));
    }
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(rusqlite::params_from_iter(params.iter()), |row| {
        let verse_id: i64 = row.get(0)?;
        let blob: Vec<u8> = row.get(1)?;
        let book_id: i64 = row.get(2)?;
        let book_name: String = row.get(3)?;
        let book_osis: String = row.get(4)?;
        let chapter: i64 = row.get(5)?;
        let verse: i64 = row.get(6)?;
        let text: String = row.get(7)?;
        Ok((
            verse_id, blob, book_id, book_name, book_osis, chapter, verse, text,
        ))
    })?;

    let mut scored: Vec<(f32, SemanticHit)> = Vec::new();
    for row in rows {
        let (verse_id, blob, book_id, book_name, book_osis, chapter, verse, text) = row?;
        let emb = blob_to_f32s(&blob);
        if emb.len() != query_embedding.len() {
            continue;
        }
        let score = cosine(query_embedding, &emb);
        scored.push((
            score,
            SemanticHit {
                verse_id,
                translation_code: translation_code.to_string(),
                book_id,
                book_name,
                book_osis,
                chapter,
                verse,
                text,
                score,
            },
        ));
    }
    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    scored.truncate(limit);
    Ok(scored.into_iter().map(|(_, h)| h).collect())
}
