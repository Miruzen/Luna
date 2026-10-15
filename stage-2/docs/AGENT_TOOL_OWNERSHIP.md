# Agent and Tool Ownership

Working model — validate against the actual code.

| Responsibility | Proposed owner | Notes |
|---|---|---|
| User intent and strategic goals | Luna | Confirm against current design |
| Personal context selection | Luna | Project only relevant context |
| Mission direction and delegation | Luna | Luna remains strategic center |
| Execution request/result boundary | Shared interface | Reuse Stage 1 contracts |
| Execution-side planning | Jarvis | Verify actual capability |
| Tool/MCP execution | Jarvis | Verify implementation and permissions |
| Retry behavior | Jarvis or execution coordinator | Decide from actual design |
| Result verification | Unresolved | Separate execution checks from strategic acceptance |
| Final user-facing synthesis | Luna | Validate with existing behavior |

## Review questions
- Where does Luna's responsibility end and Jarvis's begin?
- Can Jarvis revise a plan without asking Luna?
- Which actions require user approval?
- Who owns retries and idempotency?
- Who verifies the requested outcome?
- What happens when Jarvis returns a partial, ambiguous, or failed result?

Mark each row verified, proposed, or unresolved. Do not treat this table as implementation truth before inspection.
