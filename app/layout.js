import "./globals.css";

export const metadata = {
  title: "VoucherRADIUS",
  description: "Gestion des vouchers FreeRADIUS pour portails captifs pfSense"
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
