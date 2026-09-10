import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableItem = ({ id, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto',
  };

  return (
    <div ref={setNodeRef} style={style} className="sortable-row">
      {/* Ручка для перетаскивания */}
      <div className="drag-handle" {...attributes} {...listeners} title="Перетащить">
        ⋮⋮
      </div>
      <div className="sortable-content">
        {children}
      </div>
    </div>
  );
};

export default SortableItem;