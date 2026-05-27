export const ALL_COLUMNS = [
  { id: 'well',             label: 'What Went Well',         color: '#10b981', icon: '✓' },
  { id: 'improve',          label: 'What Needs Improvement', color: '#f43f5e', icon: '△' },
  { id: 'actions',          label: 'Action Items',           color: '#3b82f6', icon: '→' },
  { id: 'previous-actions', label: 'Previous Action Items',  color: '#14b8a6', icon: '↩' },
];

export const DEFAULT_COLUMN_IDS = ['well', 'improve', 'actions', 'previous-actions'];

export function getColumnById(id) {
  return ALL_COLUMNS.find((c) => c.id === id);
}
