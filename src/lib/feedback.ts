import type { QA } from './engine';
export type Grade = 'A'|'B'|'C'|'D';

export function evaluate(qas: QA[]){
  const hitPersona = qas.some(x=>/理念|地域|連携|安全|QA|線量|最適化|説明責任/.test(x.a));
  const concrete   = qas.some(x=>/\d|%|時間|件|具体|KPI/.test(x.a));
  const transfer   = qas.some(x=>/当院|活か|転用|適用/.test(x.a));
  let grade: Grade = 'D';
  if (hitPersona && concrete && transfer) grade='A';
  else if([hitPersona&&concrete,hitPersona&&transfer,concrete&&transfer].some(Boolean)) grade='B';
  else if(hitPersona||concrete||transfer) grade='C';
  return { grade, note: {A:'適合・具体・転用が揃う',B:'方向性良・結節弱',C:'要素単発',D:'適合・具体不足'}[grade] };
}

export function buildFeedback(persona: any, qas: QA[]){
  const r = evaluate(qas);
  const mod = persona?.modalities?.[0] || 'CT/MRI';
  return {
    grade: r.grade,
    gradeNote: r.note,
    good: [
      '病院価値（理念・地域・安全など）との接続が見える',
      '目的→行動→成果の流れで事実を説明できている'
    ],
    improve: [
      '数値・時間・KPIで検証可能にする',
      `当院の設備（例：${mod}）や体制に沿って「どこに強みを挿入するか」を具体化`
    ],
    whyDeepDive: [
      '価値観適合の確認（理念・地域連携・安全文化）',
      '再現可能性の検証（事例→当院業務への転用）',
      '説明責任と接遇の姿勢の確認'
    ],
    nextAdvice: [
      '見学でワークフロー観察→強みの挿入ポイントを3か所メモ化',
      '線量最適化・接遇・チーム連携の学習メモを2〜3枚で可視化'
    ]
  };
}
