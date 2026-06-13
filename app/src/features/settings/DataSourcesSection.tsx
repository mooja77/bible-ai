import type { ResourceSource, Translation } from "../../lib/bible";
import { SourceStatusBadge } from "./SettingsPrimitives";
import { resourceSourceStatus, resourceSourceMetadata } from "./settingsData";

const DEFERRED_DATA_SOURCES = [
  {
    name: "Douay-Rheims",
    status: "Phase 13",
    detail: "Public-domain source is available, but Vulgate versification needs explicit mapping before import.",
  },
  {
    name: "Septuagint / Apocrypha",
    status: "Phase 13",
    detail: "Treat as a dedicated corpus phase because book order, versification, and licensing need separate QA.",
  },
];

export function DataSourcesSection({
  translations,
  resourceSources,
}: {
  translations: Translation[];
  resourceSources: ResourceSource[];
}) {
  return (
      <section
        className="surface-panel rounded-lg p-4 space-y-4"
        data-testid="data-sources-screen"
      >
        <div>
          <h2 className="text-sm tracking-wider text-neutral-400">
            Data Sources
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Bundled corpora and deferred source decisions for audit and attribution.
          </p>
        </div>
        <ul className="divide-y divide-neutral-900 border border-neutral-900 rounded">
          {translations.map((translation) => (
            <li key={translation.code} className="px-3 py-2">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm text-neutral-200">
                  {translation.code} · {translation.name}
                </p>
                <div className="flex items-center gap-2">
                  <SourceStatusBadge status="bundled" />
                  <span className="text-xs text-neutral-500">{translation.kind}</span>
                </div>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                {translation.language}
                {translation.year ? ` · ${translation.year}` : ""} ·{" "}
                {translation.license}
              </p>
            </li>
          ))}
        </ul>
        {resourceSources.length > 0 && (
          <div className="border-t border-neutral-800 pt-3">
            <h3 className="text-xs tracking-wider text-neutral-500 mb-2">
              Open Resource Library
            </h3>
            <ul className="grid gap-2">
              {resourceSources.map((source) => {
                const metadata = resourceSourceMetadata(source);
                return (
                  <li key={source.id ?? source.slug} className="border border-neutral-900 rounded px-3 py-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm text-neutral-200">{source.title}</p>
                      <div className="flex items-center gap-2">
                        {metadata.reviewStatus === "unreviewed" && (
                          <span
                            className="text-[0.6875rem] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300"
                            data-testid="source-unreviewed-badge"
                          >
                            unreviewed
                          </span>
                        )}
                        <SourceStatusBadge status={resourceSourceStatus(source)} />
                        <span className="text-xs text-neutral-500">{source.license}</span>
                      </div>
                    </div>
                    <p className="text-xs text-neutral-600 mt-0.5">
                      {source.version ? `Version ${source.version}` : "No version recorded"}
                      {source.source_url ? ` · ${source.source_url}` : ""}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1">{source.attribution}</p>
                    {metadata.review && (
                      <p className="text-xs text-neutral-500 mt-1">
                        Review: {metadata.review}
                      </p>
                    )}
                    {metadata.redistribution && (
                      <p className="text-xs text-neutral-500 mt-1">
                        Redistribution: {metadata.redistribution}
                      </p>
                    )}
                    {metadata.shareAlike && (
                      <p className="text-xs text-amber-200 mt-1">
                        Share-alike: {metadata.shareAlike}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <div className="border-t border-neutral-800 pt-3">
          <h3 className="text-xs tracking-wider text-neutral-500 mb-2">
            Candidate Sources
          </h3>
          <ul className="grid gap-2">
            {DEFERRED_DATA_SOURCES.map((source) => (
              <li key={source.name} className="border border-neutral-900 rounded px-3 py-2">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm text-neutral-200">{source.name}</p>
                  <div className="flex items-center gap-2">
                    <SourceStatusBadge status="deferred" />
                    <span className="text-xs text-amber-300">{source.status}</span>
                  </div>
                </div>
                <p className="text-xs text-neutral-500 mt-1">{source.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
  );
}
