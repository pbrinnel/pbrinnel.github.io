import*as THREE from"three";const spriteDepth={flat:!0,bias:38,silhouette:!0,silhouetteOpacity:.7,silhouetteDither:!0,silhouetteGrey:.22,silhouetteTeam:!1,silhouetteScale:6,silhouetteWidth:.3},depthUniforms={uFlatDepth:{value:1},uFlatBias:{value:38}},silUniforms={uSilGrey:{value:.22},uSilTeam:{value:0},uSilDither:{value:1},uSilScale:{value:6},uSilWidth:{value:.3}},silhouettes=new Set,FLAT_VERT=`
  {
    vec3 fdO = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;          // the anchor: sprite position / quad pivot
    vec4 fdA = projectionMatrix * viewMatrix * vec4(fdO + uFlatBias * uFlatMul * normalize(cameraPosition - fdO), 1.0);
    gl_Position.z = mix(gl_Position.z, fdA.z / fdA.w * gl_Position.w, uFlatDepth);
  }
  #include <logdepthbuf_vertex>`;function patchFlatDepth(material,mul=1){if(material.userData.flatDepth)return material;const flatMul=typeof mul=="object"?mul:{value:mul};material.userData.flatMul=flatMul;const prev=material.onBeforeCompile,prevKey=material.customProgramCacheKey?.bind(material);return material.onBeforeCompile=(shader,renderer)=>{prev&&prev.call(material,shader,renderer),Object.assign(shader.uniforms,depthUniforms),shader.uniforms.uFlatMul=flatMul,shader.vertexShader=`uniform float uFlatDepth;
uniform float uFlatBias;
uniform float uFlatMul;
`+shader.vertexShader.replace("#include <logdepthbuf_vertex>",FLAT_VERT)},material.customProgramCacheKey=()=>(prevKey?prevKey():"")+"|fd2",material.userData.flatDepth=!0,material}const SIL_FRAG=`
  #include <map_fragment>
  if (sampledDiffuseColor.a < 0.5) discard;                      // the sprite's own shape (alpha test on the texel, not on opacity)
  diffuseColor = vec4(mix(vec3(uSilGrey), diffuse, uSilTeam), opacity);
  if (uSilDither > 0.5) {                                        // keep only thin diagonal lines: a diamond lattice, uSilScale px apart
    vec2 sp = gl_FragCoord.xy / uSilScale;
    float a = fract((sp.x + sp.y) * 0.5), b = fract((sp.x - sp.y) * 0.5);
    if (min(min(a, 1.0 - a), min(b, 1.0 - b)) > uSilWidth * 0.5) discard;
  }`;function addSilhouette(quad,color=8378623){const mat=patchFlatDepth(new THREE.MeshBasicMaterial({map:quad.material.map,color,transparent:!0,side:THREE.DoubleSide,opacity:spriteDepth.silhouetteOpacity,depthWrite:!1,depthTest:!0,depthFunc:THREE.GreaterDepth,fog:!1}),quad.material.userData.flatMul||1),prev=mat.onBeforeCompile;mat.onBeforeCompile=(shader,r)=>{prev(shader,r),Object.assign(shader.uniforms,silUniforms),shader.fragmentShader=`uniform float uSilGrey, uSilTeam, uSilDither, uSilScale, uSilWidth;
`+shader.fragmentShader.replace("#include <map_fragment>",SIL_FRAG)},mat.customProgramCacheKey=()=>"silh3";const s=new THREE.Mesh(quad.geometry,mat);return s.renderOrder=1,s.frustumCulled=!1,s.visible=spriteDepth.silhouette,s.raycast=()=>{},s.userData.noAO=!0,s.castShadow=s.receiveShadow=!1,quad.add(s),silhouettes.add(s),s}function removeSilhouette(s){s&&(s.parent?.remove(s),s.material.dispose(),silhouettes.delete(s))}function setSilhouetteColor(s,color){s&&s.material.color.set(color)}function applySpriteDepth(){depthUniforms.uFlatDepth.value=spriteDepth.flat?1:0,depthUniforms.uFlatBias.value=spriteDepth.bias;const U=silUniforms,d=spriteDepth;U.uSilGrey.value=d.silhouetteGrey,U.uSilTeam.value=d.silhouetteTeam?1:0,U.uSilDither.value=d.silhouetteDither?1:0,U.uSilScale.value=d.silhouetteScale,U.uSilWidth.value=d.silhouetteWidth;for(const s of silhouettes)s.visible=d.silhouette,s.material.opacity=d.silhouetteOpacity}export{addSilhouette,applySpriteDepth,depthUniforms,patchFlatDepth,removeSilhouette,setSilhouetteColor,spriteDepth};
