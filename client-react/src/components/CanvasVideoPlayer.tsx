import { useEffect, useRef } from 'react';
import { useSharedVideo } from './SharedVideoProvider';

interface Bounds {
  X: number;
  Y: number;
  Width: number;
  Height: number;
}

interface Props {
  bounds?: Bounds | null;
  onClick: () => void;
}

export default function CanvasVideoPlayer({ bounds, onClick }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { videoElement } = useSharedVideo();
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !videoElement) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    const draw = () => {
      if (!running) return;

      const vw = videoElement.videoWidth;
      const vh = videoElement.videoHeight;

      if (vw && vh) {
        const sx = bounds ? Math.round(bounds.X * vw) : 0;
        const sy = bounds ? Math.round(bounds.Y * vh) : 0;
        const sw = bounds ? Math.round(bounds.Width * vw) : vw;
        const sh = bounds ? Math.round(bounds.Height * vh) : vh;

        if (canvas.width !== sw || canvas.height !== sh) {
          canvas.width = sw;
          canvas.height = sh;
        }

        ctx.drawImage(videoElement, sx, sy, sw, sh, 0, 0, sw, sh);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [videoElement, bounds]);

  return (
    <canvas
      ref={canvasRef}
      onClick={onClick}
      className="w-full h-full object-contain cursor-pointer"
    />
  );
}
