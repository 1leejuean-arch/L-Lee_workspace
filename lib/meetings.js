export const MEETING_COLUMNS = "id,title,meeting_date,start_time,end_time,attendees,location,content,decisions,action_items,tag,created_at,updated_at";
export const MEETINGS_TABLE_MISSING_MESSAGE = "회의록 테이블이 아직 준비되지 않았습니다. SQL을 실행해주세요.";
export const MEETING_SAVE_ERROR_MESSAGE = "회의록을 저장하지 못했습니다.";
export const MEETING_DELETE_ERROR_MESSAGE = "회의록을 삭제하지 못했습니다.";

export function mapMeetingRow(row) {
  return {
    id: row.id,
    title: row.title || "",
    meetingDate: row.meeting_date || "",
    startTime: String(row.start_time || "").slice(0, 5),
    endTime: String(row.end_time || "").slice(0, 5),
    attendees: row.attendees || "",
    location: row.location || "",
    content: row.content || "",
    decisions: row.decisions || "",
    actionItems: row.action_items || "",
    tag: row.tag || "",
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

function textValue(value, maxLength = 10000) {
  return String(value || "").trim().slice(0, maxLength);
}

function validateDate(value) {
  const date = textValue(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("MEETING_DATE_REQUIRED");
  return date;
}

function validateTime(value) {
  const time = textValue(value, 5);
  if (!time) return "";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("MEETING_TIME_INVALID");
  return time;
}

export function buildMeetingPayload(body) {
  const title = textValue(body.title, 200);
  if (!title) throw new Error("MEETING_TITLE_REQUIRED");
  const startTime = validateTime(body.startTime);
  const endTime = validateTime(body.endTime);
  if (startTime && endTime && endTime < startTime) throw new Error("MEETING_TIME_RANGE_INVALID");

  return {
    title,
    meeting_date: validateDate(body.meetingDate),
    start_time: startTime || null,
    end_time: endTime || null,
    attendees: textValue(body.attendees, 2000),
    location: textValue(body.location, 500),
    content: textValue(body.content, 30000),
    decisions: textValue(body.decisions, 20000),
    action_items: textValue(body.actionItems, 20000),
    tag: textValue(body.tag, 100),
  };
}

export function isMeetingTableMissingError(error) {
  const details = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return error?.code === "42P01" || details.includes("meeting_minutes") || details.includes("schema cache");
}

export function logMeetingError(context, error) {
  console.error(context, { code: error?.code, message: error?.message, details: error?.details, hint: error?.hint });
}
