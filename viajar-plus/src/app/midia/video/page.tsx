"use client";
import { RequireTrip } from "@/components/layout/require-trip";
import { PageHeader } from "@/components/ui/states";
import { VideoEditor } from "@/components/video/video-editor";

export default function VideoPage() {
  return (
    <>
      <PageHeader
        eyebrow="Fotos e vídeos"
        title="Editor de vídeo"
        description="Monte um vídeo curto da viagem: corte, reordene, adicione títulos e legendas e exporte no formato ideal para cada rede."
      />
      <RequireTrip>{(trip) => <VideoEditor trip={trip} />}</RequireTrip>
    </>
  );
}
