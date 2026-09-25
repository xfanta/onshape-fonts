"use client";

import { createContext, useContext } from "react";
import type { Family } from "@/lib/family";

/** Hands the family footer's data, fetched once in the layout (a server
 *  component), to the client-side SiteShell that renders the footer. */
const FamilyContext = createContext<Family | null>(null);

export function FamilyProvider({ value, children }: { value: Family | null; children: React.ReactNode }) {
  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export const useFamily = () => useContext(FamilyContext);
