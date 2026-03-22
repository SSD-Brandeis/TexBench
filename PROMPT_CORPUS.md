# Prompt Corpus

This document is a corpus of user-style prompts that are already covered by the current model-backed assist tests.

Use it as:
- a reference for prompts we expect to work well
- a seed set for future regressions
- a sanity check when changing prompt handling, DSL interpretation, or follow-up semantics

This is intentionally biased toward prompts that are already exercised in the live suites, not hypothetical phrasing we have not validated yet.

## Principles

- Initial prompts create a workload from an empty state.
- Follow-up prompts modify the current workload.
- Follow-up prompts should preserve unrelated groups and operations.
- Structural prompts should explicitly talk about phases or groups.
- Clarification-triggering prompts are valid corpus entries when the clarification flow is also covered.

## Single-turn creation prompts

These are good baseline prompts for creating a workload from scratch.

```text
Generate an insert-only workload with 250k inserts
Generate a insert only workload with 250k inserts
Generate a workload with 250k insert operations
Generate a insert only workload with 1 million entries
Generate an insert-only workload with 250k inserts
Generate a workload with 1M inserts
```

## Single-turn phase-oriented prompts

These prompts create explicit phased or grouped layouts.

```text
Generate a three phase workload: first load the database with 5M inserts, next run a write-only phase for 1M operations, then run an interleaved read phase with 80% point queries and 20% short range queries for 2M operations
Create a three phase workload with a preload phase, then a mixed read/write phase, then a query-heavy analytics phase. Preload 2M inserts, then interleave 500k updates and 500k point queries, then interleave 800k point queries and 200k long range queries
Make a three phase workload where we first preload the DB, then do an interleaved write-heavy phase, then do an interleaved read-heavy phase. Use 1M inserts, then 600k operations at 75% updates and 25% point queries, then 900k operations at 90% point queries and 10% range queries
```

## Follow-up prompts that add operations to the current group

These prompts are intended to modify the current workload without creating a new group.

```text
interleave 5k point queries with the inserts
Add 5k point queries
Add updates to group 1
```

## Follow-up prompts that refine existing behavior

These prompts should mutate existing fields in place rather than changing layout.

```text
change point queries distribution to normal
make the point queries use a normal distribution
use normal distribution for point queries
```

## Follow-up prompts that append a later phase or group

These prompts should create a new group rather than rewriting the existing one.

```text
then add a second phase with 5k point queries
add a later phase with 5k point queries
next phase should run 5k point queries
Add another group with all deletes
Add a second group with all deletes
Add a third group with all deletes
Put point deletes, range deletes, and empty point deletes into a second group
```

## Follow-up prompts that rename or convert operations in a targeted group

These prompts should only rewrite the referenced group.

```text
Change updates in group 2 to merges
Convert the second group's updates into merges
Change range deletes in group 2 to point deletes
```

## Multi-turn conversation patterns that are known-good

These sequences are important because the product is chat-based and users keep refining the same workload.

### Sequence: create, interleave, refine

```text
Generate an insert-only workload with 250k inserts
interleave 5k point queries with the inserts
change point queries distribution to normal
```

Expected shape:
- one section
- one group
- inserts and point queries remain interleaved
- point query distribution becomes normal

### Sequence: create, add phase

```text
Generate an insert-only workload with 250k inserts
then add a second phase with 5k point queries
```

Expected shape:
- one section
- two groups
- group 1 stays inserts
- group 2 becomes point queries

### Sequence: create, add phase, rename inside group 2

```text
Generate an insert-only workload with 250k inserts
then add a second phase with 5k updates and 5k range deletes
Change updates in group 2 to merges
Change range deletes in group 2 to point deletes
```

Expected shape:
- one section
- two groups
- group 1 remains unchanged
- group 2 ends with merges and point deletes

### Sequence: create, refine, then append another group

```text
Generate an insert-only workload with 250k inserts
then add a second phase with 5k point queries
change point queries distribution to normal
Add a third group with all deletes
```

Expected shape:
- one section
- three groups
- earlier groups keep their semantics
- delete operations land only in the newly appended group

## Clarification-driven prompts

These prompts are valid, but the system may ask a clarification before applying the final edit.

```text
Generate a workload
Add another group with all deletes
Add a second group with all deletes
Add a third group with all deletes
```

Typical clarification:

```text
Which deletes should be added or removed?
```

Typical valid answers:

```text
point_deletes
range_deletes
empty_point_deletes
```

## Prompt classes we currently rely on heavily

If you are manually smoke-testing the system, these classes are the most useful:

1. create from empty state
2. add an operation to the current group
3. change one field in place
4. append a later phase
5. rename one operation in a targeted group
6. append a delete-only group after clarification

## Notes for maintainers

- This corpus should track prompts that are actually covered by live model-backed tests.
- When a real user prompt fails and we fix it, add the exact prompt here and add a regression.
- Do not treat this file as a list of all supported English.
- Prefer exact user phrasing over cleaned-up wording when the prompt came from a real failure.
