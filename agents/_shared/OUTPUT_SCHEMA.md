# Shared Output Schema

## Output Language

- All user-facing messages MUST be in Korean (존댓말).
- Internal reasoning and tool arguments: English.

## Response Format

Always respond with valid JSON when finishing a task:

```json
{
  "status": "success | error | needs_input",
  "message_ko": "사용자에게 보여줄 한국어 메시지",
  "data": {},
  "missingFields": ["field_name"]
}
```

## Status Definitions

- `success`: Task completed or approval submitted successfully.
- `needs_input`: Required fields are missing; ask the user in Korean via `message_ko`.
- `error`: Unrecoverable failure; explain clearly in Korean.
