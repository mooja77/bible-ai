import type { TheologyLink, TheologyTopic } from "../../lib/bible";
import {
  relationLabel,
  theologyLinkKindLabel,
  theologyLinkPreview,
  type DoctrineRelationKind,
  type DoctrineRelationPayload,
} from "./theologyData";

export function DoctrineMap({
  topic,
  subtopics,
  relations,
}: {
  topic: TheologyTopic;
  subtopics: TheologyTopic[];
  relations: Array<{ link: TheologyLink; payload: DoctrineRelationPayload }>;
}) {
  const relationTone: Record<DoctrineRelationKind, string> = {
    depends_on: "border-sky-500/40 bg-sky-500/10 text-sky-200",
    supports: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
    tension: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  };
  const relationLine: Record<DoctrineRelationKind, string> = {
    depends_on: "bg-sky-500/45",
    supports: "bg-emerald-500/45",
    tension: "bg-amber-500/55",
  };
  const hasMapItems = relations.length > 0 || subtopics.length > 0;

  return (
    <section className="soft-card p-3 space-y-3" data-testid="doctrine-map">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-neutral-200">Doctrine map</h3>
        <span className="text-xs text-neutral-600">
          {relations.length} relation{relations.length === 1 ? "" : "s"} · {subtopics.length} subtopic
          {subtopics.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.25fr)] gap-3">
        <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-3">
          <p className="text-xs tracking-wider text-amber-300">Current topic</p>
          <p className="text-base font-semibold text-neutral-100 mt-1">{topic.title}</p>
          {topic.summary && (
            <p className="text-xs text-neutral-400 mt-2 line-clamp-3">{topic.summary}</p>
          )}
        </div>
        <div className="space-y-2">
          {!hasMapItems && (
            <p className="rounded border border-neutral-900 px-3 py-3 text-sm text-neutral-500">
              No doctrine links or subtopics mapped yet.
            </p>
          )}
          {relations.map(({ link, payload }) => (
            <div
              key={link.id ?? `${payload.relation}-${payload.target_topic_id}-${payload.target_topic_title}`}
              className="grid grid-cols-[2.5rem_1fr] items-stretch gap-2"
            >
              <div className="flex items-center justify-center">
                <span className={`h-px w-full ${relationLine[payload.relation]}`} />
              </div>
              <div className={`rounded border px-3 py-2 ${relationTone[payload.relation]}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {relationLabel(payload.relation)} {payload.target_topic_title ?? "related topic"}
                  </p>
                  <span className="text-[0.6875rem] tracking-wider opacity-80">
                    {payload.relation.replace(/_/g, " ")}
                  </span>
                </div>
                {payload.note && (
                  <p className="text-xs text-neutral-300 mt-1 line-clamp-2">{payload.note}</p>
                )}
              </div>
            </div>
          ))}
          {subtopics.map((subtopic) => (
            <div key={subtopic.id} className="grid grid-cols-[2.5rem_1fr] items-stretch gap-2">
              <div className="flex items-center justify-center">
                <span className="h-px w-full bg-neutral-600/50" />
              </div>
              <div className="rounded border border-neutral-800 bg-neutral-900/40 px-3 py-2">
                <p className="text-sm font-semibold text-neutral-200">Subtopic: {subtopic.title}</p>
                {subtopic.summary && (
                  <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{subtopic.summary}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function TheologyEvidenceSection({
  title,
  links,
  onRemove,
}: {
  title: string;
  links: TheologyLink[];
  onRemove: (id: number) => Promise<void>;
}) {
  return (
    <section className="border border-neutral-900 rounded px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-xs tracking-wider text-neutral-500">{title}</h4>
        <span className="text-xs text-neutral-600">{links.length}</span>
      </div>
      <ul className="mt-2 space-y-2">
        {links.map((link) => (
          <li
            key={link.id ?? `${link.link_kind}-${link.title}`}
            className="rounded border border-neutral-900/80 px-3 py-2 flex items-start justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="text-sm text-neutral-200">{link.title ?? "Untitled link"}</p>
              <p className="text-xs text-neutral-500">
                {theologyLinkKindLabel(link)}
                {link.target_id ? ` #${link.target_id}` : ""}
              </p>
              {theologyLinkPreview(link) && (
                <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                  {theologyLinkPreview(link)}
                </p>
              )}
            </div>
            {link.id && (
              <button
                type="button"
                onClick={() => void onRemove(link.id!)}
                className="btn-secondary px-2 py-1 text-xs"
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProgressMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="soft-card px-3 py-2">
      <p className="text-xs tracking-wider text-neutral-500">{label}</p>
      <p className="text-lg font-semibold text-neutral-100">{value}</p>
    </div>
  );
}

export function TheologyTextarea({
  label,
  value,
  onChange,
  rows = 5,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs tracking-wider text-neutral-500">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        aria-label={label}
        className="settings-input resize-y"
      />
    </label>
  );
}
