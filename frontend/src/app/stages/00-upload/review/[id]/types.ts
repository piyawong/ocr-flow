export interface RawFile {
  id: number;
  fileNumber: number;
  originalName: string;
  storagePath: string;
  mimeType: string;
  size: number;
  processed: boolean;
  processedAt: string | null;
  isReviewed: boolean;
  reviewedAt: string | null;
  hasEdited: boolean;
  editedPath: string | null;
  createdAt: string;
}

export interface TextElement {
  id: string;
  text: string;
  x: number; // percentage position (0-100)
  y: number; // percentage position (0-100)
  fontSize: number;
  color: string;
}

// Unified history state (canvas + text)
export interface HistoryState {
  canvasData: ImageData | null;
  textElements: TextElement[];
}

export type DrawMode = 'mouse' | 'brush' | 'eraser';
