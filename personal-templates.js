// Personal reusable snapshots. All data stays in this origin's browser storage.
// One key per new template prevents unrelated saves in other tabs being overwritten.
const PERSONAL_TEMPLATE_PREFIX='kmcu-ctl-mail:personal-template:v1:';
const personalTemplateState={entries:new Map(),selected:'',busy:false,readError:false};
const personalTemplatePanel=document.createElement('section');
personalTemplatePanel.id='personalTemplatePanel';personalTemplatePanel.className='saved-template-tools';personalTemplatePanel.setAttribute('aria-labelledby','personalTemplateHeading');
personalTemplatePanel.innerHTML=`<h2 id="personalTemplateHeading">내 템플릿 저장 · 관리</h2>
 <p class="hint">현재 내용을 이름을 붙여 보관하고 다시 사용할 수 있습니다. 이 기기·브라우저에만 저장되며, 브라우저 데이터를 지우면 사라집니다.</p>
 <form id="personalTemplateSaveForm"><label for="personalTemplateName">새 템플릿 이름</label><input id="personalTemplateName" maxlength="80" autocomplete="off" placeholder="예: 교수법 워크숍 · 참여 안내" required><button id="savePersonalTemplate" type="submit">현재 내용을 새 템플릿으로 저장</button></form>
 <label for="personalTemplateSelect">저장한 내 템플릿</label><select id="personalTemplateSelect" aria-describedby="personalTemplateStatus"></select>
 <div class="personal-template-actions"><button id="loadPersonalTemplate" type="button">불러오기</button><button id="renamePersonalTemplate" type="button">이름 변경</button><button id="deletePersonalTemplate" type="button" class="danger">삭제</button></div>
 <p id="personalTemplateStatus" class="hint" role="status" aria-live="polite"></p>`;
