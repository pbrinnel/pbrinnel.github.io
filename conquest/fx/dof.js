import*as THREE from"three";import{Pass,FullScreenQuad}from"three/addons/postprocessing/Pass.js";const VERT="varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",COMMON=`
#include <packing>
uniform sampler2D tDepth;
uniform float cameraNear, cameraFar;
uniform mat4 uProjInv, uCamWorld;
uniform float uTilt, uFocusDist, uBandHalf, uAperture, uNearScale, uFarScale, uMaxNear, uMaxFar, uPxScale;
uniform vec3 uFocusPoint, uPlaneN;
// signed CoC in full-res pixels: + far (behind the focus), - near
float cocAt(vec2 uv, float depth) {
  float viewZ = perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
  float z = max(-viewZ, 1e-3);
  float d;
  if (uTilt > 0.5) {
    vec4 v = uProjInv * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    d = dot(uPlaneN, (uCamWorld * (v / v.w)).xyz - uFocusPoint);
  } else d = z - uFocusDist;
  float ad = max(abs(d) - uBandHalf, 0.0);
  float rel = ad / z;                                    // thin-lens like: blur ~ distance from focus / distance from camera
  return d >= 0.0 ? min(rel * uAperture * uFarScale * uPxScale, uMaxFar * uPxScale)
                  : -min(rel * uAperture * uNearScale * uPxScale, uMaxNear * uPxScale);
}
`,PREFILTER=`
uniform sampler2D tColor; uniform vec2 uRes; varying vec2 vUv;
${COMMON}
void main() {
  ivec2 h = ivec2(gl_FragCoord.xy), full = h * 2, mx = ivec2(uRes) - 1;
  vec3 col[4]; float coc[4]; float ref = 0.0;
  for (int i = 0; i < 4; i++) {
    ivec2 p = min(full + ivec2(i & 1, i >> 1), mx);
    col[i] = texelFetch(tColor, p, 0).rgb;
    coc[i] = cocAt((vec2(p) + 0.5) / uRes, texelFetch(tDepth, p, 0).r);
    if (abs(coc[i]) > abs(ref)) ref = coc[i];
  }
  vec3 sum = vec3(0.0); float ws = 0.0, cs = 0.0;
  for (int i = 0; i < 4; i++) {
    float w = exp(-abs(coc[i] - ref) * 0.6) / (1.0 + dot(col[i], vec3(0.3333)));
    sum += col[i] * w; ws += w; cs += coc[i] * w;
  }
  gl_FragColor = vec4(sum / ws, cs / ws);
}`,GATHER=`
uniform sampler2D tPre; uniform vec2 uHalf; uniform float uBokeh; uniform float uMaxFarH, uMaxNearH;
varying vec2 vUv;
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
vec2 vogel(int i, float phi) { float r = sqrt((float(i) + 0.5) / float(TAPS)); float t = float(i) * 2.3999632 + phi; return r * vec2(cos(t), sin(t)); }
float bokehW(vec3 c) { return 1.0 + uBokeh * smoothstep(0.75, 1.6, dot(c, vec3(0.2126, 0.7152, 0.0722))); }
void main() {
  vec4 c0 = texture2D(tPre, vUv);
  float phi = ign(gl_FragCoord.xy) * 6.2831853;
  #ifdef FAR
    float R = max(c0.a, 0.0) * 0.5;
    if (R < 0.3) { gl_FragColor = vec4(c0.rgb, 1.0); return; }
    vec3 acc = c0.rgb * (1.0 / (R * R + 0.5)) * bokehW(c0.rgb); float wsum = 1.0 / (R * R + 0.5) * bokehW(c0.rgb);
    for (int i = 0; i < TAPS; i++) {
      vec2 o = vogel(i, phi) * R;
      vec4 s = texture2D(tPre, vUv + o / uHalf);
      float cs = max(s.a, 0.0) * 0.5;
      if (s.a > c0.a) cs = min(cs, R);                          // taps behind the centre only reach as far as the centre's own blur
      float w = clamp(cs - length(o) + 0.5, 0.0, 1.0) / (cs * cs + 0.5) * bokehW(s.rgb);
      acc += s.rgb * w; wsum += w;
    }
    gl_FragColor = vec4(acc / wsum, 1.0);
  #else
    float Rn = uMaxNearH;
    vec3 acc = vec3(0.0); float wsum = 0.0, cov = 0.0;
    for (int i = 0; i < TAPS; i++) {
      vec2 o = vogel(i, phi) * Rn;
      vec4 s = texture2D(tPre, vUv + o / uHalf);
      float cn = max(-s.a, 0.0) * 0.5;
      if (cn < 0.6) continue;
      float k = clamp(cn - length(o) + 0.5, 0.0, 1.0) / (cn * cn);
      acc += s.rgb * k * bokehW(s.rgb); wsum += k * bokehW(s.rgb); cov += k;
    }
    float alpha = clamp(cov * Rn * Rn / float(TAPS), 0.0, 1.0);
    gl_FragColor = vec4(wsum > 1e-6 ? acc / wsum : c0.rgb, alpha);
  #endif
}`,COMPOSITE=`
uniform sampler2D tColor, tPre, tFar, tNear; uniform vec2 uRes, uHalf; uniform float uDebug, uNearOn;
varying vec2 vUv;
${COMMON}
vec3 debugColor(float c, vec3 img) {
  float mxF = uMaxFar * uPxScale, mxN = uMaxNear * uPxScale;
  vec3 m = c >= 0.0 ? mix(vec3(0.15, 0.85, 0.2), vec3(1.0, 0.15, 0.1), clamp(c / mxF, 0.0, 1.0))
                    : mix(vec3(0.15, 0.85, 0.2), vec3(0.1, 0.35, 1.0), clamp(-c / mxN, 0.0, 1.0));
  if (abs(c) < 0.35) m = vec3(0.2, 1.0, 0.3);
  return mix(img * 0.55, m, 0.55);
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 sc = texelFetch(tColor, p, 0);
  float coc = cocAt(vUv, texelFetch(tDepth, p, 0).r);
  vec3 col = sc.rgb;
  float farA = smoothstep(0.4, 1.6, max(coc, 0.0));
  if (farA > 0.0) {
    // joint-bilateral upsample of the half-res far layer: only half-res pixels with a similar CoC contribute
    vec2 hp = gl_FragCoord.xy * 0.5 - 0.5; ivec2 h0 = ivec2(floor(hp)); vec2 f = hp - vec2(h0);
    vec3 acc = vec3(0.0); float ws = 0.0;
    for (int i = 0; i < 4; i++) {
      ivec2 q = clamp(h0 + ivec2(i & 1, i >> 1), ivec2(0), ivec2(uHalf) - 1);
      float bw = ((i & 1) == 1 ? f.x : 1.0 - f.x) * ((i >> 1) == 1 ? f.y : 1.0 - f.y);
      float w = bw * (exp(-abs(texelFetch(tPre, q, 0).a - coc) * 0.5) + 1e-3);
      acc += texelFetch(tFar, q, 0).rgb * w; ws += w;
    }
    col = mix(col, acc / ws, farA);
  }
  if (uNearOn > 0.5) {
    vec4 n = texture2D(tNear, vUv);
    col = mix(col, n.rgb, smoothstep(0.015, 0.9, n.a));
  }
  if (uDebug > 0.5) col = debugColor(coc, col);
  gl_FragColor = vec4(col, 1.0);
}`,MASK=`uniform sampler2D tColor; varying vec2 vUv;
void main(){ float a = texture2D(tColor, vUv).a; gl_FragColor = vec4(vec3(abs(a - 0.5) < 0.06 ? 1.0 : 0.0), 1.0); }`;class SceneDofPass extends Pass{constructor(renderer,scene,camera){super(),this.renderer=renderer,this.scene=scene,this.camera=camera,this.needsSwap=!0,this.enabled=!0,this.dof=!1,this.sceneRT=null,this.preRT=null,this.farRT=null,this.nearRT=null,this.maskTarget=new THREE.WebGLRenderTarget(2,2,{type:THREE.UnsignedByteType,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:!1}),this.quad=new FullScreenQuad(null);const U=()=>({tColor:{value:null},tDepth:{value:null},tPre:{value:null},tFar:{value:null},tNear:{value:null},uRes:{value:new THREE.Vector2(2,2)},uHalf:{value:new THREE.Vector2(1,1)},cameraNear:{value:1},cameraFar:{value:1e3},uProjInv:{value:new THREE.Matrix4},uCamWorld:{value:new THREE.Matrix4},uTilt:{value:0},uFocusDist:{value:100},uBandHalf:{value:0},uAperture:{value:40},uNearScale:{value:.5},uFarScale:{value:1},uMaxNear:{value:10},uMaxFar:{value:26},uPxScale:{value:1},uFocusPoint:{value:new THREE.Vector3},uPlaneN:{value:new THREE.Vector3(0,1,0)},uBokeh:{value:1},uMaxFarH:{value:13},uMaxNearH:{value:5},uDebug:{value:0},uNearOn:{value:0}});this.U=U();const mk=(frag,defines)=>new THREE.ShaderMaterial({uniforms:this.U,vertexShader:VERT,fragmentShader:frag,depthTest:!1,depthWrite:!1,...defines?{defines}:{}});this.mPre=mk(PREFILTER),this.mFar=mk(GATHER,{FAR:1,TAPS:56}),this.mNear=mk(GATHER,{TAPS:36}),this.mComp=mk(COMPOSITE),this.mMask=mk(MASK),this.settings={debug:!1,nearOn:!1}}setSize(w,h){if(w=Math.max(2,Math.round(w)),h=Math.max(2,Math.round(h)),this.sceneRT&&this.sceneRT.width===w&&this.sceneRT.height===h)return;for(const t of[this.sceneRT,this.preRT,this.farRT,this.nearRT])t?.dispose();this.sceneRT=new THREE.WebGLRenderTarget(w,h,{type:THREE.HalfFloatType,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter}),this.sceneRT.depthTexture=new THREE.DepthTexture(w,h,THREE.UnsignedIntType);const hw=Math.ceil(w/2),hh=Math.ceil(h/2),half=()=>new THREE.WebGLRenderTarget(hw,hh,{type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:!1});this.preRT=half(),this.farRT=half(),this.nearRT=half(),this.maskTarget.setSize(w,h),this.U.uRes.value.set(w,h),this.U.uHalf.value.set(hw,hh)}render(renderer,writeBuffer){const U=this.U,cam=this.camera,prevTarget=renderer.getRenderTarget();renderer.setRenderTarget(this.sceneRT),renderer.clear(),renderer.render(this.scene,cam),U.tColor.value=this.sceneRT.texture,U.tDepth.value=this.sceneRT.depthTexture,U.cameraNear.value=cam.near,U.cameraFar.value=cam.far,U.uProjInv.value.copy(cam.projectionMatrixInverse),U.uCamWorld.value.copy(cam.matrixWorld),this.quad.material=this.mMask,renderer.setRenderTarget(this.maskTarget),this.quad.render(renderer),this.dof&&(this.quad.material=this.mPre,renderer.setRenderTarget(this.preRT),this.quad.render(renderer),U.tPre.value=this.preRT.texture,this.quad.material=this.mFar,renderer.setRenderTarget(this.farRT),this.quad.render(renderer),this.settings.nearOn&&(this.quad.material=this.mNear,renderer.setRenderTarget(this.nearRT),this.quad.render(renderer)),U.tFar.value=this.farRT.texture,U.tNear.value=this.nearRT.texture,U.uNearOn.value=this.settings.nearOn?1:0,U.uDebug.value=this.settings.debug?1:0),this.dof||(U.uAperture.value=0,U.uDebug.value=0,U.uNearOn.value=0),this.quad.material=this.mComp,renderer.setRenderTarget(this.renderToScreen?null:writeBuffer),this.quad.render(renderer),renderer.setRenderTarget(prevTarget)}dispose(){for(const t of[this.sceneRT,this.preRT,this.farRT,this.nearRT,this.maskTarget])t?.dispose();for(const m of[this.mPre,this.mFar,this.mNear,this.mComp,this.mMask])m.dispose();this.quad.dispose()}}function cocForPoint(p,camera,U){const v=p.clone().applyMatrix4(camera.matrixWorldInverse),z=Math.max(-v.z,.001),d=U.uTilt.value>.5?U.uPlaneN.value.dot(p.clone().sub(U.uFocusPoint.value)):z-U.uFocusDist.value,rel=Math.max(Math.abs(d)-U.uBandHalf.value,0)/z,px=U.uPxScale.value;return d>=0?Math.min(rel*U.uAperture.value*U.uFarScale.value*px,U.uMaxFar.value*px):-Math.min(rel*U.uAperture.value*U.uNearScale.value*px,U.uMaxNear.value*px)}export{SceneDofPass,cocForPoint};
