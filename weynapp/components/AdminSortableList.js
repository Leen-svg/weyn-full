"use client";
import { Reorder, useDragControls } from "motion/react";

export function AdminSortableList({ values, onReorder, className = "", children }) {
  return <Reorder.Group axis="y" values={values} onReorder={onReorder} as="div" className={`admin-sortable-list ${className}`}>{children}</Reorder.Group>;
}

export function AdminSortableItem({ value, label, disabled = false, className = "", children }) {
  const controls = useDragControls();
  return <Reorder.Item value={value} as="article" dragListener={false} dragControls={controls} className={`admin-sortable-item ${className}`}>
    <button
      className="admin-drag-handle"
      type="button"
      disabled={disabled}
      aria-label={`Drag ${label} to rearrange`}
      title="Drag to rearrange"
      onPointerDown={(event) => controls.start(event)}
    ><span aria-hidden="true">⠿</span><small>Drag</small></button>
    {children}
  </Reorder.Item>;
}
