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
pub struct Verse {
    pub verse_id: i64,
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

pub fn get_chapter(
    conn: &Connection,
    translation_code: &str,
    book_id: i64,
    chapter: i64,
) -> SqlResult<Vec<Verse>> {
    let mut stmt = conn.prepare(
        "SELECT v.id, v.chapter, v.verse, t.text
         FROM verses v
         JOIN translation_text t ON t.verse_id = v.id
         WHERE t.translation_code = ?1 AND v.book_id = ?2 AND v.chapter = ?3
         ORDER BY v.verse",
    )?;
    let rows = stmt.query_map(
        rusqlite::params![translation_code, book_id, chapter],
        |row| {
            Ok(Verse {
                verse_id: row.get(0)?,
                chapter: row.get(1)?,
                verse: row.get(2)?,
                text: row.get(3)?,
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
        "SELECT v.id, v.chapter, v.verse, t.text
         FROM verses v
         JOIN translation_text t ON t.verse_id = v.id
         WHERE t.translation_code = ?1 AND v.id >= ?2 AND v.id <= ?3
         ORDER BY v.id
         LIMIT ?4",
    )?;
    let rows = stmt.query_map(
        rusqlite::params![translation_code, start_verse_id, end_verse_id, limit],
        |row| {
            Ok(Verse {
                verse_id: row.get(0)?,
                chapter: row.get(1)?,
                verse: row.get(2)?,
                text: row.get(3)?,
            })
        },
    )?;
    rows.collect()
}

/// Conservative cleanup of a user search string so FTS5's MATCH parser does not
/// choke on stray punctuation. Keeps letters, digits, apostrophes and hyphens;
/// everything else becomes a space. Empty output means "no searchable tokens".
fn sanitise_fts_query(q: &str) -> String {
    q.split_whitespace()
        .filter_map(|w| {
            let cleaned: String = w
                .chars()
                .filter(|c| c.is_alphanumeric() || matches!(c, '\'' | '-'))
                .collect();
            if cleaned.is_empty() {
                None
            } else {
                Some(cleaned)
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn search(
    conn: &Connection,
    query: &str,
    translation_code: Option<&str>,
    limit: i64,
    book_id: Option<i64>,
    testament: Option<&str>,
) -> SqlResult<Vec<SearchHit>> {
    let cleaned = sanitise_fts_query(query);
    if cleaned.is_empty() {
        return Ok(Vec::new());
    }

    let mut sql = String::from(
        "SELECT fts.verse_id, fts.translation_code, v.book_id, b.name, b.osis_code,
                v.chapter, v.verse, fts.text,
                snippet(translation_text_fts, 2, '<mark>', '</mark>', '…', 12)
         FROM translation_text_fts fts
         JOIN verses v ON v.id = fts.verse_id
         JOIN books b ON b.id = v.book_id
         WHERE fts.text MATCH ?",
    );
    let mut params = vec![Value::Text(cleaned)];
    if let Some(code) = translation_code {
        sql.push_str(" AND fts.translation_code = ?");
        params.push(Value::Text(code.to_string()));
    }
    if let Some(id) = book_id {
        sql.push_str(" AND v.book_id = ?");
        params.push(Value::Integer(id));
    }
    if let Some(t) = testament.filter(|t| matches!(*t, "OT" | "NT" | "DC")) {
        sql.push_str(" AND b.testament = ?");
        params.push(Value::Text(t.to_string()));
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
        "SELECT verse_id, position, surface, lemma, strongs, morph
         FROM word_tokens
         WHERE translation_code = ?1 AND verse_id >= ?2 AND verse_id < ?3
         ORDER BY verse_id, position",
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

pub fn get_strongs_occurrences(
    conn: &Connection,
    code: &str,
    limit: i64,
) -> SqlResult<Vec<StrongsOccurrence>> {
    let mut stmt = conn.prepare(
        "SELECT wt.translation_code, wt.verse_id, wt.surface, wt.lemma, wt.morph,
                v.book_id, b.name, b.osis_code, v.chapter, v.verse, tt.text
         FROM word_tokens wt
         JOIN verses v ON v.id = wt.verse_id
         JOIN books b ON b.id = v.book_id
         JOIN translation_text tt
           ON tt.verse_id = wt.verse_id AND tt.translation_code = wt.translation_code
         WHERE wt.strongs LIKE '%' || ?1 || '%'
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
) -> SqlResult<Vec<SemanticHit>> {
    let mut stmt = conn.prepare(
        "SELECT e.verse_id, e.embedding, v.book_id, b.name, b.osis_code,
                v.chapter, v.verse, t.text
         FROM verse_embeddings e
         JOIN verses v ON v.id = e.verse_id
         JOIN books b ON b.id = v.book_id
         JOIN translation_text t
           ON t.verse_id = e.verse_id AND t.translation_code = e.translation_code
         WHERE e.translation_code = ?1 AND e.model = ?2",
    )?;
    let rows = stmt.query_map(rusqlite::params![translation_code, model], |row| {
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
