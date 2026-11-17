const fs=require('node:fs'),{JSDOM,VirtualConsole}=require('jsdom'); const {IDBFactory,IDBKeyRange}=require('fake-indexeddb');
exports.launch=async (file,{db=new IDBFactory(),confirm=()=>true,prompt=()=>null,onBoot}={})=>{
 const errors=[]; const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e));
 const dom=new JSDOM(fs.readFileSync(file,'utf8'),{url:'https://test.example/kmcu-ctl-mail/',virtualConsole:vc,runScripts:'dangerously',pretendToBeVisual:true,beforeParse(w){
 Object.assign(w,{indexedDB:db,IDBKeyRange,confirm,prompt,alert:(s)=>errors.push(Error('Alert: '+s)),scrollTo:()=>{},matchMedia:()=>({matches:true,addListener(){},addEventListener(){}})}); if(onBoot)onBoot(w);
 }});
 const w=dom.window; await exports.until(()=>{if(errors.length)throw errors[0];return w.document.querySelector('#draftLoading')?.hidden});return {dom,w,errors};
};
exports.until=async(fn)=>{for(let i=0;i<150;i++){if(fn())return;await new Promise(r=>setTimeout(r,20))}throw Error('timed out')};
if(require.main===module)(async()=>{const x=await exports.launch(process.argv[2]); console.log(x.w.document.querySelector('#draftStatus').textContent);console.log(x.errors.map(e=>e.message));x.w.close()})().catch(e=>{console.error(e);process.exitCode=1});
