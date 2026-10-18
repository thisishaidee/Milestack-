import type { Project } from "@/types/project";

export default function ProjectCard({ project }: { project: Project }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-blue-500/50 hover:bg-white/10">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold">{project.name}</h3>

        <span className="rounded-full bg-blue-600/20 px-3 py-1 text-xs font-semibold text-blue-400">
          {project.onChainId ? (project.cancelled ? "Cancelled" : "Funded") : "Draft"}
        </span>
      </div>

      <div className="mt-5 space-y-2 text-sm text-white/60">
        <p>Budget: {project.totalBudget.toLocaleString()} USDCx</p>
        <p>Milestones: {project.milestones.length}</p>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex justify-between text-xs text-white/50">
          <span>Progress</span>
          <span>0%</span>
        </div>

        <div className="h-2 rounded-full bg-white/10">
          <div className="h-2 w-0 rounded-full bg-blue-500"></div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <span className="rounded-lg border border-white/10 px-4 py-2 text-sm">
          View Project →
        </span>
      </div>
    </div>
  );
}
