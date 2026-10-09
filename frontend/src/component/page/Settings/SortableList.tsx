import { Box, IconButton, Paper, Typography } from '@mui/material';
import DragIndicator from '@mui/icons-material/DragIndicator';
import {
  closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';

interface SortableItem { id: string; label: string; detail?: string }
interface SortableListProps { label: string; items: SortableItem[]; reorder: (ids: string[]) => void }

function itemName(item: SortableItem): string {
  return item.detail ? `${item.label} - ${item.detail}` : item.label;
}

function SortableRow({ item }: { item: SortableItem }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return <Paper component="li" ref={setNodeRef} variant="outlined"
    style={{ transform: CSS.Transform.toString(transform), transition, position: 'relative', zIndex: isDragging ? 1 : undefined }}
    sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, bgcolor: 'background.paper', borderColor: isDragging ? 'primary.main' : 'divider' }}>
    <IconButton ref={setActivatorNodeRef} {...attributes} {...listeners}
      aria-label={t('reorder', { name: itemName(item) })} sx={{ touchAction: 'none', cursor: isDragging ? 'grabbing' : 'grab' }}>
      <DragIndicator />
    </IconButton>
    <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
      <Typography>{item.label}</Typography>
      {item.detail && <Typography variant="body2" color="text.secondary">{item.detail}</Typography>}
    </Box>
  </Paper>;
}

export default function SortableList({ label, items, reorder }: SortableListProps) {
  const { t } = useTranslation();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const name = (id: UniqueIdentifier) => {
    const item = items.find(item => item.id === id);
    return item ? itemName(item) : String(id);
  };
  return <DndContext sensors={sensors} collisionDetection={closestCenter}
    accessibility={{
      screenReaderInstructions: { draggable: t('sortKeyboard') },
      announcements: {
        onDragStart: ({ active }) => t('sortPickedUp', { name: name(active.id) }),
        onDragOver: ({ active, over }) => over
          ? t('sortPosition', { name: name(active.id), position: items.findIndex(item => item.id === over.id) + 1, count: items.length }) : undefined,
        onDragEnd: ({ active, over }) => over
          ? t('sortDropped', { name: name(active.id), position: items.findIndex(item => item.id === over.id) + 1, count: items.length })
          : t('sortCancelled', { name: name(active.id) }),
        onDragCancel: ({ active }) => t('sortCancelled', { name: name(active.id) }),
      },
    }}
    onDragEnd={({ active, over }) => {
      if (!over || active.id === over.id) return;
      const from = items.findIndex(item => item.id === active.id);
      const to = items.findIndex(item => item.id === over.id);
      if (from >= 0 && to >= 0) reorder(arrayMove(items, from, to).map(item => item.id));
    }}>
    <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
      <Box component="ul" aria-label={label} sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 1 }}>
        {items.map(item => <SortableRow key={item.id} item={item} />)}
      </Box>
    </SortableContext>
  </DndContext>;
}
