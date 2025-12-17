'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4004';

interface LabeledFile {
  id: number;
  groupId: number;
  orderInGroup: number;
  storagePath: string;
  originalName: string;
  templateName: string;
  labelStatus: string;
  pageInDocument: number;
}

function ReviewContent() {
  const searchParams = useSearchParams();
  const groupId = searchParams.get('groupId');
  const template = searchParams.get('template');
  const title = searchParams.get('title') || template;

  const [files, setFiles] = useState<LabeledFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId || !template) {
      setError('Missing groupId or template parameter');
      setLoading(false);
      return;
    }

    const fetchFiles = async () => {
      try {
        const res = await fetch(
          `${API}/labeled-files/group/${groupId}/by-template?name=${encodeURIComponent(template)}`
        );
        if (!res.ok) throw new Error('Failed to fetch files');
        const data = await res.json();
        setFiles(data.files || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, [groupId, template]);

  // Update window title
  useEffect(() => {
    document.title = title ? `Review: ${title}` : 'Review Documents';
  }, [title]);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>{error}</div>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>{title}</h1>
          <p style={styles.subtitle}>Group {groupId}</p>
        </div>
        <div style={styles.empty}>No documents found for this template</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>{title}</h1>
        <p style={styles.subtitle}>
          Group {groupId} - {files.length} page(s)
        </p>
      </div>

      <div style={styles.gallery}>
        {files.map((file, index) => (
          <div key={file.id} style={styles.imageCard}>
            <div style={styles.imageLabel}>
              Page {file.pageInDocument || index + 1} / {files.length}
            </div>
            <img
              src={`${API}/labeled-files/${file.id}/preview`}
              alt={`Page ${file.pageInDocument || index + 1}`}
              style={styles.image}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#1a1a2e',
    color: '#fff',
    padding: '20px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '24px',
    borderBottom: '1px solid #333',
    paddingBottom: '16px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    margin: 0,
    color: '#60a5fa',
  },
  subtitle: {
    fontSize: '14px',
    color: '#888',
    margin: '8px 0 0 0',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '18px',
    color: '#888',
  },
  error: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '18px',
    color: '#ef4444',
  },
  empty: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '50vh',
    fontSize: '16px',
    color: '#888',
  },
  gallery: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    alignItems: 'center',
  },
  imageCard: {
    backgroundColor: '#16213e',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
    maxWidth: '100%',
  },
  imageLabel: {
    backgroundColor: '#0f3460',
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#60a5fa',
  },
  image: {
    display: 'block',
    maxWidth: '100%',
    height: 'auto',
  },
};

export default function ReviewPage() {
  return (
    <Suspense fallback={<div style={styles.loading}>Loading...</div>}>
      <ReviewContent />
    </Suspense>
  );
}
