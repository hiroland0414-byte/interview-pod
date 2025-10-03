'use client';
import React, { useMemo, useState } from 'react';
import Fuse from 'fuse.js';

type Hospital = {
  id: string;
  name: string;
  prefecture?: string;
  city?: string;
  tags?: string[];
};

export default function HospitalSuggest({
  list,
  onSelect,
}: {
  list: Hospital[];
  onSelect: (h: Hospital) => void;
}) {
  const [q, setQ] = useState('');
  const fuse = useMemo(
    () =>
      new Fuse(list, {
        keys: ['name', 'prefecture', 'city', 'tags'],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [list]
  );

  const results = q
    ? fuse.search(q).slice(0, 8).map((r) => r.item)
    : list.slice(0, 8);

  return (
    <div className="space-y-2">
      <input
        className="w-full p-2 border rounded"
        placeholder="例：京都市立病院 / 札幌 / がん など"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <ul className="divide-y border rounded">
        {results.map((h) => (
          <li
            key={h.id}
            className="p-2 hover:bg-gray-50 cursor-pointer"
            onClick={() => onSelect(h)}
          >
            <div className="font-medium">{h.name}</div>
            <div className="text-sm text-gray-600">
              {(h.prefecture || '') + (h.city ? ' ' + h.city : '')}
            </div>
            {h.tags?.length ? (
              <div className="mt-1 text-xs text-gray-500">
                {h.tags.join(' / ')}
              </div>
            ) : null}
          </li>
        ))}
        {!results.length && (
          <li className="p-2 text-sm text-gray-500">候補がありません</li>
        )}
      </ul>
    </div>
  );
}
