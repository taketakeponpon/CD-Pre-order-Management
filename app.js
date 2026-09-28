const KEY="cdReservationApp_v3";
const app=document.getElementById("app"), modalRoot=document.getElementById("modalRoot"), toastRoot=document.getElementById("toastRoot");

const defaultData={artists:[],cds:[],reservations:[]};
let data=loadData();

function loadData(){try{return JSON.parse(localStorage.getItem(KEY))||structuredClone(defaultData)}catch(e){return structuredClone(defaultData)}}
function save(){localStorage.setItem(KEY,JSON.stringify(data))}
function uid(prefix){return prefix+"_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,7)}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function yen(n){return Number(n||0).toLocaleString("ja-JP")+"円"}
function dateTime(v){if(!v)return "—"; const d=new Date(v); return isNaN(d)?"—":d.toLocaleString("ja-JP",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"})}
function todayLocal(){const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,16)}
function toast(msg){toastRoot.innerHTML=`<div class="toast">${esc(msg)}</div>`;setTimeout(()=>toastRoot.innerHTML="",2200)}
function go(page,params={}){location.hash=page+(Object.keys(params).length?"?"+new URLSearchParams(params):"");render()}
function parseHash(){const [p,q]=location.hash.replace("#","").split("?");return {page:p||"home",params:Object.fromEntries(new URLSearchParams(q||""))}}
function artistName(id){return data.artists.find(a=>a.id===id)?.name||"不明なアーティスト"}
function cdById(id){return data.cds.find(c=>c.id===id)}
function activeReservations(){return data.reservations.filter(r=>r.status!=="cancelled")}
function imageTag(src){return src?`<img class="cover" src="${src}" alt="">`:`<div class="cover placeholder">♪</div>`}

function layout(title,content){
  app.innerHTML=`<header class="header"><div class="header-inner">
    <div class="logo">♪ CD予約管理システム<span class="logo-sub">お気に入りのCDをすっきり管理</span></div>
    <button class="menu-btn" onclick="go('menu')">☰ メニュー</button>
  </div></header><main class="container">${content}</main>`;
}

function render(){
  const {page,params}=parseHash();
  if(page==="home")return renderHome();
  if(page==="artists")return renderArtists();
  if(page==="artist-form")return renderArtistForm(params.id);
  if(page==="cds")return renderCDs();
  if(page==="cd-form")return renderCDForm(params.id);
  if(page==="cd-detail")return renderCDDetail(params.id);
  if(page==="reservation-form")return renderReservationForm(params.id);
  if(page==="reservations")return renderReservations();
  if(page==="reservation-detail")return renderReservationDetail(params.id);
  if(page==="menu")return renderMenu();
  renderHome();
}
window.addEventListener("hashchange",render);

function renderHome(){
  const active=activeReservations(), unpaid=active.filter(r=>r.paymentStatus==="unpaid").reduce((s,r)=>s+r.total,0);
  layout("",`<div class="page-title"><h1>ホーム</h1><div class="item-meta">CD予約をかんたんに管理できます。</div></div>
  <div class="grid grid-3">
    <div class="stat"><div class="stat-label">登録アーティスト</div><div class="stat-value">${data.artists.length}</div></div>
    <div class="stat"><div class="stat-label">登録CD</div><div class="stat-value">${data.cds.length}</div></div>
    <div class="stat"><div class="stat-label">未払い金額</div><div class="stat-value">${yen(unpaid)}</div></div>
  </div>
  <div class="card"><div class="section-title"><h2>メニュー</h2></div><div class="nav-grid">
    <button class="nav-card" onclick="go('reservations')"><strong>📋 予約一覧</strong><span>予約状況・未払いを確認</span></button>
    <button class="nav-card" onclick="go('reservation-form')"><strong>＋ 予約を登録</strong><span>CDの予約情報を入力</span></button>
    <button class="nav-card" onclick="go('cds')"><strong>💿 CD一覧</strong><span>CDを検索・管理</span></button>
    <button class="nav-card" onclick="go('cd-form')"><strong>＋ CDを登録</strong><span>形態や特典を設定</span></button>
    <button class="nav-card" onclick="go('artists')"><strong>♪ アーティスト</strong><span>登録・編集</span></button>
    <button class="nav-card" onclick="go('menu')"><strong>⚙ データ管理</strong><span>バックアップ・初期化</span></button>
  </div></div>
  ${active.length?`<div class="card"><div class="section-title"><h2>最近の予約</h2><button class="btn ghost small" onclick="go('reservations')">すべて見る</button></div>
  ${active.slice().sort((a,b)=>new Date(b.reservationDateTime||b.createdAt)-new Date(a.reservationDateTime||a.createdAt)).slice(0,5).map(r=>reservationSummary(r)).join("")}</div>`:""}`);
}
function reservationSummary(r){
  const cd=cdById(r.cdId); if(!cd)return "";
  return `<div class="list-item"><div class="item-main"><div class="item-title">${esc(cd.title)}</div>
  <div class="item-meta">${esc(artistName(cd.artistId))} ・ ${dateTime(r.reservationDateTime)}</div>
  <div class="row" style="margin-top:5px"><span class="badge ${r.status==="received"?"green":""}">${r.status==="received"?"受け取り済み":"予約済み"}</span><span class="badge ${r.paymentStatus==="paid"?"green":"orange"}">${r.paymentStatus==="paid"?"支払い済み":"未払い"}</span><span class="price">${yen(r.total)}</span></div></div></div>`
}

function renderArtists(){
  layout("",`<div class="page-title"><div class="section-title"><div><h1>アーティスト</h1><div class="item-meta">先にアーティストを登録すると、CD登録時に選択できます。</div></div><button class="btn" onclick="go('artist-form')">＋ 登録</button></div></div>
  <div class="card">${data.artists.length?data.artists.map(a=>`<div class="list-item"><div class="item-main"><div class="item-title">${esc(a.name)}</div><div class="item-meta">登録CD：${data.cds.filter(c=>c.artistId===a.id).length}件</div></div><button class="btn ghost small" onclick="go('artist-form',{id:'${a.id}'})">編集</button></div>`).join(""):`<div class="empty">まだアーティストが登録されていません。</div>`}</div>
  <button class="btn ghost" onclick="go('home')">← ホームへ</button>`);
}
function renderArtistForm(id){
  const a=data.artists.find(x=>x.id===id);
  layout("",`<div class="page-title"><h1>${a?"アーティストを編集":"アーティストを登録"}</h1></div>
  <div class="card"><div class="field"><label>アーティスト名<span class="required">必須</span></label><input id="artistName" value="${esc(a?.name||"")}" placeholder="例：Aぇ! group"></div>
  <div class="actions"><button class="btn" onclick="saveArtist('${id||""}')">保存</button><button class="btn ghost" onclick="go('artists')">キャンセル</button></div></div>`);
}
window.saveArtist=(id)=>{const name=document.getElementById("artistName").value.trim();if(!name)return alert("アーティスト名を入力してください。");if(id){data.artists.find(a=>a.id===id).name=name}else data.artists.push({id:uid("artist"),name});save();toast("保存しました");go("artists")}

function renderCDs(){
  layout("",`<div class="page-title"><div class="section-title"><div><h1>CD一覧</h1></div><button class="btn" onclick="go('cd-form')">＋ 登録</button></div>
  <div class="search-row"><input id="cdSearch" placeholder="CDタイトル・アーティストで検索" oninput="filterCDs()"></div></div>
  <div class="card" id="cdList">${cdListHTML(data.cds)}</div>
  <button class="btn ghost" onclick="go('home')">← ホームへ</button>`);
}
function cdListHTML(list){
  if(!list.length)return `<div class="empty">該当するCDがありません。</div>`;
  return list.map(c=>`<div class="list-item">${imageTag(c.image)}<div class="item-main"><div class="item-title">${esc(c.title)}</div><div class="item-meta">${esc(artistName(c.artistId))} ・ ${esc(c.releaseDate||"発売日未設定")}</div><div class="row" style="margin-top:6px"><span class="badge">${c.formats.length}形態</span><span class="badge">${c.commonBonus?.enabled?"共通早期特典あり":"共通早期特典なし"}</span></div></div><button class="btn ghost small" onclick="go('cd-detail',{id:'${c.id}'})">詳細</button></div>`).join("");
}
window.filterCDs=()=>{const q=document.getElementById("cdSearch").value.toLowerCase();document.getElementById("cdList").innerHTML=cdListHTML(data.cds.filter(c=>(c.title+" "+artistName(c.artistId)).toLowerCase().includes(q)))}

function renderCDForm(id){
  const c=data.cds.find(x=>x.id===id);
  layout("",`<div class="page-title"><h1>${c?"CDを編集":"CDを登録"}</h1></div>
  ${!data.artists.length?`<div class="warning">先にアーティストを登録してください。</div>`:`<div class="card">
  <div class="field"><label>アーティスト<span class="required">必須</span></label><select id="cdArtist">${data.artists.map(a=>`<option value="${a.id}" ${a.id===c?.artistId?"selected":""}>${esc(a.name)}</option>`).join("")}</select></div>
  <div class="grid grid-2"><div class="field"><label>CDタイトル<span class="required">必須</span></label><input id="cdTitle" value="${esc(c?.title||"")}"></div>
  <div class="field"><label>発売日</label><input id="releaseDate" type="date" value="${esc(c?.releaseDate||"")}"></div></div>
  <div class="field"><label>ジャケット画像</label><input id="coverFile" type="file" accept="image/*" onchange="previewImage(this)"><div id="imagePreview" style="margin-top:8px">${imageTag(c?.image)}</div><div class="help">画像はブラウザ内に保存されます。</div></div>
  <div class="card" style="box-shadow:none;background:#fbfdff"><div class="section-title"><h3>全形態共通早期予約特典</h3></div>
    <div class="radio-group"><label class="radio"><input type="radio" name="commonBonus" value="no" ${!c?.commonBonus?.enabled?"checked":""} onchange="toggleCommonBonus()">なし</label>
    <label class="radio"><input type="radio" name="commonBonus" value="yes" ${c?.commonBonus?.enabled?"checked":""} onchange="toggleCommonBonus()">あり</label></div>
    <div id="commonBonusNameWrap" class="${c?.commonBonus?.enabled?"":"hidden"}" style="margin-top:10px"><label>特典名</label><input id="commonBonusName" value="${esc(c?.commonBonus?.name||"")}"></div>
  </div>
  <div class="section-title"><h3>形態</h3><button class="btn secondary small" onclick="addFormatForm()">＋ 形態を追加</button></div>
  <div id="formatsWrap">${(c?.formats||[{name:"",price:"",bonusEnabled:false,bonusName:""}]).map((f,i)=>formatEditor(f,i)).join("")}</div>
  <div class="actions"><button class="btn" onclick="saveCD('${id||""}')">保存</button><button class="btn ghost" onclick="go('cds')">キャンセル</button></div>
  </div>`}
  ${!data.artists.length?`<button class="btn" onclick="go('artist-form')">アーティストを登録する</button>`:""}`);
}
function formatEditor(f,i){return `<div class="format-card"><div class="format-head"><span class="format-number">形態 ${i+1}</span><button class="btn danger small" onclick="this.closest('.format-card').remove()">削除</button></div>
<div class="grid grid-2" style="margin-top:10px"><div class="field"><label>形態名<span class="required">必須</span></label><input class="fmt-name" value="${esc(f.name)}" placeholder="例：初回限定盤A"></div><div class="field"><label>価格<span class="required">必須</span></label><input class="fmt-price" type="number" min="0" value="${esc(f.price)}" placeholder="1500"></div></div>
<div class="field"><label>形態別特典</label><div class="radio-group"><label class="radio"><input type="radio" name="bonus_${i}" value="no" ${!f.bonusEnabled?"checked":""} onchange="toggleFormatBonus(this)">なし</label><label class="radio"><input type="radio" name="bonus_${i}" value="yes" ${f.bonusEnabled?"checked":""} onchange="toggleFormatBonus(this)">あり</label></div>
<div class="${f.bonusEnabled?"":"hidden"} fmt-bonus-wrap" style="margin-top:8px"><input class="fmt-bonus" value="${esc(f.bonusName||"")}" placeholder="特典名"></div></div></div>`}
window.toggleCommonBonus=()=>{document.getElementById("commonBonusNameWrap").classList.toggle("hidden",document.querySelector('input[name="commonBonus"]:checked').value!=="yes")}
window.toggleFormatBonus=(el)=>{el.closest(".field").querySelector(".fmt-bonus-wrap").classList.toggle("hidden",el.value!=="yes")}
window.addFormatForm=()=>{const w=document.getElementById("formatsWrap"),i=w.children.length;w.insertAdjacentHTML("beforeend",formatEditor({name:"",price:"",bonusEnabled:false,bonusName:""},i))}
window.previewImage=(input)=>{if(!input.files?.[0])return;const r=new FileReader();r.onload=()=>document.getElementById("imagePreview").innerHTML=imageTag(r.result);r.readAsDataURL(input.files[0])}
window.saveCD=async(id)=>{
 const title=document.getElementById("cdTitle").value.trim(), artistId=document.getElementById("cdArtist").value;
 const cards=[...document.querySelectorAll("#formatsWrap .format-card")];
 if(!title||!cards.length)return alert("タイトルと形態を入力してください。");
 const formats=cards.map((el,i)=>{const bonus=el.querySelector(`input[name="bonus_${i}"]:checked`)?.value==="yes";return {id:uid("fmt"),name:el.querySelector(".fmt-name").value.trim(),price:Number(el.querySelector(".fmt-price").value||0),bonusEnabled:bonus,bonusName:bonus?el.querySelector(".fmt-bonus").value.trim():""}});
 if(formats.some(f=>!f.name))return alert("形態名を入力してください。");
 let image=id?(data.cds.find(c=>c.id===id)?.image||""):""; const file=document.getElementById("coverFile").files?.[0];
 if(file)image=await new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(file)});
 const commonEnabled=document.querySelector('input[name="commonBonus"]:checked').value==="yes";
 const obj={id:id||uid("cd"),artistId,title,releaseDate:document.getElementById("releaseDate").value,image,commonBonus:{enabled:commonEnabled,name:commonEnabled?document.getElementById("commonBonusName").value.trim():""},formats};
 if(id){const idx=data.cds.findIndex(c=>c.id===id);data.cds[idx]=obj}else data.cds.push(obj);save();toast("CDを保存しました");go("cd-detail",{id:obj.id})
}

