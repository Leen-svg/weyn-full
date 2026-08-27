"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { PenLine } from "lucide-react";

const PostComposer = dynamic(() => import("./PostComposer"), {
  loading: () => <div className="skeleton" style={{ height: 220 }} aria-hidden="true" />,
});

// Posting used to live only inside the community feed, two thirds of the way
// down Home, with no entry point anywhere else in the product. This puts it in
// the header on every screen.
export default function ComposeButton() {
  const router = useRouter();
  const dialogRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(null);

  // showModal() is what gives us the focus trap, the inert background and the
  // ::backdrop — the open attribute alone gives none of that.
  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    setDone(null);
  }, []);

  return (
    <>
      <button type="button" className="compose-button" onClick={() => setOpen(true)}>
        <PenLine aria-hidden="true" />
        <span className="compose-button__label">Post</span>
      </button>

      <dialog
        className="compose-dialog"
        ref={dialogRef}
        aria-label="Write a post"
        onClose={close}
        onCancel={close}
        // Clicking the backdrop lands on the dialog itself, never a child.
        onClick={(event) => { if (event.target === dialogRef.current) close(); }}
      >
        <div className="compose-dialog__panel">
          <header className="compose-dialog__head">
            <h2>Share a spot</h2>
            <button type="button" className="compose-dialog__close" onClick={close} aria-label="Close">×</button>
          </header>

          {done ? (
            <p className="compose-dialog__done" role="status">{done}</p>
          ) : (
            <PostComposer
              onPosted={(points) => {
                setDone(points ? `Posted. +${points} points.` : "Posted.");
                // The feed is server-rendered, so it needs a refresh to show it.
                router.refresh();
                setTimeout(close, 1400);
              }}
            />
          )}
        </div>
      </dialog>
    </>
  );
}
