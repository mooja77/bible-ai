# Content Rights Evidence Dossier

Status: ENGINEERING RESEARCH COMPLETE — named rights approval pending
Prepared: 2026-07-14
Scope: the exact 11 artifacts locked by `data/corpus-lock.json`
Intended release model: free, non-commercial Bible study app; no paid access,
subscriptions, advertising, or sale of bundled content

This dossier collects the public evidence a named reviewer needs to make the
release decision recorded in `app/release/content-review.json`. It is an
engineering record, not legal advice and not an approval. A public release
remains blocked until the reviewer confirms the intended territories and
distribution channels, resolves every item marked **open**, and signs the
content-review gate.

## Material findings

1. The exact KJV JSON is acquired from a repository whose pinned README applies
   CC BY-NC 2.0 BR to the repository and separately says Bible versions belong
   to their respective owners. The intended free, non-commercial release is
   consistent with the license's non-commercial condition, but attribution,
   modification marking, and permitted scope still need named confirmation.
   That compilation notice must not be collapsed into the underlying KJV
   text's public-domain status.
2. KJV rights are territory-sensitive. eBible describes the text as public
   domain outside the UK but identifies non-expiring UK Letters Patent;
   Cambridge states that it administers Authorized Version rights for the Crown
   and routes Bible permissions through its Bibles team. The reviewer must
   determine whether the planned electronic distribution and each territory
   need permission.
3. The two Strong's files contain an exact embedded notice saying the 2009/2010
   Open Scriptures JSON versions are `CC-BY-SA`, but they do not identify a
   Creative Commons version. The pinned repository has no root license. A 2025
   repository licensing issue also points to a separate combined XHTML artifact
   whose own header says GPL 3.0; that discussion did not resolve the JSON
   files' exact CC version or the relationship between the notices. The exact
   terms, attribution, source lineage, and share-alike treatment therefore
   remain open.
4. OpenBible.info labels the cross-reference content “Creative Commons
   Attribution,” and the official license link resolves to CC BY 4.0. The
   release must preserve attribution, link the license, and identify the app's
   normalized/indexed transformations.
5. MorphHB is the clearest attributed source: its pinned license places the WLC
   text in the public domain and licenses lemma/morphology work under CC BY 4.0,
   with a specified attribution.
6. The scrollmapper repository is MIT-licensed, but it aggregates Bible texts
   with source-specific rights. MIT coverage for repository code/formatting does
   not replace a source-by-source content determination.

## Locked-artifact evidence

The version and checksum columns below are copied from the lock. Reviewers
should compare them to the generated template; the verifier now rejects a
signed review if either identity changes.