function renderCDDetail(id){
 const c=cdById(id);if(!c)return go("cds");
 const rs=activeReservations().filter(r=>r.cdId===id);
 const fmtCounts={}; c.formats.forEach(f=>fmtCounts[f.id]=0);
 const bonusCounts={}; c.formats.forEach(f=>{if(f.bonusEnabled)bonusCounts["format:"+f.id]=0}); if(c.commonBonus?.enabled)bonusCounts.common=0;
 rs.forEach(r=>r.items.forEach(it=>fmtCounts[it.formatId]=(fmtCounts[it.formatId]||0)+it.quantity));
 rs.forEach(r=>{if(r.bonusType==="common"&&c.commonBonus?.enabled)bonusCounts.common=(bonusCounts.common||0)+1;if(r.bonusType==="format"&&r.bonusFormatId)bonusCounts["format:"+r.bonusFormatId]=(bonusCounts["format:"+r.bonusFormatId]||0)+1});
 layout("",`<div class="page-title"><div class="section-title"><h1>CD詳細</h1><button class="btn" onclick="go('reservation-form',{cdId:id})">＋ このCDを予約</button></div></div>
 <div class="card">${imageTag(c.image)}<div style="margin-top:12px"><h2>${esc(c.title)}</h2><div class="item-meta">${esc(artistName(c.artistId))} ・ 発売日：${esc(c.releaseDate||"未設定")}</div></div>
 <div class="actions" style="margin-top:12px"><button class="btn ghost small" onclick="go('cd-form',{id:'${id}'})">編集</button></div></div>
 <div class="card"><h2>形態別の予約数</h2><table class="detail-table">${c.formats.map(f=>`<tr><th>${esc(f.name)}</th><td>${fmtCounts[f.id]||0}枚</td></tr>`).join("")}</table></div>
 <div class="card"><h2>特典別の予約数</h2><table class="detail-table">${c.commonBonus?.enabled?`<tr><th>全形態共通早期予約特典：${esc(c.commonBonus.name||"特典名未設定")}</th><td>${bonusCounts.common||0}件</td></tr>`:""}${c.formats.filter(f=>f.bonusEnabled).map(f=>`<tr><th>${esc(f.name)}：${esc(f.bonusName||"特典名未設定")}</th><td>${bonusCounts["format:"+f.id]||0}件</td></tr>`).join("")}${!c.commonBonus?.enabled&&!c.formats.some(f=>f.bonusEnabled)?`<tr><td colspan="2">登録されている特典はありません。</td></tr>`:""}</table></div>
 <button class="btn ghost" onclick="go('cds')">← CD一覧へ</button>`);
}

