import { afterEach, expect, it, vi } from 'vitest';
import { PerspectiveCamera, Scene } from 'three';
import type { WebGLRenderer } from 'three';
import { createGenealogyStars } from './genealogy-stars';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function setup(reduced = false) {
  const media = { matches: reduced, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', () => media);
  const stars = createGenealogyStars();
  const scene = new Scene(); scene.add(stars.points);
  const renderer = { getSize: (v: { set(x: number, y: number): void }) => v.set(1200, 600), getPixelRatio: () => 3 } as unknown as WebGLRenderer;
  const frame = () => stars.points.onBeforeRender(renderer, scene, new PerspectiveCamera(), stars.points.geometry, stars.points.material, null as never);
  return { stars, media, scene, frame };
}

it('keeps decorative stars out of picking and releases GPU resources and listeners', () => {
  const { stars, scene, media } = setup();
  expect(stars.points.geometry.attributes.position.count).toBe(46000);
  const hits: never[] = [];
  stars.points.raycast(null as never, hits);
  expect(hits).toHaveLength(0);
  const geometry = vi.spyOn(stars.points.geometry, 'dispose');
  const material = vi.spyOn(stars.points.material, 'dispose');
  const nebula = stars.points.children[0] as import('three').Mesh;
  const nebulaGeometry = vi.spyOn(nebula.geometry, 'dispose');
  const nebulaMaterial = vi.spyOn(nebula.material as import('three').ShaderMaterial, 'dispose');
  stars.dispose();
  expect(scene.children).toHaveLength(0);
  expect(geometry).toHaveBeenCalledOnce(); expect(material).toHaveBeenCalledOnce();
  expect(nebulaGeometry).toHaveBeenCalledOnce(); expect(nebulaMaterial).toHaveBeenCalledOnce();
  expect(media.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
});

it('smooths pointer movement and prevents a time jump after resuming a hidden view', () => {
  const { stars, frame } = setup();
  const time = vi.spyOn(performance, 'now').mockReturnValue(100);
  frame(); stars.move(1, -1);
  time.mockReturnValue(60100); frame();
  const u = stars.points.material.uniforms;
  expect(u.uTime.value).toBe(.05);
  expect(u.uAspect.value).toBe(2); expect(u.uDpr.value).toBe(2);
  expect(u.uPointer.value.x).toBeGreaterThan(0); expect(u.uPointer.value.x).toBeLessThan(.2);
  stars.dispose();
});

it('respects initial and live reduced-motion preferences', () => {
  const { stars, media, frame } = setup(true);
  const time = vi.spyOn(performance, 'now').mockReturnValue(100);
  frame(); stars.move(1, 1); time.mockReturnValue(200); frame();
  expect(stars.points.material.uniforms.uTime.value).toBe(0);
  stars.burst(.2, .3);
  expect(stars.points.material.uniforms.uPulseAge.value).toBe(10);
  expect(stars.points.material.uniforms.uMotion.value).toBe(0);
  expect(stars.points.material.uniforms.uPointer.value.length()).toBe(0);
  media.matches = false; media.addEventListener.mock.calls[0][1]();
  time.mockReturnValue(250); frame();
  expect(stars.points.material.uniforms.uTime.value).toBeGreaterThan(0);
  stars.dispose();
});

it('starts selection ripples at the clicked node and lets them expire', () => {
  const { stars, frame } = setup();
  const time = vi.spyOn(performance, 'now').mockReturnValue(100);
  frame(); stars.burst(.3, -.4);
  const u = stars.points.material.uniforms;
  expect(u.uPulse.value.toArray()).toEqual([.3, -.4]);
  expect(u.uPulseAge.value).toBe(0);
  for (let i = 1; i <= 240; i++) { time.mockReturnValue(100 + i * 50); frame(); }
  expect(u.uPulseAge.value).toBe(10);
  stars.dispose();
});
