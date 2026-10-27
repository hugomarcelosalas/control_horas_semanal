/* Stock: vista de trabajo basada en el Excel original. */
(() => {
  const $ = id => document.getElementById(id);
  const COLS = 21;
  const colName = n => { let s=''; while(n){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26);}return s; };
  const addr = (r,c) => colName(c)+r;
  let cells = {}, rowCount = 95, colCount = COLS, saving = false, dirty = false, saveTimer = null;

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
  function editable(r,c,v){
    if(isFormula(v))return false;
    if(r>=5&&r<=21&&[2,3,7,11,14,20].includes(c))return true;
    const dayRows=[[31,37],[42,48],[53,59],[64,70],[75,81],[85,91]];
    if(dayRows.some(([a,b])=>r>=a&&r<=b)&&((c>=2&&c<=8)||(c>=10&&c<=16)))return true;
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
    try{await api('/api/stock/workbook','PUT',{workbook:{rows:rowCount,cols:colCount,cells}});dirty=false;updateStatus('Guardado correctamente · '+new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}));if(showMessage)alert('Stock guardado correctamente.');return true;}
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
  async function init(){
    const panel=$('stockWorkbookPanel');if(!panel)return;
    $('stockWorkbookImport')?.addEventListener('change',e=>importWorkbook(e.target.files?.[0]));
    $('stockWorkbookSave')?.addEventListener('click',()=>save(true));
    $('stockWorkbookPrint')?.addEventListener('click',()=>window.print());
    try{
      const data=await api('/api/stock/workbook');
      if(data.workbook&&data.workbook.cells){cells=data.workbook.cells;rowCount=data.workbook.rows||95;colCount=data.workbook.cols||21;render();}
      else{cells={};rowCount=95;colCount=21;render();updateStatus('Carga el archivo Calcetines 2026-10.xlsx para importar datos y fórmulas.');}
    }catch(e){cells={};rowCount=95;colCount=21;render();updateStatus('Esperando sesión de administrador para cargar/guardar el Excel.');}
  }
  document.addEventListener('click',e=>{
    const tab=e.target.closest('.section-tab[data-section="stockWorkbookPanel"]');
    if(tab&&window.__CONTROL_HORARIO_USER__?.role==='admin')setTimeout(init,50);
  });
  document.addEventListener('DOMContentLoaded',init);
  window.StockWorkbook={save,render};
})();