function renderReservationForm(id){
 const existing=data.reservations.find(r=>r.id===id), selectedCd=cdById(existing?.cdId||parseHash().params.cdId);
 layout("",`<div class="page-title"><h1>${existing?"予約を編集":"予約を登録"}</h1></div>
 ${!data.cds.length?`<div class="warning">先にCDを登録してください。</div>`:`<div class="card">
 <div class="field"><label>CD<span class="required">必須</span></label><select id="resCd" onchange="changeReservationCD()">${data.cds.map(c=>`<option value="${c.id}" ${c.id===selectedCd?.id?"selected":""}>${esc(c.title)} / ${esc(artistName(c.artistId))}</option>`).join("")}</select></div>
 <div id="resFormats"></div>
 <div class="field"><label>予約日時<span class="required">必須</span></label><input id="resDateTime" type="datetime-local" value="${esc(existing?.reservationDateTime||todayLocal())}"><div class="help">CDを予約した日時を入力してください。</div></div>
 <div class="field"><label>特典</label><div id="bonusChoices"></div></div>
 <div class="grid grid-2"><div class="field"><label>店舗・サイト</label><input id="storeSite" value="${esc(existing?.storeSite||"")}" placeholder="例：タワーレコード"></div>
 <div class="field"><label>受け取り方法</label><select id="receiveMethod" onchange="toggleStoreName()"><option value="delivery" ${existing?.receiveMethod==="delivery"?"selected":""}>配送</option><option value="store" ${existing?.receiveMethod==="store"?"selected":""}>店舗受け取り</option><option value="convenience" ${existing?.receiveMethod==="convenience"?"selected":""}>コンビニ受け取り</option></select></div></div>
 <div class="field hidden" id="storeNameWrap"><label id="storeNameLabel">店舗名</label><input id="storeName" value="${esc(existing?.storeName||"")}" placeholder="例：セブン-イレブン○○店"><div class="help" id="storeNameHelp"></div></div>
 <div class="grid grid-2"><div class="field"><label>支払い状況</label><select id="paymentStatus"><option value="unpaid" ${existing?.paymentStatus!=="paid"?"selected":""}>未払い</option><option value="paid" ${existing?.paymentStatus==="paid"?"selected":""}>支払い済み</option></select></div>
 <div class="field"><label>送料</label><input id="shipping" type="number" min="0" value="${esc(existing?.shipping||0)}"></div></div>
 <div class="field"><label class="checkbox-line"><input id="pointsUsed" type="checkbox" ${existing?.pointsUsed?"checked":""}> ポイントを使用する</label><input id="pointsAmount" type="number" min="0" value="${esc(existing?.pointsAmount||0)}" placeholder="使用ポイント・金額" style="margin-top:7px"></div>
 <div class="field"><label>メモ</label><textarea id="memo" placeholder="自由にメモできます">${esc(existing?.memo||"")}</textarea></div>
 <div class="total-box" id="resTotal"></div>
 <div class="actions" style="margin-top:14px"><button class="btn" onclick="saveReservation('${id||""}')">保存</button><button class="btn ghost" onclick="go('reservations')">キャンセル</button></div>
 </div>`}
 ${!data.cds.length?`<button class="btn" onclick="go('cd-form')">CDを登録する</button>`:""}`);
 if(selectedCd) setTimeout(()=>{changeReservationCD(); if(existing)restoreReservation(existing); toggleStoreName();},0);
}
window.changeReservationCD=()=>{const cd=cdById(document.getElementById("resCd").value);if(!cd)return;const r=data.reservations.find(x=>x.id===parseHash().params.id);document.getElementById("resFormats").innerHTML=`<div class="field"><label>予約する形態・数量<span class="required">必須</span></label>${cd.formats.map(f=>`<div class="qty-row"><span><strong>${esc(f.name)}</strong><br><small>${yen(f.price)}</small></span><input class="qty" data-format="${f.id}" type="number" min="0" value="0"><span class="price">${yen(0)}</span></div>`).join("")}</div>`;document.querySelectorAll(".qty").forEach(x=>x.addEventListener("input",updateTotal));document.getElementById("bonusChoices").innerHTML=bonusHTML(cd);updateTotal()}
function bonusHTML(c){let s=`<div class="radio-group"><label class="radio"><input type="radio" name="bonusType" value="none" checked>特典なし</label>`;if(c.commonBonus?.enabled)s+=`<label class="radio"><input type="radio" name="bonusType" value="common">共通早期予約特典：${esc(c.commonBonus.name||"特典")}</label>`;c.formats.filter(f=>f.bonusEnabled).forEach(f=>s+=`<label class="radio"><input type="radio" name="bonusType" value="format" data-format="${f.id}">${esc(f.name)}：${esc(f.bonusName||"特典")}</label>`);return s+"</div>"}
function restoreReservation(r){document.querySelectorAll(".qty").forEach(x=>{const it=r.items.find(i=>i.formatId===x.dataset.format);x.value=it?.quantity||0});document.querySelectorAll('input[name="bonusType"]').forEach(x=>{x.checked=x.value===r.bonusType&&(x.value!=="format"||x.dataset.format===r.bonusFormatId)});updateTotal()}
window.updateTotal=()=>{const cd=cdById(document.getElementById("resCd")?.value);if(!cd)return;let subtotal=0;document.querySelectorAll(".qty").forEach(x=>{const f=cd.formats.find(y=>y.id===x.dataset.format),q=Number(x.value||0);subtotal+=f.price*q;x.parentElement.lastElementChild.textContent=yen(f.price*q)});const shipping=Number(document.getElementById("shipping")?.value||0),points=document.getElementById("pointsUsed")?.checked?Number(document.getElementById("pointsAmount")?.value||0):0,total=Math.max(0,subtotal+shipping-points);document.getElementById("resTotal").innerHTML=`<div class="total-row"><span>商品小計</span><strong>${yen(subtotal)}</strong></div><div class="total-row"><span>送料</span><strong>${yen(shipping)}</strong></div><div class="total-row"><span>ポイント</span><strong>-${yen(points)}</strong></div><div class="total-row main"><span>合計支払額</span><strong>${yen(total)}</strong></div>`}
window.toggleStoreName=()=>{const v=document.getElementById("receiveMethod")?.value,w=document.getElementById("storeNameWrap"),l=document.getElementById("storeNameLabel"),h=document.getElementById("storeNameHelp");if(!w)return;w.classList.toggle("hidden",v==="delivery");if(v==="store"){l.textContent="店舗名";h.textContent="受け取りに行く店舗名を入力してください。";document.getElementById("storeName").placeholder="例：タワーレコード○○店"}else{l.textContent="コンビニ店舗名";h.textContent="受け取りに指定したコンビニ店舗名を入力してください。";document.getElementById("storeName").placeholder="例：セブン-イレブン○○店"}}
window.saveReservation=(id)=>{
 const cd=cdById(document.getElementById("resCd").value),items=[...document.querySelectorAll(".qty")].map(x=>({formatId:x.dataset.format,quantity:Number(x.value||0)})).filter(x=>x.quantity>0);
 if(!items.length)return alert("少なくとも1つの形態を1枚以上選択してください。");
 const shipping=Number(document.getElementById("shipping").value||0),pointsUsed=document.getElementById("pointsUsed").checked,pointsAmount=pointsUsed?Number(document.getElementById("pointsAmount").value||0):0;
 const subtotal=items.reduce((s,it)=>s+cd.formats.find(f=>f.id===it.formatId).price*it.quantity,0),total=Math.max(0,subtotal+shipping-pointsAmount);
 const b=document.querySelector('input[name="bonusType"]:checked'),receiveMethod=document.getElementById("receiveMethod").value,storeName=document.getElementById("storeName").value.trim();
 if(receiveMethod!=="delivery"&&!storeName)return alert("店舗名を入力してください。");
 const obj={id:id||uid("res"),cdId:cd.id,items,bonusType:b?.value||"none",bonusFormatId:b?.value==="format"?b.dataset.format:null,reservationDateTime:document.getElementById("resDateTime").value,storeSite:document.getElementById("storeSite").value.trim(),receiveMethod,storeName,paymentStatus:document.getElementById("paymentStatus").value,shipping,pointsUsed,pointsAmount,subtotal,total,memo:document.getElementById("memo").value.trim(),status:id?(data.reservations.find(r=>r.id===id)?.status||"reserved"):"reserved",createdAt:id?(data.reservations.find(r=>r.id===id)?.createdAt||new Date().toISOString()):new Date().toISOString()};
 if(id){data.reservations[data.reservations.findIndex(r=>r.id===id)]=obj}else data.reservations.push(obj);save();toast("予約を保存しました");go("reservation-detail",{id:obj.id})
}

