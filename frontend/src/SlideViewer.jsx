import React, { useState } from 'react';
import { BlockMath } from 'react-katex';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import 'katex/dist/katex.min.css';
import MessageContent from './MessageContent';
import SortableItem from './SortableItem';

/**
 * Универсальный редактируемый блок.
 */
const EditableText = ({ value, onChange, className = '', multiline = false, placeholder = 'Нажмите, чтобы изменить' }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const start = () => {
    setDraft(value || '');
    setEditing(true);
  };

  const save = () => {
    setEditing(false);
    if (draft !== value) onChange(draft);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') cancel();
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      save();
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      save();
    }
  };

  if (editing) {
    const common = {
      autoFocus: true,
      value: draft,
      onChange: (e) => setDraft(e.target.value),
      onBlur: save,
      onKeyDown: handleKeyDown,
      className: `edit-input ${className}`,
    };
    return multiline ? <textarea rows={3} {...common} /> : <input type="text" {...common} />;
  }

  return (
    <div className={`editable ${className}`} onClick={start} title="Нажмите, чтобы редактировать">
      {value ? <MessageContent text={value} /> : <span className="placeholder">{placeholder}</span>}
    </div>
  );
};

const SlideViewer = ({ slide, onChange }) => {
  if (!slide) return null;

  const items = Array.isArray(slide.items) ? slide.items : [];
  const formulas = Array.isArray(slide.formulas) ? slide.formulas : [];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const updateField = (field, value) => onChange({ ...slide, [field]: value });

  const updateItem = (idx, value) => {
    const next = [...items];
    next[idx] = value;
    onChange({ ...slide, items: next });
  };

  const removeItem = (idx) => {
    const next = [...items];
    next.splice(idx, 1);
    onChange({ ...slide, items: next });
  };

  const addItem = () => {
    onChange({ ...slide, items: [...items, 'Новый пункт'] });
  };

  const updateFormula = (idx, value) => {
    const next = [...formulas];
    next[idx] = value;
    onChange({ ...slide, formulas: next });
  };

  const removeFormula = (idx) => {
    const next = [...formulas];
    next.splice(idx, 1);
    onChange({ ...slide, formulas: next });
  };

  const addFormula = () => {
    onChange({ ...slide, formulas: [...formulas, 'x_t = \\mu + \\varepsilon_t'] });
  };

  // Универсальный обработчик окончания перетаскивания
  const handleDragEnd = (event, list, field) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = list.findIndex((_, i) => `item-${field}-${i}` === active.id);
    const newIndex = list.findIndex((_, i) => `item-${field}-${i}` === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange({ ...slide, [field]: arrayMove(list, oldIndex, newIndex) });
  };

  return (
    <div className="slide-card">
      <EditableText
        value={slide.title}
        onChange={(v) => updateField('title', v)}
        className="slide-title"
        placeholder="Заголовок слайда"
      />

      <EditableText
        value={slide.subtitle || ''}
        onChange={(v) => updateField('subtitle', v)}
        className="slide-subtitle"
        placeholder="Подзаголовок (опционально)"
      />

      {items.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(e) => handleDragEnd(e, items, 'items')}
        >
          <SortableContext
            items={items.map((_, i) => `item-items-${i}`)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="slide-items">
              {items.map((item, idx) => (
                <SortableItem key={`item-items-${idx}`} id={`item-items-${idx}`}>
                  <li>
                    <EditableText
                      value={item}
                      onChange={(v) => updateItem(idx, v)}
                      className="slide-item"
                      multiline
                    />
                    <button
                      className="item-remove"
                      onClick={() => removeItem(idx)}
                      title="Удалить пункт"
                    >
                      ✕
                    </button>
                  </li>
                </SortableItem>
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {formulas.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(e) => handleDragEnd(e, formulas, 'formulas')}
        >
          <SortableContext
            items={formulas.map((_, i) => `item-formulas-${i}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="slide-formulas">
              {formulas.map((formula, idx) => (
                <SortableItem key={`item-formulas-${idx}`} id={`item-formulas-${idx}`}>
                  <div className="formula-row">
                    <EditableText
                      value={formula}
                      onChange={(v) => updateFormula(idx, v)}
                      className="formula-edit"
                      multiline
                    />
                    <button
                      className="item-remove"
                      onClick={() => removeFormula(idx)}
                      title="Удалить формулу"
                    >
                      ✕
                    </button>
                  </div>
                </SortableItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="slide-add-buttons">
        <button className="add-btn" onClick={addItem}>+ Добавить пункт</button>
        <button className="add-btn" onClick={addFormula}>+ Добавить формулу</button>
      </div>
    </div>
  );
};

export default SlideViewer;