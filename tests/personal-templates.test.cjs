const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {launch,until}=require('./harness.cjs');
const file=path.resolve(__dirname,'../index.html'),prefix='kmcu-ctl-mail:personal-template:v1:',legacy='kmcu_ct_email_custom_programs_v1';
let passed=0;const cases=[];
function test(name,fn){cases.push([name,fn]);}
async function setup(options={}){const x=await launch(file,options);x.$=s=>x.w.document.querySelector(s);x.eval=s=>x.w.eval(s);return x;}
async function click(x,id){x.$(id).click();await until(()=>!x.eval('personalTemplateState.busy'));}
async function save(x,name){x.$('#personalTemplateName').value=name;x.$('#personalTemplateSaveForm').dispatchEvent(new x.w.Event('submit',{bubbles:true,cancelable:true}));await until(()=>!x.eval('personalTemplateState.busy'));}
function keys(x){return Object.keys(x.w.localStorage).filter(k=>k.startsWith(prefix));}
function status(x){return x.$('#personalTemplateStatus').textContent;}
function select(x,key){x.$('#personalTemplateSelect').value=key;x.$('#personalTemplateSelect').dispatchEvent(new x.w.Event('change',{bubbles:true}));}
function model(x){return JSON.parse(x.eval('JSON.stringify(data)'));}
function normalized(value){const result=JSON.parse(JSON.stringify(value));result.blocks.forEach(b=>delete b.id);return result;}
async function closed(x,fn){try{await fn();assert.deepEqual(x.errors.map(e=>e.message),[]);}finally{x.w.close();}}

