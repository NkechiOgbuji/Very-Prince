import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { readOrganization, readOrgBudget } from "@/lib/sorobanClient";

type Props = {
  params: { id: string };
};

// ── Dynamic Metadata ──────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const [org, budget] = await Promise.all([
      readOrganization(params.id),
      readOrgBudget(params.id),
    ]);

    const title = org.name ?? params.id;
    const budgetLine = budget?.xlm ? `Budget: ${budget.xlm} XLM` : "";
    const description = `${title} is an organization on Very Princess. ${budgetLine}`.trim();

    return {
      title,
      description,
      openGraph: {
        title: `${title} | Very Princess`,
        description,
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: `${title} | Very Princess`,
        description,
      },
    };
  } catch {
    return {
      title: `Org: ${params.id} | Very Princess`,
      description:
        "View this organization on Very Princess, built on Stellar Soroban.",
    };
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrgDetailPage({ params }: Props) {
  redirect(`/dashboard?org=${encodeURIComponent(params.id)}`);
}