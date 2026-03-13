"use client";

import { useState, useRef, useEffect, useMemo, useId } from "react";
import clsx from "clsx";

const TIMEZONES = Intl.supportedValuesOf("timeZone");

function formatTimezoneLabel(tz: string): string {
  try {
    const offset =
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        timeZoneName: "shortOffset",
      })
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName")?.value ?? "";

    return `${tz.replace(/_/g, " ")} (${offset})`;
  } catch {
    return tz.replace(/_/g, " ");
  }
}

interface TimezoneSelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function TimezoneSelect({ label, value, onChange, error }: TimezoneSelectProps) {
  const generatedId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    if (!search) return TIMEZONES;
    const q = search.toLowerCase();
    return TIMEZONES.filter(
      (tz) => tz.toLowerCase().includes(q) || formatTimezoneLabel(tz).toLowerCase().includes(q)
    );
  }, [search]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [filtered]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, open]);

  function select(tz: string) {
    onChange(tz);
    setOpen(false);
    setSearch("");
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[highlightedIndex]) {
          select(filtered[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        setSearch("");
        break;
    }
  }

  const displayValue = open ? search : value ? formatTimezoneLabel(value) : "";

  return (
    <div className="space-y-1" ref={containerRef}>
      {label && (
        <label htmlFor={generatedId} className="block text-sm font-medium text-navy-300">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          id={generatedId}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          className={clsx(
            "block w-full px-4 py-2 bg-navy-800 border rounded-lg text-white placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
            error ? "border-red-500" : "border-navy-700"
          )}
          placeholder="Search timezones..."
          value={displayValue}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setSearch("");
          }}
          onKeyDown={handleKeyDown}
        />
        <svg
          className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400 pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        {open && filtered.length > 0 && (
          <ul
            ref={listRef}
            role="listbox"
            className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-navy-700 bg-navy-800 py-1 shadow-lg"
          >
            {filtered.map((tz, i) => (
              <li
                key={tz}
                role="option"
                aria-selected={tz === value}
                className={clsx(
                  "cursor-pointer select-none px-4 py-2 text-sm",
                  i === highlightedIndex
                    ? "bg-navy-700 text-white"
                    : "text-navy-300 hover:bg-navy-700/50 hover:text-white",
                  tz === value && "font-medium text-amber-400"
                )}
                onMouseEnter={() => setHighlightedIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(tz);
                }}
              >
                {formatTimezoneLabel(tz)}
              </li>
            ))}
          </ul>
        )}
        {open && filtered.length === 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-navy-700 bg-navy-800 py-3 px-4 text-sm text-navy-400 shadow-lg">
            No timezones found
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