$('#personalTemplateSlot').replaceWith(personalTemplatePanel);
const personalTemplateStyle=document.createElement('style');
personalTemplateStyle.textContent='.saved-template-tools>h2{font-size:14px;font-weight:700;margin:7px 0}.saved-template-tools p{margin:4px 0 8px}.saved-template-tools label{display:block;margin:5px 0;font-weight:650}.saved-template-tools form{display:grid;gap:6px}.personal-template-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin-top:6px}.personal-template-actions button{min-width:0;min-height:40px;padding:8px 4px}.saved-template-tools [data-error="true"]{color:#b42335}@media(max-width:480px){.personal-template-actions{grid-template-columns:1fr 1fr}.personal-template-actions #loadPersonalTemplate{grid-column:1/-1}}';
document.head.appendChild(personalTemplateStyle);
function personalTemplateMessage(message,error=false){
 const output=$('#personalTemplateStatus');output.textContent=message;output.dataset.error=String(error);
}
function personalTemplateName(value){
 if(typeof value!=='string')throw Error('템플릿 이름을 입력해 주세요.');
 const name=value.trim();
 if(!name||name.length>80||/[\u0000-\u001f\u007f]/.test(name))throw Error('템플릿 이름은 1~80자의 한 줄로 입력해 주세요.');
 return name;
}
function personalTemplateRecord(raw,key){
 const record=JSON.parse(raw);
 if(!record||record.version!==1||typeof record.id!=='string'||key!==PERSONAL_TEMPLATE_PREFIX+record.id)throw Error('지원하지 않는 템플릿 저장 형식입니다.');
 personalTemplateName(record.name);
 if(!Number.isFinite(record.createdAt)||!Number.isFinite(record.updatedAt))throw Error('템플릿 저장 정보가 올바르지 않습니다.');
 prepareMailDocument(record.document);
 return record;
}
function personalTemplateRefresh({announce=true}={}){
 const entries=new Map();let damaged=0,legacyError=false;
 try{
  const keys=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(PERSONAL_TEMPLATE_PREFIX))keys.push(key);}
  for(const key of keys){
   const raw=localStorage.getItem(key);if(raw===null)continue;
   try{const record=personalTemplateRecord(raw,key);entries.set(key,{key,raw,name:record.name,document:record.document,record,legacy:false});}catch(_){damaged++;}
  }
  const raw=localStorage.getItem(CATALOG_STORAGE_KEY);
  if(raw){
   try{
    const legacy=JSON.parse(raw);if(!legacy||typeof legacy!=='object'||Array.isArray(legacy))throw Error('invalid legacy catalog');
    for(const name of Object.keys(legacy)){
     try{
      const source=legacy[name];if(!source||typeof source!=='object')throw Error('invalid legacy template');
      const family=['program','notice','survey'].includes(source.__kmcuTemplateFamily)?source.__kmcuTemplateFamily:'program';
      const document=prepareMailDocument({schema:1,template:family,data:source});delete document.data.__kmcuTemplateFamily;
      const key='legacy:'+name;entries.set(key,{key,raw:JSON.stringify(source),name,document,legacy:true});
     }catch(_){damaged++;}
    }
   }catch(_){legacyError=true;}
  }
  personalTemplateState.entries=entries;personalTemplateState.readError=false;
 }catch(_){
  personalTemplateState.readError=true;personalTemplateRender();
  personalTemplateMessage('브라우저 저장소에 접근할 수 없습니다. 브라우저의 사이트 데이터 설정을 확인한 뒤 다시 시도해 주세요. 현재 편집 내용은 유지됩니다.',true);return false;
 }
 personalTemplateRender();
 if(announce){
  if(damaged||legacyError)personalTemplateMessage('읽지 못한 저장 항목이 있습니다. 정상 항목만 표시하며 원본 저장 데이터는 변경하지 않았습니다.',true);
  else personalTemplateMessage(entries.size?`${entries.size}개 저장됨 · 불러온 뒤 편집해도 저장된 템플릿은 바뀌지 않습니다.`:'저장한 템플릿이 없습니다. 현재 내용을 먼저 저장해 보세요.');
 }
 return true;
}
function personalTemplateRender(){
 const select=$('#personalTemplateSelect'),previous=personalTemplateState.selected;
 select.replaceChildren();
 const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent=personalTemplateState.entries.size?'내 템플릿 선택':'저장한 템플릿 없음';select.appendChild(placeholder);
 const entries=[...personalTemplateState.entries.values()].sort((a,b)=>a.name.localeCompare(b.name,'ko')||a.key.localeCompare(b.key));
 for(const entry of entries){
  const option=document.createElement('option');option.value=entry.key;
  option.textContent=entry.name+' · '+({program:'프로그램',notice:'일반공지',survey:'수요조사'}[entry.document.template]||'양식')+(entry.legacy?' (이전 저장본)':'');select.appendChild(option);
 }
 personalTemplateState.selected=personalTemplateState.entries.has(previous)?previous:'';select.value=personalTemplateState.selected;
 const unavailable=personalTemplateState.busy||personalTemplateState.readError;
 select.disabled=unavailable||!entries.length;
 $('#savePersonalTemplate').disabled=unavailable;
 for(const id of ['loadPersonalTemplate','renamePersonalTemplate','deletePersonalTemplate'])$('#'+id).disabled=unavailable||!personalTemplateState.selected;
}
function personalTemplateSnapshot(){
 // Include unblurred text, rich marks, URL edits and Korean IME text without
 // ending composition or changing the current editor merely to save a copy.
 const snapshot=clone(data),find=target=>target===data?snapshot:snapshot.blocks.find(block=>block.id===target.id);
 const session=previewEditSession;
 if(currentPreviewSession(session)){
  const target=find(session.target);
  if(target){writePreviewValue(target,session.key,(session.node.innerText??session.node.textContent??'').replace(/\r\n?/g,'\n'));saveRichValue(target,session.key,session.node,readPreviewValue(target,session.key));}
 }
 if(currentInlineURL()){
  const session=urlEditSession,block=find(session.block);
  if(block){if(session.row)block[session.list||'links'][session.index][session.column??1]=session.node.value;else block[session.key]=session.node.value;}
 }
 const inline=inlineComposition;
 if(inline?.owner===data){
  const target=find(inline.target);
  if(target){if(inline.row&&inline.target[inline.list]?.[inline.index]===inline.row)target[inline.list][inline.index][inline.col]=inline.node.value;else if(!inline.row&&inline.key)target[inline.key]=inline.node.value;}
 }
 return prepareMailDocument({schema:1,template:current,data:snapshot});
}
async function personalTemplateAction(action){
 if(personalTemplateState.busy)return;
 personalTemplateState.busy=true;personalTemplateRender();
 try{await action();}
 catch(error){
  const quota=error?.name==='QuotaExceededError'||error?.name==='NS_ERROR_DOM_QUOTA_REACHED';
  personalTemplateMessage(quota?'브라우저 저장 공간이 부족해 저장하지 못했습니다. 필요 없는 내 템플릿을 삭제하거나 사진을 줄인 뒤 다시 시도해 주세요. 기존 템플릿과 현재 편집 내용은 유지됩니다.':(error?.name==='SecurityError'?'브라우저가 저장소 사용을 차단했습니다. 사이트 데이터 설정을 확인해 주세요.':error.message||'저장소 작업에 실패했습니다. 다시 시도해 주세요.'),true);
 }finally{personalTemplateState.busy=false;personalTemplateRender();}
}
function personalTemplateLocked(action){return navigator.locks?.request?navigator.locks.request('kmcu-ctl-mail:personal-templates',action):action();}
function personalTemplateUniqueName(name,except=''){
 if([...personalTemplateState.entries.values()].some(entry=>entry.key!==except&&entry.name.normalize('NFC')===name.normalize('NFC')))throw Error('같은 이름의 내 템플릿이 있습니다. 다른 이름으로 저장해 주세요.');
}
function personalTemplateCurrent(entry){
 if(!entry)throw Error('저장한 템플릿을 선택해 주세요.');
 if(entry.legacy){
  const raw=localStorage.getItem(CATALOG_STORAGE_KEY),catalog=JSON.parse(raw||'{}');
  if(!catalog||typeof catalog!=='object'||Array.isArray(catalog)||!Object.prototype.hasOwnProperty.call(catalog,entry.name)||JSON.stringify(catalog[entry.name])!==entry.raw)throw Error('다른 탭에서 이 템플릿을 변경했습니다. 목록을 다시 확인해 주세요.');
  return catalog;
 }
 if(localStorage.getItem(entry.key)!==entry.raw)throw Error('다른 탭에서 이 템플릿을 변경하거나 삭제했습니다. 목록을 다시 확인해 주세요.');
 return personalTemplateRecord(entry.raw,entry.key);
}
$('#personalTemplateSaveForm').addEventListener('submit',event=>{
 event.preventDefault();personalTemplateAction(()=>personalTemplateLocked(()=>{
  const name=personalTemplateName($('#personalTemplateName').value);
  if(!personalTemplateRefresh({announce:false}))return;personalTemplateUniqueName(name);
  const document=personalTemplateSnapshot(),id=globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),key=PERSONAL_TEMPLATE_PREFIX+id;
  if(localStorage.getItem(key)!==null)throw Error('저장 식별자가 중복되었습니다. 다시 시도해 주세요.');
  const now=Date.now(),record={version:1,id,name,createdAt:now,updatedAt:now,document};
  localStorage.setItem(key,JSON.stringify(record));personalTemplateState.selected=key;
  if(!personalTemplateRefresh({announce:false}))return;
  $('#personalTemplateName').value='';personalTemplateMessage('“'+name+'”을 저장했습니다. 현재 편집 내용과 기존 템플릿은 그대로 유지됩니다.');
 }));
});
$('#personalTemplateSelect').addEventListener('change',event=>{personalTemplateState.selected=event.target.value;personalTemplateRender();});
$('#loadPersonalTemplate').addEventListener('click',()=>personalTemplateAction(()=>{
 const entry=personalTemplateState.entries.get(personalTemplateState.selected);personalTemplateCurrent(entry);
 const next=prepareMailDocument(entry.document);
 if(!confirm('“'+entry.name+'”의 복사본을 불러올까요? 현재 작성 내용이 바뀝니다. 필요한 내용은 먼저 내 템플릿으로 저장해 주세요.'))return;
 personalTemplateCurrent(entry);
 // End old edit sessions before changing their document owner.
 finishInlineURL();finishInlineComposition();
 if(previewEditSession){previewEditSession.composing=false;syncPreviewText(previewEditSession);previewEditSession=null;}
 hideFormatToolbar();
 current=next.template;data=clone(next.data);activeCatalogName='';detachedTemplateSelection=true;
 deletedSections=[];refreshUndoButton();data.blocks.forEach(block=>block.id=id());renderAll();
 personalTemplateMessage('“'+entry.name+'”의 복사본을 불러왔습니다. 편집해도 저장된 원본은 바뀌지 않습니다.');
}));
$('#renamePersonalTemplate').addEventListener('click',()=>{
 const entry=personalTemplateState.entries.get(personalTemplateState.selected);if(!entry)return;
 const answer=prompt('내 템플릿의 새 이름을 입력해 주세요. (최대 80자)',entry.name);if(answer===null)return;
 personalTemplateAction(()=>personalTemplateLocked(()=>{
  const name=personalTemplateName(answer);if(name===entry.name)return;
  personalTemplateCurrent(entry);if(!personalTemplateRefresh({announce:false}))return;personalTemplateUniqueName(name,entry.key);
  if(entry.legacy){
   const catalog=personalTemplateCurrent(entry);Object.defineProperty(catalog,name,{value:catalog[entry.name],enumerable:true,writable:true,configurable:true});delete catalog[entry.name];
   localStorage.setItem(CATALOG_STORAGE_KEY,JSON.stringify(catalog));customPrograms=catalog;personalTemplateState.selected='legacy:'+name;
  }else{
   const record=personalTemplateCurrent(entry);record.name=name;record.updatedAt=Date.now();localStorage.setItem(entry.key,JSON.stringify(record));
  }
  if(!personalTemplateRefresh({announce:false}))return;
  personalTemplateMessage('이름을 “'+name+'”으로 변경했습니다. 현재 편집 내용은 유지됩니다.');
 }));
});
$('#deletePersonalTemplate').addEventListener('click',()=>{
 const entry=personalTemplateState.entries.get(personalTemplateState.selected);if(!entry)return;
 if(!confirm('내 템플릿 “'+entry.name+'”을 삭제할까요? 저장한 템플릿은 복구할 수 없지만, 현재 편집 중인 내용과 기본 제공 양식은 유지됩니다.'))return;
 personalTemplateAction(()=>personalTemplateLocked(()=>{
  const stored=personalTemplateCurrent(entry);
  if(entry.legacy){delete stored[entry.name];localStorage.setItem(CATALOG_STORAGE_KEY,JSON.stringify(stored));customPrograms=stored;}
  else localStorage.removeItem(entry.key);
  personalTemplateState.selected='';if(!personalTemplateRefresh({announce:false}))return;
  personalTemplateMessage('“'+entry.name+'”을 삭제했습니다. 현재 편집 내용과 기본 제공 양식은 유지됩니다.');
 }));
});
window.addEventListener('storage',event=>{if(event.key===null||event.key===CATALOG_STORAGE_KEY||event.key?.startsWith(PERSONAL_TEMPLATE_PREFIX)){personalTemplateRefresh();}});
window.addEventListener('focus',()=>{if(!personalTemplateState.busy)personalTemplateRefresh({announce:false});});
personalTemplateRefresh();
