import*as THREE from"three";import{EffectComposer}from"three/addons/postprocessing/EffectComposer.js";import{Pass,FullScreenQuad}from"three/addons/postprocessing/Pass.js";import{ShaderPass}from"three/addons/postprocessing/ShaderPass.js";import{UnrealBloomPass}from"three/addons/postprocessing/UnrealBloomPass.js";import{OutputPass}from"three/addons/postprocessing/OutputPass.js";import{SMAAPass}from"three/addons/postprocessing/SMAAPass.js";import{SceneDofPass}from"./dof.js";const VERT="varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",GradeShader={uniforms:{tDiffuse:{value:null},aspect:{value:1},exposure:{value:1},vig:{value:0},vigSoft:{value:.6}},vertexShader:VERT,fragmentShader:`
    uniform sampler2D tDiffuse; uniform float exposure, aspect, vig, vigSoft; varying vec2 vUv;
    void main(){
      vec4 t = texture2D(tDiffuse, vUv); vec3 c = t.rgb * exposure;
      if (vig > 0.0) {
        vec2 q = (vUv - 0.5) * vec2(aspect, 1.0);
        c *= 1.0 - vig * smoothstep(0.35, 0.35 + 0.8 * vigSoft + 0.2, length(q) * 1.15);
      }
      gl_FragColor = vec4(c, t.a);
    }`},CasShader={uniforms:{tDiffuse:{value:null},tMask:{value:null},res:{value:new THREE.Vector2(1,1)},sharp:{value:.5}},vertexShader:VERT,fragmentShader:`
    uniform sampler2D tDiffuse, tMask; uniform vec2 res; uniform float sharp; varying vec2 vUv;
    void main(){
      ivec2 p = ivec2(gl_FragCoord.xy), mx = ivec2(res) - 1;
      vec3 e = texelFetch(tDiffuse, p, 0).rgb;
      if (texelFetch(tMask, p, 0).r > 0.5) { gl_FragColor = vec4(e, 1.0); return; }
      vec3 b = texelFetch(tDiffuse, clamp(p + ivec2(0, 1), ivec2(0), mx), 0).rgb, d = texelFetch(tDiffuse, clamp(p + ivec2(-1, 0), ivec2(0), mx), 0).rgb;
      vec3 f = texelFetch(tDiffuse, clamp(p + ivec2(1, 0), ivec2(0), mx), 0).rgb,  h = texelFetch(tDiffuse, clamp(p + ivec2(0, -1), ivec2(0), mx), 0).rgb;
      vec3 a = texelFetch(tDiffuse, clamp(p + ivec2(-1, 1), ivec2(0), mx), 0).rgb, c = texelFetch(tDiffuse, clamp(p + ivec2(1, 1), ivec2(0), mx), 0).rgb;
      vec3 g = texelFetch(tDiffuse, clamp(p + ivec2(-1, -1), ivec2(0), mx), 0).rgb, i = texelFetch(tDiffuse, clamp(p + ivec2(1, -1), ivec2(0), mx), 0).rgb;
      vec3 mn = min(min(min(d, e), min(f, b)), h), mn2 = min(min(min(a, c), min(g, i)), mn); mn += mn2;
      vec3 mxv = max(max(max(d, e), max(f, b)), h), mx2 = max(max(max(a, c), max(g, i)), mxv); mxv += mx2;
      vec3 amp = clamp(min(mn, 2.0 - mxv) / max(mxv, vec3(1e-4)), 0.0, 1.0);
      amp = sqrt(amp);
      float peak = -1.0 / mix(-8.0, -5.0, clamp(sharp, 0.0, 1.0));
      vec3 w = amp * peak;
      vec3 outc = ((b + d + f + h) * w + e) / (1.0 + 4.0 * w);
      gl_FragColor = vec4(clamp(outc, 0.0, 1.0), 1.0);
    }`},MergeShader={uniforms:{tAA:{value:null},tPre:{value:null},tMask:{value:null},res:{value:new THREE.Vector2(1,1)}},vertexShader:VERT,fragmentShader:`
    uniform sampler2D tAA, tPre, tMask; uniform vec2 res; varying vec2 vUv;
    void main(){
      ivec2 p = ivec2(gl_FragCoord.xy), mx = ivec2(res) - 1;
      float m = texelFetch(tMask, p, 0).r;      // sprite pixels keep their exact value; pixels around the silhouette still get SMAA
      gl_FragColor = vec4(m > 0.5 ? texelFetch(tPre, p, 0).rgb : texelFetch(tAA, p, 0).rgb, 1.0);
    }`},CopyShader={uniforms:{tDiffuse:{value:null}},vertexShader:VERT,fragmentShader:"uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tDiffuse, vUv); }"};class SilhouetteSMAAPass extends Pass{constructor(w,h,getMask){super(),this.needsSwap=!1,this.getMask=getMask,this.smaa=new SMAAPass(w,h),this.pre=new THREE.WebGLRenderTarget(w,h,{type:THREE.HalfFloatType,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:!1}),this.copy=new ShaderPass(CopyShader),this.merge=new ShaderPass(MergeShader),this.mergeMat=this.merge.material,this.quad=new FullScreenQuad(null),this.copyMat=new THREE.ShaderMaterial({uniforms:THREE.UniformsUtils.clone(CopyShader.uniforms),vertexShader:CopyShader.vertexShader,fragmentShader:CopyShader.fragmentShader}),this.mergeMat2=new THREE.ShaderMaterial({uniforms:THREE.UniformsUtils.clone(MergeShader.uniforms),vertexShader:MergeShader.vertexShader,fragmentShader:MergeShader.fragmentShader})}setSize(w,h){this.smaa.setSize(w,h),this.pre.setSize(w,h),this.mergeMat2.uniforms.res.value.set(w,h)}render(renderer,writeBuffer,readBuffer){this.quad.material=this.copyMat,this.copyMat.uniforms.tDiffuse.value=readBuffer.texture,renderer.setRenderTarget(this.pre),this.quad.render(renderer),this.smaa.render(renderer,writeBuffer,readBuffer);const u=this.mergeMat2.uniforms;u.tAA.value=writeBuffer.texture,u.tPre.value=this.pre.texture,u.tMask.value=this.getMask().texture,this.quad.material=this.mergeMat2,renderer.setRenderTarget(readBuffer),this.quad.render(renderer)}}const SplitShader={uniforms:{tDiffuse:{value:null},tDS:{value:null},split:{value:-1},res:{value:new THREE.Vector2(1,1)},line:{value:1}},vertexShader:VERT,fragmentShader:`
    uniform sampler2D tDiffuse, tDS; uniform float split, line; uniform vec2 res; varying vec2 vUv;
    vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(max(c, 0.0), vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
    void main(){
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      if (split >= 0.0) {
        if (vUv.x < split) col = toSRGB(texture2D(tDS, vUv).rgb);      // DS pass is linear, modern side is already sRGB
        float d = abs(vUv.x * res.x - split * res.x);
        if (line > 0.5 && d < 1.0) col = mix(col, vec3(1.0), 0.85);
      }
      gl_FragColor = vec4(col, 1.0);
    }`};class PostStack{constructor(renderer,scene,camera){this.renderer=renderer,this.scene=scene,this.camera=camera,this.w=2,this.h=2,this.pr=1,this.splitU=null}build(){this.dispose();const rt=new THREE.WebGLRenderTarget(this.w*this.pr,this.h*this.pr,{type:THREE.HalfFloatType}),c=this.composer=new EffectComposer(this.renderer,rt);c.setPixelRatio(this.pr),c.setSize(this.w,this.h);const W=this.w*this.pr,H=this.h*this.pr;this.scenePass=new SceneDofPass(this.renderer,this.scene,this.camera),this.bloom=new UnrealBloomPass(new THREE.Vector2(W,H),.25,.5,1.1),this.grade=new ShaderPass(GradeShader),this.output=new OutputPass,this.smaa=new SilhouetteSMAAPass(W,H,()=>this.scenePass.maskTarget),this.cas=new ShaderPass(CasShader),this.casU=this.cas.uniforms,this.casU.tMask.value=this.scenePass.maskTarget.texture,this.split=new ShaderPass(SplitShader),this.splitU=this.split.uniforms;for(const p of[this.scenePass,this.bloom,this.grade,this.output,this.smaa,this.cas,this.split])c.addPass(p)}setSize(w,h,pr){this.w=w,this.h=h,this.pr=pr,this.composer&&(this.composer.setPixelRatio(pr),this.composer.setSize(w,h),this.splitU.res.value.set(w*pr,h*pr),this.casU.res.value.set(w*pr,h*pr),this.grade.uniforms.aspect.value=w/h)}apply(s){const p=s.post,d=s.dof;this.smaa.enabled=s.pixel.aa==="smaa",this.bloom.enabled=p.bloom,this.bloom.strength=p.bloomStrength,this.bloom.radius=p.bloomRadius,this.bloom.threshold=p.bloomThreshold,this.cas.enabled=p.cas,this.casU.sharp.value=p.casStrength,this.scenePass.dof=d.enabled,this.scenePass.settings.debug=d.enabled&&d.debug,this.scenePass.settings.nearOn=d.enabled&&d.nearScale>0,this.scenePass.U.uBokeh.value=d.bokeh;const g=this.grade.uniforms;g.exposure.value=s.tone.exposure,g.vig.value=p.vignette?p.vigStrength:0,g.vigSoft.value=p.vigSoft,this.renderer.toneMapping=THREE.NoToneMapping}dispose(){this.composer?.dispose(),this.scenePass?.dispose(),this.composer=null}}export{PostStack};
