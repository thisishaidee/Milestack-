import type { Project } from "@/types/project";

export default function ProjectCard({ project }: { project: Project }) {
  const hasMilestoneDetails =
    project.milestones.length > 0 &&
    project.milestones.every(
      (milestone) =>
        milestone.amount > 0 && milestone.contributorWallet.trim().length > 0
    );
  const paidCount = project.milestones.filter(
    (milestone) => milestone.status === "paid" || milestone.status === "released"
  ).length;
  const progress = hasMilestoneDetails
    ? Math.round((paidCount / project.milestones.length) * 100)
    : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-blue-500/50 hover:bg-white/10">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl font-bold">{project.name}</h3>

        <span className="shrink-0 rounded-full bg-blue-600/20 px-3 py-1 text-xs font-semibold text-blue-400">
          {project.onChainId
            ? project.cancelled
              ? "Cancelled"
              : "Funded"
            : "Draft"}
        </span>
      </div>

      <div className="mt-5 space-y-2 text-sm text-white/60">
        <p>Budget: {project.totalBudget.toLocaleString()} USDCx</p>
        <p>Milestones: {project.milestones.length}</p>
      </div>

      <div className="mt-6">
        {progress === null ? (
          <p className="text-xs text-white/45">
            Milestone details load when you open this project.
          </p>
        ) : (
          <>
            <div className="mb-2 flex justify-between text-xs text-white/50">
              <span>Paid milestones</span>
              <span>
                {paidCount}/{project.milestones.length} · {progress}%
              </span>
            </div>

            <div
              className="h-2 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-label="Paid milestones"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            >
              <div
                className="h-2 rounded-full bg-blue-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <span className="rounded-lg border border-white/10 px-4 py-2 text-sm">
          View Project →
        </span>
      </div>
    </div>
  );
}
