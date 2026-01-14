export function normalize(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[‐-‒–—―－ー]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function kanaToHiragana(s: string): string {
  return s.replace(/[\u30a1-\u30f6]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}
