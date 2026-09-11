"use client";

import Link from "next/link";
import { track } from "@/app/lib/track";

export function AboutCard({
  href,
  testId,
  title,
  body,
  cta,
  analyticsTarget,
}: {
  href: string;
  testId: string;
  title: string;
  body: string;
  cta: string;
  analyticsTarget?: "promises";
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className="border-border-subtle bg-card-bg hover:border-border-strong group flex flex-col rounded-xl border p-5 transition-colors"
      onClick={() => {
        if (analyticsTarget) {
          track({ type: "about_commitment_link_clicked", data: { target: analyticsTarget } });
        }
      }}
    >
      <h2 className="text-foreground text-lg font-semibold">{title}</h2>
      <p className="text-text-muted mt-2 flex-1 text-sm leading-relaxed">{body}</p>
      <span className="text-accent mt-4 text-sm font-medium group-hover:underline">{cta} →</span>
    </Link>
  );
}
