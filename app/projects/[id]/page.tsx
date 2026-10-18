"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import MilestoneList from "@/components/MilestoneList";
import DepositForm from "@/components/DepositForm";
import VaultStatus from "@/components/VaultStatus";
import CancelRemainingButton from "@/components/CancelRemainingButton";
import { getProject, saveProject, deleteProject } from "@/lib/projectStore";
import {
  getOnChainMilestones,
  getOnChainProject,
  getUsdcxDecimals,
  mergeChainIntoProject,
} from "@/lib/escrow";
import { formatDisplayAmount } from "@/lib/units";
import type { Project } from "@/types/project";

interface ProjectDetailPageProps {
  params: { id: string };
}

export default function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null | undefined>(undefined);
  const [remainingLabel, setRemainingLabel] = useState("0");

  const persist = useCallback((next: Project) => {
    saveProject(next);
    setProject(next);
  }, []);

  const refreshFromChain = useCallback(async (base?: Project | null) => {
    const current = base ?? (typeof window !== "undefined" ? getProject(params.id) : null);
    if (!current || typeof current.onChainId !== "number") {
      if (current) setProject(current);
      return;
    }
    try {
      const decimals = await getUsdcxDecimals();
      const chain = await getOnChainProject(current.onChainId);
      if (!chain) {
        setProject(current);
        return;
      }
      const rows = await getOnChainMilestones(current.onChainId, chain.milestoneCount);
      const merged = mergeChainIntoProject(current, chain, rows, decimals);
      setRemainingLabel(formatDisplayAmount(chain.remaining, decimals));
      persist(merged);
    } catch (error) {
      console.error("[project] failed to refresh chain state", error);
      setProject(current);
    }
  }, [params.id, persist]);

  useEffect(() => {
    const local = getProject(params.id);
    setProject(local);
    void refreshFromChain(local);
  }, [params.id, refreshFromChain]);

  function handleMilestonesUpdate(updated: Project) {
    persist(updated);
  }

  function handleFunded(payload: { onChainId: number; txid: string }) {
    if (!project) return;
    const next: Project = {
      ...project,
      onChainId: payload.onChainId,
      depositTxid: payload.txid,
      milestones: project.milestones.map((milestone, index) => ({
        ...milestone,
        onChainIndex: index,
      })),
    };
    persist(next);
    void refreshFromChain(next);
  }

  function handleCancelled(txid: string) {
    if (!project) return;
    const next = { ...project, cancelTxid: txid, cancelled: true };
    persist(next);
    void refreshFromChain(next);
  }

  function handleDelete() {
    if (!project) return;
    const confirmed = window.confirm(
      project.onChainId
        ? "Delete this local project record? On-chain escrow is not deleted."
        : "Delete this project? This action cannot be undone."
    );
    if (!confirmed) return;
    deleteProject(project.id);
    router.push("/");
  }

  if (project === undefined) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm text-white/50">Loading project…</p>
      </div>
    );
  }

  if (project === null) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm text-white/50">Project not found.</p>
      </div>
    );
  }

  const funded = typeof project.onChainId === "number";

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-6 py-16">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <p className="mt-1 text-sm text-white/50">Client wallet: {project.clientWallet}</p>
          {funded && (
            <p className="mt-1 text-sm text-white/50">On-chain project #{project.onChainId}</p>
          )}
        </div>
        <button
          onClick={handleDelete}
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Delete Project
        </button>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-medium">Milestones</h2>
        <MilestoneList
          project={project}
          onUpdate={handleMilestonesUpdate}
          onRefreshChain={() => refreshFromChain(project)}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Fund escrow</h2>
        <DepositForm project={project} onFunded={handleFunded} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">On-chain escrow</h2>
        <VaultStatus onChainId={project.onChainId} />
      </section>

      {funded && !project.cancelled && (
        <section>
          <h2 className="mb-3 text-lg font-medium">Refund remaining</h2>
          <CancelRemainingButton
            onChainId={project.onChainId!}
            clientAddress={project.clientWallet}
            remainingLabel={remainingLabel}
            onCancelled={handleCancelled}
          />
        </section>
      )}
    </div>
  );
}
