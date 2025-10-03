'use client';
import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    window.location.href = '/start';
  }, []);
  return <main style={{ padding: 20 }}>Loading...</main>;
}
