import Link from "next/link";
import { ToastRail } from "./ToastRail";

const nav = [
  { href: "/upload", label: "Upload" },
  { href: "/cast", label: "Cast" },
  { href: "/generate", label: "Generate" },
  { href: "/player", label: "Player" }
];

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink text-paper">
      <header className="border-b border-paper/15">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/upload" className="text-xl font-semibold tracking-wide">
            NovelCast
          </Link>
          <nav className="flex gap-1 text-sm text-paper/70">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="rounded-md px-3 py-2 hover:bg-paper/10 hover:text-paper">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {children}
      <ToastRail />
    </div>
  );
}
