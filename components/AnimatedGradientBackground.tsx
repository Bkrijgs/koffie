"use client";

import { useEffect, useRef } from "react";

/**
 * Warp-style animated gradient background, geïnspireerd op Framer's
 * AnimatedGradientBackground (Prism-preset). Mengt drie barista-kleuren
 * via een polar-swirl met iteraties, lichte domain-warp en proportion-
 * gebaseerde kleur-overgang. Vanilla WebGL, geen dependencies.
 *
 * Animatie loopt continu zo lang het component gemount is; respecteert
 * prefers-reduced-motion door de tijd op 0 te bevriezen (één frame).
 */

const VERT_SRC = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FRAG_SRC = `
precision highp float;

varying vec2 vUv;
uniform float uTime;
uniform vec2  uResolution;

uniform vec3  uColor1;
uniform vec3  uColor2;
uniform vec3  uColor3;
uniform float uProportion;        // 0..1: mengverhouding tussen kleurpaar
uniform float uSoftness;          // 0..1: zachte vs harde overgangen
uniform float uDistortion;        // 0..1: domain-warp sterkte
uniform float uSwirl;             // 0..1: polar swirl sterkte
uniform float uSwirlIterations;   // aantal iteraties (max 12)
uniform float uScale;             // pattern-scale
uniform float uRotation;          // basis-rotatie (radialen)
uniform float uSpeed;             // animatie-snelheid multiplier
uniform float uShape;             // 0 = vlak veld, 1 = stripes
uniform float uShapeScale;        // 0..1: stripe-frequentie

vec2 rotate(vec2 v, float a) {
  float c = cos(a), s = sin(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

void main() {
  // Aspect-correct, gecentreerd
  vec2 uv = vUv - 0.5;
  uv.x *= uResolution.x / uResolution.y;
  uv = rotate(uv, uRotation);
  uv *= max(uScale, 0.001);

  float t = uTime * uSpeed;

  // Multi-octave warp: twee golven op verschillende frequentie + drift,
  // geeft de organische dichtheids-variatie waar de lijnen clusteren
  // en uitwaaieren. Altijd-aan (lichte basis), uDistortion versterkt.
  float warpAmt = 0.06 + uDistortion * 0.15;
  uv += warpAmt * vec2(
    sin(uv.y * 3.0 + t * 0.45) + 0.5 * sin(uv.y * 7.5 + t * 0.7),
    cos(uv.x * 3.4 + t * 0.35) + 0.5 * cos(uv.x * 8.0 + t * 0.55)
  );

  // Polar swirl met variabele iteratie-count (constant loop bound zoals
  // WebGL eist; uniform breekt 'm eerder).
  for (int i = 0; i < 12; i++) {
    if (float(i) >= uSwirlIterations) break;
    float r = length(uv);
    float angle = uSwirl * (1.0 - r) + t * 0.06;
    uv = rotate(uv, angle);
    uv += 0.04 * vec2(sin(uv.y * 3.0 + t * 0.3), cos(uv.x * 3.0 + t * 0.25));
  }

  // Sin-gemoduleerd veld geeft door de swirl heen curving rivers.
  float field = uv.x * 0.5 + 0.5;

  float reps = 2.0;
  if (uShape > 0.5) {
    reps = mix(2.0, 55.0, clamp(uShapeScale, 0.0, 1.0));
    field = sin(field * reps * 3.14159265) * 0.5 + 0.5;
  }
  field = clamp(field, 0.0, 1.0);

  // Donkere basis (color1 ↔ color3) met scherpe sprong op proportion.
  float p = clamp(uProportion, 0.05, 0.95);
  float t1 = step(p, field);
  vec3 col = mix(uColor1, uColor3, t1);

  // Smalle color2-rivers met messcherpe randen. Bandbreedte als
  // FRACTIE van de stripe-periode zodat ze bij hoge reps niet één
  // witte vlek worden.
  float period = 1.0 / max(reps, 1.0);
  float w = uSoftness * period * 0.45;
  if (w > 0.0001) {
    float band = step(p - w, field) - step(p + w, field);
    col = mix(col, uColor2, band);
  }

  gl_FragColor = vec4(col, 1.0);
}
`;

