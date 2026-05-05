import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import {
  getChapter,
  getAppSettings,
  getVerseRange,
  getWordTokens,
  createSavedSearch,
  listBookmarks,
  listBooks,
  listHighlightsForChapter,
  listNotesForChapter,
  listRangeHighlightsForChapter,
  listRangeNotesForChapter,
  listReadingHistory,
  listSavedSearches,
  listStudyWorkspaces,
  listTranslations,
  recordReadingLocation,
  search as runSearch,
  saveAppSettings,
  deleteSavedSearch,
  type AppSettings,
  type Bookmark,
  type Book,
  type Highlight,
  type RangeHighlight,
  type RangeNote,
  type ReadingHistoryItem,
  type SavedSearch,
  type SearchHit,
  type CouncilResponse,
  type StudyWorkspaceSummary,
  type Translation,
  type Verse,
  type WordToken,
  updateSavedSearchTitle,
} from "./lib/bible";
import { BookList } from "./features/reader/BookList";
import { ChapterGrid } from "./features/reader/ChapterGrid";
import { ChapterReader, RangeActionBar } from "./features/reader/ChapterReader";
import { TranslationPicker } from "./features/reader/TranslationPicker";
import { SearchInput } from "./features/search/SearchInput";
import { SearchResults } from "./features/search/SearchResults";
import { CouncilPanel } from "./features/council/CouncilPanel";
import { StrongsPopup } from "./features/reader/StrongsPopup";
import { SettingsPanel } from "./features/settings/SettingsPanel";
import { WorkspacesPanel } from "./features/workspaces/WorkspacesPanel";

// Translations that have Strong's-tagged word tokens ingested.
const TAGGED_TRANSLATIONS = new Set(["WLC"]);

type Mode = "reader" | "council" | "workspaces" | "settings";
type SearchTestamentFilter = "all" | "OT" | "NT";
type ReaderLayout = "columns" | "interleaved";
type ReaderDensity = "comfortable" | "compact";
type CommandItem = {
  id: string;
  label: string;
  detail: string;
  run: () => void;
};

