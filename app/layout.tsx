import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./components/Providers";
import { Navbar } from "./components/Navbar";

export const metadata: Metadata = {
  title: "TripSplit - Split Expenses with Friends",
  description: "Track and split expenses for group trips with UPI payment integration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        <Providers>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
