import { InfoBlock } from "./SettingsPrimitives";

const APP_NAME = "Bible AI";
const APP_VERSION = "0.1.0";

const SOURCE_ATTRIBUTIONS = [
  {
    name: "King James Version",
    license: "Rights review pending",
    source: "thiagobodruk/bible pinned JSON",
    detail: "Underlying 1769 text is represented as public domain outside the UK; the source repository states CC BY-NC 2.0 BR, and UK Letters Patent require territory-specific review.",
  },
  {
    name: "World English Bible",
    license: "Public Domain · trademark-sensitive name",
    source: "eBible.org ENGWEBP USFM",
    detail: "Bundled as the faithful 66-book Protestant WEB edition; modified text must not be presented under the World English Bible name.",
  },
  {
    name: "ASV and Young's Literal Translation",
    license: "Public Domain · lineage review pending",
    source: "scrollmapper/bible_databases",
    detail: "Pinned JSON transformations from an MIT-licensed repository; exact text lineage and release attribution remain part of the named rights review.",
  },
  {
    name: "Westminster Leningrad Codex and Textus Receptus",
    license: "Public-domain base texts · lineage review pending",
    source: "scrollmapper/bible_databases pinned JSON",
    detail: "Bundled as original-language text; the exact transformation provenance and attribution are pending named rights review.",
  },
  {
    name: "Open Scriptures Hebrew Bible morphology",
    license: "WLC text Public Domain · lemma/morphology CC BY 4.0",
    source: "openscriptures/morphhb",
    detail: "Original work of the Open Scriptures Hebrew Bible, available at https://github.com/openscriptures/morphhb.",
  },
  {
    name: "Open Scriptures Strong's dictionaries",
    license: "CC-BY-SA · version unresolved",
    source: "openscriptures/strongs pinned Greek and Hebrew JSON",
    detail: "The exact files claim CC-BY-SA without a version; attribution, share-alike, export, and redistribution treatment remain pending rights review.",
  },
  {
    name: "OpenBible cross-references",
    license: "Creative Commons Attribution · version unresolved",
    source: "a.openbible.info cross-reference dataset",
    detail: "Used for retrieval and reader context; exact license version and attribution obligations remain pending rights review.",
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
            value="Default channel is personal use; public release requires identity-bound rights, confidence, safety, accessibility, clean-profile, and multi-provider evidence."
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
          <InfoBlock label="Public release gate" value="Complete clean-profile/accessibility QA, confidence review, content-rights and safety review, and multi-provider Council QA before publishing." />
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
