import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documents Viewer - OCR Flow',
};

export default function DocumentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Clean layout - let root layout handle html/body/ThemeProvider
  // This layout just passes children through
  return <>{children}</>;
}
