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

  // Domain warp: lichte sinusoïde verstoring zodat de strepen niet
  // perfect rechtlijnig zijn maar 'ademen'.
  uv += vec2(
    sin(uv.y * 2.7 + t * 0.5) * uDistortion * 0.6,
    cos(uv.x * 2.3 + t * 0.4) * uDistortion * 0.6
  );

  // Polar swirl: per iteratie roteren we uv rond het centrum met een
  // hoek die schaalt met de afstand — geeft het 'getorste' effect. Loop
  // bound is constant zoals WebGL eist; uniforme iteratie-count breekt
  // 'm eerder.
  for (int i = 0; i < 12; i++) {
    if (float(i) >= uSwirlIterations) break;
    float r = length(uv);
    float angle = uSwirl * (1.0 - r) + t * 0.07;
    uv = rotate(uv, angle);
    uv += 0.05 * vec2(sin(uv.y * 3.0 + t * 0.3), cos(uv.x * 3.0 + t * 0.25)) * uDistortion;
  }

  // Field-waarde uit de getortste uv bepaalt het kleur-mengpunt.
  float field = uv.x * 0.5 + 0.5;

  // Stripes-shape: golf het veld zodat het kleur-patroon zich herhaalt
  // over de getortste uv — dat geeft de typische 'vortex met strepen'.
  if (uShape > 0.5) {
    float reps = mix(2.0, 18.0, clamp(uShapeScale, 0.0, 1.0));
    field = sin(field * reps * 3.14159265) * 0.5 + 0.5;
  }

  field = clamp(field, 0.0, 1.0);

  // Zachte overgang tussen drie kleuren via één smoothstep rond het
  // 'proportion' breekpunt; softness verbreedt de overgangs-zone.
  float p = clamp(uProportion, 0.05, 0.95);
  float s = mix(0.015, 0.5, uSoftness);
  float t1 = smoothstep(p - s, p + s, field);
  vec3 col = mix(uColor1, uColor3, t1);
  // Kleur2 als 'tussenkleur' rond het breekpunt (Gaussisch piekje)
  float band = exp(-pow((field - p) / max(s, 0.01), 2.0));
  col = mix(col, uColor2, band * 0.7);

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

// "Vortex"-preset uit Framer's AnimatedGradientBackground, omgezet naar
// barista-palette: maximale swirl, sharp softness, stripes-shape. Geeft
// een getorste lichtband over een diepblauwe achtergrond.
const DEFAULT_PARAMS: ShaderParams = {
  color1: [0.086, 0.133, 0.722], // barista-500 #1622b8 (was zwart)
  color2: [0.957, 0.965, 0.984], // paper #f4f6fb       (was wit)
  color3: [0.086, 0.133, 0.722], // barista-500 #1622b8 (was zwart)
  proportion: 0.41,
  softness: 0.05,
  distortion: 0,
  swirl: 1.0,
  swirlIterations: 3,
  scale: 0.4,
  rotation: (50 * Math.PI) / 180,
  speed: 0.45,
  shape: 1,
  shapeScale: 0.8,
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
