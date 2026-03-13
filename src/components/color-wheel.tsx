"use client";

import { clamp } from "@/src/lib/color";

interface ColorWheelProps {
  hue: number;
  saturation: number;
  lightness: number;
  disabled?: boolean;
  onChange: (next: { hue: number; saturation: number }) => void;
  onInteract?: () => void;
}

function pointToSelection(
  clientX: number,
  clientY: number,
  element: HTMLDivElement
) {
  const bounds = element.getBoundingClientRect();
  const centerX = bounds.left + bounds.width / 2;
  const centerY = bounds.top + bounds.height / 2;
  const dx = clientX - centerX;
  const dy = clientY - centerY;
  const radius = bounds.width / 2;
  const distance = Math.min(Math.sqrt(dx ** 2 + dy ** 2), radius);
  const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;

  return {
    hue: angle,
    saturation: clamp((distance / radius) * 100, 0, 100)
  };
}

export function ColorWheel({
  hue,
  saturation,
  lightness,
  disabled = false,
  onChange,
  onInteract
}: ColorWheelProps) {
  const knobRadius = saturation * 0.43;
  const hueRadians = (hue * Math.PI) / 180;

  return (
    <div className="space-y-3">
      <div
        className="relative aspect-square w-full max-w-[20rem] touch-none select-none rounded-full border border-white/70 bg-white/50 p-3 shadow-soft"
        aria-disabled={disabled}
      >
        <div
          className={`absolute inset-3 rounded-full border border-white/70 shadow-inner ${
            disabled ? "opacity-60" : ""
          }`}
          aria-label="Color wheel"
          aria-roledescription="color wheel"
          aria-valuetext={`Hue ${Math.round(hue)} degrees, saturation ${Math.round(
            saturation
          )} percent, lightness ${Math.round(lightness)} percent`}
          onKeyDown={(event) => {
            if (disabled) {
              return;
            }

            const hueStep = event.shiftKey ? 12 : 4;
            const saturationStep = event.shiftKey ? 10 : 3;

            if (event.key === "ArrowLeft") {
              event.preventDefault();
              onInteract?.();
              onChange({ hue: (hue - hueStep + 360) % 360, saturation });
            } else if (event.key === "ArrowRight") {
              event.preventDefault();
              onInteract?.();
              onChange({ hue: (hue + hueStep) % 360, saturation });
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              onInteract?.();
              onChange({ hue, saturation: clamp(saturation + saturationStep, 0, 100) });
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              onInteract?.();
              onChange({ hue, saturation: clamp(saturation - saturationStep, 0, 100) });
            }
          }}
          onPointerDown={(event) => {
            if (disabled) {
              return;
            }

            event.currentTarget.setPointerCapture(event.pointerId);
            onInteract?.();
            onChange(pointToSelection(event.clientX, event.clientY, event.currentTarget));
          }}
          onPointerMove={(event) => {
            if (disabled || !event.currentTarget.hasPointerCapture(event.pointerId)) {
              return;
            }

            onChange(pointToSelection(event.clientX, event.clientY, event.currentTarget));
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
          style={{
            background:
              "radial-gradient(circle at center, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.14) 46%, rgba(255,255,255,0) 64%), conic-gradient(from 0deg, #ff5562, #ffbf43, #9ed84d, #29d3a8, #3dbaf8, #7a72ff, #ff5fb4, #ff5562)"
          }}
          tabIndex={disabled ? -1 : 0}
        >
          <div
            className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-lg"
            style={{
              left: `calc(50% + ${Math.cos(hueRadians) * knobRadius}%)`,
              top: `calc(50% + ${Math.sin(hueRadians) * knobRadius}%)`,
              backgroundColor: `hsl(${Math.round(hue)} ${Math.round(saturation)}% ${Math.round(
                lightness
              )}%)`
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm text-slate-600">
        <div className="rounded-2xl bg-white/70 px-3 py-2 shadow-soft">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Hue</span>
          <p className="mt-1 font-semibold text-slate-900">{Math.round(hue)} deg</p>
        </div>
        <div className="rounded-2xl bg-white/70 px-3 py-2 shadow-soft">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Sat</span>
          <p className="mt-1 font-semibold text-slate-900">{Math.round(saturation)}%</p>
        </div>
        <div className="rounded-2xl bg-white/70 px-3 py-2 shadow-soft">
          <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Light</span>
          <p className="mt-1 font-semibold text-slate-900">{Math.round(lightness)}%</p>
        </div>
      </div>
    </div>
  );
}
