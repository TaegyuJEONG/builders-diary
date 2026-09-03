# Builder's Diary MCP Server

Core MCP Server for the Builder's Diary project with the `generate_record` tool.

## Overview

This MCP server implements the `generate_record` tool with a **3-turn multiturn flow**:

1. **Step 1**: Analyze work context and propose project/goal/title/tags via LLM
2. **Step 2**: User confirms or modifies proposal
3. **Step 3**: Create markdown record file in portfolio structure

## Installation

```bash
cd mcp-server
pip install -r requirements.txt
```

## Architecture

```
mcp-server/
├── mcp_server.py          # Main MCP server (stdio transport)
├── tools/
│   └── generate_record.py # Core tool with 3-turn flow
├── lib/
│   ├── config.py          # Config management (~/.builders-diary/config.json)
│   ├── llm_handler.py     # LLM calls via Claude API
│   └── file_manager.py    # File I/O and folder structure
├── requirements.txt
└── README.md
```

## Configuration

The server uses `~/.builders-diary/config.json` to store:
- Portfolio path
- User ID
- Creation timestamp

### First-time setup

```bash
python mcp_server.py
# Then call generate_record with step_1 to initialize config
```

## Tool: generate_record

### Input Schema

```json
{
  "portfolio_path": "string (optional, uses config if not provided)",
  "action": "string (required: step_1, step_2, or step_3)",
  "context": "string (step_1: full context; step_2: user response)",
  "state": "object (persistent state from previous turn)"
}
```

### Step 1: Analyze Context

**Input:**
```json
{
  "action": "step_1",
  "context": "Full conversation context from work session...",
  "portfolio_path": "/Users/username/portfolio"
}
```

**Output:**
```json
{
  "step": 1,
  "status": "awaiting_confirmation",
  "proposal": {
    "project_slug": "builders-diary",
    "project_title": "Builder's Diary",
    "goal_slug": "ui-dev",
    "goal_title": "UI Development",
    "record_title": "OAuth 붙이고 리다이렉트 버그 잡음",
    "tags": ["oauth", "auth", "debugging"]
  },
  "message": "이 내용이 맞나요?...",
  "state": { /* state for next turn */ }
}
```

### Step 2: Confirm Changes

**Input:**
```json
{
  "action": "step_2",
  "context": "맞아",
  "state": { /* state from step_1 */ }
}
```

**Output:**
```json
{
  "step": 2,
  "status": "confirmed",
  "confirmed_data": { /* confirmed proposal */ },
  "message": "좋아, 파일 생성 중...",
  "state": { /* state for next turn */ }
}
```

### Step 3: Create File

**Input:**
```json
{
  "action": "step_3",
  "state": { /* state from step_2 */ }
}
```

**Output:**
```json
{
  "step": 3,
  "status": "completed",
  "file_created": {
    "path": "/Users/username/portfolio/content/projects-builders-diary/goals/ui-dev/records/20260903-000-oauth-setup.md",
    "project_id": "proj-builders-diary",
    "goal_id": "goal-ui-dev",
    "record_id": "rec-20260903-000"
  },
  "message": "✅ 완료!..."
}
```

## Running the Server

### As MCP Server (stdio transport)

```bash
python mcp_server.py
```

The server will listen for JSON messages on stdin and write responses to stdout, implementing the MCP protocol.

### Direct Tool Usage (for testing)

```python
from tools.generate_record import GenerateRecordTool

tool = GenerateRecordTool()

# Step 1
result1 = tool.execute(
    portfolio_path="/Users/username/portfolio",
    action="step_1",
    context="I implemented OAuth and fixed redirect bug..."
)
print(result1)

# Step 2
result2 = tool.execute(
    action="step_2",
    context="맞아",
    state=result1["state"]
)
print(result2)

# Step 3
result3 = tool.execute(
    action="step_3",
    state=result2["state"]
)
print(result3)
```

## File Structure Created

```
~/portfolio/
├── _metadata/
├── content/
│   └── projects-{project-slug}/
│       ├── project.yaml
│       └── goals/
│           └── {goal-slug}/
│               ├── goal.yaml
│               └── records/
│                   ├── 20260903-000-oauth-setup.md
│                   ├── 20260903-001-redirect-fix.md
│                   └── ...
```

## Markdown File Format

Each record file includes YAML front matter with metadata and markdown body:

```markdown
---
id: rec-20260903-000
project_id: proj-builders-diary
project_slug: builders-diary
project_title: Builder's Diary
goal_id: goal-ui-dev
goal_slug: ui-dev
goal_title: UI Development
title: OAuth 붙이고 리다이렉트 버그 잡음
summary: OAuth 토큰 구현 후 콜백 URL 리다이렉트 수정
tags: [oauth, auth, debugging]
created_at: 2026-09-03T14:30:00Z
updated_at: 2026-09-03T14:30:00Z
status: completed
---

# 무엇을 했는가

OAuth 토큰 구현하고, 리다이렉트 버그를 수정했다.

...
```

## Error Handling

The tool handles common error scenarios:

| Error | Message |
|-------|---------|
| Portfolio path missing | "포트폴리오 폴더를 다시 설정해주세요: `@builders-diary setup /path/to/folder`" |
| File write failed | "파일을 저장할 수 없어. 디스크 공간이나 권한을 확인해줄래?" |
| LLM API failure | "LLM이 응답하지 않아. 다시 시도해줄래?" |
| Invalid input | Clear error message with guidance |

## Testing

See the test files in the `tests/` directory for comprehensive testing of:
- Step 1: LLM context analysis
- Step 2: User confirmation handling
- Step 3: File creation
- Error scenarios
- Full E2E workflow

## Development

### Adding new tools

1. Create a new file in `tools/`
2. Implement the tool class
3. Register it in `BuildersDiaryMCPServer.tools` dictionary
4. Add handler in `handle_tool_call()` method

### Extending configuration

Modify `lib/config.py` to add new config fields. The config is stored as JSON in `~/.builders-diary/config.json`.

## Future Enhancements (V2+)

- [ ] Tag search and filtering
- [ ] Sharing functionality
- [ ] Multiple users support
- [ ] Advanced record editing
- [ ] Database integration