type ShaderParams = {
  color1: [number, number, number];
  color2: [number, number, number];
  color3: [number, number, number];
  proportion: number;
  softness: number;
  distortion: number;
  swirl: number;
  swirlIterations: number;
  scale: number;
  rotation: number;
  speed: number;
  shape: 0 | 1; // 0 = vlak, 1 = stripes
  shapeScale: number;
};

// Vortex (Framer-preset) vertaald: donkere basis met smalle 'white
// rivers' die door de polar swirl heen lopen — net als de screenshot.
// In app-kleuren: barista-500 als donker, paper als highlight.
const DEFAULT_PARAMS: ShaderParams = {
  color1: [0.086, 0.133, 0.722], // barista-500 #1622b8  (donkere basis)
  color2: [0.957, 0.965, 0.984], // paper #f4f6fb        (de witte rivers)
  color3: [0.086, 0.133, 0.722], // barista-500 #1622b8  (= color1)
  proportion: 0.5,
  softness: 0.55,                // fractie-van-periode → river breedte
  distortion: 0.3,               // multi-octave warp = organische clusters
  swirl: 1.0,
  swirlIterations: 5,            // meer iteraties = complexere rivieren
  scale: 0.45,
  rotation: (50 * Math.PI) / 180,
  speed: 0.45,
  shape: 1,
  shapeScale: 0.9,               // ~50 stripes; veel parallelle rivers
};

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function link(gl: WebGLRenderingContext, vs: WebGLShader, fs: WebGLShader) {
  const p = gl.createProgram();
  if (!p) return null;
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    gl.deleteProgram(p);
    return null;
  }
  return p;
}

export function AnimatedGradientBackground({
  params = DEFAULT_PARAMS,
}: {
  params?: Partial<ShaderParams>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef<ShaderParams>({ ...DEFAULT_PARAMS, ...params });
  paramsRef.current = { ...DEFAULT_PARAMS, ...params };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("webgl", {
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: false,
    });
    if (!ctx) return;
    const gl: WebGLRenderingContext = ctx;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT_SRC);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) return;
    const program = link(gl, vs, fs);
    if (!program) return;

    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const aPosition = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    const u = {
      time: gl.getUniformLocation(program, "uTime"),
      resolution: gl.getUniformLocation(program, "uResolution"),
      color1: gl.getUniformLocation(program, "uColor1"),
      color2: gl.getUniformLocation(program, "uColor2"),
      color3: gl.getUniformLocation(program, "uColor3"),
      proportion: gl.getUniformLocation(program, "uProportion"),
      softness: gl.getUniformLocation(program, "uSoftness"),
      distortion: gl.getUniformLocation(program, "uDistortion"),
      swirl: gl.getUniformLocation(program, "uSwirl"),
      swirlIterations: gl.getUniformLocation(program, "uSwirlIterations"),
      scale: gl.getUniformLocation(program, "uScale"),
      rotation: gl.getUniformLocation(program, "uRotation"),
      speed: gl.getUniformLocation(program, "uSpeed"),
      shape: gl.getUniformLocation(program, "uShape"),
      shapeScale: gl.getUniformLocation(program, "uShapeScale"),
    };

    function pushParams() {
      const p = paramsRef.current;
      gl.uniform3fv(u.color1, p.color1);
      gl.uniform3fv(u.color2, p.color2);
      gl.uniform3fv(u.color3, p.color3);
      gl.uniform1f(u.proportion, p.proportion);
      gl.uniform1f(u.softness, p.softness);
      gl.uniform1f(u.distortion, p.distortion);
      gl.uniform1f(u.swirl, p.swirl);
      gl.uniform1f(u.swirlIterations, p.swirlIterations);
      gl.uniform1f(u.scale, p.scale);
      gl.uniform1f(u.rotation, p.rotation);
      gl.uniform1f(u.speed, p.speed);
      gl.uniform1f(u.shape, p.shape);
      gl.uniform1f(u.shapeScale, p.shapeScale);
    }
    pushParams();

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    function resize() {
      if (!canvas) return;
      const w = Math.max(1, canvas.clientWidth);
      const h = Math.max(1, canvas.clientHeight);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(u.resolution, canvas.width, canvas.height);
    }
    resize();

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const onResize = () => resize();
    window.addEventListener("resize", onResize);

    const start = performance.now();
    let raf = 0;
    const render = (now: number) => {
      const t = (now - start) / 1000;
      pushParams();
      gl.uniform1f(u.time, reduced ? 0 : t);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (!reduced) raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    />
  );
}
