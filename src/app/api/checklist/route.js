import { route } from '@/lib/api/next-route';
import { deleteChecklistItem, saveChecklistItem } from '@/lib/api/checklist';

// Logic and auth checks live in src/lib/api/checklist.js (tested in tests/api).
export const POST = route(saveChecklistItem);
export const DELETE = route(deleteChecklistItem);
