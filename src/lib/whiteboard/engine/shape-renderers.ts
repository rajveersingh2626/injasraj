/**
 * Canvas 2D Vector Shape & Object Renderers
 */

export const DEFAULT_STICKY_COLOR = '#FEF08A';
export const DEFAULT_STICKY_WIDTH = 200;
export const DEFAULT_STICKY_HEIGHT = 180;

/**
 * Draws coordinate grid or dot grid on canvas.
 */
export function drawVirtualGrid(
  context: CanvasRenderingContext2D,
  gridType: 'none' | 'dots' | 'lines' | 'grid',
  virtualWidth: number,
  virtualHeight: number
): void {
  if (gridType === 'none') return;

  context.save();
  const step = 40;
  const minX = -4000;
  const maxX = virtualWidth + 4000;
  const minY = -4000;
  const maxY = virtualHeight + 4000;

  if (gridType === 'lines' || gridType === 'grid') {
    context.strokeStyle = '#F1F5F9';
    context.lineWidth = 1;
    context.beginPath();
    for (let x = minX; x <= maxX; x += step) {
      context.moveTo(x, minY);
      context.lineTo(x, maxY);
    }
    for (let y = minY; y <= maxY; y += step) {
      context.moveTo(minX, y);
      context.lineTo(maxX, y);
    }
    context.stroke();
  } else if (gridType === 'dots') {
    context.fillStyle = '#CBD5E1';
    for (let x = minX; x <= maxX; x += step) {
      for (let y = minY; y <= maxY; y += step) {
        context.beginPath();
        context.arc(x, y, 1.5, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  context.restore();
}

/**
 * Draws smooth point path on canvas.
 */
export function drawPointsPath(
  context: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>
): void {
  if (!points || points.length === 0) return;
  context.beginPath();
  if (points.length === 1) {
    context.arc(points[0].x, points[0].y, 1, 0, Math.PI * 2);
    context.fill();
    return;
  }
  context.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    const midY = (prev.y + curr.y) / 2;
    context.quadraticCurveTo(prev.x, prev.y, midX, midY);
  }
  const last = points[points.length - 1];
  context.lineTo(last.x, last.y);
  context.stroke();
}

/**
 * Renders a single whiteboard object onto the Canvas 2D context.
 */
export function renderCanvasObject(
  context: CanvasRenderingContext2D,
  obj: any
): void {
  if (!obj) return;
  context.save();
  context.globalAlpha = typeof obj.opacity === 'number' ? obj.opacity : 1.0;

  switch (obj.type) {
    case 'path': {
      context.strokeStyle = obj.stroke || '#000000';
      context.lineWidth = obj.strokeWidth || 3;
      context.lineCap = (obj.strokeLineCap as CanvasLineCap) || 'round';
      context.lineJoin = (obj.strokeLineJoin as CanvasLineJoin) || 'round';
      if (Array.isArray(obj.points) && obj.points.length > 0) {
        drawPointsPath(context, obj.points);
      } else if (typeof Path2D !== 'undefined' && obj.path) {
        try {
          const p2d = new Path2D(obj.path);
          context.stroke(p2d);
        } catch {
          drawPointsPath(context, obj.points);
        }
      }
      break;
    }
    case 'rect': {
      const left = obj.left ?? 0;
      const top = obj.top ?? 0;
      const width = obj.width ?? 100;
      const height = obj.height ?? 100;
      const rx = obj.rx ?? 0;
      const roughness = obj.roughness ?? 0;

      if (roughness > 0) {
        const r = roughness * 1.5;
        const j1 = Math.sin(left) * r;
        const j2 = Math.cos(top) * r;
        const j3 = Math.sin(left + width) * r;
        const j4 = Math.cos(top + height) * r;
        context.beginPath();
        context.moveTo(left + j1, top + j2);
        context.lineTo(left + width + j3, top + j1);
        context.lineTo(left + width + j2, top + height + j4);
        context.lineTo(left + j3, top + height + j1);
        context.closePath();
      } else {
        context.beginPath();
        if (rx > 0 && typeof context.roundRect === 'function') {
          context.roundRect(left, top, width, height, [rx]);
        } else {
          context.rect(left, top, width, height);
        }
      }
      if (obj.fill && obj.fill !== 'transparent') {
        context.fillStyle = obj.fill;
        context.fill();
      }
      if (obj.stroke && obj.strokeWidth) {
        context.strokeStyle = obj.stroke;
        context.lineWidth = obj.strokeWidth;
        context.stroke();
      }
      if (obj.text) {
        context.save();
        const fontSize = obj.fontSize ?? 16;
        const fontFamily = obj.fontFamily ?? 'Inter, system-ui, sans-serif';
        context.font = `${fontSize}px ${fontFamily}`;
        context.fillStyle = obj.textColor || obj.stroke || '#000000';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(obj.text, left + width / 2, top + height / 2);
        context.restore();
      }
      break;
    }
    case 'circle': {
      const radius = obj.radius ?? (obj.width ? obj.width / 2 : 50);
      const centerX = (obj.left ?? 0) + radius;
      const centerY = (obj.top ?? 0) + radius;
      const roughness = obj.roughness ?? 0;

      context.beginPath();
      if (roughness > 0) {
        const r = roughness * 1.5;
        for (let a = 0; a <= Math.PI * 2 + 0.1; a += Math.PI / 4) {
          const jitter = Math.sin(a * 4 + centerX) * r;
          const px = centerX + (radius + jitter) * Math.cos(a);
          const py = centerY + (radius + jitter) * Math.sin(a);
          if (a === 0) context.moveTo(px, py);
          else context.lineTo(px, py);
        }
        context.closePath();
      } else {
        context.arc(centerX, centerY, radius, 0, Math.PI * 2);
      }
      if (obj.fill && obj.fill !== 'transparent') {
        context.fillStyle = obj.fill;
        context.fill();
      }
      if (obj.stroke && obj.strokeWidth) {
        context.strokeStyle = obj.stroke;
        context.lineWidth = obj.strokeWidth;
        context.stroke();
      }
      if (obj.text) {
        context.save();
        const fontSize = obj.fontSize ?? 16;
        const fontFamily = obj.fontFamily ?? 'Inter, system-ui, sans-serif';
        context.font = `${fontSize}px ${fontFamily}`;
        context.fillStyle = obj.textColor || obj.stroke || '#000000';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(obj.text, centerX, centerY);
        context.restore();
      }
      break;
    }
    case 'triangle': {
      const left = obj.left ?? 0;
      const top = obj.top ?? 0;
      const width = obj.width ?? 100;
      const height = obj.height ?? 100;
      context.beginPath();
      context.moveTo(left + width / 2, top);
      context.lineTo(left + width, top + height);
      context.lineTo(left, top + height);
      context.closePath();
      if (obj.fill && obj.fill !== 'transparent') {
        context.fillStyle = obj.fill;
        context.fill();
      }
      if (obj.stroke && obj.strokeWidth) {
        context.strokeStyle = obj.stroke;
        context.lineWidth = obj.strokeWidth;
        context.stroke();
      }
      if (obj.text) {
        context.save();
        const fontSize = obj.fontSize ?? 16;
        const fontFamily = obj.fontFamily ?? 'Inter, system-ui, sans-serif';
        context.font = `${fontSize}px ${fontFamily}`;
        context.fillStyle = obj.textColor || obj.stroke || '#000000';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(obj.text, left + width / 2, top + (height * 2) / 3);
        context.restore();
      }
      break;
    }
    case 'line': {
      const x1 = obj.x1 ?? obj.left ?? 0;
      const y1 = obj.y1 ?? obj.top ?? 0;
      const x2 = obj.x2 ?? (obj.left ?? 0) + (obj.width ?? 0);
      const y2 = obj.y2 ?? (obj.top ?? 0) + (obj.height ?? 0);
      const roughness = obj.roughness ?? 0;
      context.beginPath();
      if (roughness > 0) {
        const mx = (x1 + x2) / 2 + Math.sin(x1 + y1) * roughness * 2;
        const my = (y1 + y2) / 2 + Math.cos(x2 + y2) * roughness * 2;
        context.moveTo(x1, y1);
        context.quadraticCurveTo(mx, my, x2, y2);
      } else {
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
      }
      context.strokeStyle = obj.stroke || '#000000';
      context.lineWidth = obj.strokeWidth || 3;
      context.lineCap = 'round';
      context.stroke();
      break;
    }
    case 'arrow': {
      const x1 = obj.x1 ?? obj.left ?? 0;
      const y1 = obj.y1 ?? obj.top ?? 0;
      const x2 = obj.x2 ?? (obj.left ?? 0) + (obj.width ?? 0);
      const y2 = obj.y2 ?? (obj.top ?? 0) + (obj.height ?? 0);
      const roughness = obj.roughness ?? 0;
      context.beginPath();
      if (roughness > 0) {
        const mx = (x1 + x2) / 2 + Math.sin(x1 + y1) * roughness * 2;
        const my = (y1 + y2) / 2 + Math.cos(x2 + y2) * roughness * 2;
        context.moveTo(x1, y1);
        context.quadraticCurveTo(mx, my, x2, y2);
      } else {
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
      }
      context.strokeStyle = obj.stroke || '#000000';
      context.lineWidth = obj.strokeWidth || 3;
      context.lineCap = 'round';
      context.stroke();

      const angle = Math.atan2(y2 - y1, x2 - x1);
      const headLen = obj.headLength ?? 20;
      context.beginPath();
      context.moveTo(x2, y2);
      context.lineTo(
        x2 - headLen * Math.cos(angle - Math.PI / 6),
        y2 - headLen * Math.sin(angle - Math.PI / 6)
      );
      context.lineTo(
        x2 - headLen * Math.cos(angle + Math.PI / 6),
        y2 - headLen * Math.sin(angle + Math.PI / 6)
      );
      context.closePath();
      context.fillStyle = obj.fill || obj.stroke || '#000000';
      context.fill();
      break;
    }
    case 'text': {
      const fontSize = obj.fontSize ?? 24;
      const fontFamily = obj.fontFamily ?? 'Inter, system-ui, sans-serif';
      context.font = `${fontSize}px ${fontFamily}`;
      context.fillStyle = obj.fill || obj.color || obj.stroke || '#000000';
      context.textBaseline = 'top';
      const left = obj.left ?? 0;
      const top = obj.top ?? 0;
      const lines = (obj.text ?? '').toString().split('\n');
      const lineHeight = fontSize * 1.25;
      for (let i = 0; i < lines.length; i++) {
        context.fillText(lines[i], left, top + i * lineHeight);
      }
      break;
    }
    case 'sticky': {
      const left = obj.left ?? 0;
      const top = obj.top ?? 0;
      const width = obj.width ?? DEFAULT_STICKY_WIDTH;
      const height = obj.height ?? DEFAULT_STICKY_HEIGHT;
      const color = obj.color || obj.fill || DEFAULT_STICKY_COLOR;

      context.shadowColor = 'rgba(0, 0, 0, 0.08)';
      context.shadowBlur = 8;
      context.shadowOffsetX = 2;
      context.shadowOffsetY = 4;

      context.beginPath();
      if (typeof context.roundRect === 'function') {
        context.roundRect(left, top, width, height, [obj.rx ?? 8]);
      } else {
        context.rect(left, top, width, height);
      }
      context.fillStyle = color;
      context.fill();

      context.shadowColor = 'transparent';
      context.strokeStyle = obj.stroke || '#E2E8F0';
      context.lineWidth = obj.strokeWidth || 1;
      context.stroke();

      if (obj.text) {
        const fontSize = obj.fontSize ?? 18;
        const fontFamily = obj.fontFamily ?? 'Inter, system-ui, sans-serif';
        context.font = `${fontSize}px ${fontFamily}`;
        context.fillStyle = obj.textColor || '#1E293B';
        context.textBaseline = 'top';

        const padding = 12;
        const maxLineWidth = width - padding * 2;
        const lineHeight = fontSize * 1.3;
        const words = (obj.text as string).split(' ');
        let curLine = '';
        let curY = top + padding;

        for (const word of words) {
          const testLine = curLine ? `${curLine} ${word}` : word;
          const metrics = context.measureText(testLine);
          if (metrics.width > maxLineWidth && curLine) {
            context.fillText(curLine, left + padding, curY);
            curLine = word;
            curY += lineHeight;
            if (curY + lineHeight > top + height - padding) break;
          } else {
            curLine = testLine;
          }
        }
        if (curLine && curY + lineHeight <= top + height - padding + lineHeight) {
          context.fillText(curLine, left + padding, curY);
        }
        context.restore();
      }
      break;
    }
    case 'formula': {
      const left = obj.left ?? 0;
      const top = obj.top ?? 0;
      const width = obj.width ?? 420;
      const height = obj.height ?? 120;
      const rx = obj.rx ?? 12;

      context.save();
      context.beginPath();
      if (typeof context.roundRect === 'function') {
        context.roundRect(left, top, width, height, [rx]);
      } else {
        context.rect(left, top, width, height);
      }
      context.fillStyle = 'rgba(28, 25, 23, 0.95)';
      context.fill();
      context.strokeStyle = 'rgba(180, 130, 60, 0.5)';
      context.lineWidth = 1.5;
      context.stroke();

      if (obj._imageElement && obj._imageElement.complete) {
        context.drawImage(obj._imageElement, left, top, width, height);
      } else if (obj.src && typeof Image !== 'undefined') {
        if (!obj._imageLoading) {
          obj._imageLoading = true;
          const img = new Image();
          img.onload = () => {
            obj._imageElement = img;
            obj._imageLoading = false;
          };
          img.src = obj.src;
        }
        context.font = 'italic 26px "Times New Roman", KaTeX_Main, serif';
        context.fillStyle = '#f5f3e6';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(obj.latex || 'f(x) = 0', left + width / 2, top + height / 2);
      } else {
        context.font = 'italic 26px "Times New Roman", KaTeX_Main, serif';
        context.fillStyle = '#f5f3e6';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(obj.latex || 'f(x) = 0', left + width / 2, top + height / 2);
      }
      context.restore();
      break;
    }
  }

  context.restore();
}
