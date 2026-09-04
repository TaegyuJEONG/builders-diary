import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: "Builder's Diary - Portfolio Visualization",
  description: 'Visualize your portfolio with 3-layer hierarchy and tag-based search',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        {children}
      </body>
    </html>
  );
}
