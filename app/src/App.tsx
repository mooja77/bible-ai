import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  type NoteHit,
  type SearchHit,
  type SearchResponse,
  type SearchStrategy,
  type CouncilResponse,
  type StudyWorkspaceSummary,
  type Translation,
  type Verse,
  type WordToken,
  updateSavedSearchTitle,
  searchNotes,
  type Tag,
  type ItemTag,
  listTags,
  listItemTags,
  createTag,
  tagItem,
  untagItem,
} from "./lib/bible";
import { BookNav } from "./features/reader/BookNav";
import { ChapterReader, RangeActionBar } from "./features/reader/ChapterReader";
import { InterleavedReader } from "./features/reader/InterleavedReader";
import { ReaderBar } from "./features/reader/ReaderBar";
import type { ReaderLayout, ReaderDensity } from "./features/reader/types";
import { type SearchScope } from "./features/search/SearchScopeControl";
import { SearchPanel } from "./features/search/SearchPanel";
import { StrongsPopup } from "./features/reader/StrongsPopup";
import { ErrorState } from "./components/StateViews";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { TagBrowser } from "./features/tags/TagBrowser";
import { GuidedTour, TOUR_STEPS } from "./features/onboarding/GuidedTour";
import { useGuidedTour } from "./features/onboarding/useGuidedTour";
import { NavigationDrawer } from "./features/app-shell/NavigationDrawer";
import { CommandPalette, type CommandItem } from "./features/app-shell/CommandPalette";
import { TopBar } from "./features/app-shell/TopBar";
import { ReaderPlaceholder } from "./features/reader/ReaderPlaceholder";
import { formatVerseId, parseReference } from "./lib/verse";
import { settingsHasConfiguredAi } from "./lib/settings";
import { useTheme } from "./lib/useTheme";
import { useUiScale } from "./lib/useUiScale";
import type { Mode } from "./lib/mode";

const CouncilPanel = lazy(() =>
  import("./features/council/CouncilPanel").then((module) => ({ default: module.CouncilPanel })),
);
const SettingsPanel = lazy(() =>
  import("./features/settings/SettingsPanel").then((module) => ({ default: module.SettingsPanel })),
);
const TheologyPanel = lazy(() =>
  import("./features/theology/TheologyPanel").then((module) => ({ default: module.TheologyPanel })),
);
const ResourcesPanel = lazy(() =>
  import("./features/resources/ResourcesPanel").then((module) => ({ default: module.ResourcesPanel })),
);
const WorkspacesPanel = lazy(() =>
  import("./features/workspaces/WorkspacesPanel").then((module) => ({ default: module.WorkspacesPanel })),
);

// Translations that have Strong's-tagged word tokens ingested.
const TAGGED_TRANSLATIONS = new Set(["WLC"]);

export type SearchTestamentFilter = "all" | "OT" | "NT" | "DC";

