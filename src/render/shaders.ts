// GLSL compartido: color del cielo (lo usan cielo, nubes y niebla para que todo funda igual) y ruido.

export const SKY_GLSL = /* glsl */ `
vec3 skyGrad(vec3 d, vec3 sun){
  float h = max(d.y, 0.0);
  float az = dot(normalize(d.xz + vec2(1e-5)), normalize(sun.xz)) * 0.5 + 0.5;
  vec3 zen = vec3(0.045, 0.13, 0.46);
  vec3 mid = mix(vec3(0.15, 0.21, 0.55), vec3(0.66, 0.27, 0.42), az);
  vec3 hor = mix(vec3(0.50, 0.36, 0.50), vec3(1.15, 0.50, 0.16), az * az * az);
  vec3 c = mix(hor, mid, smoothstep(0.0, 0.20, h));
  return mix(c, zen, smoothstep(0.07, 0.44, h));
}
vec3 skyBase(vec3 d, vec3 sun){
  vec3 c = skyGrad(d, sun);
  float sd = max(dot(d, sun), 0.0);
  c += vec3(1.3, 0.55, 0.16) * pow(sd, 16.0) * 0.34;
  c += vec3(2.0, 1.2, 0.5) * pow(sd, 200.0) * 0.5;
  return c;
}
vec3 hazeColor(vec3 dir, vec3 sun){
  vec3 n = normalize(dir);
  float az = dot(normalize(n.xz + vec2(1e-5)), normalize(sun.xz)) * 0.5 + 0.5;
  vec3 c = mix(vec3(0.24, 0.23, 0.44), vec3(0.70, 0.34, 0.26), pow(az, 4.0));
  return c + vec3(1.2, 0.5, 0.15) * pow(max(dot(n, sun), 0.0), 14.0) * 0.30;
}
`;

export const NOISE_GLSL = /* glsl */ `
float hash1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 hash2(vec2 p){
  return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash1(i), hash1(i + vec2(1, 0)), f.x),
             mix(hash1(i + vec2(0, 1)), hash1(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p){
  float a = 0.5, s = 0.0;
  for(int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + 17.3; a *= 0.5; }
  return s;
}
float cell(vec2 p){
  vec2 i = floor(p), f = fract(p);
  float m = 1.0;
  for(int y = -1; y <= 1; y++) for(int x = -1; x <= 1; x++){
    vec2 g = vec2(float(x), float(y));
    m = min(m, length(g + hash2(i + g) - f));
  }
  return m;
}
`;
