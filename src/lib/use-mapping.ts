"use client";

import { useEffect, useState } from "react";
import { loadMapping, type ColumnMapping } from "@/lib/column-mapping";

export function useMapping(pid: string, fid: string) {
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setMapping(loadMapping(pid, fid));
    setReady(true);
  }, [pid, fid]);
  return { mapping, ready, setMapping };
}
