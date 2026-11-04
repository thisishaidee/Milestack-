import Link from "next/link";

const workflow = [
  ["01", "Create a project", "Set the budget and define who gets paid for each milestone."],
  ["02", "Fund escrow", "Move USDCx into the MileStack contract with your wallet."],
  ["03", "Approve the work", "Review each deliverable before authorizing its payment."],
  ["04", "Settle or refund", "Pay approved milestones or return the unpaid balance."],
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-vault-bg text-white">
      <section className="mx-auto max-w-6xl px-5 pb-20 pt-16 sm:px-8 sm:pt-24">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-400">
            Milestone escrow on Stacks
          </p>
          <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
            Work gets done.
            <span className="block text-white/50">Payments follow proof.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-white/65 sm:text-lg">
            MileStack helps teams secure project budgets, approve completed milestones,
            and release contributor payments through a transparent smart contract.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/projects/new" className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold transition hover:bg-blue-500">
              Create a project
            </Link>
            <Link href="/projects" className="rounded-lg border border-white/15 px-5 py-3 text-sm font-semibold text-white/80 transition hover:border-white/35">
              View projects
            </Link>
          </div>
        </div>
        <div className="mt-16 grid gap-3 border-t border-white/10 pt-6 text-sm sm:grid-cols-3">
          <div><p className="text-white/40">Network</p><p className="mt-1 font-medium">Stacks Testnet</p></div>
          <div><p className="text-white/40">Escrow asset</p><p className="mt-1 font-medium">USDCx</p></div>
          <div><p className="text-white/40">Wallet</p><p className="mt-1 font-medium">Xverse via Stacks Connect</p></div>
        </div>
      </section>
      <section className="border-t border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-400">The workflow</p>
          <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">A clear path from agreement to payment.</h2>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {workflow.map(([number, title, description]) => (
              <article key={number} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-sm text-blue-400">{number}</p>
                <h3 className="mt-5 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/55">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
