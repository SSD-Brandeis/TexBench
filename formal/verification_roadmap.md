# Verification roadmap

## Goal

Prove the deterministic semantics of workload construction and execution, while
treating the LLM as untrusted input.

The system should guarantee that only valid, explainable, bounded state
transitions reach the UI and the benchmark runner.

## Core verification boundary

The right boundary is:

- natural language -> constrained DSL
- constrained DSL -> deterministic interpreter
- interpreter -> normalized state
- normalized state -> UI and runner

The LLM should not be treated as a trusted semantic component. It should be
treated as a producer of candidate DSL programs.

## What to verify

### 1. AI output is constrained, not trusted

Keep the model output limited to the assist DSL and reject anything outside the
DSL.

Do not try to prove that arbitrary English was understood correctly. That is not
the formal target.

### 2. DSL to state is the main formal boundary

This is the part worth proving and model-checking.

Relevant code:

- [/Users/Abhishek/src/tectonic-json/src/index.js](/Users/Abhishek/src/tectonic-json/src/index.js)
- [/Users/Abhishek/src/tectonic-json/formal/assist_interpreter.tla](/Users/Abhishek/src/tectonic-json/formal/assist_interpreter.tla)

### 3. State to UI must be derived, never invented

UI-visible artifacts should be deterministic functions of normalized state:

- workload summary
- assumptions
- structure panel labels
- benchmark target summary

### 4. State to runner must be bounded and safe

Only valid specs should be executable.

The runner path must enforce:

- valid spec only
- bounded timeout
- explicit cancel/kill behavior
- monotonic run status transitions

Relevant code:

- [/Users/Abhishek/src/tectonic-json/src/local-tectonic-runner.mjs](/Users/Abhishek/src/tectonic-json/src/local-tectonic-runner.mjs)

## Recommended phases

### Phase 1. Freeze the DSL semantics

The DSL definition should be finalized in:

- [/Users/Abhishek/src/tectonic-json/formal/assist_program_dsl.md](/Users/Abhishek/src/tectonic-json/formal/assist_program_dsl.md)

It should explicitly define the semantics of:

- `append_group`
- `set_group_operation_fields`
- `rename_group_operation`
- `replace_sections`

Any remaining English heuristics in the main success path should be removed from:

- [/Users/Abhishek/src/tectonic-json/src/index.js](/Users/Abhishek/src/tectonic-json/src/index.js)

Heuristics should only remain as fallback after failed AI output.

Success criterion:

- every successful assist response is explainable as:
  - `program -> interpreter -> patch -> state`

### Phase 2. Strengthen the TLA+ model

Extend the model in:

- [/Users/Abhishek/src/tectonic-json/formal/assist_interpreter.tla](/Users/Abhishek/src/tectonic-json/formal/assist_interpreter.tla)

Add modeling for:

- group-targeted edits
- append-group semantics
- rename semantics
- clarification resolution
- persistence and restore transitions

Add invariants:

- untouched groups remain unchanged
- only explicit structural commands change group layout
- no enabled operation disappears unless explicitly replaced or cleared
- UI-visible structure matches normalized state
- assumptions are derivable from state only

Success criterion:

- TLC checks all bounded transitions without invariant violations

### Phase 3. Move the interpreter into a proof-friendly pure module

Extract the assist interpreter out of:

- [/Users/Abhishek/src/tectonic-json/src/index.js](/Users/Abhishek/src/tectonic-json/src/index.js)

Into a pure module with a small typed input/output surface.

Then either:

- verify it in [Dafny](https://dafny.org/)
- or keep TLA+ as the specification and use JS property tests as the
  implementation conformance layer

The practical next step is Dafny.

What to prove:

- command application preserves well-formedness
- targeted edits are local
- append operations do not mutate prior groups
- normalization is idempotent

Success criterion:

- one pure interpreter with explicit semantics and bounded surface area

### Phase 4. Add conformance tests between spec and implementation

Keep and expand the invariant harness in:

- [/Users/Abhishek/src/tectonic-json/test/assist-interpreter-invariants.test.mjs](/Users/Abhishek/src/tectonic-json/test/assist-interpreter-invariants.test.mjs)

Add generated traces for:

- random valid programs
- random multi-turn sessions
- random clarification sequences

Assert that the JS interpreter matches the TLA+ or Dafny semantics on those
traces.

Success criterion:

- property-based tests catch semantic drift between implementation and spec

### Phase 5. Make assumptions deterministic artifacts

Assumptions shown to users should never come from raw model prose.

They should be computed from:

- missing fields
- inherited values
- defaults applied by normalization

This logic should be moved into a pure deterministic layer.

What to verify:

- every shown assumption corresponds to a real default or inheritance rule
- no assumption appears unless it is justified by final state

This matters because the user must always be able to inspect and override
assumptions.

### Phase 6. Verify UI derivation rules

Do not try to verify the whole browser UI.

Do verify the pure derivation helpers for:

- structure labels
- workload summary
- benchmark target summary

If a group exists in state, every UI summary and structure view should account
for it deterministically.

Best approach:

- extract derivation helpers into pure functions
- add snapshot and property tests
- optionally mirror the rules in TLA+ as observables

### Phase 7. Harden the runner state machine

Model and verify the benchmark runner transitions in:

- [/Users/Abhishek/src/tectonic-json/src/local-tectonic-runner.mjs](/Users/Abhishek/src/tectonic-json/src/local-tectonic-runner.mjs)

Desired invariants:

- only validated specs are executed
- timeout is always bounded
- cancel and timeout always lead to `SIGTERM`, then `SIGKILL`
- status transitions are monotonic
- finished runs always have terminal status

This is a good fit for a second TLA+ model:

- `starting -> running -> succeeded | failed | cancelled | timed_out`

### Phase 8. Add deterministic runtime guardrails around the model

Even with formal interpreter semantics, the model can emit bad programs.

Add deterministic checks before interpretation:

- referenced group exists, or the command is append
- referenced operation exists for rename, or the request fails clearly
- no unknown fields
- no structural mutation without a structural command

On failure:

- request clarification
- or reject safely
- do not silently mutate state

## Priority order

1. Freeze DSL semantics
2. Expand the TLA+ model for assist transitions
3. Extract the pure interpreter module
4. Add property and conformance tests
5. Determinize assumptions
6. Verify the runner state machine
7. Consider Dafny or F* proofs only after the above is stable

## What not to spend time proving

- that the LLM understood arbitrary English correctly
- UI CSS and layout styling
- benchmark correctness of `tectonic-cli` itself
- free-form patch semantics outside the DSL

## Best practical target

The high-assurance architecture for this repository is:

- LLM emits a typed DSL program
- deterministic interpreter executes it
- interpreter semantics are model-checked
- assumptions and summaries are derived deterministically
- runner transitions are bounded and verified
- the LLM remains a constrained suggestion engine, not the system of record

## Current tooling fit

The strongest tool mix for this repository is:

- [TLA+](https://foundation.tlapl.us/) for workflow and state-machine semantics
- [Dafny](https://dafny.org/) for implementation-level proof of the pure
  interpreter
- JS property and invariant tests for conformance

The practical verification target is the deterministic core, not end-to-end
natural language understanding.
