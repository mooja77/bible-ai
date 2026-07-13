# Reproducible Corpus Build

The release corpus is produced by one resumable command:

```powershell
python scripts/build_corpus.py
```

The build has four trust boundaries:

1. `fetch_corpus_sources.py` downloads only versions named in
   `data/corpus-lock.json`, verifies byte counts and SHA-256 values in a
   temporary location, and promotes inputs to the cache only after verification.
2. Every ingest script writes to a separate `.building` database selected via
   `BIBLE_AI_CORPUS_DB`. Completed steps are checkpointed by a fingerprint of
   the lock, schema, ingestion code, and embedding identity.
3. Embedding steps record the Ollama model digest/version, generator version,
   platform identity, progress, and an ordered aggregate checksum. A resume
   cannot silently mix model or platform identities.
4. `verify_corpus.py`, SQLite `quick_check`, optimization, and compaction finish
   before `os.replace` atomically promotes the database to its output path.

Useful modes:

```powershell
# Inspect every command without changing data
python scripts/build_corpus.py --plan

# Build only from the already verified local cache
python scripts/build_corpus.py --offline

# Resume is automatic; intentionally discard only the build temp/state files
python scripts/build_corpus.py --restart

# Produce a separately named candidate corpus
python scripts/build_corpus.py --output data/corpus-candidate.sqlite
```

Do not publish a corpus solely because the mechanical build passes. The corpus
lock proves artifact identity, not redistribution rights. The named content
review gate remains mandatory for every release territory.