function renderReservations(){
 const rs=activeReservations();
 layout("",`<div class="page-title"><div class="section-title"><h1>予約一覧</h1><button class="btn" onclick="go('reservation-form')">＋ 登録</button></div></div>
 <div class="card"><div class="grid grid-2"><div class="field"><label>検索</label><input id="rSearch" placeholder="CD・アーティスト・店舗" oninput="filterReservations()"></div><div class="field"><label>絞り込み</label><select id="rFilter" onchange="filterReservations()"><option value="all">すべて</option><option value="reserved">予約済み</option><option value="received">受け取り済み</option><option value="unpaid">未払い</option><option value="paid">支払い済み</option></select></div></div></div>
 <div class="card" id="reservationList">${reservationListHTML(rs)}</div>
 <button class="btn ghost" onclick="go('home')">← ホームへ</button>`);
}
function reservationListHTML(rs){if(!rs.length)return `<div class="empty">予約はありません。</div>`;return rs.slice().sort((a,b)=>new Date(b.reservationDateTime||b.createdAt)-new Date(a.reservationDateTime||a.createdAt)).map(r=>{const c=cdById(r.cdId);return `<div class="list-item">${imageTag(c?.image)}<div class="item-main"><div class="item-title">${esc(c?.title||"削除されたCD")}</div><div class="item-meta">${esc(c?artistName(c.artistId):"")} ・ 予約日時：${dateTime(r.reservationDateTime)}</div><div class="row" style="margin-top:6px"><span class="badge ${r.status==="received"?"green":""}">${r.status==="received"?"受け取り済み":"予約済み"}</span><span class="badge ${r.paymentStatus==="paid"?"green":"orange"}">${r.paymentStatus==="paid"?"支払い済み":"未払い"}</span><span class="price">${yen(r.total)}</span></div></div><button class="btn ghost small" onclick="go('reservation-detail',{id:'${r.id}'})">詳細</button></div>`}).join("")}
window.filterReservations=()=>{const q=(document.getElementById("rSearch")?.value||"").toLowerCase(),f=document.getElementById("rFilter")?.value||"all";let rs=activeReservations().filter(r=>{const c=cdById(r.cdId),text=((c?.title||"")+" "+artistName(c?.artistId)+" "+(r.storeSite||"")+" "+(r.storeName||"")).toLowerCase();return text.includes(q)&& (f==="all"||(f==="unpaid"&&r.paymentStatus==="unpaid")||(f==="paid"&&r.paymentStatus==="paid")||r.status===f)});document.getElementById("reservationList").innerHTML=reservationListHTML(rs)}

