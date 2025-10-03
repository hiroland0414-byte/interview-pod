import './globals.css';

export const metadata = {
  title: 'Interview GEM',
  description: 'AI面接シミュレーション'
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
