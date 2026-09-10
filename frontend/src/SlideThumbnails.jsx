import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableThumb = ({ id, slide, index, isActive, onClick }) => {
  const [holding, setHolding] = useState(false);
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

  // Объединяем onClick с обработчиками dnd-kit
  const handleClick = (e) => {
    if (isDragging) return; // не переключаем, если был drag
    onClick();
  };

  const handlePointerDown = (e) => {
    setHolding(true);
    // Передаём событие dnd-kit
    listeners?.onPointerDown?.(e);
  };

  const handlePointerUp = () => setHolding(false);
  const handlePointerLeave = () => setHolding(false);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`slide-thumb ${isActive ? 'active' : ''} ${holding ? 'holding' : ''} ${isDragging ? 'dragging' : ''}`}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      {...attributes}
      {...listeners}
      title={slide.title || `Слайд ${index + 1}`}
    >
      <div className="thumb-number">{index + 1}</div>
      <div className="thumb-content">
        <div className="thumb-title">{slide.title || 'Без названия'}</div>
        <div className="thumb-preview">
          {(slide.items || []).slice(0, 2).map((item, i) => (
            <div key={i} className="thumb-line">
              {item.replace(/\\\(.*?\\\)|\\\[.*?\\\]/g, '').slice(0, 40)}
            </div>
          ))}
          {(slide.items || []).length > 2 && (
            <div className="thumb-line thumb-more">…</div>
          )}
        </div>
      </div>
    </div>
  );
};

const SlideThumbnails = ({ slides, currentIndex, onSelect, onReorder }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 8, // чуть больше, чтобы "дрожащая рука" не сбивала
      },
    })
  );

  if (slides.length === 0) return null;

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = slides.findIndex((_, i) => `slide-${i}` === active.id);
    const newIndex = slides.findIndex((_, i) => `slide-${i}` === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(slides, oldIndex, newIndex), newIndex);
  };

  return (
    <div className="slide-thumbnails">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={slides.map((_, i) => `slide-${i}`)}
          strategy={horizontalListSortingStrategy}
        >
          {slides.map((slide, idx) => (
            <SortableThumb
              key={`slide-${idx}`}
              id={`slide-${idx}`}
              slide={slide}
              index={idx}
              isActive={idx === currentIndex}
              onClick={() => onSelect(idx)}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default SlideThumbnails;