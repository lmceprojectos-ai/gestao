import { Suspense } from "react";
import { ResetClient } from "./reset-client";

export const dynamic = "force-dynamic";

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={null}>
      <ResetClient />
    </Suspense>
  );
}
