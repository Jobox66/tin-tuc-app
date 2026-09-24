
# MEMORY GOVERNANCE RULES

You have access to the `local-memory` MCP server to persist and retrieve long-term project knowledge and user preferences.

## 1. When to SEARCH memory (`search_memory`):

- At the start of any new feature or task, automatically search for relevant architectural decisions or conventions for this project.
- Before making significant architectural choices, check if prior decisions were already made.

## 2. When to WRITE memory (`add_memory`):

- Proactively save durable knowledge: Architectural decisions, database choices, naming conventions, API schemas, and business rules.
- DO NOT save: Temporary debug logs, syntax errors, scratch variables, conversational pleasantries, or secret credentials.

## 3. Scoping:

- Use the current workspace/folder name for `project` (or `"auto"`).
- Only use `project="global"` if the preference applies to all projects (e.g. coding style).

## 4. Updates (`delete_memory`):

- When an old rule is superseded, use `search_memory` to get its ID, call `delete_memory`, then add the new rule.
