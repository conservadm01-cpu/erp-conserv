import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/ui/states";
import { SearchHub } from "./search-hub";

export const metadata: Metadata = { title: "Pesquisar" };

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <SearchHub />
    </Suspense>
  );
}
