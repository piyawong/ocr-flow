'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface ImageViewerProps {
  src: string;
  alt?: string;
  className?: string;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
  showControls?: boolean;
}

export default function ImageViewer({
  src,
  alt = 'Image',
  className = '',
  onPrevious,
  onNext,
  hasPrevious = false,
  hasNext = false,
  showControls = true,
}: ImageViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [imagePan, setImagePan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const imageContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const zoomRef = useRef<number>(100);
  const initialPinchDistanceRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(100);
  const touchListenersInstalledRef = useRef<boolean>(false);
  const rafRef = useRef<number | null>(null);

  // Sync zoom ref with zoom state
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  // Optimized zoom update using requestAnimationFrame
  const updateZoom = useCallback((newZoom: number) => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      setZoom(Math.max(25, Math.min(300, newZoom)));
    });
  }, []);

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // Reset pan and zoom when image changes
  useEffect(() => {
    setImagePan({ x: 0, y: 0 });
    setZoom(100);
  }, [src]);

  // Handle mouse wheel zoom - reduced sensitivity
  useEffect(() => {
    const imageContainer = imageContainerRef.current;
    if (!imageContainer) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Reduced sensitivity: 5 instead of 10
      const delta = e.deltaY > 0 ? -5 : 5;
      updateZoom(zoomRef.current + delta);
    };

    imageContainer.addEventListener('wheel', handleWheel, { passive: false });
    return () => imageContainer.removeEventListener('wheel', handleWheel);
  }, [updateZoom]);

  // Handle touch events for pinch-to-zoom - reduced sensitivity
  useEffect(() => {
    const imageContainer = imageContainerRef.current;
    if (!imageContainer) return;
    if (touchListenersInstalledRef.current) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        initialPinchDistanceRef.current = distance;
        initialZoomRef.current = zoomRef.current;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialPinchDistanceRef.current !== null) {
        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        const currentDistance = Math.sqrt(dx * dx + dy * dy);
        const rawScale = currentDistance / initialPinchDistanceRef.current;
        // Reduced sensitivity: 0.3 instead of 0.5
        const sensitivity = 0.3;
        const scale = 1 + (rawScale - 1) * sensitivity;
        const newZoom = initialZoomRef.current * scale;
        updateZoom(newZoom);
      }
    };

    const handleTouchEnd = () => {
      initialPinchDistanceRef.current = null;
    };

    imageContainer.addEventListener('touchstart', handleTouchStart, { passive: false });
    imageContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
    imageContainer.addEventListener('touchend', handleTouchEnd, { passive: false });
    imageContainer.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    imageContainer.addEventListener('contextmenu', (e) => e.preventDefault());

    touchListenersInstalledRef.current = true;

    return () => {
      imageContainer.removeEventListener('touchstart', handleTouchStart);
      imageContainer.removeEventListener('touchmove', handleTouchMove);
      imageContainer.removeEventListener('touchend', handleTouchEnd);
      imageContainer.removeEventListener('touchcancel', handleTouchEnd);
      touchListenersInstalledRef.current = false;
    };
  }, [updateZoom]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && onPrevious && hasPrevious) {
        onPrevious();
      } else if (e.key === 'ArrowRight' && onNext && hasNext) {
        onNext();
      } else if (e.key === '+' || e.key === '=') {
        setZoom(prev => Math.min(300, prev + 25));
      } else if (e.key === '-') {
        setZoom(prev => Math.max(25, prev - 25));
      } else if (e.key === '0') {
        handleResetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onPrevious, onNext, hasPrevious, hasNext]);

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - imagePan.x, y: e.clientY - imagePan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      setImagePan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDoubleClick = () => {
    setZoom(100);
    setImagePan({ x: 0, y: 0 });
  };

  const handleResetZoom = () => {
    setZoom(100);
    setImagePan({ x: 0, y: 0 });
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Controls */}
      {showControls && (
        <div className="flex items-center justify-between px-3 py-2 bg-card-bg border-b border-border-color flex-shrink-0">
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={onPrevious}
              disabled={!hasPrevious}
              className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Previous (Left Arrow)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={onNext}
              disabled={!hasNext}
              className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Next (Right Arrow)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setZoom(prev => Math.max(25, prev - 25))}
              className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded transition-colors"
              title="Zoom out (-)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className="text-xs text-text-secondary min-w-[45px] text-center font-medium">{zoom}%</span>
            <button
              onClick={() => setZoom(prev => Math.min(300, prev + 25))}
              className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded transition-colors"
              title="Zoom in (+)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <div className="w-px h-4 bg-border-color mx-1"></div>
            <button
              onClick={handleResetZoom}
              className="px-2 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-hover-bg rounded transition-colors"
              title="Reset zoom (0)"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Image Container */}
      <div
        ref={imageContainerRef}
        className={`flex-1 overflow-hidden flex items-center justify-center bg-bg-secondary relative ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{
          touchAction: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      >
        <img
          ref={imageRef}
          src={src}
          alt={alt}
          className="max-w-none select-none shadow-2xl"
          draggable={false}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            transform: `scale(${zoom / 100}) translate(${imagePan.x / (zoom / 100)}px, ${imagePan.y / (zoom / 100)}px)`,
            transformOrigin: 'center center',
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        />
      </div>
    </div>
  );
}
