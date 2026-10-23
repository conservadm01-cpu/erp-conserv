"use client";
import { useEffect, useState } from "react";
import { getFiles, type Bucket } from "@/lib/data";

/** Resolve uma URL temporária (signed URL ou object URL) para exibir um arquivo privado. */
export function useMediaUrl(path: string | null | undefined, bucket: Bucket = "media"): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!path) {
      setUrl(null);
      return;
    }
    getFiles()
      .url(bucket, path)
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setUrl(null));
    return () => {
      alive = false;
    };
  }, [path, bucket]);
  return url;
}
