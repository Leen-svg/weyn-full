import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({
  className,
  ...props
}) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-[12px] border-2 border-input bg-white px-3 py-2 text-base font-medium transition-colors outline-none placeholder:text-muted-foreground focus-visible:shadow-[3px_3px_0_var(--ink)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm",
        className
      )}
      {...props} />
  );
}

export { Textarea }
