"use client";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { RequireTrip } from "@/components/layout/require-trip";
import { PhotoEditor } from "@/components/photo/editor";
import { Loading } from "@/components/ui/states";

function Inner() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  return <RequireTrip>{(trip) => <PhotoEditor trip={trip} mediaId={params.id} editId={search.get("versao")} />}</RequireTrip>;
}

export default function PhotoEditorPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Inner />
    </Suspense>
  );
}
