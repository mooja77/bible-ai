# Council confidence-adjustment review

The Council's soft layer is a deterministic **confidence adjustment**, not a
probability and not an empirically calibrated estimate of theological truth.
New responses state this in their payload with `empirically_calibrated: false`
and `method: deterministic_read_down_v1`.

## Labelled agreement process

1. Produce a complete non-mock Council fixture through the shipped pipeline.
2. From `app/`, run `npm run qa:confidence-review:template`.
3. A named theological-quality reviewer reads each case's retrieved evidence,
   disagreements, limitations, and synthesis, then completes every human field.
4. Run `npm run qa:confidence-review:verify`.
5. The public-release orchestrator runs this verifier again and will not pass
   while the review is missing, pending, stale, below policy, or blocking.

The review is SHA-256-bound to its source fixture and fails if it is anonymous,
incomplete, stale, below 20 cases, materially different from the human bands,
overstates confidence too often, or contains a human-identified blocking issue.
The v1 thresholds are committed inside the generated review so a policy change
is visible in evidence rather than hidden in code.

Historical recorded fixtures may contain a field named `calibrated`; the
template normalizes that old field to `system_adjusted_band`. New Council runs
write `adjusted`. No UI or release note should call the heuristic calibrated
until a representative labelled program has been completed and a human owner
explicitly approves that stronger claim.
