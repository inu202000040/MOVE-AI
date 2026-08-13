import type { ReactNode } from "react";

import { WorkspaceShell } from "../components/shell";

export default function FreightRiskLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
