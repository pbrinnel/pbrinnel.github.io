const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[c]),CSS=`
.wlpick-back { position: fixed; inset: 0; z-index: 50; background: rgba(8,10,14,.82); display: flex; align-items: center; justify-content: center; }
.wlpick { background: #1a1d25; color: #e6e8ee; border: 1px solid #333846; border-radius: 12px; width: min(720px, 94vw); max-height: 88vh; display: flex; flex-direction: column; font: 13px system-ui, sans-serif; }
.wlpick header { display: flex; align-items: center; gap: 10px; padding: 12px 14px 8px; border-bottom: 1px solid #333846; }
.wlpick header h3 { margin: 0; font-size: 16px; flex: 1; }
.wlpick header input { background: #12141a; border: 1px solid #333846; border-radius: 5px; padding: 5px 8px; color: inherit; font: inherit; width: 180px; }
.wlpick header button, .wlpick .def { background: #262b38; color: inherit; border: 1px solid #333846; border-radius: 6px; padding: 5px 10px; cursor: pointer; font: inherit; }
.wlpick .body { overflow: auto; padding: 6px 14px 14px; }
.wlpick h4 { margin: 12px 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #9aa0ad; }
.wlpick .list { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 6px; }
.wlpick .e { display: flex; align-items: center; gap: 8px; padding: 4px 6px; border: 1px solid #333846; border-radius: 6px; cursor: pointer; background: #191c23; text-align: left; color: inherit; font: inherit; }
.wlpick .e:hover { border-color: #f0b44c; background: #232733; }
.wlpick .e.cur { border-color: #fff; background: #262b38; }
.wlpick .e.off { opacity: .4; cursor: not-allowed; }
.wlpick .e.held { border-style: dashed; }
.wlpick .e > div { min-width: 0; flex: 1; }
.wlpick .e b { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wlpick .e small { display: block; color: #9aa0ad; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wlpick .ml { font-variant-numeric: tabular-nums; font-weight: 700; color: #f0b44c; }
`;function pickWarlord({book,rec,name="",current=-1,taken=new Map,allowDefault=!1}){document.getElementById("wlpick-css")||document.head.insertAdjacentHTML("beforeend",`<style id="wlpick-css">${CSS}</style>`);const tiers=book.tiers(rec);return new Promise(resolve=>{const back=document.createElement("div");back.className="wlpick-back",back.innerHTML=`<div class="wlpick" role="dialog" aria-label="Choose a warlord"><header><h3>Warlord for ${esc(name)}</h3>
      <input type="search" placeholder="Search name or skill" aria-label="Search">${allowDefault?'<button class="def" data-def>Default (random perfect Link)</button>':""}<button data-x title="Close (Esc)">Close</button></header>
      <div class="body"></div></div>`;const body=back.querySelector(".body"),q=back.querySelector("input"),done=v=>{back.remove(),removeEventListener("keydown",key,!0),resolve(v)},key=e=>{e.key==="Escape"&&(e.stopPropagation(),done(void 0))},draw=()=>{const f=q.value.trim().toLowerCase();body.innerHTML=tiers.map(([ml,ids])=>{const rows=ids.filter(id=>!f||book.label(id).toLowerCase().includes(f)||(book.skill(id)?.name||"").toLowerCase().includes(f)).map(id=>{const g=book.get(id).group,tk=taken.get(g),who=tk?.text,off=!!tk?.block&&id!==current,sk=book.skill(id);return`<button class="e${id===current?" cur":""}${off?" off":""}${who&&!off?" held":""}" data-id="${id}" ${off?"disabled":""}
            title="${esc(book.label(id))}${sk?" \xB7 "+esc(sk.name)+(sk.desc?": "+esc(sk.desc):""):""}${who?" \xB7 "+esc(who):""}">${book.badge(id,32)}
            <div><b>${esc(book.label(id))}</b><small>${who?esc(who):sk?esc(sk.name):"&nbsp;"}</small></div><span class="ml">${ml}</span></button>`}).join("");return rows?`<h4>Max Link ${ml}${ml===100?" (perfect Link)":""}</h4><div class="list">${rows}</div>`:""}).join("")||'<p style="color:#9aa0ad">No warlord matches.</p>'};back.addEventListener("click",e=>{const b=e.target.closest("button");if(e.target===back||b?.dataset.x!==void 0)return done(void 0);if(b?.dataset.def!==void 0)return done(null);b?.dataset.id!==void 0&&!b.disabled&&done(+b.dataset.id)}),q.oninput=draw,addEventListener("keydown",key,!0),draw(),document.body.appendChild(back),q.focus()})}export{pickWarlord};
