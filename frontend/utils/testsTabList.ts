/** Status filter on the Tests page (labels under tests.filter). `pending` means scheduled, not started yet. */
export const testsTabList = [
  { name: "All", value: "all" },
  { name: "Live", value: "ongoing" },
  { name: "Scheduled", value: "pending" },
  { name: "Completed", value: "completed" },
] as const;
