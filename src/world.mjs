import {
  WebGLRenderer,
  Scene,
  OrthographicCamera,
  PlaneGeometry,
  ShaderMaterial,
  Mesh,
  TextureLoader,
  Vector2,
  SRGBColorSpace,
} from "three";

const vertexShader = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const fragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uFrom;
  uniform sampler2D uTo;
  uniform sampler2D uSketch;
  uniform float uMix;
  uniform float uPaint;
  uniform float uIsDragon;
  uniform float uProgress;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  float fbm(vec2 p) { return noise(p)*.57 + noise(p*2.03)*.28 + noise(p*4.01)*.15; }
  vec2 cover(vec2 uv) {
    float screenAspect = uResolution.x/uResolution.y;
    float imageAspect = 16./9.;
    vec2 ratio = vec2(min(screenAspect/imageAspect,1.),min(imageAspect/screenAspect,1.));
    return (uv-.5)*ratio+.5;
  }
  void main() {
    vec2 uv = vUv;
    float envelope = sin(uMix*3.14159265);
    float grain = fbm(uv*7. + vec2(uTime*.025, -uTime*.018));
    vec2 centered = uv-.5;
    // A shallow spatial camera drift lends the still artwork depth, while the
    // stronger refractive fold only happens between chapters.
    vec2 drift = uPointer * .014 * vec2(1., .65);
    float depth = .4 + .6*smoothstep(0.,1.,uv.x);
    vec2 bend = vec2(sin(uv.y*6. + uMix*6.28), cos(uv.x*5. - uMix*6.28));
    bend *= envelope * (.035 + grain*.075);
    float zoomA = 1.035 + .025*sin(uProgress*6.28);
    float zoomB = 1.11 - uMix*.075;
    vec2 uvA = cover(centered/zoomA+.5 + drift*depth + bend);
    vec2 uvB = cover(centered/zoomB+.5 + drift*depth - bend*.65);
    vec4 fromColor = texture2D(uFrom, uvA);
    if (uIsDragon > .5) {
      vec4 sketch = texture2D(uSketch, uvA);
      float paintField = uv.x*.76 + uv.y*.09 + fbm(uv*12.)*.15;
      float paint = smoothstep(paintField-.07, paintField+.07, uPaint*1.2-.1);
      fromColor = mix(sketch, fromColor, paint);
    }
    vec4 toColor = texture2D(uTo, uvB);
    float field = uv.x*.8 + grain*.2;
    float reveal = smoothstep(field-.11,field+.11,uMix*1.3-.15);
    vec4 color = mix(fromColor,toColor,reveal);
    // A narrow refractive edge passes through real source imagery, not a
    // decorative overlay. At rest, the source colours are unchanged.
    float edge = pow(1.-abs(reveal*2.-1.),6.)*envelope;
    color.rgb += edge*.035;
    gl_FragColor = color;
    #include <colorspace_fragment>
  }
`;

export async function createWorld(host, onLost) {
  const renderer = new WebGLRenderer({
    alpha: false,
    antialias: false,
    powerPreference: "low-power",
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  let disposed = false;
  let active = false;
  let frame = 0;
  let lastTime = 0;
  let elapsed = 0;
  const pointer = new Vector2();
  const targetPointer = new Vector2();
  let textures = [];
  let geometry;
  let material;
  try {
    const loader = new TextureLoader();
    const results = await Promise.allSettled(
      ["dragon.webp", "loaf.webp", "dragon-sketch.webp"].map((file) =>
        loader.loadAsync(`/assets/home/${file}`),
      ),
    );
    textures = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
    const failure = results.find((result) => result.status === "rejected");
    if (failure) throw failure.reason;
    // Image pixels are sRGB; Three.js converts sampled textures into linear
    // working space and the output chunk restores their display appearance.
    textures.forEach((texture) => {
      texture.colorSpace = SRGBColorSpace;
    });
    const scene = new Scene();
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 2);
    camera.position.z = 1;
    geometry = new PlaneGeometry(2, 2);
    material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uFrom: { value: textures[0] },
        uTo: { value: textures[0] },
        uSketch: { value: textures[2] },
        uMix: { value: 0 },
        uPaint: { value: 1 },
        uIsDragon: { value: 1 },
        uProgress: { value: 0 },
        uTime: { value: 0 },
        uPointer: { value: pointer },
        uResolution: { value: new Vector2(1, 1) },
      },
    });
    scene.add(new Mesh(geometry, material));
    host.append(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");
    let renderFailed = false;
    const draw = () => {
      if (disposed || renderFailed) return;
      renderer.render(scene, camera);
    };
    const resize = () => {
      const { width, height } = host.parentElement.getBoundingClientRect();
      renderer.setSize(width, height, false);
      material.uniforms.uResolution.value.set(width, height);
      draw();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host.parentElement);
    const move = (event) => {
      if (event.pointerType === "touch") return;
      const rect = host.parentElement.getBoundingClientRect();
      targetPointer.set(
        (event.clientX - rect.left) / rect.width - 0.5,
        0.5 - (event.clientY - rect.top) / rect.height,
      );
    };
    const leave = () => targetPointer.set(0, 0);
    host.parentElement.addEventListener("pointermove", move, { passive: true });
    host.parentElement.addEventListener("pointerleave", leave);
    const loop = (time) => {
      frame = 0;
      if (!active || disposed || renderFailed) return;
      elapsed += Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      pointer.lerp(targetPointer, 0.065);
      material.uniforms.uTime.value = elapsed;
      draw();
      frame = requestAnimationFrame(loop);
    };
    const lost = (event) => {
      event.preventDefault();
      renderFailed = true;
      active = false;
      cancelAnimationFrame(frame);
      onLost();
    };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    resize();
    return {
      setState({ from, to, mix, paint, progress }) {
        if (disposed || renderFailed) return;
        material.uniforms.uFrom.value = textures[from];
        material.uniforms.uTo.value = textures[to];
        material.uniforms.uMix.value = mix;
        material.uniforms.uPaint.value = paint;
        material.uniforms.uIsDragon.value = from === 0 ? 1 : 0;
        material.uniforms.uProgress.value = progress;
        if (!active) draw();
      },
      setActive(value) {
        active = value && !disposed && !renderFailed && !document.hidden;
        if (active && !frame) {
          lastTime = performance.now();
          frame = requestAnimationFrame(loop);
        } else if (!active) {
          cancelAnimationFrame(frame);
          frame = 0;
        }
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        active = false;
        cancelAnimationFrame(frame);
        observer.disconnect();
        host.parentElement.removeEventListener("pointermove", move);
        host.parentElement.removeEventListener("pointerleave", leave);
        renderer.domElement.removeEventListener("webglcontextlost", lost);
        geometry.dispose();
        material.dispose();
        textures.forEach((texture) => texture.dispose());
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
      },
    };
  } catch (error) {
    geometry?.dispose();
    material?.dispose();
    textures.forEach((texture) => texture.dispose());
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
    throw error;
  }
}
