// next.config.ts
import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  output: 'export',            // 静的出力（サーバ不要で配布できる）
  images: { unoptimized: true } // 画像最適化機能を無効（サーバ不要化）
};
export default nextConfig;
