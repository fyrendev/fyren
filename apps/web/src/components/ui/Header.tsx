import type { Organization } from "@/lib/types";
import Image from "next/image";

interface Props {
  organization: Organization;
}

export function Header({ organization }: Props) {
  return (
    <header className="flex items-center gap-4">
      {organization.logoUrl ? (
        <Image
          src={organization.logoUrl}
          alt={organization.name}
          width={40}
          height={40}
          className="rounded"
        />
      ) : (
        <div
          className="w-10 h-10 rounded flex items-center justify-center text-lg font-bold"
          style={{ backgroundColor: organization.brandColor || "#627d98" }}
        >
          {organization.name[0]}
        </div>
      )}
      <h1 className="text-2xl font-semibold">{organization.name} Status</h1>
    </header>
  );
}
