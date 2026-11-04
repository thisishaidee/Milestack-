"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ProjectCard from "@/components/ProjectCard";
import { useWalletAddress } from "@/lib/stacks";
import { listProjects, saveProject } from "@/lib/projectStore";
import {
  getClientProjectCount,
  getClientProjectIds,
  getOnChainProject,
  getUsdcxDecimals,
  mergeChainIntoProject,
} from "@/lib/escrow";
import type { Project } from "@/types/project";

export default function ProjectsPage() {
  const walletAddress = useWalletAddress();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [recoveryError, setRecoveryError] = useState("");

  useEffect(() => {
    if (!walletAddress) {
      setProjects([]);
      setRecoveryMessage("");
      setRecoveryError("");
      return;
    }

    const clientAddress = walletAddress;
    let active = true;

    async function loadProjects() {
      setProjects(null);
      setRecoveryMessage("");
      setRecoveryError("");

      const localForWallet = listProjects().filter(
        (project) => project.clientWallet === clientAddress
      );

      try {
        const total = await getClientProjectCount(clientAddress);
        const startIndex = Math.max(0, total - 20);
        const { ids } = await getClientProjectIds(clientAddress, startIndex, Math.min(20, total || 1));
        const decimals = await getUsdcxDecimals();

        const recovered: (Project | null)[] = [];
        for (let start = 0; start < ids.length; start += 5) {
          const batchIds = ids.slice(start, start + 5);
          const batch = await Promise.all(
            batchIds.map(async (onChainId) => {
              const chain = await getOnChainProject(onChainId);
              if (!chain || chain.client !== clientAddress) return null;

              const local = localForWallet.find(
                (project) => project.onChainId === onChainId
              ) ?? {
                id: `recovered-${onChainId}`,
                name: `Recovered project #${onChainId}`,
                totalBudget: 0,
                clientWallet: clientAddress,
                milestones: [],
              };

              return mergeChainIntoProject(local, chain, [], decimals);
            })
          );
          recovered.push(...batch);
        }

        if (!active) return;

        const chainProjects = recovered.filter(
          (project): project is Project => project !== null
        );
        const chainIds = new Set(
          chainProjects.map((project) => project.onChainId)
        );
        const drafts = localForWallet.filter(
          (project) => !project.onChainId || !chainIds.has(project.onChainId)
        );
        const combined = [...chainProjects, ...drafts].sort((a, b) => {
          const aId = a.onChainId ?? 0;
          const bId = b.onChainId ?? 0;
          return bId - aId;
        });

        chainProjects.forEach(saveProject);
        setProjects(combined);
        if (total > 20) {
          setRecoveryMessage(`Showing the latest 20 of ${total} on-chain projects. Older projects remain on-chain.`);
        }
      } catch (error) {
        if (!active) return;
        setProjects(localForWallet);
        setRecoveryError(
          error instanceof Error
            ? `On-chain recovery could not finish: ${error.message}`
            : "On-chain recovery could not finish. Your saved local projects are still shown."
        );
      }
    }

    void loadProjects();

    return () => {
      active = false;
    };
  }, [walletAddress]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-blue-400">
              Dashboard
            </p>
            <h1 className="mt-2 text-4xl font-bold">Your Projects</h1>
            <p className="mt-3 text-white/60">
              Manage milestone payments, monitor project progress, and release funds securely.
            </p>
          </div>
          <Link
            href="/projects/new"
            className="rounded-xl bg-blue-600 px-5 py-3 font-medium transition hover:bg-blue-500"
          >
            New Project
          </Link>
        </div>

        {!walletAddress && (
          <p className="rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-white/60">
            Connect your Stacks Testnet wallet to view its projects and recover funded projects from the blockchain.
          </p>
        )}

        {recoveryMessage && (
          <p className="mb-4 text-sm text-white/50">{recoveryMessage}</p>
        )}
        {recoveryError && (
          <p className="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-200">
            {recoveryError}
          </p>
        )}

        <div className="mt-8 space-y-3">
          {projects === null && (
            <p className="text-sm text-white/50">Loading projects and checking the blockchain…</p>
          )}

          {projects?.length === 0 && walletAddress && (
            <p className="text-sm text-white/50">
              No projects found for this wallet. Create one to get started.
            </p>
          )}

          {projects?.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <ProjectCard project={project} />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
