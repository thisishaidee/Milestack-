import Link from "next/link";

const steps = [
  {
    title: "Create Project",
    description:
      "Set up your project, invite contributors, and define milestone payments.",
  },
  {
    title: "Lock Funds",
    description:
      "Deposit funds into MileStack escrow once so the budget is secured.",
  },
  {
    title: "Approve Milestones",
    description:
      "Review completed work and approve milestones whenever deliverables are met.",
  },
  {
    title: "Release Payments",
    description:
      "The escrow contract pays the stored contributor when you approve a milestone.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white">
 <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
  <Link href="/" className="text-2xl font-black tracking-tight">
    MileStack
  </Link>  
        <Link
          href="/projects"
          className="rounded-lg border border-white/20 px-4 py-2 text-sm transition hover:border-white/40"
        >
          Projects
        </Link>
      </nav>

      <section className="mx-auto flex max-w-7xl flex-col items-center px-6 py-24 text-center">
        <p className="mb-4 text-sm uppercase tracking-[0.3em] text-blue-400">
          On-chain milestone escrow
        </p>

        <h2 className="max-w-4xl text-5xl font-bold leading-tight">
          Secure milestone payments for modern teams.
        </h2>

        <p className="mt-6 max-w-2xl text-lg text-white/70">
          Lock project funds once, approve milestones with confidence, and
          release payments transparently through programmable escrow.
        </p>

        <div className="mt-10 flex gap-4">
          <Link
            href="/projects/new"
            className="rounded-lg bg-blue-600 px-6 py-3 font-medium transition hover:bg-blue-500"
          >
            Create Project
          </Link>

          <Link
            href="/projects"
            className="rounded-lg border border-white/20 px-6 py-3 transition hover:border-white/40"
          >
            View Projects
          </Link>
        </div>
      </section>

  <section className="mx-auto max-w-7xl px-6 pb-24">
  <div className="grid grid-cols-1 gap-6 rounded-2xl border border-white/10 bg-white/5 p-10 text-center sm:grid-cols-3">

  <div>
  <h3 className="text-4xl font-bold text-blue-400">4</h3>
  <p className="mt-2 text-white/60">Milestone Workflow</p>
</div>

<div>
  <h3 className="text-4xl font-bold text-blue-400">100%</h3>
  <p className="mt-2 text-white/60">On-chain Escrow</p>
</div>

<div>
  <h3 className="text-4xl font-bold text-blue-400">24/7</h3>
  <p className="mt-2 text-white/60">Transparent Payments</p>
</div>    
</div>
</section>   

      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-blue-400">
            How It Works
          </p>

          <h3 className="mt-4 text-4xl font-bold">
            A simple escrow workflow.
          </h3>

          <p className="mx-auto mt-4 max-w-2xl text-white/60">
            MileStack helps clients and contributors collaborate confidently by
            combining milestone approvals with programmable escrow.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-6"
            >
              <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-semibold">
                {index + 1}
              </div>

              <h4 className="text-xl font-semibold">
                {step.title}
              </h4>

              <p className="mt-3 text-sm leading-7 text-white/60">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>
<section className="mx-auto max-w-7xl px-6 pb-24">
  <div className="text-center">
    <p className="text-sm uppercase tracking-[0.3em] text-blue-400">
      Why MileStack
    </p>

    <h3 className="mt-4 text-4xl font-bold">
      Built for modern teams.
    </h3>

    <p className="mx-auto mt-4 max-w-2xl text-white/60">
      MileStack combines programmable escrow with milestone-based collaboration,
      helping clients and contributors work together with confidence.
    </p>
  </div>

  <div className="mt-16 grid gap-6 md:grid-cols-3">

    <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
      <h4 className="text-xl font-semibold">
        Programmable Escrow
      </h4>

      <p className="mt-4 leading-7 text-white/60">
        Funds remain securely locked until milestone conditions are approved,
        protecting both clients and contributors.
      </p>
    </div>

    <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
      <h4 className="text-xl font-semibold">
        Transparent Workflow
      </h4>

      <p className="mt-4 leading-7 text-white/60">
        Every milestone approval and payment is recorded on-chain, making
        project progress easy to verify.
      </p>
    </div>

    <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
      <h4 className="text-xl font-semibold">
        Fast Settlement
      </h4>

      <p className="mt-4 leading-7 text-white/60">
        Release milestone payments instantly once work is completed and
        approved, reducing delays and building trust.
      </p>
    </div>

  </div>
</section>

   <section className="border-t border-white/10">
  <div className="mx-auto max-w-7xl px-6 py-16">

    <div className="grid gap-10 md:grid-cols-3">

      <div>
        <h3 className="text-2xl font-bold">MileStack</h3>

        <p className="mt-4 max-w-sm text-white/60 leading-7">
          Milestone-based programmable escrow on Stacks.
        </p>
      </div>

      <div>
        <h4 className="font-semibold">Product</h4>

        <ul className="mt-4 space-y-3 text-white/60">
          <li>Create Project</li>
          <li>Projects</li>
          <li>Milestones</li>
        </ul>
      </div>

      <div>
        <h4 className="font-semibold">Built With</h4>

        <p className="mt-4 text-white/60">
          MileStack escrow on Stacks
        </p>

        <p className="mt-8 text-sm text-white/40">
          © 2026 MileStack. All rights reserved.
        </p>
      </div>

    </div>

  </div>
</section>
    </main>
  );
}
