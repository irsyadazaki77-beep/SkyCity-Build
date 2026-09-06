import React, { useEffect, useRef } from 'react';
import { TileType, BUILD_COSTS } from '../../types';

interface CursorTooltipProps {
  activeTool: TileType | 'POINTER' | 'BULLDOZER' | 'RAISE_TERRAIN' | 'LOWER_TERRAIN' | 'LEVEL_TERRAIN' | 'SMOOTH_TERRAIN';
  brushSize: number;
}

export function CursorTooltip({ activeTool, brushSize }: CursorTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTool === 'POINTER' || activeTool === 'BULLDOZER') return;

    let rafId: number;
    let mouseX = 0;
    let mouseY = 0;

    const handlePointerMove = (e: PointerEvent) => {
      mouseX = e.clientX + 16;
      mouseY = e.clientY + 16;

      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (tooltipRef.current) {
          tooltipRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
        }
      });
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      cancelAnimationFrame(rafId);
    };
  }, [activeTool]);

  if (activeTool === 'POINTER' || activeTool === 'BULLDOZER') return null;

  const cost = typeof activeTool === 'string' && activeTool.includes('TERRAIN') ? 15 * (brushSize * brushSize) : BUILD_COSTS[activeTool as TileType] || 0;

  return (
    <div
      ref={tooltipRef}
      className="fixed top-0 left-0 z-50 pointer-events-none bg-slate-900/90 backdrop-blur-md border border-white/20 text-white px-3 py-1.5 rounded-lg shadow-2xl flex flex-col items-center text-xs font-mono select-none"
      style={{ transform: 'translate3d(-9999px, -9999px, 0)', willChange: 'transform' }}
    >
      <span className="font-semibold text-amber-300">{String(activeTool).replace('_', ' ')}</span>
      <span className="text-emerald-400 font-bold">${cost}</span>
    </div>
  );
}
