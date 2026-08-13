import type { ReactNode } from "react";

import "./globals.css";

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <title>GLOVIS 해상운임 예측·운임 의사결정 플랫폼</title>
        <meta
          content="KCCI 운임 예측과 글로벌 항만 모니터링, 운임 의사결정을 지원하는 GLOVIS 해상운임 예측·운임 의사결정 플랫폼"
          name="description"
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