function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [activeTranslations, setActiveTranslations] = useState<string[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [chapterData, setChapterData] = useState<Record<string, Verse[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [scrollTarget, setScrollTarget] = useState<number | null>(null);
  const [referenceRangeTarget, setReferenceRangeTarget] = useState<{
    startVerseId: number;
    endVerseId: number;
    requestId: number;
  } | null>(null);
  const [referenceRangePanel, setReferenceRangePanel] = useState<{
    citation: string;
    translationCode: string;
    verses: Verse[];
  } | null>(null);
  const [referenceInput, setReferenceInput] = useState("");
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [searchFilterTranslation, setSearchFilterTranslation] = useState("active");
  const [searchFilterTestament, setSearchFilterTestament] =
    useState<SearchTestamentFilter>("all");
  const [searchFilterBookId, setSearchFilterBookId] = useState(0);

  const [mode, setMode] = useState<Mode>("reader");
  const [settings, setSettings] = useState<AppSettings>({});
  const [fontScale, setFontScale] = useState(1);
  const [readerLayout, setReaderLayout] = useState<ReaderLayout>("columns");
  const [readerDensity, setReaderDensity] = useState<ReaderDensity>("comfortable");
  const [syncScroll, setSyncScroll] = useState(true);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [readingHistory, setReadingHistory] = useState<ReadingHistoryItem[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [workspaceShortcuts, setWorkspaceShortcuts] = useState<StudyWorkspaceSummary[]>([]);
  const [workspaceFocusId, setWorkspaceFocusId] = useState<number | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState("");

  // Per-chapter user data (highlights + which verses have notes).
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [rangeHighlights, setRangeHighlights] = useState<RangeHighlight[]>([]);
  const [notedVerseIds, setNotedVerseIds] = useState<number[]>([]);
  const [rangeNotes, setRangeNotes] = useState<RangeNote[]>([]);

  // Optional preset question handed to CouncilPanel when user clicks
  // "Ask the Council about this verse" from the reader.
  const [pendingCouncilQuestion, setPendingCouncilQuestion] = useState<string | null>(null);
  const [workspaceCouncilResult, setWorkspaceCouncilResult] = useState<{
    question: string;
    response: CouncilResponse;
  } | null>(null);

  // Word tokens (Strong's-tagged) per translation per chapter, and the word
  // currently selected for the Strong's popup.
  const [wordTokensByTranslation, setWordTokensByTranslation] = useState<
    Map<string, Map<number, WordToken[]>>
  >(new Map());
  const [selectedWord, setSelectedWord] = useState<WordToken | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [bs, ts, savedSettings] = await Promise.all([
          listBooks(),
          listTranslations(),
          getAppSettings().catch(() => ({} as AppSettings)),
        ]);
        setBooks(bs);
        setTranslations(ts);
        setSettings(savedSettings);
        setFontScale(savedSettings.font_scale ?? 1);
        setReaderLayout(savedSettings.reader_layout ?? "columns");
        setReaderDensity(savedSettings.reader_density ?? "comfortable");
        setSyncScroll(savedSettings.sync_scroll ?? true);
        const savedActive = (savedSettings.active_translations ?? "")
          .split(",")
          .map((x) => x.trim())
          .filter((code) => ts.some((t) => t.code === code));
        const defaultActive = savedActive.length
          ? savedActive
          : [ts.find((t) => t.code === "KJV")?.code ?? ts[0]?.code].filter(Boolean);
        setActiveTranslations(defaultActive as string[]);
        const genesis = bs.find((b) => b.osis_code === "Gen") ?? bs[0];
        if (genesis) {
          setSelectedBook(genesis);
          setSelectedChapter(1);
        }
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  const refreshNavigationLists = useCallback(async () => {
    const [b, h, s, w] = await Promise.all([
      listBookmarks().catch(() => [] as Bookmark[]),
      listReadingHistory(8).catch(() => [] as ReadingHistoryItem[]),
      listSavedSearches().catch(() => [] as SavedSearch[]),
      listStudyWorkspaces().catch(() => [] as StudyWorkspaceSummary[]),
    ]);
    setBookmarks(b);
    setReadingHistory(h);
    setSavedSearches(s);
    setWorkspaceShortcuts(w);
  }, []);

  useEffect(() => {
    void refreshNavigationLists();
  }, [refreshNavigationLists]);

  useEffect(() => {
    if (!selectedBook || !selectedChapter || activeTranslations.length === 0) return;
    const timer = window.setTimeout(() => {
      recordReadingLocation(
        selectedBook.id,
        selectedChapter,
        activeTranslations.join(","),
      )
        .then(refreshNavigationLists)
        .catch(() => undefined);
    }, 800);
    return () => window.clearTimeout(timer);
  }, [activeTranslations, refreshNavigationLists, selectedBook, selectedChapter]);

  const saveSettingsPatch = useCallback((patch: AppSettings) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void saveAppSettings(next).catch((e) => setError(String(e)));
      return next;
    });
  }, []);

  useEffect(() => {
    if (!selectedBook || !selectedChapter || activeTranslations.length === 0) {
      setChapterData({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all(
      activeTranslations.map((code) =>
        getChapter(code, selectedBook.id, selectedChapter).then(
          (verses) => [code, verses] as const,
        ),
      ),
    )
      .then((entries) => {
        if (!cancelled) setChapterData(Object.fromEntries(entries));
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTranslations, selectedBook, selectedChapter]);

  const searchTimer = useRef<number | null>(null);
  useEffect(() => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const primary =
      searchFilterTranslation === "all"
        ? null
        : searchFilterTranslation === "active"
          ? (activeTranslations[0] ?? null)
          : searchFilterTranslation;
    searchTimer.current = window.setTimeout(() => {
      runSearch(
        trimmed,
        primary,
        60,
        searchFilterBookId || null,
        searchFilterTestament === "all" ? null : searchFilterTestament,
      )
        .then((hits) => setSearchResults(hits))
        .catch((e) => setError(String(e)))
        .finally(() => setSearchLoading(false));
    }, 250);
    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
  }, [
    searchQuery,
    activeTranslations,
    searchFilterTranslation,
    searchFilterBookId,
    searchFilterTestament,
  ]);

  // Refetch user data (highlights + notes) for the active chapter.
  const refetchUserData = useCallback(() => {
    if (!selectedBook || !selectedChapter) {
      setHighlights([]);
      setRangeHighlights([]);
      setNotedVerseIds([]);
      setRangeNotes([]);
      return;
    }
    const bookId = selectedBook.id;
    const chapter = selectedChapter;
    Promise.all([
      listHighlightsForChapter(bookId, chapter).catch(() => [] as Highlight[]),
      listRangeHighlightsForChapter(bookId, chapter).catch(() => [] as RangeHighlight[]),
      listNotesForChapter(bookId, chapter).catch(() => []),
      listRangeNotesForChapter(bookId, chapter).catch(() => [] as RangeNote[]),
    ]).then(([h, rh, n, rn]) => {
      setHighlights(h);
      setRangeHighlights(rh);
      setNotedVerseIds(n.map((x) => x.verse_id));
      setRangeNotes(rn);
    });
  }, [selectedBook, selectedChapter]);

  useEffect(() => {
    refetchUserData();
  }, [refetchUserData]);

  const refreshUserDataAndNavigation = useCallback(() => {
    refetchUserData();
    refreshNavigationLists();
  }, [refetchUserData, refreshNavigationLists]);

  // Fetch word tokens for any active translation that has Strong's tagging.
  useEffect(() => {
    if (!selectedBook || !selectedChapter) {
      setWordTokensByTranslation(new Map());
      return;
    }
    const tagged = activeTranslations.filter((c) => TAGGED_TRANSLATIONS.has(c));
    if (tagged.length === 0) {
      setWordTokensByTranslation(new Map());
      return;
    }
    let cancelled = false;
    Promise.all(
      tagged.map((code) =>
        getWordTokens(code, selectedBook.id, selectedChapter)
          .then((tokens) => [code, tokens] as const)
          .catch(() => [code, []] as const),
      ),
    ).then((entries) => {
      if (cancelled) return;
      const next = new Map<string, Map<number, WordToken[]>>();
      for (const [code, tokens] of entries) {
        const byVerse = new Map<number, WordToken[]>();
        for (const t of tokens) {
          const arr = byVerse.get(t.verse_id);
          if (arr) arr.push(t);
          else byVerse.set(t.verse_id, [t]);
        }
        next.set(code, byVerse);
      }
      setWordTokensByTranslation(next);
    });
    return () => {
      cancelled = true;
    };
  }, [activeTranslations, selectedBook, selectedChapter]);

  useEffect(() => {
    if (!scrollTarget || loading || mode !== "reader") return;
    const el = document.getElementById(`v-${scrollTarget}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("verse-flash");
    const timer = window.setTimeout(() => el.classList.remove("verse-flash"), 1800);
    setScrollTarget(null);
    return () => window.clearTimeout(timer);
  }, [chapterData, loading, scrollTarget, mode]);

  const orderedActive = useMemo(
    () =>
      activeTranslations
        .map((code) => translations.find((t) => t.code === code))
        .filter((t): t is Translation => !!t),
    [activeTranslations, translations],
  );

  const visibleSearchResults = useMemo(() => {
    return searchResults.filter((hit) => {
      if (searchFilterBookId && hit.book_id !== searchFilterBookId) return false;
      if (searchFilterTestament !== "all") {
        const book = books.find((b) => b.id === hit.book_id);
        if (book?.testament !== searchFilterTestament) return false;
      }
      return true;
    });
  }, [books, searchFilterBookId, searchFilterTestament, searchResults]);

  const toggleTranslation = (code: string) => {
    setActiveTranslations((prev) => {
      const next = prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code];
      saveSettingsPatch({ active_translations: next.join(",") });
      return next;
    });
  };

  const setReaderFontScale = (next: number) => {
    const clamped = Math.max(0.8, Math.min(1.4, Math.round(next * 100) / 100));
    setFontScale(clamped);
    saveSettingsPatch({ font_scale: clamped });
  };

  const setReaderLayoutSetting = (next: ReaderLayout) => {
    setReaderLayout(next);
    saveSettingsPatch({ reader_layout: next });
  };

  const setReaderDensitySetting = (next: ReaderDensity) => {
    setReaderDensity(next);
    saveSettingsPatch({ reader_density: next });
  };

  const setSyncScrollSetting = (next: boolean) => {
    setSyncScroll(next);
    saveSettingsPatch({ sync_scroll: next });
  };

  const jumpToVerse = (verseId: number, translationCode: string) => {
    const bookId = Math.floor(verseId / 1_000_000);
    const chapter = Math.floor((verseId % 1_000_000) / 1000);
    const book = books.find((b) => b.id === bookId);
    if (!book) return;
    setActiveTranslations((prev) =>
      prev.includes(translationCode) ? prev : [...prev, translationCode],
    );
    setSelectedBook(book);
    setSelectedChapter(chapter);
    setScrollTarget(verseId);
    setReferenceRangeTarget(null);
    setReferenceRangePanel(null);
    setSearchQuery("");
    setMode("reader");
  };

  const jumpToReference = async () => {
    const parsed = parseReference(referenceInput, books);
    if (!parsed) {
      setReferenceError("Use a reference like John 3:16 or John 3:16-4:2.");
      return;
    }
    const activeTranslation = activeTranslations[0] ?? translations[0]?.code;
    if (!activeTranslation) {
      setReferenceError("Select a translation before jumping to a reference.");
      return;
    }
    setReferenceError(null);
    setSelectedBook(parsed.book);
    setSelectedChapter(parsed.chapter);
    setScrollTarget(parsed.verseId);
    setReferenceRangePanel(null);
    if (parsed.endVerseId > parsed.verseId) {
      setReaderLayout("columns");
      if (parsed.endChapter === parsed.chapter) {
        setReferenceRangeTarget({
          startVerseId: parsed.verseId,
          endVerseId: parsed.endVerseId,
          requestId: Date.now(),
        });
      } else {
        setReferenceRangeTarget(null);
        try {
          const verses = await getVerseRange(
            activeTranslation,
            parsed.verseId,
            parsed.endVerseId,
          );
          if (verses.length === 0) {
            setReferenceError("No verses found for that range.");
            return;
          }
          setReferenceRangePanel({
            citation: parsed.citation,
            translationCode: activeTranslation,
            verses,
          });
        } catch (e) {
          setReferenceError(String(e));
          return;
        }
      }
    } else {
      setReferenceRangeTarget(null);
    }
    setSearchQuery("");
    setMode("reader");
  };

  const onSelectSearchHit = (hit: SearchHit) =>
    jumpToVerse(hit.verse_id, hit.translation_code);

  const askCouncilAboutVerse = (_verseId: number, citation: string) => {
    setPendingCouncilQuestion(
      `Discuss the meaning, context, and any disputed interpretations of ${citation}.`,
    );
    setMode("council");
  };

  const selectMode = (nextMode: Mode) => {
    setMode(nextMode);
    if (nextMode !== "reader") setSearchQuery("");
  };

  const updateSearchQuery = (nextQuery: string) => {
    setSearchQuery(nextQuery);
    if (nextQuery.trim()) setMode("reader");
  };

  const searchActive = searchQuery.trim().length > 0;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
        setCommandPaletteQuery("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const commandItems = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      {
        id: "mode-reader",
        label: "Open Reader",
        detail: "View Bible text",
        run: () => selectMode("reader"),
      },
      {
        id: "mode-council",
        label: "Open Council",
        detail: "Ask and compare theological arguments",
        run: () => selectMode("council"),
      },
      {
        id: "mode-workspaces",
        label: "Open Workspaces",
        detail: "Saved studies and exports",
        run: () => selectMode("workspaces"),
      },
      {
        id: "mode-settings",
        label: "Open Settings",
        detail: "Providers, data sources, backups",
        run: () => selectMode("settings"),
      },
      ...books.map((book) => ({
        id: `book-${book.id}`,
        label: `Open ${book.name}`,
        detail: `${book.testament} book`,
        run: () => {
          setSelectedBook(book);
          setSelectedChapter(1);
          setSearchQuery("");
          setMode("reader");
        },
      })),
      ...readingHistory.slice(0, 8).map((history) => {
        const book = books.find((b) => b.id === history.book_id);
        return {
          id: `history-${history.id}`,
          label: `Return to ${book?.name ?? `Book ${history.book_id}`} ${history.chapter}`,
          detail: "Recent reading",
          run: () => {
            if (!book) return;
            const codes = history.translation_codes
              .split(",")
              .map((code) => code.trim())
              .filter((code) => translations.some((translation) => translation.code === code));
            if (codes.length) setActiveTranslations(codes);
            setSelectedBook(book);
            setSelectedChapter(history.chapter);
            setSearchQuery("");
            setMode("reader");
          },
        };
      }),
      ...bookmarks.slice(0, 8).map((bookmark) => ({
        id: `bookmark-${bookmark.id}`,
        label: bookmark.label ?? formatVerseId(bookmark.verse_id, books),
        detail: "Bookmark",
        run: () => jumpToVerse(bookmark.verse_id, activeTranslations[0] ?? "KJV"),
      })),
      ...savedSearches.slice(0, 8).map((search) => ({
        id: `saved-search-${search.id}`,
        label: search.title,
        detail: `Saved search: ${search.query}`,
        run: () => {
          setSearchQuery(search.query);
          setSearchFilterTranslation(search.translation_code ?? "all");
          setSearchFilterTestament((search.testament ?? "all") as SearchTestamentFilter);
          setSearchFilterBookId(search.book_id ?? 0);
          setMode("reader");
        },
      })),
      ...workspaceShortcuts.slice(0, 12).map((workspace) => ({
        id: `workspace-${workspace.id}`,
        label: workspace.title,
        detail: `${workspace.item_count} workspace item${workspace.item_count === 1 ? "" : "s"}`,
        run: () => {
          setWorkspaceFocusId(workspace.id);
          setSearchQuery("");
          setMode("workspaces");
        },
      })),
    ];
    return items;
  }, [
    activeTranslations,
    bookmarks,
    books,
    jumpToVerse,
    readingHistory,
    savedSearches,
    translations,
    workspaceShortcuts,
  ]);

  const filteredCommandItems = useMemo(() => {
    const query = commandPaletteQuery.trim().toLowerCase();
    if (!query) return commandItems.slice(0, 20);
    return commandItems
      .filter((item) =>
        `${item.label} ${item.detail}`.toLowerCase().includes(query),
      )
      .slice(0, 20);
  }, [commandItems, commandPaletteQuery]);

  return (
    <div className="h-full flex">
      <aside className="w-72 border-r border-neutral-800 bg-neutral-950 flex flex-col">
        <div className="p-4 border-b border-neutral-800 space-y-3">
          <h1 className="text-lg font-semibold text-neutral-100">Bible AI</h1>

          <div className="flex gap-1 bg-neutral-900 p-0.5 rounded">
            <ModeButton
              active={mode === "reader"}
              onClick={() => selectMode("reader")}
              label="Reader"
            />
            <ModeButton
              active={mode === "council"}
              onClick={() => selectMode("council")}
              label="Council"
            />
            <ModeButton
              active={mode === "settings"}
              onClick={() => selectMode("settings")}
              label="Settings"
            />
            <ModeButton
              active={mode === "workspaces"}
              onClick={() => selectMode("workspaces")}
              label="Work"
            />
          </div>

          <SearchInput value={searchQuery} onChange={updateSearchQuery} />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={searchFilterTranslation}
              onChange={(e) => setSearchFilterTranslation(e.target.value)}
              className="settings-input text-xs"
              aria-label="Search translation"
            >
              <option value="active">Active translation</option>
              <option value="all">All translations</option>
              {translations.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.code}
                </option>
              ))}
            </select>
            <select
              value={searchFilterTestament}
              onChange={(e) => setSearchFilterTestament(e.target.value as SearchTestamentFilter)}
              className="settings-input text-xs"
              aria-label="Search testament"
            >
              <option value="all">All testaments</option>
              <option value="OT">Old Testament</option>
              <option value="NT">New Testament</option>
            </select>
          </div>
          <select
            value={searchFilterBookId}
            onChange={(e) => setSearchFilterBookId(Number(e.target.value))}
            className="settings-input text-xs"
            aria-label="Search book"
          >
            <option value={0}>All books</option>
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <div className="space-y-1">
            <div className="flex gap-2">
              <input
                value={referenceInput}
                onChange={(e) => {
                  setReferenceInput(e.target.value);
                  setReferenceError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void jumpToReference();
                }}
                placeholder="John 3:16 or John 3:16-18"
                className="settings-input text-xs"
                aria-label="Jump to reference"
              />
              <button
                type="button"
                onClick={() => void jumpToReference()}
                className="px-2 rounded border border-neutral-800 hover:border-neutral-700 text-xs text-neutral-300"
              >
                Go
              </button>
            </div>
            {referenceError && <p className="text-xs text-red-300">{referenceError}</p>}
          </div>

          <div className="flex items-center justify-between gap-2 text-xs text-neutral-400">
            <span>Text</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setReaderFontScale(fontScale - 0.1)}
                className="w-7 h-7 rounded border border-neutral-800 hover:border-neutral-700 text-neutral-300"
                aria-label="Decrease reader font size"
              >
                A-
              </button>
              <span className="w-10 text-center font-mono">{Math.round(fontScale * 100)}%</span>
              <button
                type="button"
                onClick={() => setReaderFontScale(fontScale + 0.1)}
                className="w-7 h-7 rounded border border-neutral-800 hover:border-neutral-700 text-neutral-300"
                aria-label="Increase reader font size"
              >
                A+
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={readerLayout}
              onChange={(e) => setReaderLayoutSetting(e.target.value as ReaderLayout)}
              className="settings-input text-xs"
              aria-label="Reader layout"
            >
              <option value="columns">Columns</option>
              <option value="interleaved">Interleaved</option>
            </select>
            <select
              value={readerDensity}
              onChange={(e) => setReaderDensitySetting(e.target.value as ReaderDensity)}
              className="settings-input text-xs"
              aria-label="Reader density"
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-neutral-400">
            <input
              type="checkbox"
              checked={syncScroll}
              onChange={(e) => setSyncScrollSetting(e.target.checked)}
              className="accent-amber-500"
              aria-label="Sync reader scrolling"
            />
            Sync scroll
          </label>
          <TranslationPicker
            translations={translations}
            activeCodes={activeTranslations}
            onToggle={toggleTranslation}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <BookList
            books={books}
            selectedBookId={selectedBook?.id ?? null}
            onSelect={(b) => {
              setSelectedBook(b);
              setSelectedChapter(1);
              setMode("reader");
            }}
          />
          <NavigationShortcuts
            books={books}
            bookmarks={bookmarks}
            history={readingHistory}
            savedSearches={savedSearches}
            workspaces={workspaceShortcuts}
            onJumpToVerse={jumpToVerse}
            onJumpToChapter={(bookId, chapter, translationCodes) => {
              const book = books.find((b) => b.id === bookId);
              if (!book) return;
              const codes = translationCodes
                .split(",")
                .map((c) => c.trim())
                .filter((code) => translations.some((t) => t.code === code));
              if (codes.length) setActiveTranslations(codes);
              setSelectedBook(book);
              setSelectedChapter(chapter);
              setSearchQuery("");
              setMode("reader");
            }}
            onRunSavedSearch={(s) => {
              setSearchQuery(s.query);
              setSearchFilterTranslation(s.translation_code ?? "all");
              setSearchFilterTestament((s.testament ?? "all") as SearchTestamentFilter);
              setSearchFilterBookId(s.book_id ?? 0);
              setMode("reader");
            }}
            onRenameSavedSearch={async (search, title) => {
              await updateSavedSearchTitle(search.id, title);
              setSavedSearches((current) =>
                current.map((s) =>
                  s.id === search.id
                    ? { ...s, title, updated_at: new Date().toISOString() }
                    : s,
                ),
              );
              await refreshNavigationLists();
            }}
            onDeleteSavedSearch={async (search) => {
              await deleteSavedSearch(search.id);
              setSavedSearches((current) => current.filter((s) => s.id !== search.id));
              await refreshNavigationLists();
            }}
            onOpenWorkspace={(workspaceId) => {
              setWorkspaceFocusId(workspaceId);
              setSearchQuery("");
              setMode("workspaces");
            }}
          />
        </div>

        {selectedBook && mode === "reader" && (
          <div className="border-t border-neutral-800 p-4">
            <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
              {selectedBook.name} · Chapters
            </h3>
            <ChapterGrid
              chapterCount={selectedBook.chapter_count}
              selectedChapter={selectedChapter}
              onSelect={setSelectedChapter}
            />
          </div>
        )}
      </aside>

      <main className="flex-1 overflow-auto">
        {error ? (
          <div className="p-6 text-red-400 text-sm">
            <p className="font-semibold mb-1">Error</p>
            <pre className="whitespace-pre-wrap">{error}</pre>
          </div>
        ) : searchActive ? (
          <SearchResults
            query={searchQuery.trim()}
            results={visibleSearchResults}
            loading={searchLoading}
            onSelect={onSelectSearchHit}
            onSaveSearch={async () => {
              const q = searchQuery.trim();
              if (!q) return;
              const translation =
                searchFilterTranslation === "active"
                  ? (activeTranslations[0] ?? null)
                  : searchFilterTranslation === "all"
                    ? null
                    : searchFilterTranslation;
              await createSavedSearch(
                q,
                q,
                translation,
                searchFilterTestament === "all" ? null : searchFilterTestament,
                searchFilterBookId || null,
              );
              await refreshNavigationLists();
            }}
          />
        ) : mode === "settings" ? (
          <SettingsPanel
            settings={settings}
            translations={translations}
            onUserDataChanged={refreshUserDataAndNavigation}
            onJumpToVerse={jumpToVerse}
            onSave={async (next) => {
              await saveAppSettings(next);
              setSettings(next);
              if (next.font_scale) setFontScale(next.font_scale);
              if (next.reader_layout) setReaderLayout(next.reader_layout);
              if (next.reader_density) setReaderDensity(next.reader_density);
              if (next.sync_scroll !== undefined && next.sync_scroll !== null) {
                setSyncScroll(next.sync_scroll);
              }
              if (next.active_translations) {
                const codes = next.active_translations
                  .split(",")
                  .map((x) => x.trim())
                  .filter((code) => translations.some((t) => t.code === code));
                if (codes.length) setActiveTranslations(codes);
              }
            }}
          />
        ) : mode === "workspaces" ? (
          <WorkspacesPanel
            onJumpToVerse={jumpToVerse}
            selectedWorkspaceId={workspaceFocusId}
            onChanged={refreshNavigationLists}
            onAskCouncil={(citation) => {
              setPendingCouncilQuestion(
                `Discuss the meaning, context, and any disputed interpretations of ${citation}.`,
              );
              setSearchQuery("");
              setMode("council");
            }}
            onRunSearch={(query) => {
              setSearchQuery(query);
              setMode("reader");
            }}
            onOpenCouncilResult={(question, response) => {
              setWorkspaceCouncilResult({ question, response });
              setSearchQuery("");
              setMode("council");
            }}
          />
        ) : mode === "council" ? (
          <CouncilPanel
            onJumpToVerse={jumpToVerse}
            books={books}
            translations={translations}
            settings={settings}
            presetQuestion={pendingCouncilQuestion}
            restoredResult={workspaceCouncilResult}
            onPresetConsumed={() => setPendingCouncilQuestion(null)}
            onRestoredResultConsumed={() => setWorkspaceCouncilResult(null)}
          />
        ) : !selectedBook || !selectedChapter ? (
          <div className="p-6 text-neutral-500">Select a book to begin.</div>
        ) : orderedActive.length === 0 ? (
          <div className="p-6 text-neutral-500">Select at least one translation.</div>
        ) : (
          <>
            {orderedActive.length === 1 ? (
              <ChapterReader
                bookName={selectedBook.name}
                chapter={selectedChapter}
                translationName={orderedActive[0].name}
                translationCode={orderedActive[0].code}
                language={orderedActive[0].language}
                verses={chapterData[orderedActive[0].code] ?? []}
                loading={loading}
                onJumpToVerse={jumpToVerse}
                highlights={highlights}
                rangeHighlights={rangeHighlights}
                notedVerseIds={notedVerseIds}
                rangeNotes={rangeNotes}
                onUserDataChanged={refreshUserDataAndNavigation}
                onAskCouncilAboutVerse={askCouncilAboutVerse}
                wordTokensByVerse={wordTokensByTranslation.get(orderedActive[0].code)}
                onWordClick={setSelectedWord}
                fontScale={fontScale}
                density={readerDensity}
                referenceRangeTarget={referenceRangeTarget}
                onReferenceRangeTargetConsumed={() => setReferenceRangeTarget(null)}
              />
            ) : readerLayout === "interleaved" ? (
              <InterleavedReader
                bookName={selectedBook.name}
                chapter={selectedChapter}
                translations={orderedActive}
                chapterData={chapterData}
                loading={loading}
                fontScale={fontScale}
                density={readerDensity}
                onJumpToVerse={jumpToVerse}
              />
            ) : (
              <div className="flex gap-0 min-h-full">
                {orderedActive.map((t, idx) => (
                  <div
                    key={t.code}
                    className={
                      "flex-1 min-w-[360px] " +
                      (idx < orderedActive.length - 1 ? "border-r border-neutral-800" : "")
                    }
                  >
                    <ChapterReader
                      bookName={selectedBook.name}
                      chapter={selectedChapter}
                      translationName={t.name}
                      translationCode={t.code}
                      language={t.language}
                      verses={chapterData[t.code] ?? []}
                      loading={loading}
                      onJumpToVerse={jumpToVerse}
                      highlights={highlights}
                      rangeHighlights={rangeHighlights}
                      notedVerseIds={notedVerseIds}
                      rangeNotes={rangeNotes}
                      onUserDataChanged={refreshUserDataAndNavigation}
                      onAskCouncilAboutVerse={askCouncilAboutVerse}
                      wordTokensByVerse={wordTokensByTranslation.get(t.code)}
                      onWordClick={setSelectedWord}
                      fontScale={fontScale}
                      density={readerDensity}
                      referenceRangeTarget={idx === 0 ? referenceRangeTarget : null}
                      onReferenceRangeTargetConsumed={() => setReferenceRangeTarget(null)}
                    />
                  </div>
                ))}
              </div>
            )}
            {referenceRangePanel && (
              <div className="max-w-4xl mx-auto px-6 pb-8">
                <RangeActionBar
                  citation={referenceRangePanel.citation}
                  translationCode={referenceRangePanel.translationCode}
                  verses={referenceRangePanel.verses}
                  onClear={() => setReferenceRangePanel(null)}
                  onChanged={() => void refreshUserDataAndNavigation()}
                  onAskCouncilAboutVerse={askCouncilAboutVerse}
                />
              </div>
            )}
          </>
        )}
      </main>

      {selectedWord && (
        <StrongsPopup
          codes={(selectedWord.strongs ?? "").split(",").filter(Boolean)}
          surface={selectedWord.surface}
          morph={selectedWord.morph}
          onJumpToVerse={jumpToVerse}
          onClose={() => setSelectedWord(null)}
        />
      )}
      {commandPaletteOpen && (
        <CommandPalette
          query={commandPaletteQuery}
          onQueryChange={setCommandPaletteQuery}
          items={filteredCommandItems}
          onClose={() => setCommandPaletteOpen(false)}
        />
      )}
    </div>
  );
}

function InterleavedReader({
  bookName,
  chapter,
  translations,
  chapterData,
  loading,
  fontScale,
  density,
  onJumpToVerse,
}: {
  bookName: string;
  chapter: number;
  translations: Translation[];
  chapterData: Record<string, Verse[]>;
  loading: boolean;
  fontScale: number;
  density: ReaderDensity;
  onJumpToVerse: (verseId: number, translationCode: string) => void;
}) {
  const primary = translations[0];
  const primaryVerses = primary ? (chapterData[primary.code] ?? []) : [];
  const verseNumbers = Array.from(
    new Set(
      translations.flatMap((t) => (chapterData[t.code] ?? []).map((v) => v.verse)),
    ),
  ).sort((a, b) => a - b);

  return (
    <article
      data-testid="interleaved-reader"
      className={
        "max-w-5xl mx-auto " +
        (density === "compact" ? "px-4 py-5" : "px-6 py-8")
      }
    >
      <header
        className={
          "border-b border-neutral-800 " +
          (density === "compact" ? "mb-4 pb-3" : "mb-6 pb-4")
        }
      >
        <h1
          className={
            "font-semibold text-neutral-100 " +
            (density === "compact" ? "text-2xl" : "text-3xl")
          }
        >
          {bookName} {chapter}
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          {translations.map((t) => t.code).join(" / ")}
        </p>
      </header>

      {loading ? (
        <p className="text-neutral-500 italic">Loading...</p>
      ) : primaryVerses.length === 0 ? (
        <p className="text-neutral-500 italic">No verses for this chapter.</p>
      ) : (
        <div className={density === "compact" ? "space-y-2" : "space-y-4"}>
          {verseNumbers.map((verseNo) => {
            const anchor =
              primaryVerses.find((v) => v.verse === verseNo) ??
              translations
                .flatMap((t) => chapterData[t.code] ?? [])
                .find((v) => v.verse === verseNo);
            return (
              <section
                key={verseNo}
                id={anchor ? `v-${anchor.verse_id}` : undefined}
                data-testid="interleaved-verse"
                className={
                  "grid border border-neutral-800 rounded " +
                  (density === "compact"
                    ? "grid-cols-[2.75rem_1fr] gap-2 px-3 py-2"
                    : "grid-cols-[3.5rem_1fr] gap-3 px-4 py-3")
                }
              >
                <button
                  type="button"
                  onClick={() => anchor && onJumpToVerse(anchor.verse_id, primary.code)}
                  className="text-left text-xs font-mono text-amber-300 hover:text-amber-200"
                >
                  {verseNo}
                </button>
                <div className={density === "compact" ? "space-y-1.5" : "space-y-2.5"}>
                  {translations.map((t) => {
                    const verse = (chapterData[t.code] ?? []).find((v) => v.verse === verseNo);
                    return (
                      <div
                        key={t.code}
                        className={
                          "grid gap-3 " +
                          (density === "compact"
                            ? "grid-cols-[3rem_1fr]"
                            : "grid-cols-[4rem_1fr]")
                        }
                      >
                        <span className="font-mono text-xs text-neutral-500">{t.code}</span>
                        <p
                          className={
                            "text-neutral-200 " +
                            (density === "compact"
                              ? "text-sm leading-snug"
                              : "text-base leading-relaxed")
                          }
                          style={{
                            fontFamily: "var(--font-serif)",
                            fontSize: `${fontScale}em`,
                          }}
                        >
                          {verse?.text ?? ""}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </article>
  );
}

function parseReference(input: string, books: Book[]) {
  const match = input.trim().match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(?:(\d+):)?(\d+))?)?$/);
  if (!match) return null;
  const [, rawBook, rawChapter, rawVerse, rawEndChapter, rawEndVerse] = match;
  const normalizedBook = normalizeReferenceBook(rawBook);
  const book = [...books]
    .sort((a, b) => b.name.length - a.name.length)
    .find((b) => {
      const names = [
        b.name,
        b.osis_code,
        b.name.replace(/^(\d)\s+/, "$1"),
        b.name.replace(/^(\d)\s+/, "$1 "),
      ];
      return names.some((name) => normalizeReferenceBook(name) === normalizedBook);
    });
  if (!book) return null;
  const chapter = Number(rawChapter);
  const verse = Number(rawVerse ?? "1");
  const endChapter = Number(rawEndChapter ?? rawChapter);
  const endVerse = Number(rawEndVerse ?? rawVerse ?? "1");
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > book.chapter_count) return null;
  if (!Number.isInteger(endChapter) || endChapter < chapter || endChapter > book.chapter_count) {
    return null;
  }
  if (!Number.isInteger(verse) || verse < 1 || verse > 999) return null;
  if (!Number.isInteger(endVerse) || endVerse < 1 || endVerse > 999) return null;
  if (endChapter === chapter && endVerse < verse) return null;
  const endVerseId = book.id * 1_000_000 + endChapter * 1000 + endVerse;
  return {
    book,
    chapter,
    endChapter,
    verseId: book.id * 1_000_000 + chapter * 1000 + verse,
    endVerseId,
    citation:
      endVerseId > book.id * 1_000_000 + chapter * 1000 + verse
        ? endChapter === chapter
          ? `${book.name} ${chapter}:${verse}-${endVerse}`
          : `${book.name} ${chapter}:${verse}-${endChapter}:${endVerse}`
        : `${book.name} ${chapter}:${verse}`,
  };
}

function normalizeReferenceBook(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function NavigationShortcuts({
  books,
  bookmarks,
  history,
  savedSearches,
  workspaces,
  onJumpToVerse,
  onJumpToChapter,
  onRunSavedSearch,
  onRenameSavedSearch,
  onDeleteSavedSearch,
  onOpenWorkspace,
}: {
  books: Book[];
  bookmarks: Bookmark[];
  history: ReadingHistoryItem[];
  savedSearches: SavedSearch[];
  workspaces: StudyWorkspaceSummary[];
  onJumpToVerse: (verseId: number, translationCode: string) => void;
  onJumpToChapter: (bookId: number, chapter: number, translationCodes: string) => void;
  onRunSavedSearch: (search: SavedSearch) => void;
  onRenameSavedSearch: (search: SavedSearch, title: string) => Promise<void> | void;
  onDeleteSavedSearch: (search: SavedSearch) => Promise<void> | void;
  onOpenWorkspace: (workspaceId: number) => void;
}) {
  const [editingSavedSearchId, setEditingSavedSearchId] = useState<number | null>(null);
  const [editingSavedSearchTitle, setEditingSavedSearchTitle] = useState("");
  const [savedSearchBusyId, setSavedSearchBusyId] = useState<number | null>(null);

  const beginSavedSearchEdit = (search: SavedSearch) => {
    setEditingSavedSearchId(search.id);
    setEditingSavedSearchTitle(search.title);
  };

  const saveSavedSearchTitle = async (search: SavedSearch) => {
    const title = editingSavedSearchTitle.trim();
    if (!title) return;
    setSavedSearchBusyId(search.id);
    try {
      await onRenameSavedSearch(search, title);
      setEditingSavedSearchId(null);
      setEditingSavedSearchTitle("");
    } finally {
      setSavedSearchBusyId(null);
    }
  };

  return (
    <div className="mt-6 space-y-5">
      {bookmarks.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Bookmarks</h3>
          <ul className="space-y-1">
            {bookmarks.slice(0, 8).map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => onJumpToVerse(b.verse_id, "KJV")}
                  className="w-full text-left text-xs text-neutral-300 hover:text-amber-200 truncate"
                >
                  {b.label ?? formatVerseId(b.verse_id, books)}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {history.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Recent</h3>
          <ul className="space-y-1">
            {history.map((h) => {
              const book = books.find((b) => b.id === h.book_id);
              return (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => onJumpToChapter(h.book_id, h.chapter, h.translation_codes)}
                    className="w-full text-left text-xs text-neutral-400 hover:text-neutral-200 truncate"
                  >
                    {book?.name ?? `Book ${h.book_id}`} {h.chapter}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {savedSearches.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
            Saved Searches
          </h3>
          <ul className="space-y-1">
            {savedSearches.slice(0, 8).map((s) => (
              <li key={s.id}>
                {editingSavedSearchId === s.id ? (
                  <div className="space-y-1">
                    <input
                      aria-label={`Saved search title: ${s.title}`}
                      value={editingSavedSearchTitle}
                      onChange={(e) => setEditingSavedSearchTitle(e.target.value)}
                      className="w-full rounded border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs text-neutral-200"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Save saved search ${s.title}`}
                        onClick={() => void saveSavedSearchTitle(s)}
                        disabled={!editingSavedSearchTitle.trim() || savedSearchBusyId === s.id}
                        className="text-xs text-amber-300 hover:text-amber-200 disabled:text-neutral-600"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        aria-label={`Cancel saved search rename ${s.title}`}
                        onClick={() => {
                          setEditingSavedSearchId(null);
                          setEditingSavedSearchTitle("");
                        }}
                        className="text-xs text-neutral-500 hover:text-neutral-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onRunSavedSearch(s)}
                      className="min-w-0 flex-1 text-left text-xs text-neutral-400 hover:text-amber-200 truncate"
                    >
                      {s.title}
                    </button>
                    <button
                      type="button"
                      aria-label={`Rename saved search ${s.title}`}
                      onClick={() => beginSavedSearchEdit(s)}
                      className="shrink-0 text-xs text-neutral-600 hover:text-neutral-300"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete saved search ${s.title}`}
                      onClick={async () => {
                        setSavedSearchBusyId(s.id);
                        try {
                          await onDeleteSavedSearch(s);
                        } finally {
                          setSavedSearchBusyId(null);
                        }
                      }}
                      disabled={savedSearchBusyId === s.id}
                      className="shrink-0 text-xs text-neutral-600 hover:text-red-300 disabled:text-neutral-700"
                    >
                      Del
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {workspaces.length > 0 && (
        <section>
          <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
            Workspaces
          </h3>
          <ul className="space-y-1">
            {workspaces.slice(0, 8).map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => onOpenWorkspace(w.id)}
                  className="w-full text-left text-xs text-neutral-400 hover:text-amber-200 truncate"
                >
                  {w.title}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function formatVerseId(verseId: number, books: Book[]) {
  const bookId = Math.floor(verseId / 1_000_000);
  const chapter = Math.floor((verseId % 1_000_000) / 1000);
  const verse = verseId % 1000;
  const book = books.find((b) => b.id === bookId);
  return `${book?.name ?? `Book ${bookId}`} ${chapter}:${verse}`;
}

function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex-1 text-sm py-1 rounded transition-colors " +
        (active
          ? "bg-neutral-800 text-neutral-100"
          : "text-neutral-400 hover:text-neutral-200")
      }
    >
      {label}
    </button>
  );
}

function CommandPalette({
  query,
  onQueryChange,
  items,
  onClose,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  items: CommandItem[];
  onClose: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const runSelected = () => {
    const selected = items[selectedIndex] ?? items[0];
    if (!selected) return;
    selected.run();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center px-4 pt-24"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl border border-neutral-800 rounded bg-neutral-950 shadow-2xl overflow-hidden">
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            } else if (event.key === "Enter") {
              event.preventDefault();
              runSelected();
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              setSelectedIndex((index) => Math.min(items.length - 1, index + 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setSelectedIndex((index) => Math.max(0, index - 1));
            }
          }}
          placeholder="Search commands, books, workspaces..."
          className="w-full bg-neutral-950 border-b border-neutral-800 px-4 py-3 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
        />
        {items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-neutral-500">No matching commands.</p>
        ) : (
          <ul className="max-h-96 overflow-y-auto py-1" data-testid="command-palette-results">
            {items.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    item.run();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={
                    "w-full text-left px-4 py-2 " +
                    (selectedIndex === index
                      ? "bg-neutral-800 text-neutral-100"
                      : "text-neutral-300 hover:bg-neutral-900")
                  }
                >
                  <span className="block text-sm">{item.label}</span>
                  <span className="block text-xs text-neutral-500">{item.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default App;
