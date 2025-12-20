'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWithAuth } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4004';

export default function Dashboard() {
  const [stats, setStats] = useState({ rawFiles: 0 });

  useEffect(() => {
    fetchWithAuth('/files')
      .then((res) => res.json())
      .then((data) => setStats({ rawFiles: data.count }))
      .catch(console.error);
  }, []);

  return (
    <div className="p-8 max-w-[1400px] mx-auto">
      <div className="mb-8">
        <h1 className="m-0 mb-2 text-[1.75rem]">Dashboard</h1>
        <p className="m-0 text-text-secondary">OCR Document Processing Pipeline Overview</p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-6 mb-8">
        <div className="bg-card-bg border border-border-color rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">📁</span>
            <span className="text-[0.9rem] text-text-secondary">Raw Images</span>
          </div>
          <p className="text-5xl font-bold m-0 mb-3 text-accent">{stats.rawFiles}</p>
          <Link href="/stages/01-raw" className="text-[0.9rem] text-accent hover:underline">
            View Details →
          </Link>
        </div>

        <div className="bg-card-bg border border-border-color rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">📑</span>
            <span className="text-[0.9rem] text-text-secondary">Groups</span>
          </div>
          <p className="text-5xl font-bold m-0 mb-3 text-accent">0</p>
          <Link href="/stages/02-group" className="text-[0.9rem] text-accent hover:underline">
            View Details →
          </Link>
        </div>

        <div className="bg-card-bg border border-border-color rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">📄</span>
            <span className="text-[0.9rem] text-text-secondary">PDFs</span>
          </div>
          <p className="text-5xl font-bold m-0 mb-3 text-accent">0</p>
          <Link href="/stages/03-pdf-label" className="text-[0.9rem] text-accent hover:underline">
            View Details →
          </Link>
        </div>

        <div className="bg-card-bg border border-border-color rounded-xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">✅</span>
            <span className="text-[0.9rem] text-text-secondary">Processed</span>
          </div>
          <p className="text-5xl font-bold m-0 mb-3 text-accent">0</p>
          <Link href="/stages/04-extract" className="text-[0.9rem] text-accent hover:underline">
            View Details →
          </Link>
        </div>
      </div>

      <div className="bg-card-bg border border-border-color rounded-xl p-6">
        <h2 className="m-0 mb-6 text-[1.1rem]">Processing Pipeline</h2>
        <div className="flex items-center gap-3 overflow-x-auto py-2">
          <Link
            href="/stages/01-raw"
            className={`flex items-center gap-2 px-4 py-3 border rounded-lg transition-all duration-200 whitespace-nowrap ${
              stats.rawFiles > 0
                ? 'bg-accent border-accent'
                : 'bg-bg-secondary border-border-color hover:border-accent'
            }`}
          >
            <span className={`font-semibold ${stats.rawFiles > 0 ? 'text-white' : 'text-accent'}`}>01</span>
            <span className={`text-[0.9rem] ${stats.rawFiles > 0 ? 'text-white' : 'text-text-primary'}`}>Raw Images</span>
          </Link>
          <span className="text-text-secondary text-xl shrink-0">→</span>
          <Link href="/stages/02-group" className="flex items-center gap-2 px-4 py-3 bg-bg-secondary border border-border-color rounded-lg transition-all duration-200 whitespace-nowrap hover:border-accent">
            <span className="font-semibold text-accent">02</span>
            <span className="text-text-primary text-[0.9rem]">Group</span>
          </Link>
          <span className="text-text-secondary text-xl shrink-0">→</span>
          <Link href="/stages/03-pdf-label" className="flex items-center gap-2 px-4 py-3 bg-bg-secondary border border-border-color rounded-lg transition-all duration-200 whitespace-nowrap hover:border-accent">
            <span className="font-semibold text-accent">03</span>
            <span className="text-text-primary text-[0.9rem]">PDF Label</span>
          </Link>
          <span className="text-text-secondary text-xl shrink-0">→</span>
          <Link href="/stages/04-extract" className="flex items-center gap-2 px-4 py-3 bg-bg-secondary border border-border-color rounded-lg transition-all duration-200 whitespace-nowrap hover:border-accent">
            <span className="font-semibold text-accent">04</span>
            <span className="text-text-primary text-[0.9rem]">Extract</span>
          </Link>
          <span className="text-text-secondary text-xl shrink-0">→</span>
          <Link href="/stages/05-review" className="flex items-center gap-2 px-4 py-3 bg-bg-secondary border border-border-color rounded-lg transition-all duration-200 whitespace-nowrap hover:border-accent">
            <span className="font-semibold text-accent">05</span>
            <span className="text-text-primary text-[0.9rem]">Review</span>
          </Link>
          <span className="text-text-secondary text-xl shrink-0">→</span>
          <Link href="/stages/06-upload" className="flex items-center gap-2 px-4 py-3 bg-bg-secondary border border-border-color rounded-lg transition-all duration-200 whitespace-nowrap hover:border-accent">
            <span className="font-semibold text-accent">06</span>
            <span className="text-text-primary text-[0.9rem]">Upload</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