function renderReservationDetail(id){
 const r=data.reservations.find(x=>x.id===id);if(!r)return go("reservations");const c=cdById(r.cdId);
 const itemRows=r.items.map(it=>{const f=c?.formats.find(x=>x.id===it.formatId);return `<tr><th>${esc(f?.name||"不明")}</th><td>${it.quantity}枚 × ${yen(f?.price||0)} = ${yen((f?.price||0)*it.quantity)}</td></tr>`}).join("");
 let bonus="特典なし";if(r.bonusType==="common")bonus=`共通早期予約特典：${esc(c?.commonBonus?.name||"")}`;if(r.bonusType==="format"){const f=c?.formats.find(x=>x.id===r.bonusFormatId);bonus=`${esc(f?.name||"")}：${esc(f?.bonusName||"")}`}
 layout("",`<div class="page-title"><div class="section-title"><h1>予約詳細</h1><div class="actions">${r.status!=="received"?`<button class="btn success small" onclick="completePickup('${id}')">受け取り完了</button>`:""}<button class="btn ghost small" onclick="go('reservation-form',{id:'${id}'})">編集</button><button class="btn danger small" onclick="cancelReservation('${id}')">予約をキャンセル</button></div></div></div>
 <div class="card"><h2>${esc(c?.title||"削除されたCD")}</h2><div class="item-meta">${esc(c?artistName(c.artistId):"")}</div><table class="detail-table" style="margin-top:10px">
 <tr><th>予約日時</th><td>${dateTime(r.reservationDateTime)}</td></tr><tr><th>形態</th><td><table class="detail-table">${itemRows}</table></td></tr><tr><th>特典</th><td>${bonus}</td></tr><tr><th>店舗・サイト</th><td>${esc(r.storeSite||"—")}</td></tr><tr><th>受け取り方法</th><td>${r.receiveMethod==="delivery"?"配送":r.receiveMethod==="store"?"店舗受け取り":"コンビニ受け取り"}${r.storeName?`<br>店舗名：${esc(r.storeName)}`:""}</td></tr><tr><th>支払い</th><td>${r.paymentStatus==="paid"?"支払い済み":"未払い"}</td></tr><tr><th>送料</th><td>${yen(r.shipping)}</td></tr><tr><th>ポイント</th><td>${r.pointsUsed?yen(r.pointsAmount):"使用なし"}</td></tr><tr><th>メモ</th><td>${esc(r.memo||"—")}</td></tr></table></div>
 <div class="card"><div class="total-box"><div class="total-row"><span>商品小計</span><strong>${yen(r.subtotal)}</strong></div><div class="total-row"><span>送料</span><strong>${yen(r.shipping)}</strong></div><div class="total-row"><span>ポイント</span><strong>-${yen(r.pointsAmount)}</strong></div><div class="total-row main"><span>合計支払額</span><strong>${yen(r.total)}</strong></div></div></div>
 <button class="btn ghost" onclick="go('reservations')">← 予約一覧へ</button>`);
}
window.completePickup=(id)=>showConfirm("受け取り完了に変更しますか？","この操作を行うと、予約状況が「受け取り済み」に変更されます。よろしいですか？",()=>{data.reservations.find(r=>r.id===id).status="received";save();toast("受け取り済みに変更しました");render()});
window.cancelReservation=(id)=>showConfirm("予約をキャンセルしますか？","キャンセルした予約は通常の予約一覧・集計から除外されます。",()=>{data.reservations.find(r=>r.id===id).status="cancelled";save();toast("予約をキャンセルしました");go("reservations")});
function showConfirm(title,msg,ok){modalRoot.innerHTML=`<div class="modal-backdrop"><div class="modal"><h3>${esc(title)}</h3><p>${esc(msg)}</p><div class="actions"><button class="btn danger" id="modalOk">実行</button><button class="btn ghost" onclick="closeModal()">戻る</button></div></div></div>`;document.getElementById("modalOk").onclick=()=>{closeModal();ok()}}
window.closeModal=()=>modalRoot.innerHTML="";

