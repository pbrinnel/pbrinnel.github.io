import*as THREE from"three";function makeUniforms(mode){return{uPxMode:{value:mode},uTime:{value:0},uShimmer:{value:0},uClsTex:{value:null},uGridA:{value:new THREE.Vector4(0,0,100,0)},uGridB:{value:new THREE.Vector4(1,0,0,1)},uGridC:{value:new THREE.Vector2(1,1)},uRef:{value:new THREE.Color(1,1,1)},uMinGain:{value:0},uMaxGain:{value:1.15},uLightAmt:{value:1},uOutline:{value:0},uOutlineCol:{value:new THREE.Color(0)},uRim:{value:0},uRimDir:{value:new THREE.Vector2(.5,-.5)},uRimCol:{value:new THREE.Color(16777215)}}}const pixelUniforms={ds:makeUniforms(0),mod:makeUniforms(1)},GLSL_FUNCS=`
uniform float uPxMode;
uniform float uTime;
uniform float uShimmer;
uniform sampler2D uClsTex;
uniform vec4 uGridA;
uniform vec4 uGridB;
uniform vec2 uGridC;
uniform vec3 uRef;
uniform float uMinGain;
uniform float uMaxGain;
uniform float uLightAmt;
uniform float uOutline;
uniform vec3 uOutlineCol;
uniform float uRim;
uniform vec2 uRimDir;
uniform vec3 uRimCol;

float pxHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// Alpha-weighted bilinear of the four texels around tc, with fractional weights s (so transparent texels'
// hidden colour never bleeds into the edge of a sprite).
vec4 pxTaps(sampler2D tex, vec2 i, vec2 s, vec2 ts) {
  vec4 a = textureLod(tex, (i + vec2(0.5, 0.5)) / ts, 0.0);
  vec4 b = textureLod(tex, (i + vec2(1.5, 0.5)) / ts, 0.0);
  vec4 c = textureLod(tex, (i + vec2(0.5, 1.5)) / ts, 0.0);
  vec4 d = textureLod(tex, (i + vec2(1.5, 1.5)) / ts, 0.0);
  float wa = (1.0 - s.x) * (1.0 - s.y) * a.a, wb = s.x * (1.0 - s.y) * b.a;
  float wc = (1.0 - s.x) * s.y * c.a,         wd = s.x * s.y * d.a;
  float aw = wa + wb + wc + wd;
  vec3 rgb = (a.rgb * wa + b.rgb * wb + c.rgb * wc + d.rgb * wd) / max(aw, 1e-4);
  float alpha = (1.0 - s.x) * (1.0 - s.y) * a.a + s.x * (1.0 - s.y) * b.a + (1.0 - s.x) * s.y * c.a + s.x * s.y * d.a;
  return vec4(rgb, alpha);
}

// mode 0: nearest, 1: sharp-bilinear, 2: hardware. off = integer texel displacement (water wobble).
vec4 pxSampleR(sampler2D tex, vec2 uv, vec2 off, vec2 gx, vec2 gy, float ramp) {   // ramp: width of the blend ramp in screen pixels (max); gx/gy = dFdx/dFdy(uv), taken in uniform control flow
  vec2 ts = vec2(textureSize(tex, 0));
  vec2 tc = uv * ts;
  vec2 dx = gx * ts, dy = gy * ts;
  if (uPxMode > 1.5) return textureGrad(tex, uv + off / ts, gx, gy);
  vec2 fw = max(abs(dx) + abs(dy), vec2(1e-4));
  vec2 q = tc + off, i, s;
  if (uPxMode < 0.5) { i = floor(q) ; s = vec2(0.0); }   // nearest: the texel containing the sample point
  else {
    vec2 p = q - 0.5; i = floor(p);
    s = clamp((p - i - 0.5) / min(fw, vec2(ramp)) + 0.5, 0.0, 1.0);   // sharp-bilinear ramp, ramp screen pixels wide
  }
  vec4 sharp = pxTaps(tex, i, s, ts);
  float m = uPxMode < 0.5 ? 0.0 : smoothstep(0.8, 1.25, max(fw.x, fw.y));
  if (m > 0.0) {
    vec4 hw = textureGrad(tex, uv + off / ts, gx, gy);
    sharp = mix(sharp, hw, m);
  }
  return sharp;
}
vec4 pxSample(sampler2D tex, vec2 uv, vec2 off, vec2 gx, vec2 gy) { return pxSampleR(tex, uv, off, gx, gy, 1.0); }
`,TERRAIN_MAP_FRAG=`
#ifdef USE_MAP
  vec3 pxGlow = vec3(0.0);
  vec2 pgx = dFdx(vMapUv), pgy = dFdy(vMapUv);
  vec4 sampledDiffuseColor = pxSample(map, vMapUv, vec2(0.0), pgx, pgy);
#ifndef PX_NO_CLS
  if (uShimmer > 0.0 && vWNy > 0.6) {
    vec2 rel = vWPos.xz - uGridA.xy;
    vec2 cc = vec2(dot(rel, uGridB.xy), dot(rel, uGridB.zw)) / uGridA.z;
    if (cc.x >= 0.0 && cc.y >= 0.0 && cc.x < uGridC.x && cc.y < uGridC.y) {
      float cls = texture2D(uClsTex, (floor(cc) + 0.5) / uGridC).r * 255.0;
      vec2 wq = floor(vWPos.xz / (uGridA.z / 16.0));      // world "pixel" grid, 16 per cell
      float t = uTime;
      vec3 c0 = sampledDiffuseColor.rgb;
      if (cls > 0.5 && cls < 1.5) {
        // water: only texels that look like water move (a cell can also hold bank texels)
        float wet = step(c0.r + 0.03, c0.b);
        vec2 off = vec2(step(0.55, sin(wq.y * 0.55 + t * 1.3) * 0.5 + 0.5) * step(0.25, uShimmer), 0.0);   // 1 texel steps
        if (wet > 0.5 && off.x > 0.0) sampledDiffuseColor = pxSample(map, vMapUv, off, pgx, pgy);
        float band = sin((wq.x + wq.y) * 0.21 - t * 0.9);
        float h = pxHash(wq + floor(t * 3.0) * 7.13);
        float glint = step(0.965, h) * step(0.2, band * 0.5 + 0.5) * wet;
        pxGlow += vec3(0.85, 0.95, 1.0) * glint * uShimmer * 1.4;
      } else if (cls > 1.5) {
        // lava: the hot texels pulse in quantised steps and go HDR so bloom can pick them up; rock stays untouched
        float hot = smoothstep(0.25, 0.6, c0.r - c0.b) * smoothstep(0.3, 0.7, c0.r);
        float n = pxHash(floor(wq / 2.0));
        float pulse = floor((0.5 + 0.5 * sin(t * 1.6 + n * 6.2831)) * 4.0) / 4.0;
        pxGlow += c0 * hot * (0.15 + 0.85 * pulse) * uShimmer;
      }
    }
  }
#endif
  diffuseColor *= sampledDiffuseColor;
#endif
`,SPRITE_MAP_FRAG=`
#ifdef USE_MAP
  // material.opacity < 1 fades the unit with an ordered dither (pixel-art friendly: surviving pixels keep their exact colour)
  float pxFade = diffuseColor.a; diffuseColor.a = 1.0;
  // sprites: a very narrow ramp (0.15 px), so texels keep their exact source colour even when only ~1.5-3 screen pixels wide
  vec4 sampledDiffuseColor = pxSampleR(map, vMapUv, vec2(0.0), dFdx(vMapUv), dFdy(vMapUv), 0.15);
  if (uPxMode < 1.5) {   // the silhouette is the DS one: alpha always comes from the nearest texel (hard edge), so no edge pixel is ever dropped or added
    vec2 pxts = vec2(textureSize(map, 0));
    sampledDiffuseColor.a = textureLod(map, (floor(vMapUv * pxts) + 0.5) / pxts, 0.0).a;
  }
  if (uOutline > 0.0 || uRim > 0.0) {
    vec2 ts = vec2(textureSize(map, 0));
    vec2 tcen = (floor(vMapUv * ts) + 0.5) / ts;
    // neighbour alpha at one texel (nearest sampled, so the outline follows the pixel art grid)
    float nx1 = textureLod(map, tcen + vec2(1.0 / ts.x, 0.0), 0.0).a, nx0 = textureLod(map, tcen - vec2(1.0 / ts.x, 0.0), 0.0).a;
    float ny1 = textureLod(map, tcen + vec2(0.0, 1.0 / ts.y), 0.0).a, ny0 = textureLod(map, tcen - vec2(0.0, 1.0 / ts.y), 0.0).a;
    float self = textureLod(map, tcen, 0.0).a;
    float nb = max(max(nx1, nx0), max(ny1, ny0));
    if (uOutline > 0.0 && self < 0.5 && nb > 0.5) {
      sampledDiffuseColor = vec4(uOutlineCol, uOutline);
    }
    if (uRim > 0.0 && self > 0.5) {
      // rim: opaque texel next to a transparent one on the side facing the light (screen space dir from the sun)
      vec2 d = uRimDir;
      float opp = textureLod(map, tcen + vec2(d.x / ts.x, -d.y / ts.y), 0.0).a;
      float edge = step(opp, 0.5);
      sampledDiffuseColor.rgb += uRimCol * edge * uRim * 0.35;
    }
  }
  diffuseColor *= sampledDiffuseColor;
  if (pxFade < 0.999) {
    ivec2 bp = ivec2(mod(gl_FragCoord.xy, 4.0));
    const float BAYER[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
    if (pxFade * 16.0 <= BAYER[bp.y * 4 + bp.x] + 0.5) discard;
  }
#endif
`;function injectFuncs(shader,uniforms,fragMarker="#include <common>"){Object.assign(shader.uniforms,uniforms),shader.fragmentShader=shader.fragmentShader.replace(fragMarker,fragMarker+`
`+GLSL_FUNCS)}function patchTerrain(material,uniforms,{lit,cls=!0}){return material.onBeforeCompile=shader=>{injectFuncs(shader,uniforms),cls||(shader.fragmentShader=`#define PX_NO_CLS
`+shader.fragmentShader),shader.vertexShader=shader.vertexShader.replace("#include <common>",`#include <common>
varying vec3 vWPos;
varying float vWNy;`).replace("#include <project_vertex>",`#include <project_vertex>
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWNy = normalize(mat3(modelMatrix) * ${lit?"objectNormal":"normal"}).y;`),shader.fragmentShader=shader.fragmentShader.replace("#include <common>",`#include <common>
varying vec3 vWPos;
varying float vWNy;`).replace("#include <map_fragment>",TERRAIN_MAP_FRAG),lit?shader.fragmentShader=shader.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
  vec3 pxTexel = diffuseColor.rgb; diffuseColor.rgb = vec3(1.0);`).replace("#include <opaque_fragment>",`
          vec3 pxF = (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse) / max(uRef, vec3(1e-3));
          pxF = mix(vec3(1.0), clamp(pxF, vec3(uMinGain), vec3(uMaxGain)), uLightAmt);
          outgoingLight = pxTexel * pxF + pxGlow + totalEmissiveRadiance;
          #include <opaque_fragment>`):shader.fragmentShader=shader.fragmentShader.replace("#include <opaque_fragment>",`outgoingLight += pxGlow;
#include <opaque_fragment>`)},material.customProgramCacheKey=()=>"pxT2"+(lit?"L":"B")+(cls?"":"D"),material}function patchSprite(material,uniforms){return material.onBeforeCompile=shader=>{injectFuncs(shader,uniforms),shader.fragmentShader=shader.fragmentShader.replace("#include <map_fragment>",SPRITE_MAP_FRAG).replace("#include <fog_fragment>",`#include <fog_fragment>
  gl_FragColor.a = 0.5;`)},material.customProgramCacheKey=()=>"pxS6",material}function buildClassTexture(model,waterIds,lavaIds){const w=model.w,h=model.h,data=new Uint8Array(w*h);let water=0,lava=0;for(const c of model.cells){if(c.x<0||c.y<0||c.x>=w||c.y>=h)continue;const v=lavaIds.includes(c.terrain)?2:waterIds.includes(c.terrain)?1:0;data[c.y*w+c.x]=v,v===1?water++:v===2&&lava++}const tex=new THREE.DataTexture(data,w,h,THREE.RedFormat,THREE.UnsignedByteType);return tex.magFilter=tex.minFilter=THREE.NearestFilter,tex.needsUpdate=!0,{tex,water,lava}}function setGridUniforms(uniforms,model){uniforms.uGridA.value.set(model.origin.x,model.origin.z,model.S,0),uniforms.uGridB.value.set(model.xv.x,model.xv.z,model.yv.x,model.yv.z),uniforms.uGridC.value.set(model.w,model.h)}function prepareTexture(tex,{mips,aniso}){tex.colorSpace=THREE.SRGBColorSpace,tex.magFilter=THREE.LinearFilter,tex.generateMipmaps=mips,tex.minFilter=mips?THREE.LinearMipmapLinearFilter:THREE.LinearFilter,tex.anisotropy=aniso,tex.image&&(tex.needsUpdate=!0)}export{buildClassTexture,patchSprite,patchTerrain,pixelUniforms,prepareTexture,setGridUniforms};
