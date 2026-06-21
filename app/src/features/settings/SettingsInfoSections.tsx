import { InfoBlock } from "./SettingsPrimitives";

const APP_NAME = "Bible AI";
const APP_VERSION = "0.1.0";

const SOURCE_ATTRIBUTIONS = [
  {
    name: "King James Version",
    license: "Public Domain",
    source: "thiagobodruk/bible",
    detail: "Bundled as KJV verse text.",
  },
  {
    name: "World English Bible",
    license: "Public Domain",
    source: "eBible.org ENGWEBP USFM",
    detail: "Bundled as the 66-book Protestant WEB edition.",
  },
  {
    name: "ASV, YLT, WLC, TR, DRC assessment cache",
    license: "Public Domain in ingest metadata",
    source: "scrollmapper/bible_databases",
    detail: "DRC remains assessment-only until alternate versification is implemented.",
  },
  {
    name: "Open Scriptures morphology and Strong's dictionaries",
    license: "CC-BY / CC-BY-SA in ingest metadata",
    source: "openscriptures/morphhb and openscriptures/strongs",
    detail: "Used for word-study metadata and original-language lookup.",
  },
  {
    name: "OpenBible cross-references",
    license: "CC-BY",
    source: "a.openbible.info cross-reference dataset",
    detail: "Used for cross-reference retrieval and reader context.",
  },
];

export function LicenseAttributionSection() {
  return (
      <section
        className="space-y-5 pt-6"
        data-testid="license-attribution-screen"
      >
        <div className="editorial-rule" aria-hidden="true" />
        <div>
          <span className="section-kicker">Disclosures</span>
          <h2 className="editorial-section-h2">
            License & Attribution
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Public-release disclosures for bundled corpus, study metadata, and privacy.
          </p>
        </div>
        <ul className="divide-y divide-neutral-900 border border-neutral-900 rounded">
          {SOURCE_ATTRIBUTIONS.map((source) => (
            <li key={source.name} className="px-3 py-2">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm text-neutral-200">{source.name}</p>
                <span className="text-xs text-neutral-500">{source.license}</span>
              </div>
              <p className="text-xs text-neutral-400 mt-1">{source.source}</p>
              <p className="text-xs text-neutral-500 mt-1">{source.detail}</p>
            </li>
          ))}
        </ul>
        <div className="grid md:grid-cols-2 gap-3 border-t border-neutral-800 pt-3">
          <InfoBlock
            label="Local data"
            value="Notes, workspaces, bookmarks, settings, backups, and Council history are stored on this machine."
          />
          <InfoBlock
            label="Provider calls"
            value="Council requests send the question and retrieved evidence only to providers the user configures."
          />
          <InfoBlock
            label="Exports"
            value="Export and source-drawer tests check that local Windows paths and provider key names are not exposed."
          />
          <InfoBlock
            label="Distribution decision"
            value="Default channel is personal use; public release requires manual clean-profile QA and multi-provider QA."
          />
        </div>
      </section>
  );
}

export function AboutDistributionSection() {
  return (
      <section
        className="space-y-5 pt-6"
        data-testid="about-distribution-screen"
      >
        <div className="editorial-rule" aria-hidden="true" />
        <div>
          <span className="section-kicker">Release</span>
          <h2 className="editorial-section-h2">
            About & Distribution
          </h2>
          <p className="text-xs text-neutral-500 mt-1">
            Version, privacy posture, and release readiness notes.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <InfoBlock label="Version" value={`${APP_NAME} ${APP_VERSION}`} />
          <InfoBlock label="Release mode" value="Personal-use release candidate with public-release disclosures included" />
          <InfoBlock label="Privacy" value="User data, provider keys, and backups stay local unless a provider call is submitted." />
          <InfoBlock label="Public release gate" value="Complete clean-profile installer QA and multi-provider Council QA before publishing." />
        </div>
        <div className="border-t border-neutral-800 pt-3">
          <span className="section-kicker mb-2 block">
            Release Notes
          </span>
          <ul className="list-disc list-inside text-xs text-neutral-400 space-y-1">
            <li>Council transparency views explain ranking, disagreement, evidence, and provider failures.</li>
            <li>Workspaces export saved studies, Council answers, notes, and search results.</li>
            <li>Settings now exposes provider tests, data sources, backup/restore, and distribution status.</li>
          </ul>
        </div>
      </section>
  );
}
