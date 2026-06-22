import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "L-Lee Workspace",
  description: "Personal workspace dashboard for calendar, drive, notes, tasks, and AI assistance.",
  icons: {
    icon: "/l-lee-icon.png",
    shortcut: "/l-lee-icon.png",
    apple: "/l-lee-icon.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
