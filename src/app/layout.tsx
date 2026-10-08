import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import "./globals.css";

const vazirmatn = localFont({
  src: [
    { path: "../../public/fonts/Vazirmatn-Regular.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/Vazirmatn-Medium.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/Vazirmatn-SemiBold.woff2", weight: "600", style: "normal" },
    { path: "../../public/fonts/Vazirmatn-Bold.woff2", weight: "700", style: "normal" },
    { path: "../../public/fonts/Vazirmatn-ExtraBold.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-vazir",
  display: "swap",
});

export const metadata: Metadata = {
  title: "هایپر زیتون | سامانه ثبت مرجوعی کالا",
  description:
    "سامانه ثبت، پیگیری و پرداخت مرجوعی کالاهای هایپر زیتون رفسنجان — صندوقدارها ثبت می‌کنند، مدیریت وجه را برمی‌گرداند.",
  keywords: ["هایپر زیتون", "رفسنجان", "کرمان", "مرجوعی", "بازگشت کالا", "صندوق فروش"],
  authors: [{ name: "کیانوش صفاپور" }],
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4efe2" },
    { media: "(prefers-color-scheme: dark)", color: "#1a2419" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className={`${vazirmatn.variable} font-sans antialiased bg-background text-foreground min-h-screen`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
          <Toaster
            dir="rtl"
            position="bottom-center"
            richColors
            closeButton
            toastOptions={{
              style: {
                fontFamily: "var(--font-vazir), Tahoma, sans-serif",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
