import "./globals.css";

export const metadata = {
  title: "Family Travel Adventures",
  description: "Dynamic travel planner, checklists, and meal itineraries for our upcoming and past family adventures.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body>{children}</body>
    </html>
  );
}
