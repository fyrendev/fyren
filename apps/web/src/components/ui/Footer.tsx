import type { Organization } from "@/lib/types";
import { Rss } from "lucide-react";

interface Props {
  organization: Organization;
  rssUrl: string;
}

export function Footer({ organization, rssUrl }: Props) {
  return (
    <footer className="mt-12 pt-8 border-t border-navy-800 text-sm text-navy-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {organization.websiteUrl && (
            <a
              href={organization.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              {organization.name}
            </a>
          )}
          <a
            href={rssUrl}
            className="inline-flex items-center gap-1 hover:text-white transition-colors"
          >
            <Rss className="w-4 h-4" />
            RSS
          </a>
        </div>
        <a
          href="https://fyren.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-white transition-colors"
        >
          Powered by Fyren
        </a>
      </div>
    </footer>
  );
}
