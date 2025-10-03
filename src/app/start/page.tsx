'use client';
import React, { useEffect, useState } from 'react';
import HospitalSuggest from '@/components/HospitalSuggest';
import hospitals from '@/data/hospitals.json';

type Mode = {
  interviewOutput: 'text'|'voice'|'both';
  answerInput: 'text'|'voice';
  feedbackOutput: 'text'|'voice'|'both';
  remember: 'session'|'local';
};

export default function StartPage() {
  const [selected, setSelected] = useState<any>(null);
  const [copypaste, setCopypaste] = useState('');
  const [mode, setMode] = useState<Mode>({ interviewOutput:'text', answerInput:'text', feedbackOutput:'text', remember:'session'});

  useEffect(()=>{
    const saved = (mode.remember === 'local' ? localStorage : sessionStorage).getItem('interview.mode');
    if (saved) setMode(JSON.parse(saved));
    const prof = sessionStorage.getItem('interview.profile');
    if (prof) {
      const p = JSON.parse(prof);
      setSelected(p.hospital); setCopypaste(p.copypaste || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  function goNext(){
    if(!selected) return alert('病院を選んでください');
    const profile = { hospital: selected, copypaste };
    sessionStorage.setItem('interview.profile', JSON.stringify(profile));
    const store = mode.remember === 'local' ? localStorage : sessionStorage;
    store.setItem('interview.mode', JSON.stringify(mode));
    window.location.href = '/practice';
  }

  function storeMode(newMode: Partial<Mode>){
    const m = { ...mode, ...newMode };
    setMode(m);
  }

  return (
    <main className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">AI面接シミュレーション</h1>

      {!selected ? (
        <>
          <p>まず「面接したい病院名」を入力してください（あいまいOK）</p>
          <HospitalSuggest list={hospitals as any} onSelect={setSelected} />
        </>
      ) : (
        <div className="border rounded-lg p-3 space-y-3">
          <div className="font-semibold">選択中：{selected.name}（{selected.prefecture} {selected.city}）</div>

          <textarea
            className="w-full border rounded p-2 h-28"
            placeholder="任意：病院サイトの理念・人材像などをコピペ（あるほど“病院らしい質問”に寄ります）"
            value={copypaste} onChange={e=>setCopypaste(e.target.value)}
          />

          <div className="grid gap-3">
            <div>
              <div className="font-semibold">出力（面接中の質問）</div>
              <select
                className="p-2 border rounded"
                value={mode.interviewOutput}
                onChange={e=>storeMode({interviewOutput: e.target.value as any})}
              >
                <option value="text">テキスト</option>
                <option value="voice">音声</option>
                <option value="both">テキスト＋音声</option>
              </select>
            </div>
            <div>
              <div className="font-semibold">入力（回答）</div>
              <select
                className="p-2 border rounded"
                value={mode.answerInput}
                onChange={e=>storeMode({answerInput: e.target.value as any})}
              >
                <option value="text">テキスト</option>
                <option value="voice">音声（音声→文字→手直し）</option>
              </select>
            </div>
            <div>
              <div className="font-semibold">出力（フィードバック）</div>
              <select
                className="p-2 border rounded"
                value={mode.feedbackOutput}
                onChange={e=>storeMode({feedbackOutput: e.target.value as any})}
              >
                <option value="text">テキスト</option>
                <option value="voice">音声</option>
                <option value="both">テキスト＋音声</option>
              </select>
            </div>
            <div>
              <div className="font-semibold">設定を覚える</div>
              <select
                className="p-2 border rounded"
                value={mode.remember}
                onChange={e=>setMode({...mode, remember: e.target.value as any})}
              >
                <option value="session">今回のみ（端末内一時）</option>
                <option value="local">次回も（端末に保存）</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={goNext} className="px-4 py-2 bg-black text-white rounded">
              面接を開始する
            </button>
            <button onClick={()=>setSelected(null)} className="px-4 py-2 border rounded">
              病院を変更
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
