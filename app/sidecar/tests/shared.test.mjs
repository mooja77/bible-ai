/**
 * Unit tests for the sidecar's LLM-response handling — the highest-risk,
 * previously-untested code path. Run with `npm test` from app/sidecar
 * (or `node --test tests/`). No test-framework dependency: uses node:test.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  extractJson,
  sanitiseJsonText,
  normaliseResult,
  parseResponse,
  buildVoicePrompt,
  buildSynthesisPrompt,
  redactSecrets,
} from "../providers/_shared.mjs";

/** A minimal but structurally valid CouncilResult-ish object. */
function validResult() {
  return {
    positions: [
      {
        label: "Position A",
        weight: 0.6,
        summary: "First position.",
        supporting_evidence_ids: [1001001],
        challenging_evidence_ids: [],
        why_not_higher: "Limited evidence.",
        confidence_rationale: "Medium support.",
        weakest_link: "Single citation.",
        what_would_change_this: "More passages.",
        interpretive_moves: ["Reads the text plainly."],
        argument_map: {
          nodes: [
            { id: "n1", kind: "claim", label: "Claim", detail: "A claim.", verse_ids: [1001001] },
            { id: "n2", kind: "support", label: "Support", detail: "Support.", verse_ids: [] },
          ],
          edges: [{ from: "n2", to: "n1", label: "supports" }],
        },
        evidence: [
          {
            verse_id: 1001001,
            citation: "Genesis 1:1",
            translation_code: "KJV",
            quote: "In the beginning...",
            reasoning: "Direct citation.",
          },
        ],
      },
      {
        label: "Position B",
        weight: 0.4,
        summary: "Second position.",
        supporting_evidence_ids: [],
        challenging_evidence_ids: [],
        why_not_higher: "",
        confidence_rationale: "",
        weakest_link: "",
        what_would_change_this: "",
        interpretive_moves: [],
        argument_map: { nodes: [], edges: [] },
        evidence: [],
      },
    ],
    dissent_notes: "A minority view is preserved.",
    unresolved_tensions: ["Continuity vs discontinuity."],
    synthesis: "The voices diverge on emphasis.",
    confidence: "medium",
    confidence_rationale: "Evidence is indirect.",
    evidence_classification: [
      { verse_id: 1001001, status: "used", reasoning: "Cited directly." },
    ],
    research_trail: [
      {
        id: "e1",
        label: "Question framed",
        detail: "The question was received.",
        event_type: "question",
        status: "complete",
        related_position: null,
        related_verse_ids: [],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// extractJson
// ---------------------------------------------------------------------------

test("extractJson: pulls JSON from a ```json fenced block", () => {
  const out = extractJson('prose\n```json\n{"a":1}\n```\nmore prose');
  assert.equal(out, '{"a":1}');
});

test("extractJson: pulls JSON from an unlabelled fenced block", () => {
  const out = extractJson('```\n{"a":1}\n```');
  assert.equal(out, '{"a":1}');
});

test("extractJson: pulls a bare object out of surrounding prose", () => {
  const out = extractJson('Here is my answer: {"a":1,"b":2} — done.');
  assert.equal(out, '{"a":1,"b":2}');
});

test("extractJson: returns a balanced nested object", () => {
  const out = extractJson('{"outer":{"inner":1}}');
  assert.equal(out, '{"outer":{"inner":1}}');
});

test("extractJson: stops at the balanced close brace, ignoring trailing prose", () => {
  // first-{ to last-} would overshoot to the brace in the closing remark.
  const out = extractJson('{"a":1} — hope that helps }');
  assert.equal(out, '{"a":1}');
});

test("extractJson: ignores braces inside JSON string values", () => {
  const out = extractJson('{"note":"a } brace in a string"}');
  assert.deepEqual(JSON.parse(out), { note: "a } brace in a string" });
});

test("extractJson: returns null when there is no JSON", () => {
  assert.equal(extractJson("no json here"), null);
  assert.equal(extractJson(""), null);
  assert.equal(extractJson(null), null);
});

// ---------------------------------------------------------------------------
// sanitiseJsonText
// ---------------------------------------------------------------------------

test("sanitiseJsonText: strips line comments", () => {
  const cleaned = sanitiseJsonText('{\n  "a": 1 // a comment\n}');
  assert.deepEqual(JSON.parse(cleaned), { a: 1 });
});

test("sanitiseJsonText: strips block comments", () => {
  const cleaned = sanitiseJsonText('{ /* leading */ "a": 1 }');
  assert.deepEqual(JSON.parse(cleaned), { a: 1 });
});

test("sanitiseJsonText: drops trailing commas before } and ]", () => {
  const cleaned = sanitiseJsonText('{ "a": [1, 2, ], "b": 3, }');
  assert.deepEqual(JSON.parse(cleaned), { a: [1, 2], b: 3 });
});

test("sanitiseJsonText: preserves a comma inside a string", () => {
  const cleaned = sanitiseJsonText('{ "a": "x, y, z" }');
  assert.deepEqual(JSON.parse(cleaned), { a: "x, y, z" });
});

test("sanitiseJsonText: preserves // inside a string (e.g. a URL)", () => {
  const cleaned = sanitiseJsonText('{ "url": "http://example.com" }');
  assert.deepEqual(JSON.parse(cleaned), { url: "http://example.com" });
});

test("sanitiseJsonText: preserves an escaped quote inside a string", () => {
  const cleaned = sanitiseJsonText('{ "a": "he said \\"hi\\"," }');
  assert.deepEqual(JSON.parse(cleaned), { a: 'he said "hi",' });
});

// ---------------------------------------------------------------------------
// redactSecrets
// ---------------------------------------------------------------------------

test("redactSecrets: strips configured provider secrets from nested values", () => {
  const out = redactSecrets(
    {
      error: "OpenAI rejected sk-test-secret-value",
      nested: ["token gateway-token-value was refused"],
      safe: "keep this",
    },
    {
      OPENAI_API_KEY: "sk-test-secret-value",
      MANAGED_GATEWAY_TOKEN: "gateway-token-value",
    },
  );
  assert.equal(out.error, "OpenAI rejected [redacted secret]");
  assert.deepEqual(out.nested, ["token [redacted secret] was refused"]);
  assert.equal(out.safe, "keep this");
});

// ---------------------------------------------------------------------------
// normaliseResult
// ---------------------------------------------------------------------------

test("normaliseResult: accepts a well-formed result unchanged in shape", () => {
  const out = normaliseResult(validResult());
  assert.equal(out.positions.length, 2);
  assert.equal(out.confidence, "medium");
});

test("normaliseResult: throws when result is not an object", () => {
  assert.throws(() => normaliseResult(null), /not an object/);
  assert.throws(() => normaliseResult("x"), /not an object/);
});

test("normaliseResult: throws when positions are missing or empty", () => {
  assert.throws(() => normaliseResult({}), /positions array missing or empty/);
  assert.throws(() => normaliseResult({ positions: [] }), /positions array missing or empty/);
});

test("normaliseResult: renormalises weights that do not sum to 1", () => {
  const obj = validResult();
  obj.positions[0].weight = 0.6;
  obj.positions[1].weight = 0.6; // sum 1.2
  const out = normaliseResult(obj);
  const total = out.positions.reduce((s, p) => s + p.weight, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `weights should sum to 1, got ${total}`);
  assert.equal(out.positions[0].raw_weight, 0.6);
  assert.ok(Math.abs(out.positions[0].weight - 0.5) < 1e-9);
});

test("normaliseResult: clamps a negative weight to zero before renormalising", () => {
  const obj = validResult();
  obj.positions[0].weight = 1.5;
  obj.positions[1].weight = -0.5; // a misbehaving provider
  const out = normaliseResult(obj);
  const total = out.positions.reduce((s, p) => s + p.weight, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `weights should sum to 1, got ${total}`);
  assert.ok(out.positions.every((p) => p.weight >= 0), "no negative weights");
  assert.ok(Math.abs(out.positions[1].weight) < 1e-9, "the negative weight became 0");
});

test("normaliseResult: evenly splits weight when nothing usable is supplied", () => {
  const obj = validResult();
  delete obj.positions[0].weight;
  obj.positions[1].weight = 0;
  const out = normaliseResult(obj);
  const total = out.positions.reduce((s, p) => s + p.weight, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `weights should sum to 1, got ${total}`);
  assert.ok(Math.abs(out.positions[0].weight - 0.5) < 1e-9, "even split across 2 positions");
});

test("normaliseResult: leaves weights alone when they already sum to ~1", () => {
  const out = normaliseResult(validResult());
  assert.equal(out.positions[0].weight, 0.6);
  assert.equal(out.positions[0].raw_weight, undefined);
});

test("normaliseResult: coerces missing string fields to empty strings", () => {
  const obj = validResult();
  delete obj.positions[0].summary;
  delete obj.positions[0].why_not_higher;
  delete obj.positions[0].weakest_link;
  const out = normaliseResult(obj);
  assert.equal(out.positions[0].summary, "");
  assert.equal(out.positions[0].why_not_higher, "");
  assert.equal(out.positions[0].weakest_link, "");
});

test("normaliseResult: defaults blank position labels", () => {
  const obj = validResult();
  obj.positions[0].label = "   ";
  const out = normaliseResult(obj);
  assert.equal(out.positions[0].label, "Position 1");
});

test("normaliseResult: filters non-string top-level narrative arrays", () => {
  const obj = validResult();
  obj.dissent_notes = 42;
  obj.unresolved_tensions = ["real tension", null, 7, "another tension"];
  obj.synthesis = { not: "text" };
  const out = normaliseResult(obj);
  assert.equal(out.dissent_notes, "");
  assert.deepEqual(out.unresolved_tensions, ["real tension", "another tension"]);
  assert.equal(out.synthesis, "");
});

test("normaliseResult: filters non-string interpretive_moves", () => {
  const obj = validResult();
  obj.positions[0].interpretive_moves = ["good", 42, null, "also good"];
  const out = normaliseResult(obj);
  assert.deepEqual(out.positions[0].interpretive_moves, ["good", "also good"]);
});

test("normaliseResult: normalises and drops invalid position evidence rows", () => {
  const obj = validResult();
  obj.positions[0].evidence = [
    {
      verse_id: "1001001",
      citation: 42,
      translation_code: null,
      quote: "In the beginning...",
      reasoning: false,
    },
    {
      verse_id: 0,
      citation: "Genesis 1:0",
      translation_code: "KJV",
      quote: "bad",
      reasoning: "non-positive",
    },
    {
      verse_id: 1001001.5,
      citation: "Genesis 1:1.5",
      translation_code: "KJV",
      quote: "bad",
      reasoning: "fractional",
    },
  ];
  const out = normaliseResult(obj);
  assert.deepEqual(out.positions[0].evidence, [
    {
      verse_id: 1001001,
      citation: "",
      translation_code: "",
      quote: "In the beginning...",
      reasoning: "",
    },
  ]);
});

test("normaliseResult: drops argument_map edges that reference unknown nodes", () => {
  const obj = validResult();
  obj.positions[0].argument_map.edges = [
    { from: "n2", to: "n1", label: "supports" },
    { from: "n2", to: "ghost", label: "dangling" },
  ];
  const out = normaliseResult(obj);
  assert.equal(out.positions[0].argument_map.edges.length, 1);
  assert.equal(out.positions[0].argument_map.edges[0].to, "n1");
});

test("normaliseResult: coerces an invalid argument_map node kind to 'claim'", () => {
  const obj = validResult();
  obj.positions[0].argument_map.nodes[0].kind = "bogus";
  const out = normaliseResult(obj);
  assert.equal(out.positions[0].argument_map.nodes[0].kind, "claim");
});

test("normaliseResult: drops evidence_classification rows with non-positive verse_id", () => {
  const obj = validResult();
  obj.evidence_classification = [
    { verse_id: 1001001, status: "used", reasoning: "ok" },
    { verse_id: 0, status: "used", reasoning: "bad id" },
    { verse_id: -5, status: "used", reasoning: "bad id" },
    { verse_id: 1001001.5, status: "used", reasoning: "bad id" },
  ];
  const out = normaliseResult(obj);
  assert.equal(out.evidence_classification.length, 1);
});

test("normaliseResult: coerces an invalid evidence status to 'ignored'", () => {
  const obj = validResult();
  obj.evidence_classification = [
    { verse_id: 1001001, status: "made-up", reasoning: "x" },
  ];
  const out = normaliseResult(obj);
  assert.equal(out.evidence_classification[0].status, "ignored");
});

test("normaliseResult: coerces an invalid confidence to 'medium'", () => {
  const obj = validResult();
  obj.confidence = "extremely-high";
  assert.equal(normaliseResult(obj).confidence, "medium");
});

test("normaliseResult: defaults an invalid research_trail event_type to 'synthesis'", () => {
  const obj = validResult();
  obj.research_trail[0].event_type = "not-a-type";
  const out = normaliseResult(obj);
  assert.equal(out.research_trail[0].event_type, "synthesis");
});

test("normaliseResult: drops research_trail entries with no detail", () => {
  const obj = validResult();
  obj.research_trail.push({ id: "e2", label: "Empty", detail: "", event_type: "voice" });
  const out = normaliseResult(obj);
  assert.equal(out.research_trail.length, 1);
});

test("normaliseResult: dedupes and drops non-positive supporting_evidence_ids", () => {
  const obj = validResult();
  obj.positions[0].supporting_evidence_ids = [1001001, 1001001, 0, -3, 1002002];
  const out = normaliseResult(obj);
  assert.deepEqual(out.positions[0].supporting_evidence_ids, [1001001, 1002002]);
});

// ---------------------------------------------------------------------------
// parseResponse (extract -> parse -> sanitise fallback -> normalise)
// ---------------------------------------------------------------------------

test("parseResponse: parses a clean JSON response", () => {
  const out = parseResponse(JSON.stringify(validResult()), "Test");
  assert.equal(out.positions.length, 2);
});

test("parseResponse: recovers JSON with trailing commas via the sanitiser", () => {
  const raw = JSON.stringify(validResult()).replace(/}$/, ",}");
  const out = parseResponse(raw, "Test");
  assert.equal(out.positions.length, 2);
});

test("parseResponse: parses a fenced JSON response with surrounding prose", () => {
  const raw = "Here you go:\n```json\n" + JSON.stringify(validResult()) + "\n```";
  const out = parseResponse(raw, "Test");
  assert.equal(out.confidence, "medium");
});

test("parseResponse: throws with the source label when no JSON is present", () => {
  assert.throws(() => parseResponse("sorry, no json", "OpenAI"), /OpenAI: no JSON found/);
});

test("parseResponse: throws when JSON is present but irreparably malformed", () => {
  assert.throws(() => parseResponse('{"positions": [ broken }', "Gemini"), /Gemini: invalid JSON/);
});

// ---------------------------------------------------------------------------
// prompt builders
// ---------------------------------------------------------------------------

test("buildVoicePrompt: includes the question and each evidence row", () => {
  const prompt = buildVoicePrompt({
    question: "Is the Sabbath binding?",
    evidence: [
      {
        translation_code: "KJV",
        book_name: "Exodus",
        chapter: 20,
        verse: 8,
        verse_id: 2020008,
        text: "Remember the sabbath day.",
      },
    ],
  });
  assert.match(prompt, /Is the Sabbath binding\?/);
  assert.match(prompt, /Exodus 20:8/);
  assert.match(prompt, /verse_id 2020008/);
});

test("buildSynthesisPrompt: includes one labelled block per voice", () => {
  const prompt = buildSynthesisPrompt({
    question: "Q",
    voiceResults: [
      { display_name: "Gemini", result: validResult() },
      { display_name: "OpenAI", result: validResult() },
    ],
  });
  assert.match(prompt, /## Voice: Gemini/);
  assert.match(prompt, /## Voice: OpenAI/);
  assert.match(prompt, /2 independent voices/);
});
