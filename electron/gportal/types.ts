/** 공통 G-portal 작업 결과 */
export interface GPortalToolResult {
  success: boolean
  error?: string
  poc?: boolean
  [key: string]: unknown
}

export interface MeetingRoomSearchParams {
  date: string
  startTime: string
  endTime: string
}

export interface MeetingRoomReserveParams {
  roomName: string
  date: string
  startTime: string
  endTime: string
  title?: string
}

export interface AssetExportParams {
  assetId: string
  reason: string
  startDate: string
  endDate: string
  destination: string
}

export interface VacationApplyParams {
  leaveType: string
  startDate: string
  endDate: string
  reason?: string
  substitute?: string
}

/** selectors.template.json 과 1:1 매핑 */
export interface GPortalSelectors {
  login: {
    urlPath: string
    usernameInput: string
    passwordInput: string
    submitButton: string
    loggedInIndicator: string
  }
  navigation: {
    menuItem: string
    submenuItem: string
  }
  meetingRoom: {
    dateInput: string
    startTimeInput: string
    endTimeInput: string
    searchButton: string
    roomRow: string
    reserveButton: string
    confirmButton: string
    successMessage: string
  }
  assetExport: {
    assetIdInput: string
    reasonInput: string
    startDateInput: string
    endDateInput: string
    destinationInput: string
    submitButton: string
    successMessage: string
  }
  vacation: {
    leaveTypeSelect: string
    startDateInput: string
    endDateInput: string
    reasonInput: string
    substituteInput: string
    submitButton: string
    successMessage: string
  }
}

export type GPortalAdapterMode = "stub" | "playwright"
