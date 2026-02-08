import type { Organization } from "@/lib/types";
import { Rss } from "lucide-react";
import { EmbedButton } from "@/components/status/EmbedModal";

interface Props {
  organization: Organization;
  rssUrl: string;
}

export function Footer({ organization, rssUrl }: Props) {
  return (
    <footer
      className="mt-12 pt-8 text-sm theme-muted"
      style={{ borderTop: "1px solid var(--card-border)" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {organization.websiteUrl && (
            <a
              href={organization.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="brand-link"
            >
              {organization.name}
            </a>
          )}
          <a href={rssUrl} className="inline-flex items-center gap-1 brand-link">
            <Rss className="w-4 h-4" />
            RSS
          </a>
          <EmbedButton />
        </div>
        <a
          href="https://fyren.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="brand-link"
        >
          Powered by Fyren
        </a>
      </div>
    </footer>
  );
}
