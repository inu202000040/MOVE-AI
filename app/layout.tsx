import type { ReactNode } from "react";

import { PAGE_PATHS } from "./contracts";

const NAVIGATION = [
  ["Landing", PAGE_PATHS.landing],
  ["Dashboard", PAGE_PATHS.dashboard],
  ["Models", PAGE_PATHS.models],
  ["Network", PAGE_PATHS.network],
  ["Allocation", PAGE_PATHS.allocation],
] as const;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <nav aria-label="Primary">
          {NAVIGATION.map(([label, href]) => (
            <a href={href} key={href}>
              {label}
            </a>
          ))}
        </nav>
        {children}
      </body>
    </html>
  );
}
