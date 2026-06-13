import "./globals.css";

export const metadata = {
  title: "L-Lee Workspace",
  description: "Personal workspace dashboard for calendar, drive, notes, tasks, and AI assistance.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
