/** The app's top-level view mode (sidebar navigation surfaces). Shared so
 *  components like the guided tour can type their step targets without
 *  duplicating the union. */
export type Mode =
  | "reader"
  | "council"
  | "theology"
  | "resources"
  | "workspaces"
  | "settings"
  | "tags";
