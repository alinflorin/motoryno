/** Identifiers shared across the background task, Android channel and foreground catch-up logic. */

/** expo-task-manager task name for the periodic overdue-items check (registered via expo-background-task). */
export const OVERDUE_CHECK_TASK_NAME = 'motoryno-overdue-items-check';

/** Android notification channel the overdue-items reminder is posted to. Recreated whenever ring/vibrate change. */
export const OVERDUE_CHANNEL_ID = 'overdue-items';
