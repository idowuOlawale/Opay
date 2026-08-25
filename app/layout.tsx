import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Statemently — OPay Statement Intelligence", description: "Analyze OPay bank statement PDFs with privacy-first local parsing." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
