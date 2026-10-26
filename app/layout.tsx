import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "DesignRef — referências com intenção", description: "Organize referências, explicite suas escolhas e prepare um handoff de design com contexto." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
