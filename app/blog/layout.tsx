import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "DeerStats Blog — Trail Cam, Weather & Deer Hunting Science",
  description: "Research-backed articles on deer movement, weather patterns, trail camera analysis, and the science of finding your best days to hunt.",
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f5f0e8" }}>
      <header style={{ backgroundColor: "#2d5016", padding: "16px 24px" }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "12px", textDecoration: "none" }}>
            <Image src="/deer-stats-logo.png" alt="DeerStats" width={40} height={40} />
            <span style={{ color: "#fff", fontWeight: "700", fontSize: "20px", fontFamily: "Georgia, serif" }}>DeerStats</span>
          </Link>
          <Link href="/blog" style={{ color: "#c8e6a0", textDecoration: "none", fontSize: "15px" }}>← All Articles</Link>
        </div>
      </header>
      {children}
    </div>
  );
}
