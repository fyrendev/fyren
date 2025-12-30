"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface Props {
  interval: number; // milliseconds
}

export function AutoRefresh({ interval }: Props) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => {
      router.refresh();
    }, interval);

    return () => clearInterval(timer);
  }, [interval, router]);

  return null;
}
