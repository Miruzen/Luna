# Context Projection

## Purpose
Specify the smallest useful context package Luna sends for a particular execution.

## Context classes
1. User/personal context: preferences or facts relevant to the request.
2. Strategic context: goal, mission intent, priority, rationale.
3. Execution context: task instructions, inputs, resources, constraints, success criteria.
4. Safety/permission context: allowed actions, restrictions, approval requirements, if supported.

These are conceptual categories. Map them to existing contracts before creating new schemas.

## For each field, document
- meaning;
- required or optional;
- source/owner;
- why the executor needs it;
- sensitivity and whether excluded by default;
- behavior when missing or contradictory.

## Example
A report task may need its goal, relevant files, constraints, and acceptance criteria. It should not automatically include unrelated memories or the user's entire history.

## Acceptance checks
- valid minimal projection example;
- missing-required-context example;
- unrelated context excluded;
- sources traceable where practical;
- Stage 1 compatibility maintained unless a change is justified.
