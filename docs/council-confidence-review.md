# Council confidence-adjustment review

The Council's soft layer is a deterministic **confidence adjustment**, not a
probability and not an empirically calibrated estimate of theological truth.
New responses state this in their payload with `empirically_calibrated: false`
and `method: deterministic_read_down_v1`.

## Labelled agreement process

1. Produce a complete non-mock Council fixture through the shipped pipeline.
2. From `app/`, run `npm run qa:confidence-review:template`.
3. Run `npm run qa:confidence-review:packet`. This creates the readable,
   fixture-bound `release/council-confidence-review-packet.md`; its header SHA
   must match the review JSON and fixture.
4. A named theological-quality reviewer reads each case's retrieved evidence,
   both provider analyses, disagreements, limitations, final synthesis, judge
   findings, and kill test, then completes every human field in
   `release/council-confidence-review.json`. The packet is evidence, not the
   signed decision.
5. Run `npm run qa:confidence-review:verify`.
6. The public-release orchestrator runs this verifier again and will not pass
   while the review is missing, pending, stale, below policy, or blocking.

The review is SHA-256-bound to its source fixture and fails if it is anonymous,
incomplete, stale, below 20 cases, materially different from the human bands,
overstates confidence too often, or contains a human-identified blocking issue.
The v1 thresholds are committed inside the generated review so a policy change
is visible in evidence rather than hidden in code.

## Human label rubric

- `contested`: defensible readings or material challenges prevent a stable
  confidence priority.
- `low`: substantial evidence, coverage, or reasoning weaknesses materially
  limit reliance.
- `moderate`: substantially grounded and useful, with meaningful disclosed
  limitations.
- `high`: direct evidence and challenge checks strongly support the answer,
  with no material unresolved weakness.

The `confidence_humility_score` is `0` when important limits or dissent are
materially understated, `1` when the major limits are visible but incomplete or
uneven, and `2` when dissent, vulnerable claims, change conditions, and limits
are clear and proportionate. These labels evaluate the confidence treatment;
they do not grade denominational correctness.

Historical recorded fixtures may contain a field named `calibrated`; the
template normalizes that old field to `system_adjusted_band`. New Council runs
write `adjusted`. No UI or release note should call the heuristic calibrated
until a representative labelled program has been completed and a human owner
explicitly approves that stronger claim.
