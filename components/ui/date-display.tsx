"use client";

import { useEffect, useState } from "react";

interface DateDisplayProps {
  timestamp: string;
  format?: "date" | "time" | "datetime";
  className?: string;
  options?: Intl.DateTimeFormatOptions;
}

export default function DateDisplay({
  timestamp,
  format = "datetime",
  className,
  options,
}: DateDisplayProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  // Avoid hydration mismatch by rendering nothing (or a placeholder) on server
  if (!mounted) {
    return <span className={className}>--:--</span>;
  }

  // Ensure timestamp is treated as UTC if no timezone info is present
  const dateStr =
    timestamp.endsWith("Z") || timestamp.includes("+")
      ? timestamp
      : timestamp + "Z";

  const date = new Date(dateStr);

  let formatted = "";

  if (options) {
    formatted = date.toLocaleString(undefined, options);
  } else if (format === "time") {
    formatted = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } else if (format === "date") {
    formatted = date.toLocaleDateString();
  } else {
    formatted = date.toLocaleString();
  }

  return <span className={className}>{formatted}</span>;
}
