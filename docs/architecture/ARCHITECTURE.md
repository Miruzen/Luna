# LUNA — Stage 1 Architecture

## Core principle

LUNA is the center. Jarvis is an execution layer delegated to by LUNA.

```text
Nanda
  ↓
LUNA
  ├── Identity
  ├── User Context
  ├── Memory
  └── Strategic Orchestrator
          ↓
   Execution Interface
          ↓
     Jarvis Adapter
          ↓
        Jarvis
   ├── Execution Agents
   ├── Tools / MCP
   └── Execution Runtime
          ↓
      Result / Evidence
          ↓
        LUNA
```

## Ownership

### LUNA — WHO / WHY / WHAT
- identity
- relationship
- intent
- strategic context
- mission
- desired outcome
- high-level objectives
- delegation
- constraints
- permissions
- strategic evaluation

### Jarvis — HOW
- execution planning
- execution agents
- agent coordination
- tool selection
- MCP usage
- retries
- worker coordination
- execution verification

### Shared — CURRENT STATE
- mission status
- progress
- execution result
- artifacts
- errors

Detailed Shared State is not finalized in Stage 1.

## Replaceability

```text
LUNA
  ↓
Execution Interface
  ↓
Jarvis Adapter
  ↓
Jarvis

Future:
LUNA
  ↓
Execution Interface
  ↓
Other Adapter
  ↓
Other Engine
```

## Agent ownership

Execution agents belong to the execution layer. LUNA owns the mission and desired outcome, not detailed execution-agent topology.

Agent lifecycle and agent memory are intentionally not finalized in Stage 1.
