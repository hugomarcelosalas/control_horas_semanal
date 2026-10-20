/* V&A structured register + admin deletion for day-off requests */
(function(){
 const $ = id => document.getElementById(id);
 const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let vaSortDirection = 'asc';
 let vaHasUnsavedChanges = false;
 let vaSaveInProgress = false;
 const money = v => Number(v||0).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
 function records(){
   const sheet=vendorSheetsState?.['V&A'];
   if(!sheet)return [];
   if(!Array.isArray(sheet.records)) {
     try { sheet.records=JSON.parse(sheet.cells?.['A1']||'[]'); } catch { sheet.records=[]; }
   }
   return sheet.records;
 }
 function persistRecords(){
   const sheet=vendorSheetsState['V&A'];
   sheet.rows=Math.max(2,records().length+1);sheet.cols=6;
   sheet.cells={'A1':JSON.stringify(records())};
   vaHasUnsavedChanges=true;
   const status=$('vendorSaveStatus');if(status)status.textContent='Hay cambios de V&A pendientes de guardar.';
   const saveBtn=$('vaSave');if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='Confirmar y guardar';}
 }
 async function saveVA(){
   if(vaSaveInProgress)return;
   const status=$('vendorSaveStatus'),btn=$('vaSave');
   vaSaveInProgress=true;if(btn){btn.disabled=true;btn.textContent='Guardando…';}
   if(status)status.textContent='Guardando recaudaciones de V&A…';
   try{
     const sheet=vendorSheetsState['V&A'];
     sheet.rows=Math.max(2,records().length+1);sheet.cols=6;
     sheet.cells={'A1':JSON.stringify(records())};
     const out=await fetch('/api/vendor/sheets',{method:'PUT',headers:{'Content-Type':'application/json',...(authToken?{Authorization:'Bearer '+authToken}:{})},body:JSON.stringify({sheets:vendorSheetsState})});
     const data=await out.json();if(!out.ok)throw new Error(data.error||'Error al guardar');
     vendorSheetsState=data.sheets||vendorSheetsState;
     vaHasUnsavedChanges=false;
     if(status)status.textContent='V&A guardado correctamente.';
     if(btn){btn.disabled=true;btn.textContent='Guardado ✓';}
   }catch(e){
     if(status)status.textContent='No se pudo guardar V&A: '+e.message+'. Pulsa «Confirmar y guardar» para volver a intentarlo.';
     if(btn){btn.disabled=false;btn.textContent='Reintentar guardado';}
   }finally{vaSaveInProgress=false;}
 }
 function renderVA(){
   if(!vendorActiveSheet||vendorActiveSheet!=='V&A'||!$('vendorSheetContainer'))return;
   const box=$('vendorSheetContainer');box.classList.remove('vendor-daily-sheet');
   const rows=records();
   rows.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')) * (vaSortDirection==='asc'?1:-1));
   box.innerHTML='<div class="va-toolbar"><button type="button" class="primary" id="vaAdd">+ Añadir recaudación</button><button type="button" class="primary" id="vaSave" '+(vaHasUnsavedChanges?'':'disabled')+'>Confirmar y guardar</button><span class="muted">Confirma el guardado para conservar los cambios.</span></div>'+
    '<div class="invoice-table-wrap"><table class="invoice-table va-table"><thead><tr><th><button type="button" class="va-sort-date" id="vaSortDate">Fecha recaudación '+(vaSortDirection==='asc'?'↑':'↓')+'</button></th><th>Monto</th><th>Fecha ingresado</th><th>Link (Drive)</th><th>Observaciones</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>'+
    (rows.length?rows.map((r,i)=>'<tr data-va-row="'+i+'"><td><input type="date" data-va-field="date" value="'+esc(r.date||'')+'"></td><td><input type="number" min="0" step="0.01" data-va-field="amount" value="'+esc(r.amount??'')+'" placeholder="0,00"></td><td><input type="date" data-va-field="enteredDate" value="'+esc(r.enteredDate||'')+'"></td><td><input type="url" data-va-field="driveUrl" value="'+esc(r.driveUrl||'')+'" placeholder="https://drive.google.com/...">'+(r.driveUrl?'<a href="'+esc(r.driveUrl)+'" target="_blank" rel="noopener noreferrer">Abrir Drive</a>':'')+'</td><td><textarea data-va-field="observations" rows="2">'+esc(r.observations||'')+'</textarea></td><td><select data-va-field="status" class="'+(r.status==='delivered'?'va-delivered':'va-pending')+'"><option value="pending" '+(r.status!=='delivered'?'selected':'')+'>🔴 No entregado</option><option value="delivered" '+(r.status==='delivered'?'selected':'')+'>🟢 Entregado</option></select></td><td><button type="button" class="small-btn danger-small" data-va-delete="'+i+'">Eliminar</button></td></tr>').join(''):'<tr><td colspan="7">Todavía no hay recaudaciones registradas.</td></tr>')+
    '</tbody></table></div>';
   $('vaSave').onclick=saveVA;
   $('vaSortDate').onclick=()=>{vaSortDirection=vaSortDirection==='asc'?'desc':'asc';renderVA()};
   $('vaAdd').onclick=()=>{rows.push({date:new Date().toISOString().slice(0,10),amount:'',enteredDate:'',driveUrl:'',observations:'',status:'pending',id:'va-'+Date.now()});persistRecords();renderVA()};
   box.querySelectorAll('[data-va-field]').forEach(input=>input.addEventListener('change',()=>{
     const row=rows[Number(input.closest('[data-va-row]').dataset.vaRow)];
     row[input.dataset.vaField]=input.value;
     if(input.dataset.vaField==='status')input.className=input.value==='delivered'?'va-delivered':'va-pending';
     if(input.dataset.vaField==='driveUrl')renderVA();
     persistRecords();
   }));
   box.querySelectorAll('[data-va-delete]').forEach(btn=>btn.onclick=()=>{if(!confirm('¿Eliminar esta recaudación de V&A?'))return;rows.splice(Number(btn.dataset.vaDelete),1);persistRecords();renderVA()});
 }
 // Wrap the existing renderer so the old spreadsheet grid is replaced only in V&A.
 const originalRender=window.renderVendorWorkspace;
 if(typeof originalRender==='function'){
   window.renderVendorWorkspace=function(sheets){originalRender(sheets);if(vendorActiveSheet==='V&A')renderVA()};
 }
 document.addEventListener('click',async e=>{
   const btn=e.target.closest('#dayOffAdminModal [data-delete-day-off]');
   if(!btn)return;
   if(!currentUser||currentUser.role!=='admin')return;
   const modal=$('dayOffAdminModal'),id=modal?.dataset.requestId;
   if(!id||!confirm('¿Eliminar definitivamente esta solicitud de día libre?'))return;
   try{
     const response=await fetch('/api/state',{method:'GET',headers:authToken?{Authorization:'Bearer '+authToken}:{}});
     const latest=await response.json();
     const list=Array.isArray(latest.dayOffRequests)?latest.dayOffRequests:(db.dayOffRequests||[]);
     db.dayOffRequests=list.filter(r=>String(r.id)!==String(id));
     await saveDB();
     modal.classList.add('hidden');
     if(typeof refreshPrivateRequests==='function')await refreshPrivateRequests();
     if(typeof renderVacationsSection==='function')renderVacationsSection();
     if(typeof renderCalendar==='function')renderCalendar();
   }catch(err){alert('No se pudo eliminar la solicitud: '+err.message)}
 });
 const installDelete=()=>{
   const original=openDayOffRequest;
   if(typeof original!=='function'||original.__deleteEnabled)return false;
   const wrapped=function(id){original(id);const modal=$('dayOffAdminModal');if(!modal)return;const actions=modal.querySelector('.modal-actions');if(actions&&!actions.querySelector('[data-delete-day-off]')){const b=document.createElement('button');b.type='button';b.className='danger';b.dataset.deleteDayOff='1';b.textContent='Eliminar solicitud';actions.prepend(b)}};
   wrapped.__deleteEnabled=true;openDayOffRequest=wrapped;return true;
 };
 if(!installDelete()){
   const timer=setInterval(()=>{if(installDelete())clearInterval(timer)},100);
   setTimeout(()=>clearInterval(timer),10000);
 }
 // Refresh V&A rendering when the group/sheet tabs are switched.
 document.addEventListener('click',e=>{if(e.target.closest('[data-vendor-sheet="V&A"]')||e.target.closest('[data-vendor-group="V&A"]'))setTimeout(renderVA,0)});
 const originalLoad=typeof loadVendorSheets==='function'?loadVendorSheets:null;
 if(originalLoad&&!originalLoad.__vaWrapped){const wrapped=async function(...args){const r=await originalLoad.apply(this,args);setTimeout(renderVA,0);return r};wrapped.__vaWrapped=true;loadVendorSheets=wrapped}
 const style=document.createElement('style');style.textContent='.va-toolbar button:disabled{opacity:.55;cursor:default}.va-sort-date{background:transparent;border:0;color:inherit;font:inherit;font-weight:700;cursor:pointer;padding:0}.va-toolbar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:12px 0}.va-table input,.va-table textarea,.va-table select{min-width:115px;width:100%;box-sizing:border-box;padding:8px;border:1px solid #cbd5e1;border-radius:6px;font:inherit}.va-table textarea{min-width:150px}.va-table .va-delivered{background:#dcfce7;color:#166534;border-color:#86efac}.va-table .va-pending{background:#fee2e2;color:#991b1b;border-color:#fca5a5}.va-table a{display:inline-block;margin-top:4px}.va-table td{vertical-align:top}';
 document.head.appendChild(style);
})();
