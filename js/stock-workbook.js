/* Stock: vista de trabajo basada en el Excel original. */
(() => {
  const $ = id => document.getElementById(id);
  const COLS = 21;
  const colName = n => { let s=''; while(n){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26);}return s; };
  const addr = (r,c) => colName(c)+r;
  let cells = {}, rowCount = 95, colCount = COLS, saving = false, dirty = false, saveTimer = null, weekBlocks = [];

  function numberOf(v){ if(v===null||v===undefined||v==='')return 0; const n=Number(v); return Number.isFinite(n)?n:0; }
  function evalCell(ref, seen=new Set()) {
    if(seen.has(ref)) return '#REF!';
    const raw=cells[ref];
    if(typeof raw!=='string'||!raw.startsWith('=')) return raw===undefined||raw===null||raw===''?0:raw;
    seen.add(ref);
    let expr=raw.slice(1).replace(/SUM\(([A-Z]{1,2}\d+):([A-Z]{1,2}\d+)\)/gi,(_,a,b)=>{
      const parse=x=>{const m=x.match(/^([A-Z]+)(\d+)$/);let c=0;for(const ch of m[1])c=c*26+ch.charCodeAt(0)-64;return {r:+m[2],c};};
      const p=parse(a),q=parse(b);let sum=0;
      for(let r=Math.min(p.r,q.r);r<=Math.max(p.r,q.r);r++)for(let c=Math.min(p.c,q.c);c<=Math.max(p.c,q.c);c++)sum+=numberOf(evalCell(addr(r,c),new Set(seen)));
      return String(sum);
    });
    expr=expr.replace(/\b([A-Z]{1,2}\d{1,3})\b/g,ref2=>String(numberOf(evalCell(ref2,new Set(seen)))));
    const tokens=expr.match(/\d+(?:\.\d+)?|[()+\-*/]/g)||[];
    let i=0;
    function factor(){const t=tokens[i++];if(t==='('){const v=term();if(tokens[i]===')')i++;return v;}if(t==='-')return -factor();if(t==='+')return factor();return Number(t)||0;}
    function term(){let v=factor();while(tokens[i]==='*'||tokens[i]==='/'){const op=tokens[i++],b=factor();v=op==='*'?v*b:(b===0?0:v/b);}return v;}
    function sum(){let v=term();while(tokens[i]==='+'||tokens[i]==='-'){const op=tokens[i++],b=term();v=op==='+'?v+b:v-b;}return v;}
    const result=sum();seen.delete(ref);return Number.isFinite(result)?result:'#ERROR';
  }
  function display(v){if(v===null||v===undefined||v==='')return '';if(typeof v==='number')return Number.isInteger(v)?String(v):String(Math.round(v*100)/100);return String(v);}
  function isFormula(v){return typeof v==='string'&&v.startsWith('=');}
  function addDefaultFormulas(target){
    target.C9='=200-17';target.C11='=225+30';
    for(let r=5;r<=11;r++){target['D'+r]='=(B'+r+'*200)+C'+r;target['H'+r]='=G'+r+'*200';target['Q'+r]='=N'+r+'+K'+r+'+H'+r+'+D'+r;target['U'+r]='=Q'+r+'-T'+r;}
    target.B16='=5*200';target.C16='=16+2137';target.B18='=20*200';target.B19='=17*200';target.B20='=6*200';
    const hRefs=['H94','G94','F94','E94','D94','C94','B94'], kRefs=['P94','O94','N94','M94','L94','K94','J94'];
    for(let i=0;i<7;i++){const r=15+i,inv=5+i;target['H'+r]='='+hRefs[i];target['K'+r]='='+kRefs[i];target['N'+r]='=H'+r+'+K'+r;target['Q'+r]='=D'+inv+'+H'+inv+'+K'+inv+'+N'+r;target['T'+r]='=E'+r+'-N'+r+'-B'+r+'+C'+r;target['U'+r]='=Q'+r+'-T'+r;}
    const weeks=[[38,31,37],[49,42,48],[60,53,59],[71,64,70],[82,75,81],[92,85,91]];
    for(const [total,start,end] of weeks){
      for(let c=2;c<=8;c++){const col=colName(c);target[col+total]='='+Array.from({length:end-start+1},(_,i)=>col+(start+i)).join('+');}
      target['I'+total]='='+['B','C','D','E','F','G'].map(c=>c+total).join('+');
      for(let c=10;c<=16;c++){const col=colName(c);target[col+total]='='+Array.from({length:end-start+1},(_,i)=>col+(start+i)).join('+');}
      target['Q'+total]='='+['O','N','M','L','K','J'].map(c=>c+total).join('+');
    }
    for(let c=2;c<=16;c++){const col=colName(c);target[col+'94']='='+[92,82,71,60,49,38].map(r=>col+r).join('+');}
    return target;
  }
  function editable(r,c,v){
    if(isFormula(v))return false;
    if(r>=5&&r<=21&&[2,3,7,11,14,20].includes(c))return true;
    const dayRows=[[31,37],[42,48],[53,59],[64,70],[75,81],[85,91]];
    if(dayRows.some(([a,b])=>r>=a&&r<=b)&&((c>=2&&c<=8)||(c>=10&&c<=16)||c===1))return true;
    return false;
  }
  function cellClass(r,c,v){
    const classes=[];
    if([1,3,4,13,14,26,28,29,30,39,40,41,50,51,52,61,62,63,72,73,74,83,84,93].includes(r))classes.push('sw-row-heading');
    if(isFormula(v))classes.push('sw-formula');
    if(editable(r,c,v))classes.push('sw-input-cell');
    if(c===9||c===18)classes.push('sw-gap');
    if(r>=5&&r<=21)classes.push('sw-inventory');
    return classes.join(' ');
  }
  function render(){
    renderWeekBlocks();
    const host=$('stockWorkbookGrid'); if(!host)return;
    let html='<table class="stock-workbook-table"><thead><tr><th class="sw-corner">#</th>';
    for(let c=1;c<=colCount;c++)html+='<th>'+colName(c)+'</th>';
    html+='</tr></thead><tbody>';
    for(let r=1;r<=rowCount;r++){
      html+='<tr><th class="sw-row-num">'+r+'</th>';
      for(let c=1;c<=colCount;c++){
        const a=addr(r,c),v=cells[a],val=isFormula(v)?evalCell(a):v, cls=cellClass(r,c,v);
        if(editable(r,c,v)){
          const type=(c===1&&typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v))?'date':'number';
          const inputValue=type==='date'?(v||''):display(v);
          html+='<td class="'+cls+'"><input aria-label="'+a+'" data-sw-cell="'+a+'" type="'+type+'" '+(type==='number'?'step="1" inputmode="numeric"':'')+' value="'+String(inputValue).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')+'"></td>';
        } else {
          html+='<td class="'+cls+'" title="'+(isFormula(v)?String(v).replace(/"/g,'&quot;'):'')+'">'+display(val).replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</td>';
        }
      }
      html+='</tr>';
    }
    html+='</tbody></table>';host.innerHTML=html;
    host.querySelectorAll('[data-sw-cell]').forEach(inp=>inp.addEventListener('input',()=>{
      const a=inp.dataset.swCell;
      cells[a]=inp.value===''?'':(inp.type==='number'?Number(inp.value):inp.value);
      dirty=true;updateStatus('Hay cambios sin guardar…');renderKeepFocus(a,inp.selectionStart);
      if(saveTimer)clearTimeout(saveTimer);saveTimer=setTimeout(()=>save(false),800);
    }));
    updateStatus(dirty?'Hay cambios sin guardar…':'Excel cargado · fórmulas activas');
  }
  function renderKeepFocus(a,pos){const host=$('stockWorkbookGrid');const input=host.querySelector('[data-sw-cell="'+a+'"]');if(!input)return;const old=host.scrollTop,left=host.scrollLeft;render();const fresh=host.querySelector('[data-sw-cell="'+a+'"]');if(fresh){fresh.focus();try{fresh.setSelectionRange(pos,pos)}catch(e){}}host.scrollTop=old;host.scrollLeft=left;}
  function updateStatus(t){const el=$('stockWorkbookStatus');if(el)el.textContent=t;}
  async function api(path,method='GET',body){
    const token=window.__CONTROL_HORARIO_TOKEN__;
    const res=await fetch(path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||'Error de conexión');return data;
  }
  async function save(showMessage=true){
    if(saving)return false;saving=true;
    try{await api('/api/stock/workbook','PUT',{workbook:{rows:rowCount,cols:colCount,cells,weekBlocks}});dirty=false;updateStatus('Guardado correctamente · '+new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}));if(showMessage)alert('Stock guardado correctamente.');return true;}
    catch(e){updateStatus('No se pudo guardar: '+e.message);return false;}finally{saving=false;}
  }
  function importWorkbook(file){
    if(!file)return;
    const reader=new FileReader();
    reader.onload=async e=>{
      try{
        const workbook=XLSX.read(e.target.result,{type:'array',cellDates:true,cellFormula:true});
        const sheet=workbook.Sheets[workbook.SheetNames[0]], range=XLSX.utils.decode_range(sheet['!ref']||'A1:U95');
        const next={};
        for(let r=range.s.r;r<=range.e.r;r++)for(let c=range.s.c;c<=range.e.c;c++){
          const a=XLSX.utils.encode_cell({r,c}),cell=sheet[a];if(!cell)continue;
          if(cell.f)next[a]='='+cell.f;
          else if(cell.v instanceof Date)next[a]=cell.v.toISOString().slice(0,10);
          else if(cell.v!==undefined&&cell.v!==null)next[a]=cell.v;
        }
        cells=next;rowCount=Math.max(95,range.e.r+1);colCount=Math.max(21,range.e.c+1);dirty=true;render();updateStatus('Excel importado; guardando datos iniciales…');
        const ok=await save(false);if(ok)updateStatus('Excel importado y guardado · fórmulas activas');
      }catch(err){updateStatus('No se pudo leer el Excel: '+err.message);}
    };
    reader.readAsArrayBuffer(file);
  }

  function escText(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
  function dateRangeDays(start,end){
    const out=[];let d=new Date(start+'T12:00:00'),last=new Date(end+'T12:00:00');
    while(d<=last&&out.length<62){out.push(d.toISOString().slice(0,10));d.setDate(d.getDate()+1);}return out;
  }
  function renderWeekBlocks(){
    const host=$('stockWeekBlocks');if(!host)return;
    host.innerHTML=weekBlocks.map((b,bi)=>{
      const days=dateRangeDays(b.start,b.end);
      return '<section class="stock-week-card"><div class="stock-week-card-head"><div><strong>'+escText(b.name||'Bloque semanal')+'</strong><br><span>'+escText(b.start)+' — '+escText(b.end)+' · '+days.length+' días</span></div><button class="stock-week-delete" type="button" data-delete-week="'+bi+'">Eliminar</button></div><div style="overflow-x:auto"><table><thead><tr><th>Fecha</th><th>Mostrador (pares)</th><th>Cumples (pares)</th><th>Total</th></tr></thead><tbody>'+days.map(day=>{const row=b.days?.[day]||{counter:0,birthday:0};return '<tr><td>'+day+'</td><td><input type="number" min="0" step="1" data-week="'+bi+'" data-day="'+day+'" data-kind="counter" value="'+Number(row.counter||0)+'"></td><td><input type="number" min="0" step="1" data-week="'+bi+'" data-day="'+day+'" data-kind="birthday" value="'+Number(row.birthday||0)+'"></td><td><strong>'+ (Number(row.counter||0)+Number(row.birthday||0))+'</strong></td></tr>';}).join('')+'</tbody></table></div></section>';
    }).join('');
    host.querySelectorAll('[data-week][data-day]').forEach(inp=>inp.addEventListener('change',()=>{
      const b=weekBlocks[Number(inp.dataset.week)],day=inp.dataset.day,kind=inp.dataset.kind;
      b.days=b.days||{};b.days[day]=b.days[day]||{counter:0,birthday:0};b.days[day][kind]=Math.max(0,Number(inp.value)||0);
      dirty=true;renderWeekBlocks();updateStatus('Bloques modificados; guardando…');if(saveTimer)clearTimeout(saveTimer);saveTimer=setTimeout(()=>save(false),500);
    }));
    host.querySelectorAll('[data-delete-week]').forEach(btn=>btn.addEventListener('click',()=>{
      if(!confirm('¿Eliminar este bloque semanal?'))return;weekBlocks.splice(Number(btn.dataset.deleteWeek),1);dirty=true;renderWeekBlocks();save(false);
    }));
  }
  let weekDialogBound=false;
  function setupWeekBlockDialog(){
    if(weekDialogBound)return;weekDialogBound=true;
    const dialog=$('stockWeekBlockDialog'),form=$('stockWeekBlockForm');if(!dialog||!form)return;
    $('stockAddWeekBlock')?.addEventListener('click',()=>{const now=new Date(),start=new Date(now);start.setDate(now.getDate()-((now.getDay()+6)%7));const end=new Date(start);end.setDate(start.getDate()+6);$('stockWeekStart').value=start.toISOString().slice(0,10);$('stockWeekEnd').value=end.toISOString().slice(0,10);$('stockWeekBlockName').value='Semana '+(weekBlocks.length+1);dialog.classList.remove('hidden');});
    $('stockWeekCancel')?.addEventListener('click',()=>dialog.classList.add('hidden'));
    form.addEventListener('submit',e=>{e.preventDefault();const start=$('stockWeekStart').value,end=$('stockWeekEnd').value;if(!start||!end||end<start){alert('El rango de fechas no es válido.');return;}const days={};dateRangeDays(start,end).forEach(d=>days[d]={counter:0,birthday:0});weekBlocks.push({name:$('stockWeekBlockName').value.trim()||'Bloque semanal',start,end,days});dialog.classList.add('hidden');dirty=true;renderWeekBlocks();updateStatus('Bloque añadido; guardando…');save(false);});
  }
  async function init(){
    setupWeekBlockDialog();
    const panel=$('stockWorkbookPanel');if(!panel)return;
    $('stockWorkbookImport')?.addEventListener('change',e=>importWorkbook(e.target.files?.[0]));
    $('stockWorkbookSave')?.addEventListener('click',()=>save(true));
    $('stockWorkbookPrint')?.addEventListener('click',()=>window.print());
    try{
      const data=await api('/api/stock/workbook');
      if(data.workbook&&data.workbook.cells){cells=data.workbook.cells;rowCount=data.workbook.rows||95;colCount=data.workbook.cols||21;weekBlocks=Array.isArray(data.workbook.weekBlocks)?data.workbook.weekBlocks:[];render();}
      else if(window.STOCK_WORKBOOK_INITIAL){weekBlocks=[];cells=addDefaultFormulas({...window.STOCK_WORKBOOK_INITIAL.cells});rowCount=window.STOCK_WORKBOOK_INITIAL.rows||95;colCount=window.STOCK_WORKBOOK_INITIAL.cols||21;dirty=true;render();updateStatus('Cargando los datos originales del Excel…');await save(false);}else{cells={};rowCount=95;colCount=21;render();updateStatus('Carga el archivo Calcetines 2026-10.xlsx para importar datos y fórmulas.');}
    }catch(e){cells={};rowCount=95;colCount=21;render();updateStatus('Esperando sesión de administrador para cargar/guardar el Excel.');}
  }
  document.addEventListener('click',e=>{
    const tab=e.target.closest('.section-tab[data-section="stockWorkbookPanel"]');
    if(tab&&window.__CONTROL_HORARIO_USER__?.role==='admin')setTimeout(init,50);
  });
  document.addEventListener('DOMContentLoaded',init);
  window.StockWorkbook={save,render};
})();