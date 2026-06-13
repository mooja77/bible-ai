# Sample Study Packets

These are example Study Packet v1 exports, matching the folder format produced by
the in-app "Export Study Packet" button (see `docs/study-packet-v1-contract.md`).
They illustrate the file layout, the Scripture / Source / AI / User content
labels, and the `manifest.json` shape. They are also scanned in CI by
`app/scripts/scan-packet-leaks.mjs`, so they must stay free of secrets and local
paths.

The five target workflows from the contract are:

1. `001-hard-passage` - a debated/difficult passage (included here).
2. word study - a Greek/Hebrew term study.
3. resource critique - evaluating a resource excerpt against Scripture.
4. small-group teaching - a session plan.
5. theology update - linking a Council result into a Theology topic.

The remaining four are best generated from real Council sessions via the in-app
export, since their content depends on actual retrieval and provider output.
`001-hard-passage` is a hand-authored, representative reference.