function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [activeTranslations, setActiveTranslations] = useState<string[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [chapterData, setChapterData] = useState<Record<string, Verse[]>>({});
  // Identifies which book:chapter `chapterData` was loaded for, so we never
  // derive UI (e.g. which translations have text) from a previous chapter's
  // data during the brief window after navigation but before the load lands.
  const [chapterDataKey, setChapterDataKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();
  const { uiScale, increaseUiScale, decreaseUiScale, canIncrease, canDecrease } = useUiScale();

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
  const referenceJumpRequestId = useRef(0);
  // Mirror the current reader location so an in-flight reference-range fetch can
  // tell whether the user navigated away before it resolved.
  const selectedBookIdRef = useRef<number | null>(null);
  const selectedChapterRef = useRef<number | null>(null);
  const [referenceInput, setReferenceInput] = useState("");
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [searchFilterTranslation, setSearchFilterTranslation] = useState("active");
  const [searchFilterTestament, setSearchFilterTestament] =
    useState<SearchTestamentFilter>("all");
  const [searchFilterBookId, setSearchFilterBookId] = useState(0);
  const [searchStrategy, setSearchStrategy] = useState<SearchStrategy>("keyword");
  const [searchDegraded, setSearchDegraded] = useState(false);
  const [searchDegradedReason, setSearchDegradedReason] = useState<string | null>(null);
  const [searchScope, setSearchScope] = useState<SearchScope>("scripture");
  const [noteResults, setNoteResults] = useState<NoteHit[]>([]);
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteTags, setNoteTags] = useState<ItemTag[]>([]);
  const [noteTagFilter, setNoteTagFilter] = useState<number | null>(null);

  const [mode, setMode] = useState<Mode>("reader");
  const [settings, setSettings] = useState<AppSettings>({});
  const settingsSaveChain = useRef<Promise<void>>(Promise.resolve());
  const [fontScale, setFontScale] = useState(1);
  const [readerLayout, setReaderLayout] = useState<ReaderLayout>("columns");
  // Compare is an opt-in: even with several translations active, the reader
  // lands on a single calm primary column until the user turns Compare on.
  const [compareMode, setCompareMode] = useState(false);
  const [readerDensity, setReaderDensity] = useState<ReaderDensity>("comfortable");
  const [syncScroll, setSyncScroll] = useState(true);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [bookmarkTags, setBookmarkTags] = useState<ItemTag[]>([]);
  const [bookmarkTagFilter, setBookmarkTagFilter] = useState<number | null>(null);
  const [readingHistory, setReadingHistory] = useState<ReadingHistoryItem[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [workspaceShortcuts, setWorkspaceShortcuts] = useState<StudyWorkspaceSummary[]>([]);
  const navigationRequestId = useRef(0);
  const [workspaceFocusId, setWorkspaceFocusId] = useState<number | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandPaletteQuery, setCommandPaletteQuery] = useState("");
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [bookNavOpen, setBookNavOpen] = useState(false);
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);

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
        const [bs, ts] = await Promise.all([listBooks(), listTranslations()]);
        let savedSettings: AppSettings = {};
        try {
          savedSettings = await getAppSettings();
        } catch (e) {
          setWarning(`Settings load failed: ${String(e)}`);
        }
        setBooks(bs);
        setTranslations(ts);
        setSettings(savedSettings);
        if (
          savedSettings.search_strategy === "keyword" ||
          savedSettings.search_strategy === "semantic" ||
          savedSettings.search_strategy === "hybrid"
        ) {
          setSearchStrategy(savedSettings.search_strategy);
        }
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
    const requestId = ++navigationRequestId.current;
    const [b, h, s, w, tg, bt] = await Promise.all([
      listBookmarks().catch(() => [] as Bookmark[]),
      listReadingHistory(8).catch(() => [] as ReadingHistoryItem[]),
      listSavedSearches().catch(() => [] as SavedSearch[]),
      listStudyWorkspaces().catch(() => [] as StudyWorkspaceSummary[]),
      listTags().catch(() => [] as Tag[]),
      listItemTags("bookmark").catch(() => [] as ItemTag[]),
    ]);
    if (requestId !== navigationRequestId.current) return;
    setBookmarks(b);
    setReadingHistory(h);
    setSavedSearches(s);
    setWorkspaceShortcuts(w);
    setTags(tg);
    setBookmarkTags(bt);
  }, []);

  const onAttachBookmarkTag = async (bookmarkId: number, name: string) => {
    try {
      const tag = await createTag(name);
      await tagItem(tag.id, "bookmark", bookmarkId);
      await refreshNavigationLists();
    } catch (e) {
      setError(String(e));
    }
  };

  const onDetachBookmarkTag = async (bookmarkId: number, tagId: number) => {
    try {
      await untagItem(tagId, "bookmark", bookmarkId);
      await refreshNavigationLists();
    } catch (e) {
      setError(String(e));
    }
  };

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

  const queueSettingsSave = useCallback((next: AppSettings) => {
    const save = settingsSaveChain.current
      .catch(() => undefined)
      .then(() => saveAppSettings(next));
    settingsSaveChain.current = save.catch(() => undefined);
    return save;
  }, []);

  const saveSettingsPatch = useCallback((patch: AppSettings) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      void queueSettingsSave(next).catch((e) => setError(String(e)));
      return next;
    });
  }, [queueSettingsSave]);

  useEffect(() => {
    if (!selectedBook || !selectedChapter || activeTranslations.length === 0) {
      setChapterData({});
      setChapterDataKey(null);
      return;
    }
    const key = `${selectedBook.id}:${selectedChapter}`;
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
        if (!cancelled) {
          setChapterData(Object.fromEntries(entries));
          setChapterDataKey(key);
        }
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
  const searchRequestId = useRef(0);
  const noteRequestId = useRef(0);
  const noteTimer = useRef<number | null>(null);
  useEffect(() => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    const requestId = ++searchRequestId.current;
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchLoading(false);
      setSearchDegraded(false);
      setSearchDegradedReason(null);
      return;
    }
    if (searchScope !== "scripture") {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    setSearchDegraded(false);
    setSearchDegradedReason(null);
    const filterPrimary =
      searchFilterTranslation === "all"
        ? null
        : searchFilterTranslation === "active"
          ? (activeTranslations[0] ?? null)
          : searchFilterTranslation;
    // Meaning/hybrid need a concrete translation (embeddings are per-translation),
    // so override an "all translations" selection with the active translation.
    const primary =
      searchStrategy !== "keyword" && !filterPrimary
        ? (activeTranslations[0] ?? "KJV")
        : filterPrimary;
    searchTimer.current = window.setTimeout(() => {
      searchTimer.current = null;
      runSearch(
        trimmed,
        primary,
        60,
        searchFilterBookId || null,
        searchFilterTestament === "all" ? null : searchFilterTestament,
        searchStrategy,
        settings.ollama_host ?? null,
      )
        .then((resp: SearchResponse) => {
          if (requestId !== searchRequestId.current) return;
          setSearchResults(resp.hits);
          setSearchDegraded(resp.degraded);
          setSearchDegradedReason(resp.degraded_reason);
        })
        .catch((e) => {
          if (requestId === searchRequestId.current) setError(String(e));
        })
        .finally(() => {
          if (requestId === searchRequestId.current) setSearchLoading(false);
        });
    }, 250);
    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
  }, [
    searchQuery,
    searchScope,
    activeTranslations,
    searchFilterTranslation,
    searchFilterBookId,
    searchFilterTestament,
    searchStrategy,
    settings.ollama_host,
  ]);

  useEffect(() => {
    if (noteTimer.current) window.clearTimeout(noteTimer.current);
    const requestId = ++noteRequestId.current;
    const trimmed = searchQuery.trim();
    if (searchScope !== "notes" || !trimmed) {
      setNoteResults([]);
      setNoteTags([]);
      setNoteTagFilter(null);
      setNoteLoading(false);
      return;
    }
    setNoteLoading(true);
    noteTimer.current = window.setTimeout(() => {
      noteTimer.current = null;
      searchNotes(trimmed, 100)
        .then((hits) => {
          if (requestId === noteRequestId.current) setNoteResults(hits);
        })
        .catch((e) => {
          if (requestId === noteRequestId.current) setError(String(e));
        })
        .finally(() => {
          if (requestId === noteRequestId.current) setNoteLoading(false);
        });
      listItemTags("note")
        .then((links) => {
          if (requestId === noteRequestId.current) setNoteTags(links);
        })
        .catch(() => {});
    }, 250);
    return () => {
      if (noteTimer.current) window.clearTimeout(noteTimer.current);
    };
  }, [searchQuery, searchScope]);

  // Monotonic id so an in-flight user-data load that resolves late (after a
  // newer chapter was selected) cannot overwrite the current chapter's data.
  const userDataReqId = useRef(0);

  // Refetch user data (highlights + notes) for the active chapter.
  const refetchUserData = useCallback(() => {
    const reqId = (userDataReqId.current += 1);
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
      if (reqId !== userDataReqId.current) return; // superseded by a newer load
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
    // Keep scrollTarget set if the chapter has not rendered yet — a later
    // run (chapterData is a dependency) will find the element.
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    // Restart the flash even if a prior flash class is still present.
    el.classList.remove("verse-flash");
    void el.offsetWidth; // force reflow so the animation replays
    el.classList.add("verse-flash");
    // Not registered as effect cleanup on purpose: setScrollTarget(null) below
    // re-runs this effect, and a cleanup-registered timer would be cleared
    // before it could remove the class.
    window.setTimeout(() => el.classList.remove("verse-flash"), 1800);
    setScrollTarget(null);
  }, [chapterData, loading, scrollTarget, mode]);

  const orderedActive = useMemo(
    () =>
      activeTranslations
        .map((code) => translations.find((t) => t.code === code))
        .filter((t): t is Translation => !!t),
    [activeTranslations, translations],
  );

  // A canon-limited translation (e.g. TR is NT-only, WLC is OT-only) has no
  // verses for some chapters. Drive the reader layouts off the translations
  // that actually have text here so an absent one never eats a column/row.
  // Only filter once `chapterData` belongs to the currently-selected chapter:
  // while loading — or in the render right after navigation, before the load
  // lands — chapterData still holds the previous chapter, and filtering on it
  // would briefly hide columns / show a wrong omission note.
  const chapterDataReady =
    !loading &&
    !!selectedBook &&
    selectedChapter !== null &&
    chapterDataKey === `${selectedBook.id}:${selectedChapter}`;
  const presentActive = useMemo(
    () =>
      chapterDataReady
        ? orderedActive.filter((t) => (chapterData[t.code] ?? []).length > 0)
        : orderedActive,
    [orderedActive, chapterData, chapterDataReady],
  );
  const absentActive = useMemo(
    () =>
      chapterDataReady
        ? orderedActive.filter((t) => (chapterData[t.code] ?? []).length === 0)
        : [],
    [orderedActive, chapterData, chapterDataReady],
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

  // Keep the location refs current and drop any reference-range panel whenever
  // the reader navigates to a different book/chapter (sidebar, command palette,
  // chapter grid). This both clears a stale panel after navigation and lets an
  // in-flight cross-chapter fetch detect that it should no longer apply.
  useEffect(() => {
    selectedBookIdRef.current = selectedBook?.id ?? null;
    selectedChapterRef.current = selectedChapter;
    setReferenceRangePanel(null);
  }, [selectedBook, selectedChapter]);

  const jumpToVerse = (verseId: number, translationCode: string) => {
    referenceJumpRequestId.current += 1;
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

  const jumpToReference = async (overrideReference?: string) => {
    const requestId = ++referenceJumpRequestId.current;
    const parsed = parseReference(overrideReference ?? referenceInput, books);
    if (!parsed) {
      setReferenceError(
        "Hmm, I couldn't find that. Try a book, chapter, or verse — like “John”, “John 3”, “John 3:16”, or “John 3:16-4:2”.",
      );
      return;
    }
    const activeTranslation = activeTranslations[0] ?? translations[0]?.code;
    if (!activeTranslation) {
      setReferenceError("Select a translation before jumping to a reference.");
      return;
    }
    setReferenceError(null);
    let validatedVerses: Awaited<ReturnType<typeof getVerseRange>>;
    try {
      validatedVerses = await getVerseRange(
        activeTranslation,
        parsed.verseId,
        parsed.endVerseId,
      );
    } catch (e) {
      if (requestId !== referenceJumpRequestId.current) return;
      setReferenceError(String(e));
      return;
    }
    if (requestId !== referenceJumpRequestId.current) return;
    if (validatedVerses.length === 0) {
      setReferenceError(
        `${parsed.citation} is not present in the selected ${activeTranslation} edition.`,
      );
      return;
    }
    // Set the location refs synchronously so the post-await guard below compares
    // against this jump's target (the mirror effect may not have run yet).
    selectedBookIdRef.current = parsed.book.id;
    selectedChapterRef.current = parsed.chapter;
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
          const verses = validatedVerses;
          if (requestId !== referenceJumpRequestId.current) return;
          // Drop the result if the user navigated to a different location while
          // the range was loading, so we never show a panel under the wrong chapter.
          if (
            selectedBookIdRef.current !== parsed.book.id ||
            selectedChapterRef.current !== parsed.chapter
          ) {
            return;
          }
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
          if (requestId !== referenceJumpRequestId.current) return;
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

  const onSelectSearchHit = (hit: SearchHit) => {
    setSearchPanelOpen(false);
    jumpToVerse(hit.verse_id, hit.translation_code);
  };

  const onSelectNote = (hit: NoteHit) => {
    setSearchPanelOpen(false);
    jumpToVerse(hit.verse_id, activeTranslations[0] ?? "KJV");
  };

  const handleSaveSearch = async () => {
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
  };

  const handleChangeSearchStrategy = (next: SearchStrategy) => {
    setSearchStrategy(next);
    saveSettingsPatch({ search_strategy: next });
  };

  const askCouncilAboutVerse = (_verseId: number, citation: string) => {
    setPendingCouncilQuestion(
      `Discuss the meaning, context, and any disputed interpretations of ${citation}.`,
    );
    setMode("council");
  };

  const selectMode = (nextMode: Mode) => {
    if (nextMode !== "reader") referenceJumpRequestId.current += 1;
    setMode(nextMode);
    if (nextMode !== "reader") setSearchQuery("");
    // Navigating to a mode dismisses any transient overlay so the chrome-less
    // shell never strands a full-screen panel/drawer over the new view (the
    // mode-nav now lives in the TopBar, behind these z-40 overlays).
    setSearchPanelOpen(false);
    setBookNavOpen(false);
    setNavDrawerOpen(false);
    setCommandPaletteOpen(false);
  };

  const updateSearchQuery = (nextQuery: string) => {
    setSearchQuery(nextQuery);
    if (nextQuery.trim()) setMode("reader");
  };

  const searchActive = searchQuery.trim().length > 0;
  const providerSetupComplete = settingsHasConfiguredAi(settings);
  const {
    tourOpen,
    tourStepIndex,
    tourDismissed,
    openTour,
    closeTour,
    goToTourStep,
    dismissTourPrompt,
    showProviderSetupPrompt,
    dismissProviderSetupPrompt,
  } = useGuidedTour({ selectMode, providerSetupComplete });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
        setCommandPaletteQuery("");
        return;
      }
      if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const target = (event.target as HTMLElement | null) ?? document.activeElement;
        const tag = target?.tagName;
        const isEditable =
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          (target instanceof HTMLElement && target.isContentEditable);
        if (isEditable) return;
        event.preventDefault();
        setSearchPanelOpen(true);
        return;
      }
      if (event.key === "Escape") {
        // Close the search overlay regardless of where focus currently sits
        // (e.g. focus falls back to <body> after the clear button vanishes).
        setSearchPanelOpen((open) => {
          if (open) return false;
          return open;
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Any path that sets a non-empty query (saved searches, command palette,
  // workspace "run search") should reveal the search results — which now live
  // only inside the overlay — so open it whenever a search becomes active.
  useEffect(() => {
    if (searchQuery.trim().length > 0) setSearchPanelOpen(true);
  }, [searchQuery]);

  const commandItems = useMemo<CommandItem[]>(() => {
    const query = commandPaletteQuery.trim();
    const dynamicItems: CommandItem[] = query
      ? [
          {
            id: "jump-to-query",
            category: "Jump",
            label: `Jump to “${query}”`,
            detail: "Go to this reference",
            run: () => {
              setReferenceInput(query);
              setCommandPaletteOpen(false);
              void jumpToReference(query);
            },
          },
          {
            id: "search-for-query",
            category: "Search",
            label: `Search for “${query}”`,
            detail: "Full-text search",
            run: () => {
              setCommandPaletteOpen(false);
              setSearchPanelOpen(true);
              setSearchQuery(query);
            },
          },
        ]
      : [];

    const items: CommandItem[] = [
      ...dynamicItems,
      {
        id: "mode-theology",
        category: "Go to",
        label: "Open Theology",
        detail: "Dynamic systematic theology",
        run: () => selectMode("theology"),
      },
      {
        id: "mode-reader",
        category: "Go to",
        label: "Open Reader",
        detail: "View Bible text",
        run: () => selectMode("reader"),
      },
      {
        id: "mode-council",
        category: "Go to",
        label: "Open Council",
        detail: "Ask and compare theological arguments",
        run: () => selectMode("council"),
      },
      {
        id: "mode-workspaces",
        category: "Go to",
        label: "Open Workspaces",
        detail: "Saved studies and exports",
        run: () => selectMode("workspaces"),
      },
      {
        id: "mode-resources",
        category: "Go to",
        label: "Open Resources",
        detail: "Search open study resources",
        run: () => selectMode("resources"),
      },
      {
        id: "mode-settings",
        category: "Go to",
        label: "Open Settings",
        detail: "Providers, data sources, backups",
        run: () => selectMode("settings"),
      },
      {
        id: "setup-ai-providers",
        category: "Settings",
        label: "Set Up AI Providers",
        detail: "Guided user-owned key, local, or gateway setup",
        run: () => {
          setSearchQuery("");
          selectMode("settings");
        },
      },
      {
        id: "open-guide",
        category: "Settings",
        label: "Open Guided Tour",
        detail: "Pause, rewind, and step through the app workflow",
        run: () => openTour(0),
      },
      ...translations.map((translation) => ({
        id: `translation-${translation.code}`,
        category: "Translation",
        label: `Read in ${translation.code}`,
        detail: translation.name ?? "Switch reading translation",
        run: () => {
          setActiveTranslations([translation.code]);
          saveSettingsPatch({ active_translations: translation.code });
          setSearchQuery("");
          setMode("reader");
        },
      })),
      ...books.map((book) => ({
        id: `book-${book.id}`,
        category: "Read",
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
          setSearchPanelOpen(true);
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
    commandPaletteQuery,
    jumpToVerse,
    readingHistory,
    saveSettingsPatch,
    savedSearches,
    translations,
    workspaceShortcuts,
  ]);

  return (
    <div className="app-shell h-full flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-amber-400 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-neutral-950"
        onClick={(event) => {
          event.preventDefault();
          const main = document.getElementById("main-content");
          main?.focus();
          main?.scrollIntoView();
        }}
      >
        Skip to main content
      </a>
      <TopBar
        mode={mode}
        onSelectMode={selectMode}
        theme={theme}
        onThemeToggle={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        uiScale={uiScale}
        canIncrease={canIncrease}
        canDecrease={canDecrease}
        onIncreaseUiScale={increaseUiScale}
        onDecreaseUiScale={decreaseUiScale}
        onOpenPalette={() => {
          setCommandPaletteOpen(true);
          setCommandPaletteQuery("");
        }}
        tourDismissed={tourDismissed}
        onOpenTour={() => openTour(0)}
        onToggleBookNav={() => setBookNavOpen((v) => !v)}
        onToggleNavDrawer={() => setNavDrawerOpen((v) => !v)}
      />
      {/* Onboarding prompts relocated out of the removed sidebar. They live at
          the AppShell top level (below the TopBar, above the reader) so they
          stay visible on every screen and keep their e2e testids. */}
      {mode === "reader" && (!tourDismissed || showProviderSetupPrompt) && (
        <div className="flex flex-wrap items-start gap-3 border-b border-neutral-800 px-4 py-2">
          {!tourDismissed && (
            <div
              className="soft-card flex items-center gap-3 p-3"
              data-testid="new-user-guide-prompt"
            >
              <div>
                <p className="text-sm font-medium text-neutral-100">New here?</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Take a quick tour of the main workflow.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openTour(0)}
                  className="btn-primary px-2.5 py-1 text-xs"
                >
                  Start guide
                </button>
                <button
                  type="button"
                  onClick={dismissTourPrompt}
                  className="btn-ghost px-2.5 py-1 text-xs"
                >
                  Hide
                </button>
              </div>
            </div>
          )}

          {showProviderSetupPrompt && (
            <div className="soft-card p-3 space-y-3" data-testid="provider-setup-prompt">
              <div>
                <p className="text-sm font-medium text-neutral-100">Connect AI when ready</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Reading, search, notes, and workspaces work offline. Council voices need a local Claude Code login, a user-owned API key, or a managed gateway.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    selectMode("settings");
                  }}
                  className="btn-primary px-2.5 py-1 text-xs"
                >
                  Set up AI
                </button>
                <button
                  type="button"
                  onClick={dismissProviderSetupPrompt}
                  className="btn-ghost px-2.5 py-1 text-xs"
                >
                  Use offline
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 overflow-auto bg-neutral-950/20 outline-none"
      >
        {warning && (
          <div className="m-4 flex items-start justify-between gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <span>{warning}</span>
            <button
              type="button"
              className="text-xs text-amber-100 hover:text-white"
              onClick={() => setWarning(null)}
            >
              Dismiss
            </button>
          </div>
        )}
        <ErrorBoundary key={mode} title="This view ran into a problem">
        <Suspense fallback={<div role="status" className="p-6 text-sm text-neutral-400">Loading view…</div>}>
        {mode === "reader" && !error && (
          /* Editorial reader control row (W6). Controls tucked into popovers;
             jump input always rendered. */
          <ReaderBar
            selectedBook={selectedBook}
            selectedChapter={selectedChapter}
            translations={translations}
            activeTranslations={activeTranslations}
            onToggleTranslation={toggleTranslation}
            fontScale={fontScale}
            onFontScaleChange={setReaderFontScale}
            readerLayout={readerLayout}
            onReaderLayoutChange={setReaderLayoutSetting}
            compareMode={compareMode}
            onCompareModeChange={setCompareMode}
            readerDensity={readerDensity}
            onReaderDensityChange={setReaderDensitySetting}
            syncScroll={syncScroll}
            onSyncScrollChange={setSyncScrollSetting}
            referenceInput={referenceInput}
            onReferenceInputChange={setReferenceInput}
            referenceError={referenceError}
            onReferenceErrorClear={() => setReferenceError(null)}
            onJump={() => void jumpToReference()}
          />
        )}
        {error ? (
          <ErrorState message={error} className="m-4" />
        ) : mode === "settings" ? (
          <SettingsPanel
            settings={settings}
            translations={translations}
            onUserDataChanged={refreshUserDataAndNavigation}
            onJumpToVerse={jumpToVerse}
            onSave={async (next) => {
              await queueSettingsSave(next);
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
              setSearchPanelOpen(true);
              setMode("reader");
            }}
            onOpenCouncilResult={(question, response) => {
              setWorkspaceCouncilResult({ question, response });
              setSearchQuery("");
              setMode("council");
            }}
          />
        ) : mode === "theology" ? (
          <TheologyPanel
            onAskCouncil={(nextQuestion) => {
              setPendingCouncilQuestion(nextQuestion);
              setSearchQuery("");
              setMode("council");
            }}
            onOpenGuide={() => {
              const theologyStep = TOUR_STEPS.findIndex((step) => step.id === "theology");
              openTour(theologyStep >= 0 ? theologyStep : 0);
            }}
            onOpenResources={() => {
              setSearchQuery("");
              setMode("resources");
            }}
          />
        ) : mode === "resources" ? (
          <ResourcesPanel
            onOpenDataSources={() => setMode("settings")}
            onAskCouncil={(nextQuestion) => {
              setPendingCouncilQuestion(nextQuestion);
              setSearchQuery("");
              setMode("council");
            }}
          />
        ) : mode === "tags" ? (
          <TagBrowser onJumpToVerse={(verseId) => jumpToVerse(verseId, activeTranslations[0] ?? "KJV")} />
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
            onOpenSettings={() => {
              setSearchQuery("");
              setMode("settings");
            }}
          />
        ) : !selectedBook || !selectedChapter ? (
          <ReaderPlaceholder title="Select a book" detail="Choose a book and chapter from the sidebar to begin reading." />
        ) : orderedActive.length === 0 ? (
          <ReaderPlaceholder title="Select a translation" detail="Enable at least one translation in the sidebar translation list." />
        ) : chapterDataReady && presentActive.length === 0 ? (
          <ReaderPlaceholder
            title="No text for this chapter"
            detail={`None of your enabled translations include ${selectedBook.name} ${selectedChapter}. Try another chapter, or enable a translation that covers it.`}
          />
        ) : (
          <>
            {compareMode && absentActive.length > 0 && (
              <p
                data-testid="absent-translations-note"
                className="px-6 pt-4 text-sm text-neutral-500"
              >
                No text in this chapter for {absentActive.map((t) => t.code).join(", ")}.
              </p>
            )}
            {presentActive.length === 1 || !compareMode ? (
              <ChapterReader
                bookName={selectedBook.name}
                chapter={selectedChapter}
                translationName={presentActive[0].name}
                translationCode={presentActive[0].code}
                language={presentActive[0].language}
                verses={chapterData[presentActive[0].code] ?? []}
                loading={loading}
                onJumpToVerse={jumpToVerse}
                highlights={highlights}
                rangeHighlights={rangeHighlights}
                notedVerseIds={notedVerseIds}
                rangeNotes={rangeNotes}
                onUserDataChanged={refreshUserDataAndNavigation}
                onAskCouncilAboutVerse={askCouncilAboutVerse}
                wordTokensByVerse={wordTokensByTranslation.get(presentActive[0].code)}
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
                translations={presentActive}
                chapterData={chapterData}
                loading={loading}
                fontScale={fontScale}
                density={readerDensity}
                onJumpToVerse={jumpToVerse}
              />
            ) : (
              <div className="min-h-full">
                {/* One shared chapter heading; each column shows only its
                    translation badge so the title is not repeated per column. */}
                <div className="px-6 pt-8 pb-3">
                  <h1 className="text-3xl font-semibold text-neutral-100">
                    {selectedBook.name} {selectedChapter}
                  </h1>
                </div>
                <div className="flex gap-0">
                {presentActive.map((t, idx) => (
                  <div
                    key={t.code}
                    className={
                      "flex-1 min-w-[360px] " +
                      (idx < presentActive.length - 1 ? "border-r border-neutral-800" : "")
                    }
                  >
                    <ChapterReader
                      bookName={selectedBook.name}
                      chapter={selectedChapter}
                      showChapterHeading={false}
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
        </Suspense>
        </ErrorBoundary>
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
      <BookNav
        open={bookNavOpen}
        onClose={() => setBookNavOpen(false)}
        books={books}
        selectedBookId={selectedBook?.id ?? null}
        selectedChapter={selectedChapter}
        selectedBook={selectedBook}
        onSelectBook={(b) => {
          setSelectedBook(b);
          setSelectedChapter(1);
          setMode("reader");
        }}
        onSelectChapter={setSelectedChapter}
      />
      <NavigationDrawer
        open={navDrawerOpen}
        onClose={() => setNavDrawerOpen(false)}
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
          setNavDrawerOpen(false);
        }}
        onRunSavedSearch={(s) => {
          setSearchQuery(s.query);
          setSearchFilterTranslation(s.translation_code ?? "all");
          setSearchFilterTestament((s.testament ?? "all") as SearchTestamentFilter);
          setSearchFilterBookId(s.book_id ?? 0);
          setSearchPanelOpen(true);
          setMode("reader");
          setNavDrawerOpen(false);
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
          setNavDrawerOpen(false);
        }}
        tags={tags}
        bookmarkTags={bookmarkTags}
        bookmarkTagFilter={bookmarkTagFilter}
        onSetBookmarkTagFilter={setBookmarkTagFilter}
        onAttachBookmarkTag={onAttachBookmarkTag}
        onDetachBookmarkTag={onDetachBookmarkTag}
      />
      {searchPanelOpen && (
        <SearchPanel
          onClose={() => setSearchPanelOpen(false)}
          searchScope={searchScope}
          setSearchScope={setSearchScope}
          searchQuery={searchQuery}
          updateSearchQuery={updateSearchQuery}
          searchActive={searchActive}
          searchStrategy={searchStrategy}
          onChangeSearchStrategy={handleChangeSearchStrategy}
          translations={translations}
          books={books}
          searchFilterTranslation={searchFilterTranslation}
          setSearchFilterTranslation={setSearchFilterTranslation}
          searchFilterTestament={searchFilterTestament}
          setSearchFilterTestament={setSearchFilterTestament}
          searchFilterBookId={searchFilterBookId}
          setSearchFilterBookId={setSearchFilterBookId}
          scriptureResults={visibleSearchResults}
          searchLoading={searchLoading}
          onSelectSearchHit={onSelectSearchHit}
          searchDegraded={searchDegraded}
          searchDegradedReason={searchDegradedReason}
          onSaveSearch={handleSaveSearch}
          noteResults={noteResults}
          noteLoading={noteLoading}
          onSelectNote={onSelectNote}
          noteTags={noteTags}
          noteTagFilter={noteTagFilter}
          setNoteTagFilter={setNoteTagFilter}
        />
      )}
      {commandPaletteOpen && (
        <CommandPalette
          query={commandPaletteQuery}
          onQueryChange={setCommandPaletteQuery}
          items={commandItems}
          onClose={() => setCommandPaletteOpen(false)}
        />
      )}
      {tourOpen && (
        <GuidedTour
          steps={TOUR_STEPS}
          currentIndex={tourStepIndex}
          onStepChange={goToTourStep}
          onClose={() => closeTour(false)}
          onFinish={() => closeTour(true)}
          onAction={(mode) => {
            selectMode(mode);
            closeTour(true);
          }}
        />
      )}
    </div>
  );
}

export default App;
