"use client";
import { useParams } from "next/navigation";
import { RequireTrip } from "@/components/layout/require-trip";
import { BookEditor } from "@/components/book/book-editor";

export default function BookEditorPage() {
  const { id } = useParams<{ id: string }>();
  return <RequireTrip>{(trip) => <BookEditor trip={trip} albumId={id} />}</RequireTrip>;
}
