/* Stock: vista de trabajo basada en el Excel original. */
(() => {
  const $ = id => document.getElementById(id);
  const COLS = 21;
  const colName = n => { let s=''; while(n){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26);}return s; };
  const addr = (r,c) => colName(c)+r;
  let cells = {}, rowCount = 95, colCount = COLS, saving = false, dirty = false, saveTimer = null, weekBlocks = [], stockMovements = [], stockWarehouses = ['Bajo escaleras','Bajo parque','Mostrador','Cumpleaños'], showWarehouseForm = false, showMovementForm = false;

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
    renderMetrics();
    renderReconciliation();
    renderMovements();
    renderStockCards();
    renderWeekBlocks();
    const host=$('stockWorkbookGrid'); if(!host)return;
    host.style.display='none';
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
    try{await api('/api/stock/workbook','PUT',{workbook:{rows:rowCount,cols:colCount,cells,weekBlocks,stockMovements,stockWarehouses}});dirty=false;updateStatus('Guardado correctamente · '+new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}));if(showMessage)alert('Stock guardado correctamente.');return true;}
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



  function renderMetrics(){
    const host=$('stockMetrics');if(!host)return;
    const total=col=>{let n=0;for(let r=5;r<=11;r++){const a=col+r,v=cells[a];n+=numberOf(isFormula(v)?evalCell(a):v);}return n;};
    const items=[['Bajo escaleras',total('D'),'blue'],['Bajo parque',total('H'),'green'],['Mostrador',total('K'),'amber'],['Cumpleaños',total('N'),'purple']];
    host.innerHTML=items.map(x=>'<div class="stock-metric '+x[2]+'"><span>'+x[0]+'</span><strong>'+Math.round(x[1]).toLocaleString('es-ES')+'</strong><small>Pares en inventario</small></div>').join('');
    const aside=$('stockMovementSummary'),warehouseHost=$('stockWarehouseMovementSummary');
    let a=0,b=0;weekBlocks.forEach(w=>Object.values(w.days||{}).forEach(d=>{a+=numberOf(d.counter);b+=numberOf(d.birthday);}));
    const sizes=['XXL','XL','L','M','S','XS','XXS'];
    const movementTotals={ingreso:Object.fromEntries(sizes.map(s=>[s,0])),egreso:Object.fromEntries(sizes.map(s=>[s,0])),warehouseIn:Object.fromEntries(sizes.map(s=>[s,0])),warehouseOut:Object.fromEntries(sizes.map(s=>[s,0]))};
    stockMovements.forEach(m=>{const type=m.type==='ingreso'?'ingreso':m.type==='egreso'?'egreso':null;const quantities=m.quantities&&typeof m.quantities==='object'?m.quantities:{[m.size||'']:numberOf(m.qty)};const internalOrigin=stockWarehouses.includes(m.origin),internalDestination=stockWarehouses.includes(m.destination);sizes.forEach(size=>{const qty=numberOf(quantities[size]);if(type)movementTotals[type][size]+=qty;if(internalOrigin&&internalDestination&&m.origin!==m.destination){if(m.type==='ingreso')movementTotals.warehouseIn[size]+=qty;else if(m.type==='egreso')movementTotals.warehouseOut[size]+=qty;}});});
    const sizeRows=sizes.map(size=>'<tr><th>'+size+'</th><td>'+movementTotals.ingreso[size].toLocaleString('es-ES')+'</td><td>'+movementTotals.egreso[size].toLocaleString('es-ES')+'</td></tr>').join('');
    const warehouseRows=sizes.map(size=>'<tr><th>'+size+'</th><td>'+movementTotals.warehouseIn[size].toLocaleString('es-ES')+'</td><td>'+movementTotals.warehouseOut[size].toLocaleString('es-ES')+'</td><td>'+(movementTotals.warehouseIn[size]+movementTotals.warehouseOut[size]).toLocaleString('es-ES')+'</td></tr>').join('');
    const totalIn=sizes.reduce((sum,size)=>sum+movementTotals.ingreso[size],0),totalOut=sizes.reduce((sum,size)=>sum+movementTotals.egreso[size],0),totalWarehouseIn=sizes.reduce((sum,size)=>sum+movementTotals.warehouseIn[size],0),totalWarehouseOut=sizes.reduce((sum,size)=>sum+movementTotals.warehouseOut[size],0);
    if(aside)aside.innerHTML='<div class="stock-section-heading"><div><h3>Movimiento registrado</h3><p>Ventas e ingresos/egresos por talla</p></div></div><div class="stock-movement-row"><span>Ventas mostrador</span><strong>'+a.toLocaleString('es-ES')+'</strong></div><div class="stock-movement-row"><span>Ventas cumpleaños</span><strong>'+b.toLocaleString('es-ES')+'</strong></div><div class="stock-movement-row total"><span>Total ventas</span><strong>'+(a+b).toLocaleString('es-ES')+'</strong></div><div class="stock-movement-size-summary"><h4>Ingresos y egresos</h4><div class="stock-ledger-wrap"><table class="stock-ledger-table stock-summary-table"><thead><tr><th>Talla</th><th>Ingresos</th><th>Egresos</th></tr></thead><tbody>'+sizeRows+'<tr class="stock-movement-size-total"><th>Total</th><td>'+totalIn.toLocaleString('es-ES')+'</td><td>'+totalOut.toLocaleString('es-ES')+'</td></tr></tbody></table></div></div>';
    if(warehouseHost)warehouseHost.innerHTML='<div class="stock-section-heading"><div><h3>Movimientos de almacenes</h3><p>Entradas, salidas y total movido por talla</p></div></div><div class="stock-movement-size-summary"><div class="stock-ledger-wrap"><table class="stock-ledger-table stock-summary-table"><thead><tr><th>Talla</th><th>Ingreso</th><th>Egreso</th><th>Total</th></tr></thead><tbody>'+warehouseRows+'<tr class="stock-movement-size-total"><th>Total</th><td>'+totalWarehouseIn.toLocaleString('es-ES')+'</td><td>'+totalWarehouseOut.toLocaleString('es-ES')+'</td><td>'+(totalWarehouseIn+totalWarehouseOut).toLocaleString('es-ES')+'</td></tr></tbody></table></div><p class="stock-summary-note">Cuenta movimientos entre dos almacenes internos distintos.</p></div>';
  }


  function stockVal(col,row){const v=cells[col+row];return numberOf(isFormula(v)?evalCell(col+row):v);}
  function renderReconciliation(){
    const host=$('stockReconciliation');if(!host)return;
    const sizes=[['XXL',5],['XL',6],['L',7],['M',8],['S',9],['XS',10],['XXS',11]];
    host.innerHTML='<div class="stock-section-heading"><div><h3>Conciliación de stock</h3><p>Stock físico frente al saldo calculado en sistema, por talla</p></div></div><div class="stock-reconcile-wrap"><table class="stock-reconcile-table"><thead><tr><th>Talla</th><th>Total calcetines en stock</th><th>Calcetines en sistema</th><th>Diferencia</th></tr></thead><tbody>'+sizes.map(([size,row])=>{const physical=stockVal('Q',row),system=stockVal('U',row),diff=physical-system;return '<tr><th>'+size+'</th><td>'+physical.toLocaleString('es-ES')+'</td><td>'+system.toLocaleString('es-ES')+'</td><td class="'+(diff===0?'balanced':diff<0?'negative':'positive')+'">'+(diff>0?'+':'')+diff.toLocaleString('es-ES')+'</td></tr>';}).join('')+'</tbody></table></div>';
  }
  function renderMovements(){
    const host=$('stockMovements');if(!host)return;
    const sizes=['XXL','XL','L','M','S','XS','XXS'];
    const safeWarehouses=stockWarehouses.length?stockWarehouses:['Sin almacenes'];
    const warehouseOptions=safeWarehouses.map(w=>'<option value="'+escText(w)+'">'+escText(w)+'</option>').join('');
    const external='<option value="Proveedor / exterior">Proveedor / exterior</option>';
    const qtyRows=sizes.map(size=>'<label class="stock-size-qty"><span>'+size+'</span><input name="qty_'+size+'" type="number" min="0" step="1" value="0" aria-label="Cantidad talla '+size+'"></label>').join('');
    const renderMovementRows=list=>list.slice().reverse().map(m=>{
      const quantities=m.quantities&&typeof m.quantities==='object'?m.quantities:{[m.size||'']:numberOf(m.qty)};
      const detail=Object.entries(quantities).filter(([size,qty])=>numberOf(qty)>0).map(([size,qty])=>escText(size)+' × '+numberOf(qty).toLocaleString('es-ES')).join(', ')||'—';
      return '<tr><td>'+escText(m.date||'')+'</td><td><span class="stock-movement-tag '+(m.type==='ingreso'?'in':'out')+'">'+(m.type==='ingreso'?'Ingreso':'Egreso')+'</span></td><td>'+escText(m.origin||'—')+'</td><td>'+escText(m.destination||'—')+'</td><td>'+detail+'</td><td>'+escText(m.note||'—')+'</td><td><button type="button" class="stock-ledger-delete" data-movement-id="'+escText(m.id)+'" aria-label="Eliminar movimiento">×</button></td></tr>';
    }).join('');
    const incomeRows=renderMovementRows(stockMovements.filter(m=>m.type==='ingreso'));
    const expenseRows=renderMovementRows(stockMovements.filter(m=>m.type==='egreso'));
    const movementTable=rows=>'<div class="stock-ledger-wrap"><table class="stock-ledger-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Almacén de origen</th><th>Almacén de destino</th><th>Cantidades por talla</th><th>Observaciones</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="7">Sin movimientos todavía</td></tr>')+'</tbody></table></div>';
    host.innerHTML='<div class="stock-section-heading"><div><h3>Almacenes</h3><p>Administra los almacenes disponibles para los movimientos</p></div><button type="button" id="stockToggleWarehouseForm" class="ghost">'+(showWarehouseForm?'Cancelar':'＋ Gestionar almacenes')+'</button></div>'+(showWarehouseForm?'<div class="modal stock-form-modal" role="dialog" aria-modal="true" aria-label="Gestionar almacenes"><div class="modal-card"><button type="button" id="stockCloseWarehouseModal" class="modal-close" aria-label="Cerrar">×</button><p class="eyebrow">STOCK</p><h2>Gestionar almacenes</h2><form id="stockWarehouseForm" class="stock-warehouse-form"><label>Nombre del almacén<input name="warehouseName" type="text" maxlength="60" placeholder="Ej. Almacén central" required></label><button type="submit" class="primary">＋ Crear almacén</button></form></div></div>':'')+'<div class="stock-warehouse-list">'+stockWarehouses.map(w=>'<span class="stock-warehouse-chip">'+escText(w)+'<button type="button" data-delete-warehouse="'+escText(w)+'" aria-label="Eliminar almacén '+escText(w)+'">×</button></span>').join('')+'</div><div class="stock-section-heading stock-ledger-heading"><div><h3>Ingresos y egresos</h3><p>Registra movimientos por talla, fecha y almacenes</p></div><button type="button" id="stockToggleMovementForm" class="primary">'+(showMovementForm?'Cancelar':'＋ Nuevo movimiento')+'</button></div>'+(showMovementForm?'<div class="modal stock-form-modal" role="dialog" aria-modal="true" aria-label="Nuevo movimiento"><div class="modal-card wide"><button type="button" id="stockCloseMovementModal" class="modal-close" aria-label="Cerrar">×</button><p class="eyebrow">STOCK</p><h2>Nuevo movimiento</h2><form id="stockMovementForm" class="stock-movement-form stock-movement-form-wide"><label>Fecha<input name="date" type="date" value="'+new Date().toISOString().slice(0,10)+'" required></label><label>Tipo<select name="type"><option value="ingreso">Ingreso</option><option value="egreso">Egreso</option></select></label><label>Almacén de origen<select name="origin">'+external+warehouseOptions+'</select></label><label>Almacén de destino<select name="destination">'+warehouseOptions+external+'</select></label><label class="stock-movement-note">Observaciones<input name="note" type="text" maxlength="160" placeholder="Opcional"></label><div class="stock-qty-grid">'+qtyRows+'</div><button type="submit" class="primary">Registrar movimiento</button></form></div></div>':'')+'<div class="stock-ledger-section"><h4>Ingresos</h4>'+movementTable(incomeRows)+'</div><div class="stock-ledger-section"><h4>Egresos</h4>'+movementTable(expenseRows)+'</div>';
    host.querySelector('#stockToggleWarehouseForm')?.addEventListener('click',()=>{showWarehouseForm=!showWarehouseForm;showMovementForm=false;renderMovements();});
    host.querySelector('#stockCloseWarehouseModal')?.addEventListener('click',()=>{showWarehouseForm=false;renderMovements();});
    host.querySelector('#stockToggleMovementForm')?.addEventListener('click',()=>{showMovementForm=!showMovementForm;showWarehouseForm=false;renderMovements();});
    host.querySelector('#stockCloseMovementModal')?.addEventListener('click',()=>{showMovementForm=false;renderMovements();});
    host.querySelector('#stockWarehouseForm')?.addEventListener('submit',async e=>{
      e.preventDefault();const input=e.currentTarget.elements.warehouseName,name=String(input.value||'').trim();
      if(!name)return;if(stockWarehouses.some(w=>w.toLocaleLowerCase()===name.toLocaleLowerCase())){alert('Ya existe un almacén con ese nombre.');return;}
      const previous=stockWarehouses.slice();stockWarehouses.push(name);dirty=true;updateStatus('Guardando almacén en el servidor…');const ok=await save(false);if(ok){showWarehouseForm=false;renderMovements();alert('Almacén guardado en el servidor.');}else{stockWarehouses=previous;renderMovements();alert('No se pudo guardar el almacén en el servidor. Revisa la conexión e inténtalo de nuevo.');}
    });
    host.querySelectorAll('[data-delete-warehouse]').forEach(btn=>btn.addEventListener('click',()=>{
      const name=btn.dataset.deleteWarehouse;
      if(stockMovements.some(m=>m.origin===name||m.destination===name)){alert('No se puede eliminar: este almacén aparece en el historial de movimientos.');return;}
      if(!confirm('¿Eliminar el almacén "'+name+'"?'))return;
      stockWarehouses=stockWarehouses.filter(w=>w!==name);dirty=true;renderMovements();save(false);
    }));
    host.querySelector('#stockMovementForm')?.addEventListener('submit',async e=>{
      e.preventDefault();const form=e.currentTarget,fd=new FormData(form),quantities={};let total=0;
      sizes.forEach(size=>{const qty=Math.floor(Number(fd.get('qty_'+size))||0);if(qty>0){quantities[size]=qty;total+=qty;}});
      if(total<1){alert('Introduce al menos una cantidad en una talla.');return;}
      const type=String(fd.get('type')),origin=String(fd.get('origin')),destination=String(fd.get('destination'));
      if(origin===destination){alert('El almacén de origen y el de destino deben ser distintos.');return;}
      const previous=stockMovements.slice();stockMovements.push({id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),date:String(fd.get('date')),type,origin,destination,quantities,note:String(fd.get('note')||'').trim()});
      dirty=true;updateStatus('Guardando movimiento en el servidor…');const submit=form.querySelector('button[type="submit"]');if(submit){submit.disabled=true;submit.textContent='Guardando…';}
      const ok=await save(false);if(ok){showMovementForm=false;renderMovements();alert('Movimiento registrado y guardado en el servidor.');}else{stockMovements=previous;showMovementForm=true;renderMovements();alert('No se pudo guardar el movimiento en el servidor. No se ha confirmado el registro; inténtalo de nuevo.');}
    });
    host.querySelectorAll('[data-movement-id]').forEach(btn=>btn.addEventListener('click',()=>{
      const movement=stockMovements.find(m=>m.id===btn.dataset.movementId);if(!movement)return;
      const detail=Object.entries(movement.quantities||{}).filter(([size,qty])=>numberOf(qty)>0).map(([size,qty])=>size+' × '+numberOf(qty)).join(', ');
      if(!confirm('¿Eliminar este '+(movement.type==='ingreso'?'ingreso':'egreso')+' del '+(movement.date||'')+'?\\n\\n'+(detail||'Sin cantidades')+'\\n\\nEsta acción se guardará en el servidor y no se puede deshacer.'))return;
      const previous=stockMovements.slice();stockMovements=stockMovements.filter(m=>m.id!==btn.dataset.movementId);dirty=true;renderMovements();updateStatus('Guardando eliminación en el servidor…');save(false).then(ok=>{if(!ok){stockMovements=previous;renderMovements();alert('No se pudo eliminar en el servidor. El movimiento se ha restaurado en pantalla.');}else{alert('Movimiento eliminado y cambio guardado en el servidor.');}});
    }));
  }

  function renderStockCards(){
    const host=$('stockStockCards');if(!host)return;
    const groups=[
      {title:'Bajo escaleras',cols:['B','C','D'],labels:['Cajas','Unidades','Total pares'],sizes:[['XXL',5],['XL',6],['L',7],['M',8],['S',9],['XS',10],['XXS',11]]},
      {title:'Bajo parque',cols:['G','H'],labels:['Cajas','Total pares'],sizes:[['XXL',5],['XL',6],['L',7],['M',8],['S',9],['XS',10],['XXS',11]]},
      {title:'Mostrador',cols:['K'],labels:['Pares'],sizes:[['XXL',5],['XL',6],['L',7],['M',8],['S',9],['XS',10],['XXS',11]]},
      {title:'Cumpleaños',cols:['N'],labels:['Pares'],sizes:[['XXL',5],['XL',6],['L',7],['M',8],['S',9],['XS',10],['XXS',11]]}
    ];
    host.innerHTML=groups.map(g=>'<section class="stock-summary-card"><header><h3>'+g.title+'</h3><p>Inventario por talla</p></header><div class="stock-size-list">'+g.sizes.map(([size,row])=>'<div class="stock-size-item"><strong>'+size+'</strong><div class="stock-size-fields">'+g.cols.map((col,i)=>'<label>'+g.labels[i]+'<input type="number" min="0" step="1" data-stock-cell="'+col+row+'" value="'+escText(display(isFormula(cells[col+row])?evalCell(col+row):cells[col+row]||0))+'" '+(isFormula(cells[col+row])?'readonly':'')+'></label>').join('')+'</div></div>').join('')+'</div></section>').join('');
    host.querySelectorAll('[data-stock-cell]').forEach(inp=>inp.addEventListener('change',()=>{
      const a=inp.dataset.stockCell;if(isFormula(cells[a]))return;cells[a]=Math.max(0,Number(inp.value)||0);dirty=true;updateStatus('Inventario modificado; guardando…');save(false);
    }));
  }

  function migrateLegacyWeeks(){
    const defs=[['Semana 1',31,37],['Semana 2',42,48],['Semana 3',53,59],['Semana 4',64,70],['Semana 5',75,81],['Semana 6',85,91]];
    const out=[];
    for(const [name,a,z] of defs){
      const valid=[];for(let r=a;r<=z;r++){const d=cells['A'+r];if(typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d))valid.push({r,d});}
      if(!valid.length)continue;const days={};
      for(const x of valid){const sumCols=cols=>cols.reduce((s,c)=>s+numberOf(cells[c+x.r]),0);days[x.d]={counter:sumCols(['B','C','D','E','F','G','H']),birthday:sumCols(['J','K','L','M','N','O','P'])};}
      out.push({name,start:valid[0].d,end:valid[valid.length-1].d,days});
    }return out;
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
      dirty=true;renderWeekBlocks();renderMetrics();updateStatus('Bloques modificados; guardando…');if(saveTimer)clearTimeout(saveTimer);saveTimer=setTimeout(()=>save(false),500);
    }));
    host.querySelectorAll('[data-delete-week]').forEach(btn=>btn.addEventListener('click',()=>{
      if(!confirm('¿Eliminar este bloque semanal?'))return;weekBlocks.splice(Number(btn.dataset.deleteWeek),1);dirty=true;renderWeekBlocks();renderMetrics();save(false);
    }));
  }
  let weekDialogBound=false;
  function setupWeekBlockDialog(){
    if(weekDialogBound)return;weekDialogBound=true;
    const dialog=$('stockWeekBlockDialog'),form=$('stockWeekBlockForm');if(!dialog||!form)return;
    $('stockAddWeekBlock')?.addEventListener('click',()=>{const now=new Date(),start=new Date(now);start.setDate(now.getDate()-((now.getDay()+6)%7));const end=new Date(start);end.setDate(start.getDate()+6);$('stockWeekStart').value=start.toISOString().slice(0,10);$('stockWeekEnd').value=end.toISOString().slice(0,10);$('stockWeekBlockName').value='Semana '+(weekBlocks.length+1);dialog.classList.remove('hidden');});
    $('stockWeekCancel')?.addEventListener('click',()=>dialog.classList.add('hidden'));
    form.addEventListener('submit',e=>{e.preventDefault();const start=$('stockWeekStart').value,end=$('stockWeekEnd').value;if(!start||!end||end<start){alert('El rango de fechas no es válido.');return;}const days={};dateRangeDays(start,end).forEach(d=>days[d]={counter:0,birthday:0});weekBlocks.push({name:$('stockWeekBlockName').value.trim()||'Bloque semanal',start,end,days});dialog.classList.add('hidden');dirty=true;renderWeekBlocks();renderMetrics();updateStatus('Bloque añadido; guardando…');save(false);});
  }

  function printStockReport(){
    const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const inventory=[...document.querySelectorAll('#stockStockCards .stock-summary-card')].map(card=>{
      const title=card.querySelector('h3')?.textContent||'Inventario';
      const headers=[...card.querySelectorAll('.stock-size-fields label')].map(x=>x.childNodes[0]?.textContent?.trim()||'Cantidad');
      const rows=[...card.querySelectorAll('.stock-size-item')].map(row=>{
        const size=row.querySelector('strong')?.textContent||'';
        const values=[...row.querySelectorAll('input')].map(inp=>inp.value||'0');
        return '<tr><td>'+esc(size)+'</td>'+values.map(v=>'<td class="num">'+esc(v)+'</td>').join('')+'</tr>';
      });
      return '<section class="card"><h2>'+esc(title)+'</h2><table><thead><tr><th>Talla</th>'+headers.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></section>';
    }).join('');
    const weeks=[...document.querySelectorAll('#stockWeekBlocks .stock-week-card')].map(card=>{
      const title=card.querySelector('.stock-week-card-head strong')?.textContent||'Bloque semanal';
      const range=card.querySelector('.stock-week-card-head span')?.textContent||'';
      const table=card.querySelector('table');
      return '<section class="card"><h2>'+esc(title)+'</h2><p class="sub">'+esc(range)+'</p>'+(table?table.outerHTML:'')+'</section>';
    }).join('');
    const metrics=[...document.querySelectorAll('#stockMetrics .stock-metric')].map(m=>'<div class="metric"><span>'+esc(m.querySelector('span')?.textContent)+'</span><b>'+esc(m.querySelector('strong')?.textContent)+'</b><small>'+esc(m.querySelector('small')?.textContent)+'</small></div>').join('');
    const movements=$('stockMovementSummary')?.innerHTML||'';
    const win=window.open('','_blank');
    if(!win){alert('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para esta web y vuelve a pulsar Imprimir.');return;}
    win.document.open();
    win.document.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe de Stock · Calcetines</title><style>'+
      '@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font:11px Arial,sans-serif;color:#172b4d;margin:0}h1{font-size:23px;margin:0 0 4px}h2{font-size:13px;margin:0 0 8px;color:#1e4778}p{margin:0 0 10px;color:#66758b}.top{display:flex;justify-content:space-between;align-items:start;border-bottom:2px solid #dbe7f5;padding-bottom:10px;margin-bottom:12px}.date{font-size:10px;color:#64748b}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}.metric{border:1px solid #dbe5f1;border-radius:8px;padding:8px;background:#f7faff}.metric span,.metric small{display:block;color:#61718a;font-size:9px}.metric b{display:block;font-size:18px;margin:3px 0}.inventory{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;align-items:start}.card{border:1px solid #dbe5f1;border-radius:7px;padding:8px;margin:0 0 10px;break-inside:avoid}.inventory .card{margin:0}table{border-collapse:collapse;width:100%;font-size:9px}th,td{border:1px solid #e2e8f0;padding:5px 6px;text-align:left}th{background:#edf4fd;color:#365477}.num{text-align:right;font-variant-numeric:tabular-nums}.weeks{margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:8px}.sub{font-size:9px} .stock-week-delete,button{display:none!important}.stock-week-card-head{display:flex;justify-content:space-between;margin-bottom:5px}.stock-week-card-head span{font-size:9px;color:#64748b}.stock-week-card table input{border:0;width:100%;font:inherit;text-align:center;background:transparent}.movement{margin-top:12px}.movement h3{font-size:13px}.movement .stock-section-heading{margin-bottom:5px}.movement .stock-movement-row{display:flex;justify-content:space-between;padding:5px;border-bottom:1px solid #e2e8f0;font-size:10px}.movement .total{font-weight:bold;background:#edf4fd}'+
      '@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}'+
      '</style></head><body><div class="top"><div><h1>Informe de Stock · Calcetines</h1><p>Inventario por ubicación y movimientos semanales</p></div><div class="date">Generado: '+esc(new Date().toLocaleString('es-ES'))+'</div></div>'+
      '<div class="metrics">'+metrics+'</div><h2>Inventario por talla y ubicación</h2><div class="inventory">'+inventory+'</div><h2 style="margin-top:16px">Bloques semanales</h2><div class="weeks">'+weeks+'</div><div class="movement">'+movements+'</div><script>window.onload=()=>{setTimeout(()=>window.print(),350)};<\/script></body></html>');
    win.document.close();
  }

  async function init(){
    setupWeekBlockDialog();
    const panel=$('stockWorkbookPanel');if(!panel)return;
    $('stockWorkbookImport')?.addEventListener('change',e=>importWorkbook(e.target.files?.[0]));
    $('stockWorkbookSave')?.addEventListener('click',()=>save(true));
    $('stockWorkbookPrint')?.addEventListener('click',printStockReport);
    try{
      const data=await api('/api/stock/workbook');
      if(data.workbook&&data.workbook.cells){cells=data.workbook.cells;rowCount=data.workbook.rows||95;colCount=data.workbook.cols||21;weekBlocks=Array.isArray(data.workbook.weekBlocks)?data.workbook.weekBlocks:[];stockMovements=Array.isArray(data.workbook.stockMovements)?data.workbook.stockMovements:[];stockWarehouses=Array.isArray(data.workbook.stockWarehouses)&&data.workbook.stockWarehouses.length?data.workbook.stockWarehouses:['Bajo escaleras','Bajo parque','Mostrador','Cumpleaños'];if(!weekBlocks.length){weekBlocks=migrateLegacyWeeks();if(weekBlocks.length){dirty=true;}}render();if(dirty)await save(false);}
      else if(window.STOCK_WORKBOOK_INITIAL){weekBlocks=[];stockMovements=[];stockWarehouses=['Bajo escaleras','Bajo parque','Mostrador','Cumpleaños'];cells=addDefaultFormulas({...window.STOCK_WORKBOOK_INITIAL.cells});rowCount=window.STOCK_WORKBOOK_INITIAL.rows||95;colCount=window.STOCK_WORKBOOK_INITIAL.cols||21;dirty=true;render();updateStatus('Cargando los datos originales del Excel…');await save(false);}else{cells={};rowCount=95;colCount=21;render();updateStatus('Carga el archivo Calcetines 2026-10.xlsx para importar datos y fórmulas.');}
    }catch(e){cells={};rowCount=95;colCount=21;render();updateStatus('Esperando sesión de administrador para cargar/guardar el Excel.');}
  }
  document.addEventListener('click',e=>{
    const tab=e.target.closest('.section-tab[data-section="stockWorkbookPanel"]');
    if(tab&&window.__CONTROL_HORARIO_USER__?.role==='admin')setTimeout(init,50);
  });
  document.addEventListener('DOMContentLoaded',init);
  window.StockWorkbook={save,render};
})();