test('bundle matches runtime and all script syntax is valid',async()=>{
 const html=fs.readFileSync(file,'utf8'),runtime=fs.readFileSync(path.resolve(__dirname,'../personal-templates.js'),'utf8');
 assert.ok(html.includes('// BEGIN PERSONAL TEMPLATES\n'+runtime+'// END PERSONAL TEMPLATES\n'));
 new Function(html.split('<script>')[1].split('</script>')[0]);
});
test('save/load/independent edit, formatting, card links, themes and fields round-trip',async()=>{
 const x=await setup();await closed(x,async()=>{
  assert.equal(x.$('#loadPersonalTemplate').disabled,true);
  x.eval(`data.headline='개인 양식';data.headerChoice='winter';data.themePrimary='#123456';data.themeBackground='#fef0ee';data.richText=JSON.stringify({headline:{text:'개인 양식',html:'<strong>개인</strong> 양식'}});let card=data.blocks.find(b=>b.type==='card');card.links=[['새 자료','https://example.com/doc']];card.rows[0].push('행 버튼','https://example.com/row');data.blocks[0].hidden=true;update();`);
  const before=model(x),html=x.eval('build(false)');await save(x,'매월 안내');assert.equal(keys(x).length,1);assert.deepEqual(model(x),before);
  const key=keys(x)[0],raw=x.w.localStorage.getItem(key);assert.match(status(x),/저장했습니다/);
  x.eval(`data.headline='변경된 편집';data.blocks[1].links[0][0]='바뀐 자료';update()`);
  await click(x,'#loadPersonalTemplate');assert.deepEqual(normalized(model(x)),normalized(before));assert.equal(x.eval('build(false)'),html);
  x.eval(`data.headline='복사본만 수정';update()`);assert.equal(x.w.localStorage.getItem(key),raw);
  await click(x,'#loadPersonalTemplate');assert.equal(model(x).headline,'개인 양식');
 });
});
test('local storage reload restores saved list and preserves current draft separately',async()=>{
 const x=await setup();x.eval(`data.headline='원본';update()`);await save(x,'재사용');const storage=Object.fromEntries(Object.keys(x.w.localStorage).map(k=>[k,x.w.localStorage.getItem(k)]));x.w.close();
 const y=await setup({onBoot:w=>Object.entries(storage).forEach(([k,v])=>w.localStorage.setItem(k,v))});await closed(y,async()=>{
  assert.equal(keys(y).length,1);assert.equal(y.$('#personalTemplateSelect').options.length,2);select(y,keys(y)[0]);await click(y,'#loadPersonalTemplate');assert.equal(model(y).headline,'원본');
 });
});
test('duplicate/empty/overlong names never overwrite; built-in names are independent',async()=>{
 const x=await setup();await closed(x,async()=>{
  await save(x,'혁신적 교수법');const raw=x.w.localStorage.getItem(keys(x)[0]);await save(x,'혁신적 교수법');assert.equal(keys(x).length,1);assert.equal(x.w.localStorage.getItem(keys(x)[0]),raw);assert.match(status(x),/같은 이름/);
  await save(x,'   ');assert.equal(keys(x).length,1);await save(x,'x'.repeat(81));assert.equal(keys(x).length,1);
  assert.equal(x.$('#templateSelect').querySelectorAll('option[value="p:혁신적 교수법"]').length,1);
 });
});
test('rename and delete are isolated; canceled dialogs preserve stored/current data',async()=>{
 let answer='이름 변경',yes=false;const x=await setup({prompt:()=>answer,confirm:()=>yes});await closed(x,async()=>{
  await save(x,'첫 양식');const key=keys(x)[0],before=model(x);await click(x,'#renamePersonalTemplate');assert.equal(JSON.parse(x.w.localStorage.getItem(key)).name,'이름 변경');assert.deepEqual(model(x),before);
  answer=null;await click(x,'#renamePersonalTemplate');assert.equal(JSON.parse(x.w.localStorage.getItem(key)).name,'이름 변경');
  x.eval(`data.headline='보존할 편집';update()`);await click(x,'#loadPersonalTemplate');assert.equal(model(x).headline,'보존할 편집');
  await click(x,'#deletePersonalTemplate');assert.equal(keys(x).length,1);yes=true;await click(x,'#deletePersonalTemplate');assert.equal(keys(x).length,0);assert.equal(model(x).headline,'보존할 편집');assert.equal(x.$('#deletePersonalTemplate').disabled,true);
 });
});
test('legacy templates remain loadable and builtin canonical versions remain available',async()=>{
 const base=await setup(),doc=model(base);base.w.close();doc.headline='이전 저장 원본';doc.__kmcuTemplateFamily='notice';
 let answer='이전 양식 이름 변경';const x=await setup({prompt:()=>answer,onBoot:w=>w.localStorage.setItem(legacy,JSON.stringify({'혁신적 교수법':doc}))});await closed(x,async()=>{
  select(x,'legacy:혁신적 교수법');await click(x,'#loadPersonalTemplate');assert.equal(x.eval('current'),'notice');assert.equal(model(x).headline,'이전 저장 원본');
  x.$('#templateSelect').value='p:혁신적 교수법';x.$('#templateSelect').dispatchEvent(new x.w.Event('change'));assert.equal(x.eval('current'),'program');assert.notEqual(model(x).headline,'이전 저장 원본');
  select(x,'legacy:혁신적 교수법');await click(x,'#renamePersonalTemplate');assert.ok(JSON.parse(x.w.localStorage.getItem(legacy))[answer]);assert.equal(model(x).headline,'혁신적 교수법 신청 안내');
  await click(x,'#deletePersonalTemplate');assert.deepEqual(JSON.parse(x.w.localStorage.getItem(legacy)),{});assert.ok(x.$('#templateSelect').querySelector('option[value="p:혁신적 교수법"]'));
 });
});
test('quota failure does not change existing records or current data',async()=>{
 const x=await setup();await closed(x,async()=>{
  await save(x,'원본');const before=model(x),storage=Object.fromEntries(Object.entries(x.w.localStorage));const original=x.w.Storage.prototype.setItem;
  x.w.Storage.prototype.setItem=function(k,v){if(k.startsWith(prefix))throw new x.w.DOMException('Quota','QuotaExceededError');return original.call(this,k,v);};
  await save(x,'저장 실패');assert.match(status(x),/공간이 부족/);assert.deepEqual(Object.fromEntries(Object.entries(x.w.localStorage)),storage);assert.deepEqual(model(x),before);
 });
});
test('corrupt/unknown records are untouched while valid data remains usable',async()=>{
 const invalid=prefix+'bad';const x=await setup({onBoot:w=>{w.localStorage.setItem(invalid,'{broken');w.localStorage.setItem(legacy,'{broken');}});await closed(x,async()=>{
  assert.match(status(x),/읽지 못한/);await save(x,'정상 양식');assert.equal(keys(x).length,2);assert.equal(x.w.localStorage.getItem(invalid),'{broken');assert.equal(x.w.localStorage.getItem(legacy),'{broken');
 });
});
test('blocked storage is reported without disabling the mailing editor',async()=>{
 const x=await setup({onBoot:w=>{w.Storage.prototype.getItem=function(){throw new w.DOMException('blocked','SecurityError')};}});await closed(x,async()=>{
  assert.match(status(x),/접근할 수 없습니다/);assert.equal(x.$('#savePersonalTemplate').disabled,true);assert.equal(x.$('main').inert,false);x.eval(`data.headline='여전히 편집 가능';update()`);assert.equal(model(x).headline,'여전히 편집 가능');
 });
});
test('other-tab updates refresh list; stale deletion is rejected safely',async()=>{
 const x=await setup();await closed(x,async()=>{
  await save(x,'첫 번째');const key=keys(x)[0],record=JSON.parse(x.w.localStorage.getItem(key));record.name='다른 탭 수정';x.w.localStorage.setItem(key,JSON.stringify(record));
  await click(x,'#deletePersonalTemplate');assert.ok(x.w.localStorage.getItem(key));assert.match(status(x),/다른 탭/);
  x.w.dispatchEvent(new x.w.StorageEvent('storage',{key,newValue:JSON.stringify(record)}));assert.match(x.$('#personalTemplateSelect').textContent,/다른 탭 수정/);
 });
});
test('unblurred IME/rich text is snapshotted without ending the edit session',async()=>{
 const x=await setup();await closed(x,async()=>{
  x.eval(`const n=document.createElement('span');n.dataset.editBlock='main';n.dataset.editKey='headline';n.innerHTML='<strong>입력 중인 문장</strong>';document.body.appendChild(n);previewEditSession={owner:data,node:n,target:data,key:'headline',composing:true};`);
  const original=model(x).headline;await save(x,'입력 중 저장');const stored=JSON.parse(x.w.localStorage.getItem(keys(x)[0]));assert.equal(stored.document.data.headline,'입력 중인 문장');assert.match(stored.document.data.richText,/<strong>/);assert.equal(model(x).headline,original);assert.equal(x.eval('previewEditSession.composing'),true);
 });
});
test('all built-in families remain renderable with safe final output',async()=>{
 const x=await setup();await closed(x,async()=>{
  for(const family of ['program','notice','survey']){x.eval(`newTemplate('${family}')`);await save(x,family);await click(x,'#loadPersonalTemplate');assert.equal(x.eval('current'),family);const html=x.eval('build(false)');assert.ok(html.startsWith('<!DOCTYPE html>'));assert.ok(!html.includes('personalTemplate'));assert.ok(!html.includes('contenteditable='));assert.ok(!html.includes('data-direct-row'));assert.ok(x.$('#contextEditor').hidden);}
 });
});
test('43 built-in template/header exports match pre-change SHA-256 fixtures',async()=>{
 const hashes=require('./export-hashes.json'),crypto=require('node:crypto'),x=await setup();await closed(x,async()=>{
  for(const [key,expected] of Object.entries(hashes)){
   const at=key.lastIndexOf(':'),name=key.slice(0,at),header=key.slice(at+1);
   if(['program','notice','survey'].includes(name))x.eval(`newTemplate(${JSON.stringify(name)})`);else x.eval(`loadCatalogProgram(${JSON.stringify(name)},{builtIn:true})`);
   x.eval(`data.headerChoice=${JSON.stringify(header)}`);
   assert.equal(crypto.createHash('sha256').update(x.eval('build(false)')).digest('hex'),expected,key);
  }
 });
});
(async()=>{for(const [name,fn] of cases){await fn();passed++;console.log('PASS '+name);}console.log(`${passed} suites passed`);})().catch(error=>{console.error(error);process.exitCode=1;});
