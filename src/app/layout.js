import localFont from "next/font/local";
import "./globals.css";
import Providers from "./providers";
import HeaderGate from "./../components/HeaderGate";
import ScrollTopButton from "./../components/ScrollTopButton";

// Google Sans → body / detail / Latin. LINE Seed Sans TH → headings + Thai.
// Variable names must differ from the @theme --font-* keys in globals.css.
const googleSans = localFont({
  src: [
    { path: "../fonts/GoogleSans-Regular.ttf", weight: "400", style: "normal" },
    { path: "../fonts/GoogleSans-Medium.ttf", weight: "500", style: "normal" },
    { path: "../fonts/GoogleSans-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../fonts/GoogleSans-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-google-sans",
  display: "swap",
});

const lineSeed = localFont({
  src: [
    { path: "../fonts/LINESeedSansTH_W_Th.woff2", weight: "100", style: "normal" },
    { path: "../fonts/LINESeedSansTH_W_Rg.woff2", weight: "400", style: "normal" },
    { path: "../fonts/LINESeedSansTH_W_Bd.woff2", weight: "700", style: "normal" },
    { path: "../fonts/LINESeedSansTH_W_He.woff2", weight: "800", style: "normal" },
    { path: "../fonts/LINESeedSansTH_W_XBd.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-line-seed",
  display: "swap",
});

export const metadata = {
  title: "9Expert HRMS",
  description: "Internal Human Resource Management System — 9Expert Training",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th" className={`${googleSans.variable} ${lineSeed.variable}`}>
      <body className="antialiased">
        <Providers>
          {/* <HeaderGate /> */}
          <main className="min-h-[calc(100dvh-4rem)]">{children}</main>
        </Providers>
        <ScrollTopButton />
      </body>
    </html>
  );
}
