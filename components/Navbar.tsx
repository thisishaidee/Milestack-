import Link from "next/link";
import WalletConnectButton from "@/components/WalletConnectButton";

export default function Navbar() {
  return (
    <nav className="border-b border-white/10 bg-vault-bg/95 px-5 py-4 text-white sm:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">MileStack</Link>
        <div className="flex items-center gap-4">
          <Link href="/projects" className="hidden text-sm text-white/65 transition hover:text-white sm:inline">Projects</Link>
          <WalletConnectButton />
        </div>
      </div>
    </nav>
  );
}
