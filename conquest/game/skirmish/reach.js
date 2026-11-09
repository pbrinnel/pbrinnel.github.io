import*as THREE from"three";import{markOverlay,groundUniforms}from"../../fx/look.js";const srgb=(r,g,b)=>new THREE.Color().setRGB(r/255,g/255,b/255,THREE.SRGBColorSpace),REACH={edge:srgb(110,235,225),outline:!1,fadeSmooth:!1,fadeFrames:6};let DATA=null;const loadReachData=root=>fetch(root+"reach.json").then(r=>r.ok?r.json():null).then(j=>(DATA=j,j)).catch(()=>null),reachReady=()=>!!DATA,VERT=`
  attribute float aY;
  varying vec2 vW; varying float vY;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xz; vY = aY;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`,FRAG=`
  uniform float uRows[16]; uniform vec3 uCol[4];
  uniform vec2 uYv; uniform vec2 uOrigin; uniform float uS; uniform float uSl; uniform float uAlpha; uniform float uBase;
  varying vec2 vW; varying float vY;
  void main() {
    float cy = dot(vW - uOrigin, uYv) / uS;
    float u = clamp(vY + 1.0 - cy, 0.0, 1.0);
    float a = 8192.0 * (60.0 - 2.0 * uSl) / 60.0; a = sign(a) * floor(abs(a));      // integer lerp truncates toward zero
    float us = (8192.0 - a) / 16384.0;
    float e = 240.0 + floor(16.0 * uSl / 60.0);
    float v = u < us ? e - (e - 240.0) * u / max(us, 1e-6) : 256.0 - (256.0 - e) * (u - us) / max(1.0 - us, 1e-6);
    int r = int(clamp(floor(v) - 240.0, 0.0, 15.0));
    gl_FragColor = vec4(uCol[int(uRows[r])], uBase * uAlpha);
    #include <colorspace_fragment>
    #include <dithering_fragment>
  }`,EDGE_FRAG=`
  uniform vec3 uEdge; uniform float uAlpha; uniform float uBase;
  varying vec2 vW; varying float vY;
  void main() {
    gl_FragColor = vec4(uEdge, uBase * uAlpha);
    #include <colorspace_fragment>
    #include <dithering_fragment>
  }`;class ReachMark{constructor(stage,cells,kind=0){if(this.stage=stage,this.age=null,this.ok=!!DATA,!DATA){console.warn("reach.json missing: run tools/build_viewer_data.py"),this.meshes=[];return}const kd=DATA.kinds[kind],m=stage.model,S=m.S,key=new Set(cells.map(c=>c.x+","+c.y)),pos=[],idx=[],ay=[],epos=[],eidx=[],quad=(P,I,Y,y,a,b,c,d)=>{const o=P.length/3;for(const p of[a,b,c,d])P.push(p.x,p.y,p.z),Y.push(y);I.push(o,o+1,o+2,o,o+2,o+3)},eY=[];for(const c of cells){const cell=m.cell(c.x,c.y);if(!cell)continue;const cs=m.corners(cell,S*DATA.lift/DATA.cell);if(quad(pos,idx,ay,c.y,cs[0],cs[1],cs[2],cs[3]),!REACH.outline)continue;[[0,-1,0,1],[1,0,1,2],[0,1,2,3],[-1,0,3,0]].forEach(([dx,dy,i,j])=>{if(key.has(c.x+dx+","+(c.y+dy)))return;const a=cs[i],b=cs[j],ctr=m.center(c.x,c.y,S*.075),inA=a.clone().lerp(ctr,.09).setY(a.y+S*.005),inB=b.clone().lerp(ctr,.09).setY(b.y+S*.005);quad(epos,eidx,eY,0,a.clone().setY(a.y+S*.005),b.clone().setY(b.y+S*.005),inB,inA)})}const col=new Array(4).fill(0).map((_,i)=>{const c=kd.colors[i];return srgb(c[0],c[1],c[2])}),rows=kd.rows.slice(0,16),mk=(P,I,Y,frag,base)=>{const g=new THREE.BufferGeometry;g.setAttribute("position",new THREE.Float32BufferAttribute(P,3)),g.setAttribute("aY",new THREE.Float32BufferAttribute(Y,1)),g.setIndex(I);const mat=new THREE.ShaderMaterial({vertexShader:VERT,fragmentShader:frag,transparent:!0,depthWrite:!1,depthTest:!0,side:THREE.DoubleSide,polygonOffset:!0,polygonOffsetFactor:-2,polygonOffsetUnits:-2,uniforms:{uRows:{value:rows},uCol:{value:col},uEdge:{value:REACH.edge},uYv:{value:new THREE.Vector2(m.yv.x,m.yv.z).normalize()},uOrigin:{value:new THREE.Vector2(m.origin.x,m.origin.z)},uS:{value:S},uSl:{value:0},uAlpha:{value:1},uBase:{value:base}}}),mesh=new THREE.Mesh(g,mat);return mesh.frustumCulled=!1,mesh.renderOrder=8,markOverlay(mesh),stage.fxGroup.add(mesh),mesh};this.alpha=DATA.alpha/DATA.alpha_max,this.fill=mk(pos,idx,ay,FRAG,this.alpha),this.edge=epos.length?mk(epos,eidx,eY,EDGE_FRAG,1):null,this.edge&&(this.edge.renderOrder=this.fill.renderOrder+.01)}get meshes(){return this.ok?this.edge?[this.fill,this.edge]:[this.fill]:[]}update(now,dir,dt60){if(this.age!==null&&(this.age+=dt60,this.age>=REACH.fadeFrames))return!1;const a=this.age===null||!REACH.fadeSmooth?1:1-this.age/REACH.fadeFrames,sl=Math.floor(now/1e3*60)%DATA.cycle,ga=groundUniforms.uGroundAlpha.value,comp=ga>0?1/Math.max(.05,ga):1;for(const m of this.meshes){const u=m.material.uniforms;u.uBase.value=Math.min(4,(m===this.fill?this.alpha:1)*comp),u.uSl.value=sl,u.uAlpha.value=a}return!0}fade(){this.age===null&&(this.age=0)}dispose(){for(const m of this.meshes)this.stage.fxGroup.remove(m),m.geometry.dispose(),m.material.dispose()}}export{REACH,ReachMark,loadReachData,reachReady};