function renderMenu(){
 layout("",`<div class="page-title"><h1>データ管理</h1></div>
 <div class="card"><div class="notice">このアプリのデータは、このブラウザのlocalStorageに保存されます。同じURLを使っても、ブラウザごとにデータは分かれて管理されます。</div></div>
 <div class="card"><h2>バックアップ</h2><p class="item-meta">端末変更やブラウザ変更の前にJSONで保存しておくと安心です。</p><div class="actions"><button class="btn" onclick="exportData()">JSONを書き出す</button><label class="btn secondary" style="display:inline-flex;align-items:center;cursor:pointer">JSONを読み込む<input type="file" accept=".json,application/json" onchange="importData(this)" style="display:none"></label></div></div>
 <div class="card"><h2>データ削除</h2><p class="item-meta">登録したアーティスト・CD・予約をすべて削除します。</p><button class="btn danger" onclick="clearAllData()">すべてのデータを削除</button></div>
 <button class="btn ghost" onclick="go('home')">← ホームへ</button>`);
}
window.exportData=()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="cd-reservation-backup.json";a.click();URL.revokeObjectURL(a.href);toast("バックアップを書き出しました")};
window.importData=(input)=>{const file=input.files?.[0];if(!file)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!d.artists||!d.cds||!d.reservations)throw 0;showConfirm("データを読み込みますか？","現在のデータは読み込んだデータに置き換わります。",()=>{data=d;save();toast("データを読み込みました");go("home")})}catch(e){alert("正しいバックアップJSONではありません。")}};r.readAsText(file)}
window.clearAllData=()=>showConfirm("すべてのデータを削除しますか？","アーティスト、CD、予約がすべて削除されます。この操作は元に戻せません。",()=>{data=structuredClone(defaultData);save();toast("データを削除しました");go("home")});

render();
