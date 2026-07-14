import type { ChatCompletionTool } from "openai/resources/chat/completions"
import { gportalSession } from "./GPortalSession"

/** OpenAI function.name은 ^[a-zA-Z0-9_-]+$ 만 허용 (`.` 불가) */
export function getGPortalTools(): ChatCompletionTool[] {
  return [
    {
      type: "function",
      function: {
        name: "gportal_ensure_session",
        description: "Ensure G-portal browser session is logged in",
        parameters: { type: "object", properties: {}, additionalProperties: false }
      }
    },
    {
      type: "function",
      function: {
        name: "gportal_navigate",
        description: "Navigate to a G-portal menu path",
        parameters: {
          type: "object",
          properties: {
            menuPath: { type: "string", description: "Korean menu path e.g. 시설관리 > 회의실 예약" }
          },
          required: ["menuPath"],
          additionalProperties: false
        }
      }
    },
    {
      type: "function",
      function: {
        name: "meeting_room_search",
        description: "Search available meeting rooms",
        parameters: {
          type: "object",
          properties: {
            date: { type: "string" },
            startTime: { type: "string" },
            endTime: { type: "string" }
          },
          required: ["date", "startTime", "endTime"],
          additionalProperties: false
        }
      }
    },
    {
      type: "function",
      function: {
        name: "meeting_room_reserve",
        description: "Reserve a meeting room",
        parameters: {
          type: "object",
          properties: {
            roomName: { type: "string" },
            date: { type: "string" },
            startTime: { type: "string" },
            endTime: { type: "string" },
            title: { type: "string" }
          },
          required: ["roomName", "date", "startTime", "endTime"],
          additionalProperties: false
        }
      }
    },
    {
      type: "function",
      function: {
        name: "asset_export_submit",
        description: "Submit asset export approval request",
        parameters: {
          type: "object",
          properties: {
            assetId: { type: "string" },
            reason: { type: "string" },
            startDate: { type: "string" },
            endDate: { type: "string" },
            destination: { type: "string" }
          },
          required: ["assetId", "reason", "startDate", "endDate", "destination"],
          additionalProperties: false
        }
      }
    },
    {
      type: "function",
      function: {
        name: "vacation_apply",
        description: "Submit vacation leave application",
        parameters: {
          type: "object",
          properties: {
            leaveType: { type: "string" },
            startDate: { type: "string" },
            endDate: { type: "string" },
            reason: { type: "string" },
            substitute: { type: "string" }
          },
          required: ["leaveType", "startDate", "endDate"],
          additionalProperties: false
        }
      }
    }
  ]
}

export async function executeGPortalTool(
  name: string,
  args: Record<string, unknown>
): Promise<Record<string, unknown>> {
  switch (name) {
    case "gportal_ensure_session":
      return gportalSession.ensureSession()
    case "gportal_navigate":
      return gportalSession.navigate(String(args.menuPath ?? ""))
    case "meeting_room_search":
      return gportalSession.searchMeetingRoom(args as Record<string, string>)
    case "meeting_room_reserve":
      return gportalSession.reserveMeetingRoom(args as Record<string, string>)
    case "asset_export_submit":
      return gportalSession.submitAssetExport(args as Record<string, string>)
    case "vacation_apply":
      return gportalSession.applyVacation(args as Record<string, string>)
    default:
      return { success: false, error: `Unknown tool: ${name}` }
  }
}
