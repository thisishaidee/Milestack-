"use client";

import { useEffect, useState } from "react";
import VaultStatus from "@/components/VaultStatus";
import { getProject } from "@/lib/projectStore";

interface VaultDetailPageProps {
  params: { id: string };
}

export default function VaultDetailPage({ params }: VaultDetailPageProps) {
  const [onChainId, setOnChainId] = useState<number | undefined>();

  useEffect(() => {
    const project = getProject(params.id);
    setOnChainId(project?.onChainId);
  }, [params.id]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-6 text-2xl font-semibold">Escrow</h1>
      <VaultStatus onChainId={onChainId} />
    </div>
  );
}
