"use client";

import { useState } from "react";

export default function PasswordInput({ id, ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-control">
      <input id={id} type={visible ? "text" : "password"} {...props} />
      <button
        type="button"
        className="password-toggle"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={() => setVisible((value) => !value)}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}