| Source | Locked identity | SHA-256 | Public evidence | Engineering conclusion | Open reviewer decision |
|---|---|---|---|---|---|
| KJV | `thiagobodruk/bible@49a869c278bcd91ced78a5d64fe2d92ac812e2ca` | `cb31a8aec26786c967e8cd52c325bbbca82a34d4e6c0aec2d2901166f2dec483` | [Pinned source](https://raw.githubusercontent.com/thiagobodruk/bible/49a869c278bcd91ced78a5d64fe2d92ac812e2ca/json/en_kjv.json); [pinned repository README](https://raw.githubusercontent.com/thiagobodruk/bible/49a869c278bcd91ced78a5d64fe2d92ac812e2ca/README.md); [eBible KJV notice](https://ebible.org/eng-kjv2006/copyright.htm); [eBible public-domain/Letters Patent explanation](https://ebible.org/publicdomain.htm); [Cambridge Bible permissions](https://www.cambridge.org/gb/rights-and-permissions/permissions) | Underlying 1769 KJV is represented as public domain outside the UK; acquisition repository notice is CC BY-NC 2.0 BR; the intended release is free and non-commercial; UK rights are exceptional. | Confirm attribution and modification marking, bind approval to the non-commercial release scope, and decide permitted territories/channels and UK treatment. **Open; release-critical.** |
| ASV | `scrollmapper/bible_databases@ba07bc991644d82b24426b920245eb4422daa769` | `61f53a4dd0ae412f7c925ec7113bc02c6de44d0402b94d0cee264bcd69417ea8` | [Pinned source](https://raw.githubusercontent.com/scrollmapper/bible_databases/ba07bc991644d82b24426b920245eb4422daa769/formats/json/ASV.json); [pinned MIT license](https://raw.githubusercontent.com/scrollmapper/bible_databases/ba07bc991644d82b24426b920245eb4422daa769/LICENSE); [official eBible ASV front matter](https://ebible.org/eng-asv/FRT01.htm) | The 1901 ASV is represented as public domain; the exact JSON comes from an MIT repository. | Confirm the exact text lineage and notice/attribution to ship. |
| WEB | `ENGWEBP repository snapshot acquired 2026-05-02` | `2c77e11f0d26863f7f4a507b40c58651d55399e6d760223b3550908331bc994f` | [Official edition page](https://ebible.org/find/show.php?id=engwebp); [public-domain and trademark rules](https://ebible.org/publicdomain.htm); [eBible legal page](https://ebible.org/legal.php) | Public-domain text; the World English Bible name is trademark-sensitive and should identify only a faithful copy. | Confirm the committed snapshot remains a faithful ENGWEBP copy and approve exact product/export attribution. |
| YLT | `scrollmapper/bible_databases@ba07bc991644d82b24426b920245eb4422daa769` | `853fb222c1a32f3f864c4aaed4c68082ec23d0c450135206e7c5c5f014166888` | [Pinned source](https://raw.githubusercontent.com/scrollmapper/bible_databases/ba07bc991644d82b24426b920245eb4422daa769/formats/json/YLT.json); [pinned MIT license](https://raw.githubusercontent.com/scrollmapper/bible_databases/ba07bc991644d82b24426b920245eb4422daa769/LICENSE); [official eBible YLT edition](https://ebible.org/pdf/engylt/) | Young's 1898 text is represented as public domain; exact JSON comes from an MIT repository. | Confirm exact lineage and notice/attribution to ship. |
| WLC | `scrollmapper/bible_databases@ba07bc991644d82b24426b920245eb4422daa769` | `ac61c4bb978bc17226e4fff8c97aa3634301c9b46bd0a4b859d47095cac3b597` | [Pinned source](https://raw.githubusercontent.com/scrollmapper/bible_databases/ba07bc991644d82b24426b920245eb4422daa769/formats/json/WLC.json); [pinned MIT license](https://raw.githubusercontent.com/scrollmapper/bible_databases/ba07bc991644d82b24426b920245eb4422daa769/LICENSE); [MorphHB license statement](https://raw.githubusercontent.com/openscriptures/morphhb/3d15126fb1ef74867fc1434be1942e837932691f/LICENSE.md) | WLC base text is represented as public domain; provenance of this exact JSON transformation still needs confirmation. | Confirm source lineage, database/formatting rights, and attribution. |
| TR | `scrollmapper/bible_databases@ba07bc991644d82b24426b920245eb4422daa769` | `3ee63c508133c65eb2900bef04ed3d5a83137eec4d1b1867cb4a605f2339fb2e` | [Pinned source](https://raw.githubusercontent.com/scrollmapper/bible_databases/ba07bc991644d82b24426b920245eb4422daa769/formats/json/TR.json); [pinned MIT license](https://raw.githubusercontent.com/scrollmapper/bible_databases/ba07bc991644d82b24426b920245eb4422daa769/LICENSE); [Open Scriptures prototype source notice](https://prototypes.openscriptures.org/manuscript-comparator/?page=3&passage=luke) | The source notice represents the underlying Textus Receptus as public domain; exact JSON transformation is in the MIT repository. | Confirm exact edition lineage and attribution. |
| openbible-xrefs | snapshot acquired 2026-05-02 | `533e055792af278032f87ab8e4cce6c1b3899f776cea1c711cfd290c2052b4b2` | [Official cross-reference page and license notice](https://www.openbible.info/labs/cross-references/); [linked CC BY 4.0 license](https://creativecommons.org/licenses/by/4.0/); [project background](https://www.openbible.info/blog/2010/04/new-in-labs-cross-references/) | CC BY 4.0 permits redistribution and adaptation with attribution and modification marking. | Confirm exact attribution placement and treatment of normalized mappings, indexes, and exports. **Open for named approval; evidence resolved.** |
| strongs-greek | `openscriptures/strongs@0acd2f251c2d35ff8db2dece4e0593979d3ac223` | `7624ee738ae47e80f1a352223e28a26d011c9cd4898822cee52f47a010c04efd` | [Pinned source](https://raw.githubusercontent.com/openscriptures/strongs/0acd2f251c2d35ff8db2dece4e0593979d3ac223/greek/strongs-greek-dictionary.js); exact file header: “Copyright 2009, Open Scriptures. CC-BY-SA. Derived from XML.”; [repository license issue #11](https://github.com/openscriptures/strongs/issues/11); [separate pinned combined XHTML GPL 3.0 header](https://github.com/openscriptures/strongs/blob/0acd2f251c2d35ff8db2dece4e0593979d3ac223/strongs-dictionary.xhtml) | The JSON header asserts CC BY-SA, but its version/full terms are absent and the repository contains a separate differently licensed combined artifact. Do not infer that either notice automatically resolves the other file's lineage or terms. | Obtain a version-specific license and lineage conclusion; define attribution and share-alike handling for bundled data, exports, and derived indexes. **Open; release-critical.** |
| strongs-hebrew | `openscriptures/strongs@0acd2f251c2d35ff8db2dece4e0593979d3ac223` | `5ce6aeed551c709f49bcfa341cadf2f34bc7599b85d9de9e6ac2ecbf60fc3739` | [Pinned source](https://raw.githubusercontent.com/openscriptures/strongs/0acd2f251c2d35ff8db2dece4e0593979d3ac223/hebrew/strongs-hebrew-dictionary.js); exact file header: “Copyright 2010, Open Scriptures. CC-BY-SA. Derived from XML.”; [repository license issue #11](https://github.com/openscriptures/strongs/issues/11); [separate pinned combined XHTML GPL 3.0 header](https://github.com/openscriptures/strongs/blob/0acd2f251c2d35ff8db2dece4e0593979d3ac223/strongs-dictionary.xhtml) | Same unresolved CC-version, full-text, and lineage ambiguity as the Greek JSON; the separate GPL notice is evidence to review, not a substitute conclusion. | Obtain version-specific terms and a lineage conclusion; define attribution and share-alike handling. **Open; release-critical.** |
| morphhb | `openscriptures/morphhb@3d15126fb1ef74867fc1434be1942e837932691f` | aggregate `c1b448b47e2a09d7edbf35d845e27be0e9022de7587b73df7745e22e12b66c5c` | [Pinned license](https://raw.githubusercontent.com/openscriptures/morphhb/3d15126fb1ef74867fc1434be1942e837932691f/LICENSE.md); [pinned repository](https://github.com/openscriptures/morphhb/tree/3d15126fb1ef74867fc1434be1942e837932691f) | WLC text public domain; lemma and morphology work CC BY 4.0. License specifies attribution to the Open Scriptures Hebrew Bible project and repository. | Confirm the exact attribution placement in app notices/exports and whether transformations must be marked. |
| wlc-verse-map | `openscriptures/morphhb@65214d2bdf57f01feb4822c22c5b0d4de032891f` | `6cd269ca3dccef2cb944b9d9dd8afc950f929dab53a534f1268d23affa983163` | [Pinned source](https://raw.githubusercontent.com/openscriptures/morphhb/65214d2bdf57f01feb4822c22c5b0d4de032891f/wlc/VerseMap.xml); [license at the pinned revision](https://raw.githubusercontent.com/openscriptures/morphhb/65214d2bdf57f01feb4822c22c5b0d4de032891f/LICENSE.md) | Project mapping data is part of the MorphHB repository; the current lock deliberately leaves its classification pending. | Confirm whether the map is CC BY 4.0 project work, public-domain WLC support data, or another category, then set attribution. **Open.** |

## Derived artifacts that must be covered by the decision

The signed review should expressly cover the shipped SQLite representation,
FTS indexes, normalized verse mappings, local semantic embeddings, installer
copies, backups, and user exports. These are generated artifacts, not extra
upstream sources, but a reviewer must decide which attribution, modification,
and share-alike obligations follow them.

## Reviewer completion procedure

1. Name every target territory and channel (for example direct download,
   GitHub Releases, Microsoft Store, or partner distribution).
   Confirm that `release_scope` remains `free_noncommercial`, free of charge,
   and without paid access, subscriptions, advertising, or bundled-content
   sales. Any future scope change requires a new rights review.
2. Resolve the KJV scope/territory question and the two Strong's license issues
   above, and confirm OpenBible attribution/transform marking. If any cannot be
   resolved, remove/replace that source and rebuild the corpus rather than
   marking it approved.
3. Regenerate the identity-bound template:

   ```powershell
   cd app
   npm run qa:content-review:template
   ```

4. For every source, verify the locked version/checksum and short lock license
   label, then independently record the reviewer-authored license conclusion,
   evidence references, redistribution scope, exact attribution text, and
   obligations. Then make the three confirmation fields true only after review.
5. Record a non-privileged decision reference and run:

   ```powershell
   npm run qa:content-review:verify
   npm run qa:public-release:verify
   ```

The verification script checks evidence completeness and exact lock identity;
it cannot determine whether the legal conclusion itself is correct.
