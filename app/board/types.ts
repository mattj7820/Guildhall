/** The notice board as one viewer sees it: shapes shared with the browser. */
export interface BoardPage {
  /** When the table next meets: an instant (ISO 8601), shown in each browser's time zone. */
  nextSession?: string;
  /** The session notes the viewer may read, newest first. */
  sessions: { title: string; url: string }[];
}
