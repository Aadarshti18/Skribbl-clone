import React, { useCallback, useEffect, useRef, useState } from "react";
import { useGame } from "../context/GameContext";

interface Point {
  x: number;
  y: number;
}

interface StrokeRecord {
  strokeId: string;
  color: string;
  size: number;
  tool: "brush" | "eraser";
  points: Point[];
}

const COLORS = [
  "#1A1A2E", "#FFFFFF", "#FF5A5F", "#FFC857", "#3DDC84",
  "#6C5CE7", "#0F8B8D", "#E8590C", "#D63384", "#495057",
  "#74C0FC", "#A9E34B",
];

const SIZES = [4, 8, 14, 24];

function nanoId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function DrawingCanvas({ isDrawer }: { isDrawer: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const stateRef = useRef({
    drawing: false,
    currentStrokeId: "",
    lastPoint: null as Point | null,
  });

  const strokesRef = useRef<StrokeRecord[]>([]);
  const remoteStrokesRef = useRef<Map<string, StrokeRecord>>(new Map());

  const [color, setColor] = useState("#1A1A2E");
  const [size, setSize] = useState(8);
  const [tool, setTool] = useState<"brush" | "eraser">("brush");

  const { emitDrawStart, emitDrawMove, emitDrawEnd, emitCanvasClear, emitDrawUndo, onDrawData, onCanvasClear, onDrawUndo } =
    useGame();

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const all = [...strokesRef.current, ...remoteStrokesRef.current.values()];
    for (const stroke of all) {
      drawStrokePath(ctx, stroke);
    }
  }, []);

  function drawStrokePath(ctx: CanvasRenderingContext2D, stroke: StrokeRecord) {
    if (stroke.points.length === 0) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = stroke.size;
    ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = stroke.tool === "eraser" ? "rgba(0,0,0,1)" : stroke.color;

    if (stroke.points.length === 1) {
      const p = stroke.points[0];
      ctx.beginPath();
      ctx.arc(p.x, p.y, stroke.size / 2, 0, Math.PI * 2);
      ctx.fillStyle = ctx.strokeStyle as string;
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- Setup canvas + responsive sizing -------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.round(rect.width * dpr);
      const targetH = Math.round(rect.height * dpr);
      if (canvas.width === targetW && canvas.height === targetH) return;

      // Preserve existing drawing by redrawing after resize
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctxRef.current = ctx;
        redrawAll();
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [redrawAll]);

  // --- Wire up incoming remote draw events -----------------------------------
  useEffect(() => {
    const offData = onDrawData((payload) => {
      const ctx = ctxRef.current;
      if (!ctx) return;

      if (payload.type === "start") {
        const s = payload.stroke as { strokeId: string; x: number; y: number; color: string; size: number; tool: "brush" | "eraser" };
        const rect = containerRef.current?.getBoundingClientRect();
        const w = rect?.width ?? 1;
        const h = rect?.height ?? 1;
        const stroke: StrokeRecord = {
          strokeId: s.strokeId,
          color: s.color,
          size: s.size,
          tool: s.tool,
          points: [{ x: s.x * w, y: s.y * h }],
        };
        remoteStrokesRef.current.set(s.strokeId, stroke);
        redrawAll();
      } else if (payload.type === "move") {
        const s = payload.stroke as { strokeId: string; x: number; y: number };
        const stroke = remoteStrokesRef.current.get(s.strokeId);
        if (!stroke) return;
        const rect = containerRef.current?.getBoundingClientRect();
        const w = rect?.width ?? 1;
        const h = rect?.height ?? 1;
        stroke.points.push({ x: s.x * w, y: s.y * h });
        redrawAll();
      } else if (payload.type === "end") {
        const s = payload.stroke as { strokeId: string };
        const stroke = remoteStrokesRef.current.get(s.strokeId);
        if (stroke) {
          strokesRef.current.push(stroke);
          remoteStrokesRef.current.delete(s.strokeId);
        }
      }
    });

    const offClear = onCanvasClear(() => {
      strokesRef.current = [];
      remoteStrokesRef.current.clear();
      redrawAll();
    });

    const offUndo = onDrawUndo(() => {
      strokesRef.current.pop();
      redrawAll();
    });

    return () => {
      offData();
      offClear();
      offUndo();
    };
  }, [onDrawData, onCanvasClear, onDrawUndo, redrawAll]);

  // --- Local drawing handlers (drawer only) -----------------------------------
  const getRelativePoint = useCallback((clientX: number, clientY: number): Point => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const handlePointerDown = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDrawer) return;
      const p = getRelativePoint(clientX, clientY);
      const strokeId = nanoId();
      stateRef.current = { drawing: true, currentStrokeId: strokeId, lastPoint: p };

      const stroke: StrokeRecord = { strokeId, color, size, tool, points: [p] };
      strokesRef.current.push(stroke);
      redrawAll();

      const rect = containerRef.current!.getBoundingClientRect();
      emitDrawStart({ strokeId, x: p.x / rect.width, y: p.y / rect.height, color, size, tool });
    },
    [isDrawer, color, size, tool, getRelativePoint, emitDrawStart, redrawAll]
  );

  const handlePointerMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDrawer || !stateRef.current.drawing) return;
      const p = getRelativePoint(clientX, clientY);
      const stroke = strokesRef.current[strokesRef.current.length - 1];
      if (stroke && stroke.strokeId === stateRef.current.currentStrokeId) {
        stroke.points.push(p);
        redrawAll();
      }
      stateRef.current.lastPoint = p;

      const rect = containerRef.current!.getBoundingClientRect();
      emitDrawMove({ strokeId: stateRef.current.currentStrokeId, x: p.x / rect.width, y: p.y / rect.height });
    },
    [isDrawer, getRelativePoint, emitDrawMove, redrawAll]
  );

  const handlePointerUp = useCallback(() => {
    if (!isDrawer || !stateRef.current.drawing) return;
    const strokeId = stateRef.current.currentStrokeId;
    stateRef.current.drawing = false;
    emitDrawEnd({ strokeId });
  }, [isDrawer, emitDrawEnd]);

  // Pointer events (covers mouse + touch + pen uniformly)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function onDown(e: PointerEvent) {
      e.preventDefault();
      canvas!.setPointerCapture(e.pointerId);
      handlePointerDown(e.clientX, e.clientY);
    }
    function onMove(e: PointerEvent) {
      if (e.buttons === 0 && e.pointerType === "mouse") return;
      handlePointerMove(e.clientX, e.clientY);
    }
    function onUp() {
      handlePointerUp();
    }

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("pointerleave", onUp);

    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("pointerleave", onUp);
    };
  }, [handlePointerDown, handlePointerMove, handlePointerUp]);

  // Clear local strokes whenever a fresh round begins (new word being drawn)
  useEffect(() => {
    strokesRef.current = [];
    remoteStrokesRef.current.clear();
    redrawAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDrawer]);

  const handleClear = useCallback(() => {
    strokesRef.current = [];
    remoteStrokesRef.current.clear();
    redrawAll();
    emitCanvasClear();
  }, [emitCanvasClear, redrawAll]);

  const handleUndo = useCallback(() => {
    strokesRef.current.pop();
    redrawAll();
    emitDrawUndo();
  }, [emitDrawUndo, redrawAll]);

  return (
    <div className="canvas-wrap">
      <div className="canvas-frame" ref={containerRef}>
        <canvas ref={canvasRef} className="drawing-canvas" style={{ touchAction: "none" }} />
        {!isDrawer && (
          <div className="canvas-watch-badge" aria-hidden="true">
            👀 watching
          </div>
        )}
      </div>

      {isDrawer && (
        <div className="toolbar" role="toolbar" aria-label="Drawing tools">
          <div className="toolbar-colors">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`color-swatch ${color === c && tool === "brush" ? "color-swatch--active" : ""}`}
                style={{ background: c }}
                aria-label={`Color ${c}`}
                onClick={() => {
                  setColor(c);
                  setTool("brush");
                }}
              />
            ))}
          </div>

          <div className="toolbar-sizes">
            {SIZES.map((s) => (
              <button
                key={s}
                className={`size-swatch ${size === s ? "size-swatch--active" : ""}`}
                aria-label={`Brush size ${s}`}
                onClick={() => setSize(s)}
              >
                <span style={{ width: s, height: s }} />
              </button>
            ))}
          </div>

          <div className="toolbar-actions">
            <button
              className={`btn btn-sm ${tool === "eraser" ? "btn-primary" : ""}`}
              onClick={() => setTool("eraser")}
              aria-pressed={tool === "eraser"}
            >
              🧹 Eraser
            </button>
            <button className="btn btn-sm" onClick={handleUndo}>
              ↩ Undo
            </button>
            <button className="btn btn-sm btn-danger" onClick={handleClear}>
              🗑 Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
