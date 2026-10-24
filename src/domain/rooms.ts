import { z } from "zod";

/** חדרים לדוגמה להצגת הרהיט בהדמיה. נשמרים בפרויקט כדי שהתמונה הממוזערת והסיכום יתאימו. */
export const ROOM_KEYS = ["bedroom", "living", "kids", "bathroom", "neutral"] as const;
export type RoomKey = (typeof ROOM_KEYS)[number];

export const DEFAULT_ROOM: RoomKey = "bedroom";

export const ROOM_LABELS: Record<RoomKey, string> = {
  bedroom: "חדר שינה",
  living: "סלון",
  kids: "חדר ילדים",
  bathroom: "חדר רחצה",
  neutral: "חלל ניטרלי",
};

export const presentationSchema = z.object({
  room: z.enum(ROOM_KEYS),
});
export type Presentation = z.infer<typeof presentationSchema>;

export function roomOf(p: { room?: string } | undefined | null): RoomKey {
  return ROOM_KEYS.includes(p?.room as RoomKey) ? (p!.room as RoomKey) : DEFAULT_ROOM;
}
