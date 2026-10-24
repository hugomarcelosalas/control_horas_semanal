const $=id=>document.getElementById(id);
// Estado de vacaciones inicializado antes de registrar manejadores de clics.
let vacationsViewMode='calendar';
let vacationsMonth=new Date();vacationsMonth.setDate(1);
let calendarEventDraftOpen=false;
// Navegación registrada al inicio para que no dependa de la inicialización de otros módulos.
document.getElementById('sectionTabs')?.addEventListener('click',e=>{
  const tab=e.target.closest('.section-tab');
  if(!tab)return;
  e.preventDefault();
  const sectionId=tab.dataset.section;
  if(['dashboardPanel','balancesPanel','employeesPanel','hugoErikaPanel','importExportPanel','invoicesPanel','wagesPanel','monthlyHoursPanel'].includes(sectionId) && window.__CONTROL_HORARIO_USER__?.role!=='admin')return;
  if(typeof showSection==='function')showSection(sectionId);
  else {
    document.querySelectorAll('#app main > section.panel').forEach(p=>p.classList.toggle('hidden',p.id!==sectionId));
    document.querySelectorAll('.section-tab').forEach(t=>t.classList.toggle('active',t===tab));
  }
},true);

// Acciones críticas con delegación temprana: no dependen de que otros módulos hayan enlazado sus botones.
document.addEventListener('click',e=>{
  const target=e.target;
  const pdf=target.closest('#exportBalancesPdf');
  if(pdf){e.preventDefault();e.stopImmediatePropagation();if(typeof exportBalancesPdf==='function')exportBalancesPdf();return;}
  const inactive=target.closest('#toggleInactiveEmployees');
  if(inactive){e.preventDefault();e.stopImmediatePropagation();inactiveEmployeesVisible=!inactiveEmployeesVisible;if(typeof renderInactiveEmployees==='function')renderInactiveEmployees();return;}
  const calendar=target.closest('#vacCalendarBtn');
  if(calendar){e.preventDefault();e.stopImmediatePropagation();if(typeof vacationsViewMode!=='undefined')vacationsViewMode='calendar';if(typeof renderVacationsSection==='function')renderVacationsSection();return;}
  const list=target.closest('#vacListBtn');
  if(list){e.preventDefault();e.stopImmediatePropagation();if(typeof vacationsViewMode!=='undefined')vacationsViewMode='list';if(typeof renderVacationsSection==='function')renderVacationsSection();return;}
},true);

let db={users:[],records:{},locks:{},weekly:{},vacations:{},balanceVisibility:{},version:8};
let authToken=null;
let currentUser=null,selectedEmployee=null,editingHeId=null,hugoErikaRecords=[],currentDate=new Date(),selectedDate=null,selectedWeeklyId=null,selectedVacationId=null,activeView="calendar",pendingDeleteUser=null,editingUsername=null,selectedDashboardEmployees=null,inactiveEmployeesVisible=false;
async function api(path,options={}){const headers={"Content-Type":"application/json",...(options.headers||{})};if(authToken)headers.Authorization="Bearer "+authToken;const r=await fetch(path,{...options,headers});const data=await r.json().catch(()=>({}));if(r.status===401&&path!=="/api/login"&&authToken){authToken=null;currentUser=null;selectedEmployee=null;window.__CONTROL_HORARIO_TOKEN__=null;window.__CONTROL_HORARIO_USER__=null;$("app")?.classList.add("hidden");$("loginScreen")?.classList.remove("hidden");const err=$("loginError");if(err){err.textContent="La sesión ha caducado o se ha reiniciado. Vuelve a iniciar sesión; tus datos guardados siguen en la aplicación.";err.classList.remove("hidden")}}if(!r.ok)throw new Error(data.error||"Error de conexión");return data;}
async function saveDB(){db.version=8;try{const r=await api('/api/state',{method:'PUT',body:JSON.stringify(db)});db=r.db||db;return true;}catch(e){alert("No se han podido guardar los cambios en el servidor. Mantén esta ventana abierta e inténtalo de nuevo. Detalle: "+e.message);return false;}}
let vendorSheetsState={},vendorActiveSheet='Cierre',vendorActiveGroup='Venta',vendorSaveTimer=null;
const vendorGroups={Venta:['Cierre','mon-thursday','Friday','Saturday- vacaciones','Sunday','week state','Semanal con suma','week con suma','Borrar'],Stock:['Calcetines','Pulseras'],'V&A':['V&A']};
const stockSizes=['XXL','XL','L','M','S','XS','XXS'];
function stockCell(sheet,row,col){return vendorColName(col)+row}
function stockGet(sheet,row,col){return sheet.cells?.[stockCell(sheet,row,col)]??''}
function renderVendorStock(box){
 const tabNames=['Calcetines','Pulseras'];
 for(const name of tabNames)if(!vendorSheetsState[name])vendorSheetsState[name]={rows:30,cols:8,cells:{}};
 const sh=vendorSheetsState[vendorActiveSheet];
 if(!sh.cells)sh.cells={};
 const selectedDate=sh.cells.stockSelectedDate||dateKey(new Date());
 const itemNames=vendorActiveSheet==='Calcetines'?stockSizes:['Pulseras'];
 const esc=vendorEscape;
 const stockColumns=[['B','Stock bajo parque'],['C','Stock bajo escalera'],['D','Stock mostrador'],['E','Stock cumple']];
 const expenseKey=(date,item,place)=>'egreso|'+date+'|'+item+'|'+place;
 box.classList.add('vendor-stock-view');
 let html='<div class="stock-screen"><div class="stock-head"><div><h2>'+esc(vendorActiveSheet)+'</h2><p>Existencias y salidas por fecha, talla y destino</p></div><label>Fecha de egresos<input id="stockDate" type="date" value="'+esc(selectedDate)+'"></label></div>';
 html+='<div class="stock-table-wrap"><table class="stock-table"><thead><tr><th>'+(vendorActiveSheet==='Calcetines'?'Talla':'Artículo')+'</th>'+stockColumns.map(x=>'<th>'+x[1]+'</th>').join('')+'<th>Egreso mostrador</th><th>Egreso cumples</th></tr></thead><tbody>';
 itemNames.forEach((item,i)=>{const row=i+3;html+='<tr><th>'+esc(item)+'</th>';stockColumns.forEach(([col,label])=>{const ref=col+row;html+='<td><input type="number" min="0" step="1" inputmode="numeric" aria-label="'+esc(item+' '+label)+'" data-stock-cell="'+ref+'" value="'+esc(sh.cells[ref]??'')+'"></td>'});['mostrador','cumples'].forEach(place=>{const key=expenseKey(selectedDate,item,place);html+='<td><input type="number" min="0" step="1" inputmode="numeric" aria-label="'+esc(item+' egreso '+place)+'" data-stock-expense="'+esc(key)+'" value="'+esc(sh.cells[key]??'')+'"></td>'});html+='</tr>'});
 html+='</tbody></table></div><p class="stock-note">Los egresos se guardan por día y por artículo/talla. Al cambiar la fecha verás los egresos registrados para ese día.</p></div>';
 box.innerHTML=html;
 box.querySelector('#stockDate').addEventListener('change',e=>{sh.cells.stockSelectedDate=e.target.value||dateKey(new Date());renderVendorWorkspace(vendorSheetsState);});
 box.querySelectorAll('[data-stock-cell]').forEach(inp=>inp.addEventListener('input',()=>{sh.cells[inp.dataset.stockCell]=inp.value;stockScheduleSave()}));
 box.querySelectorAll('[data-stock-expense]').forEach(inp=>inp.addEventListener('input',()=>{sh.cells[inp.dataset.stockExpense]=inp.value;stockScheduleSave()}));
 function stockScheduleSave(){if($('vendorSaveStatus'))$('vendorSaveStatus').textContent='Hay cambios sin guardar…';if(vendorSaveTimer)clearTimeout(vendorSaveTimer);vendorSaveTimer=setTimeout(()=>saveVendorSheets(false),900)}
}
function renderVendorWorkspace(sheets){
 vendorSheetsState=sheets&&Object.keys(sheets).length?sheets:{};vendorActiveSheet=vendorActiveSheet&&vendorSheetsState[vendorActiveSheet]?vendorActiveSheet:Object.keys(vendorSheetsState)[0];
 const tabs=$('vendorSheetTabs');if(!tabs)return;
 const groupNames=Object.keys(vendorGroups);
 if(!groupNames.includes(vendorActiveGroup))vendorActiveGroup='Venta';
 if(!vendorSheetsState['V&A'])vendorSheetsState['V&A']={rows:20,cols:8,cells:{}};
 if(!vendorGroups[vendorActiveGroup].includes(vendorActiveSheet)||!vendorSheetsState[vendorActiveSheet])vendorActiveSheet=(vendorGroups[vendorActiveGroup].find(n=>vendorSheetsState[n])||Object.keys(vendorSheetsState)[0]);
 tabs.innerHTML='<div class="vendor-main-tabs">'+groupNames.map(name=>'<button type="button" class="vendor-main-tab '+(name===vendorActiveGroup?'active':'')+'" data-vendor-group="'+name+'">'+name+'</button>').join('')+'</div><div class="vendor-sub-tabs">'+(vendorGroups[vendorActiveGroup]||[]).filter(name=>vendorSheetsState[name]).map(name=>'<button type="button" class="vendor-sheet-tab '+(name===vendorActiveSheet?'active':'')+'" data-vendor-sheet="'+vendorEscape(name)+'">'+vendorEscape(name)+'</button>').join('')+'</div>';
 tabs.querySelectorAll('[data-vendor-group]').forEach(btn=>btn.onclick=()=>{vendorActiveGroup=btn.dataset.vendorGroup;vendorActiveSheet=(vendorGroups[vendorActiveGroup].find(n=>vendorSheetsState[n])||Object.keys(vendorSheetsState)[0]);renderVendorWorkspace(vendorSheetsState)});
 tabs.querySelectorAll('[data-vendor-sheet]').forEach(btn=>btn.onclick=()=>{vendorActiveSheet=btn.dataset.vendorSheet;renderVendorWorkspace(vendorSheetsState)});
 tabs.querySelectorAll('button').forEach(btn=>btn.setAttribute('aria-selected',String(btn.dataset.vendorGroup?btn.dataset.vendorGroup===vendorActiveGroup:btn.dataset.vendorSheet===vendorActiveSheet)));
 const sh=vendorSheetsState[vendorActiveSheet],box=$('vendorSheetContainer');if(!sh||!box)return;
 if(vendorActiveGroup==='Stock'){renderVendorStock(box);return;}else box.classList.remove('vendor-stock-view');
 const isDaily=['Cierre','mon-thursday','Friday','Saturday- vacaciones','Sunday'].includes(vendorActiveSheet);
 box.classList.toggle('vendor-daily-sheet',isDaily);
 let table='<table class="vendor-grid '+(isDaily?'vendor-daily-grid':'')+'"><thead><tr><th class="vendor-index"></th>';
 for(let c=1;c<=sh.cols;c++)table+='<th class="vendor-colhead">'+vendorColName(c)+'</th>';
 table+='</tr></thead><tbody>';
 for(let r=1;r<=sh.rows;r++){table+='<tr><td class="row-num vendor-index">'+r+'</td>';for(let c=1;c<=sh.cols;c++){const ref=vendorColName(c)+r,val=sh.cells?.[ref]??'';const cellClass=isDaily?vendorCellClass(vendorActiveSheet,ref):'vendor-cell-bordered';table+='<td class="'+cellClass+'" data-vendor-td="'+ref+'"><input aria-label="'+ref+'" data-vendor-cell="'+ref+'" value="'+vendorEscape(val)+'" autocomplete="off" spellcheck="false"></td>'}table+='</tr>'}
 table+='</tbody></table>';box.innerHTML=table;
 box.querySelectorAll('[data-vendor-cell]').forEach(input=>input.addEventListener('input',()=>{sh.cells[input.dataset.vendorCell]=input.value;const status=$('vendorSaveStatus');if(status)status.textContent='Hay cambios sin guardar…';if(vendorSaveTimer)clearTimeout(vendorSaveTimer);vendorSaveTimer=setTimeout(()=>saveVendorSheets(false),900)}));
 const save=$('vendorSaveBtn');if(save)save.onclick=()=>saveVendorSheets(true);
 const print=$('vendorPrintBtn');if(print)print.onclick=()=>{document.body.classList.add('vendor-printing');window.print();setTimeout(()=>document.body.classList.remove('vendor-printing'),500)};
}async function saveVendorSheets(manual){
 const status=$('vendorSaveStatus');if(status)status.textContent='Guardando cambios…';
 try{const out=await api('/api/vendor/sheets',{method:'PUT',body:JSON.stringify({sheets:vendorSheetsState})});vendorSheetsState=out.sheets||vendorSheetsState;if(status)status.textContent='Guardado correctamente · '+new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});}
 catch(e){if(status)status.textContent='No se pudo guardar: '+e.message;if(manual)alert('No se pudo guardar la planilla: '+e.message)}
}


function pad(n){return String(n).padStart(2,"0")}
function dateKey(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function parseKey(k){const [y,m,d]=k.split("-").map(Number);return new Date(y,m-1,d)}
function fmtDate(k){return parseKey(k).toLocaleDateString("es-ES",{day:"2-digit",month:"2-digit",year:"numeric"})}
function weekRangeForDate(d){const x=new Date(d);const day=x.getDay()||7;const start=new Date(x);start.setDate(x.getDate()-day+1);const end=new Date(start);end.setDate(start.getDate()+6);return {start:dateKey(start),end:dateKey(end)}}
async function loadPlannedSummary(){const el=$("heroWeekPlanned"),diff=$("heroWeekDifference");if(!el||!selectedEmployee?.username||!authToken)return;const r=weekRangeForDate(new Date());try{const data=await api('/api/horarios/summary?username='+encodeURIComponent(selectedEmployee.username)+'&start='+r.start+'&end='+r.end);el.textContent=fmtMinutes(data.plannedMinutes||0);const worked=employeeWeekSummary().worked;const delta=(data.plannedMinutes||0)-worked;if(diff)diff.textContent=(delta>=0?'+':'')+fmtMinutes(delta)+' previstas − trabajadas';}catch(e){el.textContent='0:00';if(diff)diff.textContent='Sin cuadrante'}}

function fmtLong(k){return parseKey(k).toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
function normalizeTimeValue(v){
 const raw=String(v??"").trim();
 if(!raw)return "";
 let h,m;
 const colon=raw.match(/^(\d{1,2})\s*[:.]\s*(\d{1,2})$/);
 if(colon){h=Number(colon[1]);m=Number(colon[2]);}
 else{
   const digits=raw.replace(/\D/g,"");
   if(digits.length===1||digits.length===2){h=Number(digits);m=0}
   else if(digits.length===3){h=Number(digits.slice(0,1));m=Number(digits.slice(1))}
   else if(digits.length===4){h=Number(digits.slice(0,2));m=Number(digits.slice(2))}
   else return null;
 }
 if(!Number.isInteger(h)||!Number.isInteger(m)||h<0||h>23||m<0||m>59)return null;
 return `${pad(h)}:${pad(m)}`;
}
function minutesFromTime(t){if(!t)return 0;const normalized=normalizeTimeValue(t);if(!normalized)return 0;const [h,m]=normalized.split(":").map(Number);return h*60+m}
function workMinutes(r){if(!r)return 0;if((!r.entry||!r.exit)&&r.workedHours!=null)return hoursToMinutes(r.workedHours);if(!r.entry||!r.exit)return 0;let a=minutesFromTime(r.entry),b=minutesFromTime(r.exit);if(b<a)b+=1440;return b-a}
function fmtMinutes(min){const sign=min<0?"-":"";min=Math.abs(Math.round(min));return `${sign}${Math.floor(min/60)}:${pad(min%60)}`}
function extraMinutes(r){return Math.round((Number(r?.extraHours)||0)*60)}
function totalMinutes(r){return workMinutes(r)+extraMinutes(r)}
function userRecords(){return db.records[selectedEmployee.username]||{}}
function userLocks(){return db.locks[selectedEmployee.username]||{}}
function weeklyRows(){return (db.weekly[selectedEmployee.username]||[]).slice().sort((a,b)=>b.start.localeCompare(a.start)||b.end.localeCompare(a.end)).map(r=>({...r,locked:r.locked!==false}))}
function vacations(){return (db.vacations[selectedEmployee.username]||[]).slice().sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end))}
function classBalance(v){return v>0?"positive":v<0?"negative":"neutral"}
function isAdmin(){return currentUser?.role==="admin"}
function monthKey(k){return k.slice(0,7)}
function isPreviousMonth(k){const d=parseKey(k),n=new Date();return d.getFullYear()<n.getFullYear()||(d.getFullYear()===n.getFullYear()&&d.getMonth()<n.getMonth())}
function startOfCurrentWeek(){const n=new Date();n.setHours(0,0,0,0);n.setDate(n.getDate()-((n.getDay()+6)%7));return n}
function isBeforeCurrentWeek(k){return parseKey(k)<startOfCurrentWeek()}
function isMonthLocked(k){const mk=monthKey(k);return db.monthLocks?.[mk]===true}
function isDayLocked(k){const explicit=userLocks()[k];if(explicit===false)return false;if(explicit===true)return true;return isBeforeCurrentWeek(k)}
function canEditDay(k){return isAdmin()||(!isDayLocked(k))}
function hoursToMinutes(v){return Math.round((Number(v)||0)*60)}
function daysInclusive(s,e){return Math.max(1,Math.round((e-s)/86400000)+1)}
function dailyContractMinutes(user=selectedEmployee){return (Number(user?.weeklyHours)||0)*60/5}
function workingDaysInclusive(s,e){let n=0;for(let d=new Date(s);d<=e;d.setDate(d.getDate()+1)){const day=d.getDay();if(day!==0&&day!==6)n++}return n}
function vacationForDate(k){return vacations().find(v=>k>=v.start&&k<=v.end)}
function isWeekday(d){const x=d.getDay();return x>=1&&x<=5}
function vacationMinutesForDate(k){const v=vacationForDate(k);if(!v||v.cancelled)return 0;return isWeekday(parseKey(k))?dailyContractMinutes():0}
function totalMinutesForDate(k){return totalMinutes(userRecords()[k]||{})+vacationMinutesForDate(k)}

function ensureUserData(username){db.records[username]=db.records[username]||{};db.locks[username]=db.locks[username]||{};db.weekly[username]=db.weekly[username]||[];db.vacations[username]=db.vacations[username]||[]}

function downloadTextFile(filename,text,mime){const blob=new Blob([text],{type:mime});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function escapeCsvCell(v){const s=String(v??"");return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
function buildBackupCsv(){const rows=[["Empleado","Usuario","Fecha","Entrada","Salida","Horas","Horas extra","Observaciones","Vacaciones"]];db.users.filter(u=>u.role==="employee").forEach(u=>{const recs=db.records?.[u.username]||{},vacs=db.vacations?.[u.username]||{};const keys=new Set([...Object.keys(recs),...vacs.flatMap(v=>{const a=[];for(let d=parseKey(v.start);d<=parseKey(v.end);d.setDate(d.getDate()+1))a.push(dateKey(d));return a})]);[...keys].sort().forEach(k=>{const r=recs[k]||{},v=vacs.find(x=>k>=x.start&&k<=x.end);rows.push([u.name,u.username,k,r.entry||"",r.exit||"",fmtMinutes(totalMinutes(r)),r.extraHours??"",r.comments||"",v?"Sí":""])});});return rows.map(r=>r.map(escapeCsvCell).join(",")).join("\r\n")}
async function makeBackup(){if(!isAdmin())return;const stamp=dateKey(new Date());try{const payload=await api('/api/admin/backup');if(payload?.backupType!=="control_horario_full"||!payload.data?.users||!Array.isArray(payload.data.payrolls)||!Array.isArray(payload.data.hugoErika))throw new Error("El servidor no ha devuelto una copia completa.");downloadTextFile("control_horario_backup_"+stamp+".json",JSON.stringify(payload,null,2),"application/json;charset=utf-8");downloadTextFile("control_horario_registros_"+stamp+".csv","\\ufeff"+buildBackupCsv(),"text/csv;charset=utf-8");localStorage.setItem("control_horario_last_backup",new Date().toISOString());renderLastBackupLabel();alert("Copia completa creada. Guarda el JSON en un lugar seguro: incluye datos privados y contraseñas cifradas.")}catch(e){alert("No se pudo crear la copia completa: "+e.message)}}
function restoreBackup(file){if(!isAdmin())return;const reader=new FileReader();reader.onload=async()=>{try{const payload=JSON.parse(reader.result);if(payload?.backupType!=="control_horario_full"||!payload.data?.users||!payload.data?.records)throw new Error("El archivo no es una copia de seguridad válida de Control Horario.");const d=payload.data;const details="Usuarios: "+d.users.length+"\\nRegistros Hugo & Erika: "+(d.hugoErika||[]).length+"\\nNóminas: "+(d.payrolls||[]).length+"\\nHorarios: "+((d.horarios?.turnos||[]).length)+"\\nFecha: "+(payload.createdAt||"desconocida");if(!confirm("ATENCIÓN: se reemplazarán los datos actuales por la copia.\\n\\n"+details+"\\n\\nAntes de continuar, crea una copia del estado actual. ¿Quieres restaurar?"))return;const out=await api("/api/admin/backup/restore",{method:"PUT",body:JSON.stringify(payload)});db=out.db;hugoErikaRecords=db.hugoErika||[];selectedEmployee=db.users.find(u=>u.username===selectedEmployee?.username&&u.role==="employee"&&u.active!==false)||db.users.find(u=>u.role==="employee"&&u.active!==false)||db.users.find(u=>u.role==="employee");alert("Copia completa restaurada. Se han recuperado "+out.restored.users+" usuarios, "+out.restored.payrolls+" nóminas, "+out.restored.hugoErika+" registros Hugo & Erika y "+out.restored.turnos+" turnos. Recarga la página si alguna sección no se actualiza.") ;render()}catch(e){alert("No se pudo restaurar la copia: "+e.message)}$("restoreBackupFile").value=""};reader.readAsText(file)}
async function loadAuditHistory(){if(!isAdmin())return;try{const rows=await api('/api/audit');const box=$("auditHistory");if(!box)return;box.innerHTML=rows.length?rows.slice(0,100).map(x=>'<div class="audit-row"><strong>'+String(x.actorName||x.actor||'Administrador')+'</strong><span>'+new Date(x.at).toLocaleString('es-ES')+'</span><p>'+String(x.message||'Cambio registrado')+'</p></div>').join(''):'<div class="muted">No hay cambios registrados todavía.</div>'}catch(e){console.warn(e)}}
function setupExcelAndReview(){const a=$("exportEmployeeExcel"),b=$("exportAllExcel"),c=$("exportMonthlyExcel"),d=$("exportAnnualExcel"),rev=$("weekReviewBtn"),ah=$("auditRefreshBtn");if(a)a.onclick=exportEmployeeExcel;if(b)b.onclick=exportAllExcel;if(c)c.onclick=exportMonthlyExcel;if(d)d.onclick=exportAnnualExcel;if(rev)rev.onclick=reviewCurrentWeek;if(ah)ah.onclick=()=>{$("auditHistory")?.classList.toggle("hidden");loadAuditHistory()};const nf=$("notionImportFile"),nl=$("notionFileName");if(nf&&nl)nf.onchange=()=>{nl.textContent=nf.files?.[0]?.name||"Ningún archivo seleccionado"}}
function renderLastBackupLabel(){const el=$("lastBackupLabel");if(!el)return;const v=localStorage.getItem("control_horario_last_backup");el.textContent=v?"Última copia: "+new Date(v).toLocaleString("es-ES",{dateStyle:"short",timeStyle:"short"}):"Última copia: todavía no creada"}
function setupBackupControls(){if(!isAdmin())return;const panel=$("importExportPanel");if(!panel)return;let box=$("backupTools");if(!box){box=document.createElement("div");box.id="backupTools";box.className="backup-tools";box.innerHTML='<div><strong>💾 Copias de seguridad</strong><p class="muted">Guarda una copia completa antes de migrar el servidor o hacer cambios importantes.</p><div id="lastBackupLabel" class="muted"></div></div><div class="backup-actions"><button type="button" class="small-btn" id="exportBackupBtn">⬇️ Crear backup</button><label class="small-btn" for="restoreBackupFile">↩️ Restaurar copia</label><input id="restoreBackupFile" type="file" accept=".json,application/json" hidden></div>';panel.appendChild(box)}$("exportBackupBtn").onclick=()=>{makeBackup()};renderLastBackupLabel();$("restoreBackupFile").onchange=e=>{const file=e.target.files?.[0];if(file)restoreBackup(file)}}


$("loginForm").addEventListener("submit",async e=>{e.preventDefault();const u=$("username").value.trim().toLowerCase(),p=$("password").value;try{const r=await api('/api/login',{method:'POST',body:JSON.stringify({username:u,password:p})});authToken=r.token;currentUser=r.user;window.__CONTROL_HORARIO_TOKEN__=authToken;window.__CONTROL_HORARIO_USER__=currentUser;window.dispatchEvent(new Event('control-horario-auth'));
  updateSectionTabsVisibility();db=r.db;selectedEmployee=currentUser.role==="admin"?(db.users.find(x=>x.role==="employee"&&x.active!==false)||db.users.find(x=>x.role==="employee")||currentUser):currentUser;$("loginError").classList.add("hidden");$("loginScreen").classList.add("hidden");$("app").classList.remove("hidden");$("currentUser").textContent=`${currentUser.name}${currentUser.role==="admin"?" · Administrador":""}`;if(currentUser.role==="vendedor"){$("sectionTabs")?.classList.add("hidden");document.querySelectorAll("#app main > *").forEach(el=>{if(el.id!=="vendorWorkspace")el.classList.add("hidden")});$("vendorWorkspace")?.classList.remove("hidden");renderVendorWorkspace(db.vendorSheets||{});return;}$("sectionTabs")?.classList.remove("hidden");$("vendorWorkspace")?.classList.add("hidden");document.querySelector("#app main > .hero")?.classList.remove("hidden");$("adminPanel").classList.toggle("hidden",!isAdmin());setupBackupControls();setupExcelAndReview();loadAuditHistory();setupPayrollUI();setupHugoErika();$("dashboardPanel").classList.add("hidden");$("mainPanel").classList.remove("hidden");setupRange();render();}catch(err){$("loginError").textContent=err.message;$("loginError").classList.remove("hidden")}});
$("logoutBtn").onclick=async()=>{try{await api('/api/logout',{method:'POST'})}catch(e){}authToken=null;currentUser=null;window.__CONTROL_HORARIO_TOKEN__=null;window.__CONTROL_HORARIO_USER__=null;window.dispatchEvent(new Event('control-horario-auth'));
  updateSectionTabsVisibility();db={users:[],records:{},locks:{},weekly:{},vacations:{},horarios:{},balanceVisibility:{},version:8};$("sectionTabs")?.classList.remove("hidden");$("vendorWorkspace")?.classList.add("hidden");document.querySelector("#app main > .hero")?.classList.remove("hidden");$("app").classList.add("hidden");$("loginScreen").classList.remove("hidden");$("password").value=""}

function setupRange(){const y=currentDate.getFullYear(),m=currentDate.getMonth();$("rangeStart").value=dateKey(new Date(y,m,1));$("rangeEnd").value=dateKey(new Date(y,m+1,0))}
function renderSelectedEmployeeDailyChart(){const box=$("selectedEmployeeDailyChart");if(!box||!selectedEmployee)return;const y=currentDate.getFullYear(),m=currentDate.getMonth()+1,days=new Date(y,m,0).getDate(),u=selectedEmployee,items=[];for(let d=1;d<=days;d++){const k=`${y}-${pad(m)}-${pad(d)}`,q=dashboardMetricsForUser(u,k);items.push({label:String(d),segments:q.work>0?[{name:u.name,color:u.color||"#172033",minutes:q.work}]:[],vac:q.vac})}const workedDays=items.filter(x=>x.segments.length).length;box.innerHTML='<div class="selected-chart-head"><div><h3>Horas trabajadas por día</h3><p>'+u.name+' · '+workedDays+' día(s) con horas en '+currentDate.toLocaleDateString("es-ES",{month:"long",year:"numeric"})+'</p></div></div>'+chartBars(items,[u]);setupChartTooltips()}
function render(){
  loadPlannedSummary();
 if(!selectedEmployee)return;ensureUserData(selectedEmployee.username);
 $("employeeTitle").textContent=selectedEmployee.name;$("employeeSubtitle").textContent=`Jornada contratada: ${selectedEmployee.weeklyHours} horas semanales`;
 const controlSelector=$("controlEmployeeSelector"),controlSelect=$("controlEmployeeSelect");if(controlSelector&&controlSelect){controlSelector.classList.toggle("hidden",!isAdmin());if(isAdmin()){const activeEmployees=db.users.filter(u=>u.role==="employee"&&u.active!==false);controlSelect.innerHTML=activeEmployees.map(u=>`<option value="${u.username}">${u.name}</option>`).join("");controlSelect.value=selectedEmployee.username;controlSelect.onchange=()=>{selectedEmployee=db.users.find(u=>u.username===controlSelect.value)||selectedEmployee;render()};}}
 const currentWeeklyBalance=latestWeeklyBalance(selectedEmployee);$("heroBalance").textContent=currentWeeklyBalance?fmtMinutes(currentWeeklyBalance.balance):"—";$("heroBalance").className=currentWeeklyBalance?classBalance(currentWeeklyBalance.balance):"neutral";renderEmployeeTopSummary();$("monthLabel").textContent=currentDate.toLocaleDateString("es-ES",{month:"long",year:"numeric"});
 renderEmployeeButtons();renderInactiveEmployees();renderRange();renderSelectedEmployeeDailyChart();loadPayrolls();
 ["calendar","list","balance","weekly","vacations"].forEach(v=>$(v+"View").classList.toggle("hidden",activeView!==v));
 $("rangeBox")?.classList.toggle("hidden",activeView==="weekly");
 $("selectedEmployeeDailyChart")?.classList.toggle("hidden",activeView==="weekly");
 document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.view===activeView));
 if(activeView==="calendar")renderCalendar();if(activeView==="list")renderList();if(activeView==="balance")renderBalance();if(activeView==="weekly")renderWeekly();if(activeView==="vacations")renderVacations();renderMyVacations();
 const ml=$("toggleMonthLock");if(ml){const key=`${currentDate.getFullYear()}-${pad(currentDate.getMonth()+1)}-01`,prev=isPreviousMonth(key),locked=isMonthLocked(key);ml.classList.toggle("hidden",!isAdmin()||!prev);ml.textContent=locked?"🔓 Abrir mes":"🔒 Cerrar mes";ml.onclick=toggleCurrentMonthLock;}
}
function excelDownload(name,rows,sheet='Resumen'){if(!window.XLSX)return alert('No se pudo cargar el exportador Excel. Recarga la página.');const wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet(rows);XLSX.utils.book_append_sheet(wb,ws,sheet.slice(0,31));XLSX.writeFile(wb,name)}
function excelEmployeeRows(u,start=null,end=null){const recs=db.records?.[u.username]||{},vacs=db.vacations?.[u.username]||[];const keys=new Set(Object.keys(recs));vacs.forEach(v=>{for(let d=parseKey(v.start);d<=parseKey(v.end);d.setDate(d.getDate()+1))keys.add(dateKey(d))});return [...keys].sort().filter(k=>(!start||k>=start)&&(!end||k<=end)).map(k=>{const r=recs[k]||{},vac=vacs.find(v=>k>=v.start&&k<=v.end);return [u.name,u.username,k,r.entry||'',r.exit||'',fmtMinutes(workMinutes(r)),Number(r.extraHours)||0,fmtMinutes(extraMinutes(r)),vac?'Sí':'',r.comments||'']})}
function exportEmployeeExcel(){if(!isAdmin())return;const u=selectedEmployee;if(!u)return;excelDownload('control_horario_'+normalizePersonName(u.name).replace(/\s+/g,'_')+'.xlsx',[['Empleado','Usuario','Fecha','Entrada','Salida','Horas normales','Horas extra (h)','Horas extra','Vacaciones','Observaciones'],...excelEmployeeRows(u)],'Registros')}
function exportAllExcel(){if(!isAdmin())return;const rows=[['Empleado','Usuario','Fecha','Entrada','Salida','Horas normales','Horas extra (h)','Horas extra','Vacaciones','Observaciones']];db.users.filter(u=>u.role==='employee').forEach(u=>rows.push(...excelEmployeeRows(u)));excelDownload('control_horario_todos.xlsx',rows,'Registros')}
function periodTotals(u,start,end){let normal=0,extra=0,vac=0;const recs=db.records?.[u.username]||{},vacs=db.vacations?.[u.username]||[];for(let d=parseKey(start);d<=parseKey(end);d.setDate(d.getDate()+1)){const k=dateKey(d),r=recs[k]||{},v=vacs.some(x=>!x.cancelled&&k>=x.start&&k<=x.end);normal+=workMinutes(r);extra+=extraMinutes(r);if(v&&isWeekday(d))vac+=(Number(u.weeklyHours)||0)*60/5}const contract=(Number(u.weeklyHours)||0)*60/5*workingDaysInclusive(parseKey(start),parseKey(end));return {normal,extra,vac,balance:normal+extra+vac-contract}}
function exportMonthlyExcel(){if(!isAdmin())return;const y=currentDate.getFullYear(),m=currentDate.getMonth(),s=dateKey(new Date(y,m,1)),e=dateKey(new Date(y,m+1,0));const rows=[['Empleado','Mes','Horas normales','Horas extra','Vacaciones','Contrato','Saldo']];db.users.filter(u=>u.role==='employee').forEach(u=>{const t=periodTotals(u,s,e);rows.push([u.name,s.slice(0,7),fmtMinutes(t.normal),fmtMinutes(t.extra),fmtMinutes(t.vac),fmtMinutes((Number(u.weeklyHours)||0)*60/5*workingDaysInclusive(parseKey(s),parseKey(e))),fmtMinutes(t.balance)])});excelDownload('resumen_mensual_'+s.slice(0,7)+'.xlsx',rows,'Resumen mensual')}
function exportAnnualExcel(){if(!isAdmin())return;const y=currentDate.getFullYear(),s=y+'-01-01',e=y+'-12-31';const rows=[['Empleado','Año','Horas normales','Horas extra','Vacaciones','Contrato','Saldo']];db.users.filter(u=>u.role==='employee').forEach(u=>{const t=periodTotals(u,s,e);rows.push([u.name,y,fmtMinutes(t.normal),fmtMinutes(t.extra),fmtMinutes(t.vac),fmtMinutes((Number(u.weeklyHours)||0)*60/5*workingDaysInclusive(parseKey(s),parseKey(e))),fmtMinutes(t.balance)])});excelDownload('resumen_anual_'+y+'.xlsx',rows,'Resumen anual')}
function currentWeekRange(){const d=new Date();d.setHours(0,0,0,0);const monday=new Date(d);monday.setDate(monday.getDate()-((monday.getDay()+6)%7));const sunday=new Date(monday);sunday.setDate(sunday.getDate()+6);return {start:dateKey(monday),end:dateKey(sunday)}}
function totalMinutesForDateForUser(user,k){const rec=(db.records?.[user.username]||{})[k]||{};const work=totalMinutes(rec);const vac=(db.vacations?.[user.username]||[]).some(v=>!v.cancelled&&k>=v.start&&k<=v.end)&&isWeekday(parseKey(k))?(Number(user.weeklyHours)||0)*60/5:0;return work+vac}
function employeeWeekSummary(user=selectedEmployee){if(!user)return {worked:0,contract:0};const r=currentWeekRange();let worked=0;for(let d=parseKey(r.start);d<=parseKey(r.end);d.setDate(d.getDate()+1))worked+=totalMinutesForDateForUser(user,dateKey(d));return {worked,contract:(Number(user.weeklyHours)||0)*60,range:r}}
function renderEmployeeTopSummary(){const s=employeeWeekSummary();const w=$("heroWeekWorked"),c=$("heroWeekContract"),r=$("heroWeekRange");if(w)w.textContent=fmtMinutes(s.worked);if(c)c.textContent=fmtMinutes(s.contract);if(r)r.textContent=fmtDate(s.range.start)+" → "+fmtDate(s.range.end)}
function latestWeeklyBalance(u){const rows=(db.weekly[u.username]||[]).slice().sort((a,b)=>a.end.localeCompare(b.end)||a.start.localeCompare(b.start));if(!rows.length)return null;const r=rows[rows.length-1];return {balance:hoursToMinutes(r.worked)-hoursToMinutes(r.contract)+hoursToMinutes(r.previous),start:r.start,end:r.end};}
function sumCurrentEmployeeBalances(){return db.users.filter(u=>u.role==='employee'&&u.active!==false).reduce((sum,u)=>{const last=latestWeeklyBalance(u);return sum+(last?last.balance:0)},0);}
function renderEmployeeButtons(){
 const employees=(db.users||[]).filter(u=>u.role==='employee');
 $("employeeButtons").innerHTML=employees.map(u=>{const last=latestWeeklyBalance(u);const bal=last?fmtMinutes(last.balance):'—';const shown=db.balanceVisibility[u.username]!==false;return `<div class="employee-chip ${shown?'':'balance-hidden'}"><button class="employee-name ${u.username===selectedEmployee.username?'active':''}" style="color:${u.color||'#2563eb'};border-color:${u.color||'#2563eb'}" data-user="${u.username}">${u.name}</button><span class="employee-balance ${last?classBalance(last.balance):''}" title="Última semana: ${last?fmtDate(last.start)+' → '+fmtDate(last.end):'sin lista semanal'}">${bal}</span><span class="employee-chip-actions"><button class="employee-edit" data-edit-user="${u.username}" title="Editar empleado" aria-label="Editar empleado">✎</button><button class="employee-dashboard" data-dashboard-user="${u.username}" title="Ver dashboard del empleado" aria-label="Ver dashboard del empleado">📊</button><button class="employee-delete" data-delete-user="${u.username}" title="Eliminar empleado" aria-label="Eliminar empleado">×</button></span></div>`}).join("")||"<span class='muted'>No hay empleados activos.</span>";
 document.querySelectorAll('[data-user]').forEach(b=>b.onclick=e=>{selectedEmployee=db.users.find(u=>u.username===b.dataset.user)||selectedEmployee;render()});
 document.querySelectorAll('[data-edit-user]').forEach(b=>b.onclick=e=>{e.stopPropagation();openUserModal(b.dataset.editUser)});
 document.querySelectorAll('[data-dashboard-user]').forEach(b=>b.onclick=e=>{e.stopPropagation();selectedEmployee=db.users.find(u=>u.username===b.dataset.dashboardUser)||selectedEmployee;$("balancesPanel").classList.add('hidden');$("dashboardPanel").classList.remove('hidden');$("mainPanel").classList.add('hidden');renderDashboard('employee')});
 document.querySelectorAll('[data-delete-user]').forEach(b=>b.onclick=e=>{e.stopPropagation();deleteUserWithDoubleConfirmation(b.dataset.deleteUser)});
}
function reviewCurrentWeek(){if(!isAdmin())return;const range=currentWeekRange(),employees=db.users.filter(u=>u.role==='employee'&&u.active!==false),lines=[];employees.forEach(u=>{let daily=0,missing=0,vacDays=0;for(let d=parseKey(range.start);d<=parseKey(range.end);d.setDate(d.getDate()+1)){if(!isWeekday(d))continue;const k=dateKey(d),rec=(db.records?.[u.username]||{})[k]||{},vac=(db.vacations?.[u.username]||[]).some(v=>k>=v.start&&k<=v.end);if(vac){vacDays++;continue}const mins=totalMinutes(rec);daily+=mins;if(!rec.entry&&!rec.exit&&mins===0)missing++}const row=(db.weekly?.[u.username]||[]).find(x=>x.start===range.start&&x.end===range.end),expected=row?hoursToMinutes(row.worked):(Number(u.weeklyHours)||0)*60,diff=daily+vacDays*(Number(u.weeklyHours)||0)*60/5-expected,status=[];if(missing)status.push(missing+' día(s) sin fichaje');if(row&&Math.abs(diff)>1)status.push('diario vs semanal '+fmtMinutes(diff));if(!row)status.push('sin cierre semanal');if(!status.length)status.push('OK');lines.push('<div class="review-row"><strong>'+u.name+'</strong><span>'+status.join(' · ')+'</span></div>')});const box=$("weekReviewBox");if(box){box.innerHTML='<h3>Revisión de semana</h3><p>Semana '+fmtDate(range.start)+' → '+fmtDate(range.end)+'</p>'+lines.join('');box.classList.remove('hidden')}}
function renderInactiveEmployees(){
 if(!isAdmin())return;
 const all=db.users.filter(u=>u.role==="employee"),box=$("inactiveEmployees"),btn=$("toggleInactiveEmployees");
 if(!box)return;
 const inactive=all.filter(u=>u.active===false);
 box.innerHTML=inactive.map(u=>`<div class="inactive-row"><span>${u.name} <small>@${u.username}</small></span><button class="small-btn reactivate-user" data-reactivate="${u.username}">Activar</button></div>`).join("")||'<span class="muted">No hay empleados inactivos.</span>';
 box.classList.toggle("hidden",!inactiveEmployeesVisible);
 if(btn){btn.classList.toggle("hidden",!inactive.length);btn.textContent=inactiveEmployeesVisible?"Ocultar no activos":"Ver no activos";}
 document.querySelectorAll("[data-reactivate]").forEach(b=>b.onclick=async()=>{const u=db.users.find(x=>x.username===b.dataset.reactivate);if(!u)return;const out=await api(`/api/admin/user/${encodeURIComponent(u.username)}`,{method:"PUT",body:JSON.stringify({name:u.name,weeklyHours:u.weeklyHours,active:true})});db=out;renderEmployeeButtons();renderInactiveEmployees();});
}
function calendarMarkControl(key,type,scope){
 if(!isAdmin())return '';
 const label=type==='week'?'☀ Horario semana':type==='holiday'?'✦ Horario festivo':'＋ Marcar';
 return '<div class="calendar-mark-wrap" data-mark-wrap="'+scope+'"><button type="button" class="calendar-mark-trigger '+(type?'is-marked mark-type-'+type:'')+'" data-mark-toggle="'+key+'" aria-label="Marcar '+key+'" aria-expanded="false">'+label+'</button><div class="calendar-mark-menu hidden" data-mark-menu="'+key+'"><button type="button" class="mark-option mark-week" data-mark-set="'+key+'" data-mark-type="week">☀ Horario semana</button><button type="button" class="mark-option mark-holiday" data-mark-set="'+key+'" data-mark-type="holiday">✦ Horario festivo</button><button type="button" class="mark-option mark-clear" data-mark-set="'+key+'" data-mark-type="">× Sin marca</button></div></div>';
}
function bindCalendarMarkControls(root,renderFn){
 if(!root)return;
 root.querySelectorAll('[data-mark-toggle]').forEach(btn=>btn.onclick=e=>{e.preventDefault();e.stopPropagation();const menu=root.querySelector('[data-mark-menu="'+btn.dataset.markToggle+'"]');const opening=menu?.classList.contains('hidden');root.querySelectorAll('[data-mark-menu]').forEach(m=>m.classList.add('hidden'));root.querySelectorAll('[data-mark-toggle]').forEach(b=>b.setAttribute('aria-expanded','false'));if(menu&&opening){menu.classList.remove('hidden');btn.setAttribute('aria-expanded','true')}});
 root.querySelectorAll('[data-mark-set]').forEach(btn=>btn.onclick=async e=>{e.preventDefault();e.stopPropagation();if(!isAdmin())return;const key=btn.dataset.markSet,type=btn.dataset.markType;if(type)db.calendarDayTypes[key]=type;else delete db.calendarDayTypes[key];await saveDB();renderFn()});
}
function renderCalendar(){
 const y=currentDate.getFullYear(),m=currentDate.getMonth(),first=new Date(y,m,1),days=new Date(y,m+1,0).getDate(),start=(first.getDay()+6)%7,recs=userRecords(),locks=userLocks();
 db.calendarDayTypes=db.calendarDayTypes||{};db.calendarEvents=Array.isArray(db.calendarEvents)?db.calendarEvents:[];
 let h=`${isAdmin()?'<div class="calendar-admin-tools"><button type="button" id="addCalendarEventBtn" class="primary">＋ Añadir evento</button><div id="calendarEventForm" class="calendar-event-form '+(calendarEventDraftOpen?'':'hidden')+'"><h3>Evento especial</h3><form id="calendarEventFormInner"><label>Día<input id="calendarEventDate" type="date" required value="'+dateKey(currentDate)+'"></label><label>Observaciones<textarea id="calendarEventObservations" rows="2" maxlength="1000" required placeholder="Describe el evento especial"></textarea></label><div class="modal-actions"><button type="button" id="cancelCalendarEvent" class="ghost">Cancelar</button><button type="submit" class="primary">Guardar evento</button></div></form></div></div>':''}${!isAdmin()?'<div class="day-off-request-tools"><button type="button" id="requestDayOffBtn" class="primary">＋ Solicitar día libre</button><div id="dayOffRequestForm" class="day-off-request-form hidden"><h3>Solicitar día libre</h3><form id="dayOffForm"><div class="two-col"><label>Fecha de inicio<input id="dayOffStart" type="date" required></label><label>Fecha de fin<input id="dayOffEnd" type="date" required></label></div><label>Prioridad<select id="dayOffPriority" required><option value="green">🟢 Verde · Si se puede</option><option value="yellow">🟡 Amarillo · Es importante</option><option value="red">🔴 Rojo · Realmente necesito el día</option></select></label><label>Observaciones<textarea id="dayOffObservations" rows="3" maxlength="1000" placeholder="Cuéntanos el motivo o cualquier detalle importante"></textarea></label><div class="modal-actions"><button type="button" id="cancelDayOff" class="ghost">Cancelar</button><button type="submit" class="primary">Enviar solicitud</button></div></form></div></div>':''}<div class="calendar">${["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map(x=>`<div class="weekday">${x}</div>`).join("")}`;
 for(let i=0;i<start;i++)h+='<div class="day empty"></div>';
 for(let d=1;d<=days;d++){
  const k=`${y}-${pad(m+1)}-${pad(d)}`,r=recs[k]||{},mins=totalMinutes(r),locked=isDayLocked(k),monthLocked=isMonthLocked(k),vac=vacationForDate(k),today=k===dateKey(new Date()),dayType=db.calendarDayTypes[k]||'',specialEvents=db.calendarEvents.filter(ev=>ev.date===k);
  h+=`<div class="day ${today?"today":""} ${locked?"locked-day":""} ${vac?"vacation-day":""} ${dayType==='week'?'calendar-week-type':dayType==='holiday'?'calendar-holiday-type':''}" data-day="${k}">
   <div class="day-top"><div class="day-number">${d}</div>${isAdmin()?`${calendarMarkControl(k,dayType,'main')}`:''}${isAdmin()?`<button class="day-lock ${locked?"is-locked":""}" data-lock-day="${k}" title="${locked?"Desbloquear día":(monthLocked?"Mes cerrado por defecto; usa el botón del mes para abrirlo":"Bloquear día")}">${locked?"🔒":(monthLocked?"🔐":"🔓")}</button>`:""}</div>
   <div class="day-data">${locked?'<div class="lock-mini">🔒 Bloqueado</div>':""}${vac?'<div class="vacation-mini">🏖 Vacaciones</div>':""}
   ${(db.dayOffRequests||[]).filter(q=>q.start<=k&&q.end>=k).map(q=>`<div class="day-off-calendar-mark day-off-${escapeHtml(q.priority)}" title="Solicitud de día libre">${isAdmin()?escapeHtml((db.users||[]).find(u=>u.username===q.username)?.name||q.username)+": ":""}Solicitud de día libre${isAdmin()?" · "+escapeHtml(requestFlagsLabel(q)):" · "+escapeHtml(requestStatusLabel(q.status))}</div>`).join("")}${r.entry||r.exit?`<div>${r.entry||"--"} → ${r.exit||"--"}</div>`:`<div class="day-missing">${vac?"Día de vacaciones":"Sin registro"}</div>`}
   <div class="day-hours">${mins?fmtMinutes(mins):""}${vac?`<span class="vac-hours"> +${fmtMinutes(vacationMinutesForDate(k))}</span>`:""}</div>${extraMinutes(r)?`<div class="day-extra">+${fmtMinutes(extraMinutes(r))} extra</div>`:""}${r.comments?`<div class="has-comment">💬 Comentario</div>`:""}${specialEvents.map(ev=>`<div class="calendar-special-event" title="${escapeHtml(ev.observations)}">📌 ${escapeHtml(ev.observations)}</div>`).join('')}
   </div></div>`;
 }
 $("calendarView").innerHTML=h+"</div>";
 const requestBtn=$("requestDayOffBtn"),requestForm=$("dayOffRequestForm");if(requestBtn&&requestForm){requestBtn.onclick=()=>requestForm.classList.toggle("hidden");$("cancelDayOff").onclick=()=>requestForm.classList.add("hidden");$("dayOffForm").onsubmit=async e=>{e.preventDefault();const start=$("dayOffStart").value,end=$("dayOffEnd").value;if(!start||!end||end<start){alert("La fecha de fin debe ser igual o posterior a la fecha de inicio.");return}try{await api("/api/day-off-requests",{method:"POST",body:JSON.stringify({start,end,priority:$("dayOffPriority").value,observations:$("dayOffObservations").value})});alert("Solicitud enviada. Solo tú y administración podéis verla.");requestForm.classList.add("hidden");$("dayOffForm").reset();await refreshPrivateRequests();renderCalendar();renderVacationsSection()}catch(err){alert(err.message)}}}
 const addEventBtn=$("addCalendarEventBtn"),eventForm=$("calendarEventForm");if(addEventBtn&&eventForm){addEventBtn.onclick=()=>{calendarEventDraftOpen=!calendarEventDraftOpen;eventForm.classList.toggle("hidden",!calendarEventDraftOpen)};$("cancelCalendarEvent").onclick=()=>{calendarEventDraftOpen=false;eventForm.classList.add("hidden")};$("calendarEventFormInner").onsubmit=async e=>{e.preventDefault();const date=$("calendarEventDate").value,observations=$("calendarEventObservations").value.trim();if(!isAdmin()||!date||!observations)return;db.calendarEvents.push({id:"cal-event-"+Date.now(),date,observations});await saveDB();calendarEventDraftOpen=false;renderCalendar()}}
 document.querySelectorAll("#calendarView [data-day]").forEach(el=>el.onclick=()=>openDay(el.dataset.day));
 bindCalendarMarkControls(document.querySelector('#calendarView'),renderCalendar);
 document.querySelectorAll("[data-lock-day]").forEach(b=>b.onclick=e=>{e.stopPropagation();toggleDayLock(b.dataset.lockDay)});
}
function renderList(){
 const y=currentDate.getFullYear(),m=currentDate.getMonth(),days=new Date(y,m+1,0).getDate(),recs=userRecords(),locks=userLocks();let rows="";
 for(let d=1;d<=days;d++){const k=`${y}-${pad(m+1)}-${pad(d)}`,r=recs[k]||{},mins=totalMinutes(r),vac=vacationForDate(k);rows+=`<tr data-day="${k}"><td>${fmtDate(k)}</td><td>${(locks[k]||isMonthLocked(k))?"🔒 ":""}${r.entry||"—"}</td><td>${r.exit||"—"}</td><td>${mins?fmtMinutes(mins):vac?"—":"—"}</td><td>${extraMinutes(r)?fmtMinutes(extraMinutes(r)):"—"}</td><td>${vac?"🏖 Vacaciones":""}${r.comments||""}</td></tr>`}
 $("listView").innerHTML=`<table class="data-table"><thead><tr><th>Fecha</th><th>Entrada</th><th>Salida</th><th>Horas</th><th>Extras</th><th>Comentarios</th></tr></thead><tbody>${rows}</tbody></table>`;
 document.querySelectorAll("#listView [data-day]").forEach(el=>el.onclick=()=>openDay(el.dataset.day));
}
function renderBalance(){
 const recs=userRecords(),keys=Object.keys(recs).sort(),vacs=vacations(),now=new Date();now.setHours(0,0,0,0);let total=0;
 keys.forEach(k=>{if(parseKey(k)<=now)total+=totalMinutes(recs[k])});
 let vacTotal=0;vacs.filter(v=>!v.cancelled).forEach(v=>{const s=parseKey(v.start),e=parseKey(v.end),end=e<now?e:now;if(s<=end)vacTotal+=dailyContractMinutes()*workingDaysInclusive(s,end)});
 const firstCandidates=keys.map(parseKey).concat(vacs.map(v=>parseKey(v.start))).filter(d=>d<=now);const start=firstCandidates.length?new Date(Math.min(...firstCandidates.map(d=>d.getTime()))):now;const days=firstCandidates.length?daysInclusive(start,now):0,contract=dailyContractMinutes()*days,balance=total+vacTotal-contract;
 $("balanceView").innerHTML=`<div class="summary-strip"><div><span>Horas trabajadas</span><strong>${fmtMinutes(total)}</strong></div><div><span>Horas de vacaciones</span><strong>${fmtMinutes(vacTotal)}</strong></div><div><span>Contrato estimado</span><strong>${fmtMinutes(contract)}</strong></div><div><span>Balance</span><strong class="${classBalance(balance)}">${fmtMinutes(balance)}</strong></div></div><div class="balance-card"><h3>Resumen acumulado</h3><table class="data-table"><tbody><tr><td>Desde</td><td>${firstCandidates.length?fmtDate(dateKey(start)):"—"}</td></tr><tr><td>Hasta</td><td>${firstCandidates.length?fmtDate(dateKey(now)):"—"}</td></tr><tr><td>Horas trabajadas</td><td>${fmtMinutes(total)}</td></tr><tr><td>Horas de vacaciones</td><td>${fmtMinutes(vacTotal)}</td></tr><tr><td>Contrato estimado</td><td>${fmtMinutes(contract)}</td></tr><tr><td>Balance</td><td class="${classBalance(balance)}">${fmtMinutes(balance)}</td></tr></tbody></table></div>`;
}
function calculateBalanceToDate(){
 const recs=userRecords(),now=new Date();now.setHours(0,0,0,0);let dates=Object.keys(recs).map(parseKey).filter(d=>d<=now).concat(vacations().map(v=>parseKey(v.start)).filter(d=>d<=now));if(!dates.length)return 0;const first=new Date(Math.min(...dates.map(d=>d.getTime())));let total=0;for(let d=new Date(first);d<=now;d.setDate(d.getDate()+1))total+=totalMinutesForDate(dateKey(d));return total-dailyContractMinutes()*daysInclusive(first,now);
}
function renderRange(){
 const s=new Date($("rangeStart").value+"T00:00:00"),e=new Date($("rangeEnd").value+"T00:00:00");if(isNaN(s)||isNaN(e)||e<s){$("rangeHours").textContent="0:00";$("rangeBalance").textContent="0:00";return}
 let worked=0;for(let d=new Date(s);d<=e;d.setDate(d.getDate()+1))worked+=totalMinutesForDate(dateKey(d));const balance=worked-(dailyContractMinutes()*daysInclusive(s,e));$("rangeHours").textContent=fmtMinutes(worked);$("rangeBalance").textContent=fmtMinutes(balance);$("rangeBalance").className=classBalance(balance);
}
$("rangeStart").onchange=renderRange;$("rangeEnd").onchange=renderRange;
async function toggleCurrentMonthLock(){if(!isAdmin())return;const mk=`${currentDate.getFullYear()}-${pad(currentDate.getMonth()+1)}`;db.monthLocks=db.monthLocks||{};db.monthLocks[mk]=db.monthLocks[mk]===true?false:true;await saveDB();render()}
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{activeView=b.dataset.view;render()});
$("prevMonth").onclick=()=>{currentDate.setMonth(currentDate.getMonth()-1);setupRange();render()};$("nextMonth").onclick=()=>{currentDate.setMonth(currentDate.getMonth()+1);setupRange();render()};

function openDay(k){selectedDate=k;const r=userRecords()[k]||{},manualLocked=!!userLocks()[k],monthLocked=isMonthLocked(k),locked=isDayLocked(k),editable=canEditDay(k);$("modalDate").textContent=fmtLong(k);$("entryTime").value=r.entry||"";$("exitTime").value=r.exit||"";$("extraHours").value=r.extraHours??"";$("comments").value=r.comments||"";$("dayLockNotice").classList.toggle("hidden",!locked);$("dayLockNotice").textContent=monthLocked?"🔒 Este mes está cerrado por defecto porque es anterior al mes actual.":"🔒 Este día está bloqueado por el administrador.";$("dayForm").querySelectorAll("input,textarea").forEach(x=>x.disabled=!editable);$("deleteDay").disabled=!editable;$("deleteDay").textContent=isAdmin()&&locked?"Desbloquea para editar/borrar":"Borrar día";updateWorkedPreview();$("dayModal").classList.remove("hidden")}
function updateWorkedPreview(){const r={entry:$("entryTime").value,exit:$("exitTime").value};$("workedPreview").value=workMinutes(r)?fmtMinutes(workMinutes(r)):"0:00"}
function setupManualTimeInputs(){
 ["entryTime","exitTime"].forEach(id=>{
   const input=$(id);if(!input)return;
   input.addEventListener("input",()=>{
     const digits=input.value.replace(/\D/g,"").slice(0,4);
     input.value=digits.length===4?`${digits.slice(0,2)}:${digits.slice(2)}`:digits;
     updateWorkedPreview();
   });
 });
}
$("entryTime").oninput=updateWorkedPreview;$("exitTime").oninput=updateWorkedPreview;setupManualTimeInputs();$("closeModal").onclick=()=>$("dayModal").classList.add("hidden");$("dayModal").onclick=e=>{if(e.target.id==="dayModal")$("dayModal").classList.add("hidden")};
$("dayForm").onsubmit=async e=>{
 e.preventDefault();
 if(!canEditDay(selectedDate)){alert("Este día está bloqueado por el administrador.");return}
 const entry=normalizeTimeValue($("entryTime").value),exit=normalizeTimeValue($("exitTime").value);
 if(entry===null||exit===null){alert("Introduce la hora con formato HH:MM. También puedes escribirla sin dos puntos, por ejemplo 1336.");return}
 $("entryTime").value=entry;$("exitTime").value=exit;
 ensureUserData(selectedEmployee.username);
 const r={entry,exit,extraHours:Number($("extraHours").value)||0,comments:$("comments").value.trim()};
 try{const out=await api('/api/records/'+encodeURIComponent(selectedEmployee.username)+'/'+encodeURIComponent(selectedDate),{method:'PUT',body:JSON.stringify({record:r})});ensureUserData(selectedEmployee.username);if(out.record)db.records[selectedEmployee.username][selectedDate]=out.record;else delete db.records[selectedEmployee.username][selectedDate];$("dayModal").classList.add("hidden");render()}catch(err){alert("El servidor no ha guardado las horas. No se han dado por guardadas. Detalle: "+err.message)}
};
$("deleteDay").onclick=async()=>{if(!canEditDay(selectedDate)){alert("Este día está bloqueado por el administrador.");return}if(!confirm("¿Seguro que quieres borrar este registro diario?"))return;try{await api('/api/records/'+encodeURIComponent(selectedEmployee.username)+'/'+encodeURIComponent(selectedDate),{method:'PUT',body:JSON.stringify({record:null})});ensureUserData(selectedEmployee.username);delete db.records[selectedEmployee.username][selectedDate];$("dayModal").classList.add("hidden");render()}catch(err){alert("No se ha podido borrar el registro. Detalle: "+err.message)}};
function toggleDayLock(k){if(!isAdmin())return;ensureUserData(selectedEmployee.username);db.locks[selectedEmployee.username][k]=isDayLocked(k)?false:true;saveDB();render()}

function renderWeekly(){const rows=weeklyRows();let h=`<div class="weekly-head"><div><h3>Historial</h3><p>Balance = Esta semana − Contrato + Anterior.</p></div><button id="addWeeklyBtn" class="primary">+ Añadir línea</button></div>`;if(!rows.length)h+='<div class="empty-state">No hay líneas semanales todavía.</div>';else h+=`<div class="weekly-list">${rows.map(r=>{const bal=hoursToMinutes(r.worked)-hoursToMinutes(r.contract)+hoursToMinutes(r.previous);return `<div class="weekly-row ${classBalance(bal)} ${r.locked?"weekly-locked":""}"><div class="weekly-dates"><strong>${fmtDate(r.start)}</strong><span>→</span><strong>${fmtDate(r.end)}</strong>${r.locked?"<span class='lock-pill'>🔒 Bloqueado</span>":""}</div><div><span>Anterior</span><strong>${fmtMinutes(hoursToMinutes(r.previous))}</strong></div><div><span>Contrato</span><strong>${fmtMinutes(hoursToMinutes(r.contract))}</strong></div><div><span>Esta semana</span><strong>${fmtMinutes(hoursToMinutes(r.worked))}</strong></div><div><span>Balance</span><strong class="${classBalance(bal)}">${fmtMinutes(bal)}</strong></div>${isAdmin()?`<div class="weekly-admin"><button class="small-btn edit-weekly" data-id="${r.id}">Editar</button><button class="small-btn lock-weekly" data-id="${r.id}">${r.locked?"🔓 Abrir semana":"🔒 Cerrar semana"}</button></div>`:""}</div>`}).join("")}</div>`;$("weeklyView").innerHTML=h;$("addWeeklyBtn")?.addEventListener("click",()=>{if(!isAdmin()){alert("Solo el administrador puede añadir líneas al historial.");return}openWeekly()});document.querySelectorAll(".edit-weekly").forEach(b=>b.onclick=()=>openWeekly(b.dataset.id));document.querySelectorAll(".lock-weekly").forEach(b=>b.onclick=()=>toggleWeeklyLock(b.dataset.id))}
function workedMinutesInRange(username,start,end){if(!username||!start||!end||end<start)return 0;const recs=db.records?.[username]||{};let total=0;for(let d=parseKey(start);d<=parseKey(end);d.setDate(d.getDate()+1)){const key=dateKey(d);total+=workMinutes(recs[key]||{});}return total}
function updateWeeklyRangeWorked(){const s=$("weeklyStart").value,e=$("weeklyEnd").value;if(!s||!e||e<s){$("weeklyRangeWorked").textContent="Selecciona un rango válido para calcular las horas trabajadas.";return}const mins=workedMinutesInRange(selectedEmployee?.username,s,e);$("weeklyWorked").value=(mins/60).toFixed(2);$("weeklyRangeWorked").textContent="Horas trabajadas en el rango: "+fmtMinutes(mins);updateWeeklyPreview()}
function openWeekly(id=null){selectedWeeklyId=id;const r=id?weeklyRows().find(x=>x.id===id):{start:"",end:"",calcStart:"",calcEnd:"",previous:0,contract:selectedEmployee.weeklyHours,worked:0,locked:false};$("weeklyModalTitle").textContent=id?"Editar línea semanal":"Nueva línea semanal";$("weeklyStart").value=r.start;$("weeklyEnd").value=r.end;$("weeklyPrevious").value=r.previous??0;$("weeklyContract").value=r.contract??selectedEmployee.weeklyHours;$("weeklyWorked").value=r.worked??0;const locked=r.locked!==false;$("weeklyLockNotice").classList.toggle("hidden",!locked);$("weeklyForm").querySelectorAll("input").forEach(x=>x.disabled=locked&&!isAdmin());$("deleteWeekly").disabled=locked&&!isAdmin();$("weeklyModal").classList.remove("hidden");if($("weeklyStart").value&&$("weeklyEnd").value)updateWeeklyRangeWorked();else updateWeeklyPreview()}
function updateWeeklyPreview(){const b=hoursToMinutes($("weeklyWorked").value)-hoursToMinutes($("weeklyContract").value)+hoursToMinutes($("weeklyPrevious").value);$("weeklyBalancePreview").textContent=fmtMinutes(b)}
["weeklyPrevious","weeklyContract","weeklyWorked"].forEach(id=>$(id).oninput=updateWeeklyPreview);["weeklyStart","weeklyEnd"].forEach(id=>$(id).addEventListener("change",updateWeeklyRangeWorked));$("closeWeeklyModal").onclick=()=>$("weeklyModal").classList.add("hidden");$("weeklyModal").onclick=e=>{if(e.target.id==="weeklyModal")$("weeklyModal").classList.add("hidden")};
$("weeklyForm").onsubmit=e=>{e.preventDefault();if(selectedWeeklyId&&weeklyRows().find(x=>x.id===selectedWeeklyId)?.locked&&!isAdmin()){alert("Esta línea está bloqueada por el administrador.");return}ensureUserData(selectedEmployee.username);const row={id:selectedWeeklyId||("w_"+Date.now()),start:$("weeklyStart").value,end:$("weeklyEnd").value,calcStart:$("weeklyStart").value,calcEnd:$("weeklyEnd").value,previous:Number($("weeklyPrevious").value)||0,contract:Number($("weeklyContract").value)||0,worked:Number($("weeklyWorked").value)||0,locked:true};if(!row.start||!row.end||row.end<row.start){alert("Revisa las fechas.");return}const arr=db.weekly[selectedEmployee.username],i=arr.findIndex(x=>x.id===row.id);if(i>=0){row.locked=arr[i].locked;arr[i]=row}else arr.push(row);saveDB();$("weeklyModal").classList.add("hidden");render()};
function workingDaysInclusive(s,e){let n=0;for(let d=new Date(s);d<=e;d.setDate(d.getDate()+1))if(isWeekday(d))n++;return n}

function euro(value){return (Number(value)||0).toLocaleString('es-ES',{style:'currency',currency:'EUR'})}
function heValues(){const hours=Number($('heHours').value)||0,festiveHours=Number($('heFestiveHours').value)||0,rate=Number($('heRate').value)||0,festiveRate=Number($('heFestiveRate').value)||0,extraIncome=Number($('heExtraIncome').value)||0,payroll=Number($('hePayroll').value)||0;const total=hours*rate+festiveHours*festiveRate+extraIncome;return {hours,festiveHours,extraHours:0,rate,festiveRate,extraRate:0,extraIncome,payroll,total,hand:total-payroll}}
function updateHePreview(){const v=heValues();$('heTotalPreview').textContent=euro(v.total);$('heHandPreview').textContent=euro(v.hand)}
async function loadHeRecords(){try{hugoErikaRecords=await api('/api/admin/hugo-erika');renderHeRecords()}catch(e){$('heRecordsList').innerHTML='<div class="empty-state">'+escapeHtml(e.message)+'</div>'}}
async function saveHeRecords(){await api('/api/admin/hugo-erika',{method:'PUT',body:JSON.stringify({records:hugoErikaRecords})})}
function resetHeForm(){editingHeId=null;$('heForm').reset();$('heHours').value='0';$('heFestiveHours').value='0';$('heRate').value='0';$('heFestiveRate').value='0';$('heExtraIncome').value='0';$('hePayroll').value='0';$('heSaveBtn').textContent='Guardar registro';$('heCancelEdit').classList.add('hidden');updateHePreview()}
function renderHeRecords(){const monthFilter=$('heFilterMonth').value,yearFilter=$('heFilterYear').value,employeeFilter=$('heFilterEmployee').value;const rows=hugoErikaRecords.filter(r=>(!monthFilter||r.month===monthFilter)&&(!yearFilter||r.month.startsWith(yearFilter))&&(!employeeFilter||r.employee===employeeFilter)).sort((a,b)=>b.month.localeCompare(a.month)||a.employee.localeCompare(b.employee));const years=[...new Set(hugoErikaRecords.map(r=>r.month.slice(0,4)))].sort().reverse();$('heFilterYear').innerHTML='<option value="">Todos los años</option>'+years.map(y=>'<option value="'+y+'">'+y+'</option>').join('');$('heFilterYear').value=yearFilter;$('heCount').textContent=rows.length;$('heSumTotal').textContent=euro(rows.reduce((s,r)=>s+(Number(r.total)||0),0));$('heSumPayroll').textContent=euro(rows.reduce((s,r)=>s+(Number(r.payroll)||0),0));$('heSumHand').textContent=euro(rows.reduce((s,r)=>s+(Number(r.hand)||0),0));$('heRecordsList').innerHTML=rows.length?'<div class="he-table-wrap"><table class="he-table"><thead><tr><th>Periodo</th><th>Nombre</th><th>Hs precio hs</th><th>Hs festivo</th><th>Precio hs festivo</th><th>Extra €</th><th>Total</th><th>Nómina</th><th>En mano</th><th>Acciones</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+new Date(r.month+'-15T12:00:00').toLocaleDateString('es-ES',{month:'short',year:'numeric'})+'</td><td><strong>'+escapeHtml(r.employee)+'</strong></td><td>'+Number(r.hours||0).toLocaleString('es-ES')+' × '+euro(r.rate)+'</td><td>'+Number(r.festiveHours||0).toLocaleString('es-ES')+'</td><td>'+euro(r.festiveRate)+'</td><td>'+euro(r.extraIncome)+'</td><td><strong>'+euro(r.total)+'</strong></td><td>'+euro(r.payroll)+'</td><td><strong>'+euro(r.hand)+'</strong></td><td><div class="he-row-actions"><button class="small-btn" data-he-edit="'+r.id+'">Editar</button><button class="small-btn danger-small" data-he-delete="'+r.id+'">Eliminar</button></div></td></tr>').join('')+'</tbody></table></div>':'<div class="empty-state">No hay registros para los filtros seleccionados.</div>';document.querySelectorAll('[data-he-edit]').forEach(b=>b.onclick=()=>editHeRecord(b.dataset.heEdit));document.querySelectorAll('[data-he-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('¿Eliminar este registro mensual?'))return;hugoErikaRecords=hugoErikaRecords.filter(r=>r.id!==b.dataset.heDelete);try{await saveHeRecords();renderHeRecords()}catch(e){alert(e.message);loadHeRecords()}})}
function editHeRecord(id){const r=hugoErikaRecords.find(x=>x.id===id);if(!r)return;editingHeId=id;for(const [field,key] of [['Month','month'],['Employee','employee'],['Hours','hours'],['Rate','rate'],['FestiveHours','festiveHours'],['FestiveRate','festiveRate'],['ExtraIncome','extraIncome'],['Payroll','payroll']])$('he'+field).value=r[key]??'';$('heSaveBtn').textContent='Guardar cambios';$('heCancelEdit').classList.remove('hidden');updateHePreview();$('heForm').scrollIntoView({behavior:'smooth',block:'start'})}
function setupHugoErika(){if(!isAdmin())return;const now=new Date();$('heMonth').value=$('heMonth').value||now.getFullYear()+'-'+pad(now.getMonth()+1);['heHours','heFestiveHours','heRate','heFestiveRate','heExtraIncome','hePayroll'].forEach(id=>$(id).addEventListener('input',updateHePreview));['heFilterMonth','heFilterYear','heFilterEmployee'].forEach(id=>$(id).addEventListener('change',renderHeRecords));$('heCancelEdit').onclick=resetHeForm;$('heForm').onsubmit=async e=>{e.preventDefault();const v=heValues(),month=$('heMonth').value,employee=$('heEmployee').value;if(!month)return alert('Selecciona el mes y el año.');const row={id:editingHeId||('he_'+Date.now()),employee,month,...v};const duplicate=hugoErikaRecords.find(r=>r.employee===employee&&r.month===month&&r.id!==editingHeId);if(duplicate&&!confirm('Ya existe un registro de '+employee+' para ese mes. ¿Quieres sustituirlo?'))return;if(duplicate)hugoErikaRecords=hugoErikaRecords.filter(r=>r.id!==duplicate.id);const idx=hugoErikaRecords.findIndex(r=>r.id===row.id);if(idx>=0)hugoErikaRecords[idx]=row;else hugoErikaRecords.push(row);try{await saveHeRecords();resetHeForm();renderHeRecords()}catch(err){alert(err.message)}};loadHeRecords()}

function renderVacations(){const rows=vacations();let h=`<div class="weekly-head"><div><h3>Vacaciones</h3><p>Se cuentan las horas de contrato de cada día laborable (lunes a viernes) del periodo.</p></div>${isAdmin()?'<button id="addVacationBtn" class="primary">+ Añadir vacaciones</button>':""}</div>`;if(!rows.length)h+='<div class="empty-state">No hay periodos de vacaciones.</div>';else h+=`<div class="vacation-list">${rows.map(v=>{const n=workingDaysInclusive(parseKey(v.start),parseKey(v.end));return `<div class="vacation-row"><div><strong>${fmtDate(v.start)}</strong> → <strong>${fmtDate(v.end)}</strong><span>${n} días laborables · ${fmtMinutes(n*dailyContractMinutes())} horas</span></div><div class="vacation-actions"><button class="small-btn edit-vacation" data-id="${v.id}">Editar</button><button class="small-btn danger-small delete-vacation" data-id="${v.id}">Eliminar</button></div></div>`}).join('')}</div>`;$('vacationsView').innerHTML=h;if($('addVacationBtn'))$('addVacationBtn').onclick=()=>openVacation();document.querySelectorAll('.edit-vacation').forEach(b=>b.onclick=()=>openVacation(b.dataset.id));document.querySelectorAll('.delete-vacation').forEach(b=>b.onclick=()=>deleteVacation(b.dataset.id))}
function openVacation(id=null){selectedVacationId=id;const v=id?vacations().find(x=>x.id===id):{start:"",end:""};$('vacationStart').value=v.start||"";$('vacationEnd').value=v.end||"";updateVacationPreview();$('vacationModal').classList.remove('hidden')}
function updateVacationPreview(){const sv=$('vacationStart').value,ev=$('vacationEnd').value;if(!sv||!ev){$('vacationDaysPreview').textContent='0 días laborables · 0:00 horas';return}const s=parseKey(sv),e=parseKey(ev);if(isNaN(s)||isNaN(e)||e<s){$('vacationDaysPreview').textContent='0 días laborables · 0:00 horas';return}const n=workingDaysInclusive(s,e);$('vacationDaysPreview').textContent=`${n} días laborables · ${fmtMinutes(n*dailyContractMinutes())} horas`}
$('vacationStart').oninput=updateVacationPreview;$('vacationEnd').oninput=updateVacationPreview;$('closeVacationModal').onclick=()=>$('vacationModal').classList.add('hidden');$('cancelVacation').onclick=()=>$('vacationModal').classList.add('hidden');$('vacationModal').onclick=e=>{if(e.target.id==='vacationModal')$('vacationModal').classList.add('hidden')};
$('vacationForm').onsubmit=e=>{e.preventDefault();ensureUserData(selectedEmployee.username);const start=$('vacationStart').value,end=$('vacationEnd').value;if(!start||!end||end<start){alert('Revisa el rango de vacaciones.');return}const arr=db.vacations[selectedEmployee.username];const row={id:selectedVacationId||('v_'+Date.now()),start,end};const i=arr.findIndex(x=>x.id===row.id);if(i>=0)arr[i]=row;else arr.push(row);saveDB();$('vacationModal').classList.add('hidden');render()};
function deleteVacation(id){if(!confirm("¿Eliminar este periodo de vacaciones?"))return;db.vacations[selectedEmployee.username]=(db.vacations[selectedEmployee.username]||[]).filter(x=>x.id!==id);saveDB();render()}

function openUserModal(username=null){editingUsername=username;const u=username?db.users.find(x=>x.username===username):null;$("userModalTitle").textContent=u?"Editar usuario":"Crear usuario";$("userSubmit").textContent=u?"Guardar cambios":"Crear usuario";$("newName").value=u?.name||"";$("newUsername").value=u?.username||"";$("newPassword").value="";$("newPassword").placeholder=u?"Dejar vacío para mantener la contraseña":"Contraseña";$("userFormStatus").textContent="";$("newPassword").required=!u;$("newWeeklyHours").value=u?.weeklyHours??40;$("newColor").value=u?.color||"#2563eb";$("newActive").checked=u?u.active!==false:true;$("newUsername").disabled=!!u;$("userModal").classList.remove("hidden")}
$("addUserBtn").onclick=()=>openUserModal();$("closeUserModal").onclick=()=>$('userModal').classList.add('hidden');$("userModal").onclick=e=>{if(e.target.id==="userModal")$("userModal").classList.add("hidden")};
$("userForm").onsubmit=async e=>{e.preventDefault();const name=$("newName").value.trim(),username=$("newUsername").value.trim().toLowerCase(),password=$("newPassword").value,weeklyHours=Number($("newWeeklyHours").value)||40,active=$("newActive").checked,color=$("newColor").value||"#2563eb";if(!name||!username||(!editingUsername&&!password)){$("userFormStatus").textContent="Completa nombre, usuario y contraseña para crear el empleado.";return;}const submitButton=$("userSubmit");submitButton.disabled=true;submitButton.textContent="Guardando…";$("userFormStatus").textContent="Guardando empleado…";try{let out;if(editingUsername)out=await api(`/api/admin/user/${encodeURIComponent(editingUsername)}`,{method:'PUT',body:JSON.stringify({name,password,weeklyHours,active,color})});else out=await api('/api/admin/user',{method:'POST',body:JSON.stringify({name,username,password,weeklyHours,active,color})});db=out;if(selectedEmployee?.username===editingUsername)selectedEmployee=db.users.find(x=>x.username===editingUsername)||selectedEmployee;if(!editingUsername)selectedEmployee=db.users.find(x=>x.username===username)||selectedEmployee;$("userForm").reset();$("newWeeklyHours").value=40;$("userModal").classList.add("hidden");render()}catch(err){$("userFormStatus").textContent="No se pudo guardar: "+err.message;alert(err.message)}finally{submitButton.disabled=false;submitButton.textContent=editingUsername?"Guardar cambios":"Crear usuario"}};
function deleteUserWithDoubleConfirmation(username){const u=db.users.find(x=>x.username===username);if(!u||u.role==="admin")return;pendingDeleteUser=username;$("confirmTitle").textContent="Primera confirmación";$("confirmText").textContent=`Vas a eliminar a ${u.name} (@${u.username}) y todos sus registros. Pulsa "Continuar" para la segunda confirmación.`;$("confirmDelete").textContent="Continuar";$("confirmModal").classList.remove("hidden")}
$("cancelConfirm").onclick=()=>{$("confirmModal").classList.add("hidden");pendingDeleteUser=null};$("confirmDelete").onclick=async()=>{if(!pendingDeleteUser)return;const u=db.users.find(x=>x.username===pendingDeleteUser);if(!u)return;if($("confirmDelete").textContent==="Continuar"){$("confirmTitle").textContent="Segunda confirmación";$("confirmText").textContent=`CONFIRMA POR SEGUNDA VEZ: eliminar definitivamente a ${u.name}. Esta acción no se puede deshacer.`;$("confirmDelete").textContent="Sí, eliminar definitivamente";return}try{db=await api(`/api/admin/user/${encodeURIComponent(pendingDeleteUser)}`,{method:'DELETE'});if(selectedEmployee.username===pendingDeleteUser)selectedEmployee=db.users.find(x=>x.role==='employee')||db.users.find(x=>x.role==='admin');$("confirmModal").classList.add("hidden");pendingDeleteUser=null;render()}catch(err){alert(err.message)}};

function balanceRangeContractMinutes(user,start,end){if(!start||!end||end<start)return 0;let days=0;for(let d=parseKey(start);d<=parseKey(end);d.setDate(d.getDate()+1))if(isWeekday(d))days++;return days*(Number(user.weeklyHours)||0)*60/5}
function renderBalances(){if(!isAdmin())return;const usersForWages=Array.isArray(db.users)?db.users:[];const wageNames={alba:'Alba Somodevilla',ainara:'Ainara Pascual',guille:'Guille Garcia',laura:'Laura Garcia'};const employeeMap=new Map(usersForWages.filter(u=>String(u.username||'').toLowerCase()!=='admin'&&String(u.username||'').toLowerCase()!=='vendedor'&&String(u.role||'').toLowerCase()!=='admin'&&String(u.role||'').toLowerCase()!=='vendedor').map(u=>[String(u.username).toLowerCase(),u]));Object.keys(db.wages||{}).forEach(username=>{const key=String(username).toLowerCase();if(!employeeMap.has(key)&&key!=='admin'&&key!=='vendedor')employeeMap.set(key,{username:key,name:wageNames[key]||key,role:'employee',active:true});});const employees=[...employeeMap.values()].sort((a,b)=>String(a.name||a.username).localeCompare(String(b.name||b.username),'es'));const rows=employees.map(u=>{const r=(db.weekly[u.username]||[]).slice().sort((a,b)=>a.end.localeCompare(b.end)||a.start.localeCompare(b.start)).pop();const balance=r?hoursToMinutes(r.worked)-hoursToMinutes(r.contract)+hoursToMinutes(r.previous):null;return {u,r,balance,shown:db.balanceVisibility[u.username]!==false}}).sort((a,b)=>(a.balance??0)-(b.balance??0)||a.u.name.localeCompare(b.u.name,'es'));$("balancePeriodLabel").textContent="Se muestra la última línea semanal guardada de cada empleado."; $("balancesList").innerHTML=rows.length?'<div class="balances-table-wrap"><table class="balances-table"><thead><tr><th>Empleado</th><th>Periodo</th><th>Anterior</th><th>Contrato</th><th>Esta semana</th><th>Balance</th><th>Mostrar</th></tr></thead><tbody>'+rows.map(x=>'<tr class="'+(x.balance===null?'neutral':classBalance(x.balance))+'"><td><strong>'+escapeHtml(x.u.name)+'</strong></td><td>'+(x.r?fmtDate(x.r.start)+' → '+fmtDate(x.r.end):'Sin lista semanal')+'</td><td>'+(x.r?fmtMinutes(hoursToMinutes(x.r.previous)):'—')+'</td><td>'+(x.r?fmtMinutes(hoursToMinutes(x.r.contract)):'—')+'</td><td>'+(x.r?fmtMinutes(hoursToMinutes(x.r.worked)):'—')+'</td><td><strong class="'+(x.balance===null?'muted':classBalance(x.balance))+'">'+(x.balance===null?'—':fmtMinutes(x.balance))+'</strong></td><td><input type="checkbox" class="balance-visibility" data-user="'+escapeHtml(x.u.username)+'" '+(x.shown?'checked':'')+' aria-label="Mostrar balance"></td></tr>').join('')+'</tbody></table></div>':'<div class="empty-state">No hay empleados.</div>';document.querySelectorAll('.balance-visibility').forEach(cb=>cb.onchange=()=>{db.balanceVisibility[cb.dataset.user]=cb.checked;saveDB();renderEmployeeButtons();renderBalances()})}

const balancesBtn=$("balancesBtn");if(balancesBtn)balancesBtn.onclick=()=>{$("balancesPanel")?.classList.remove('hidden');$("dashboardPanel")?.classList.add('hidden');$("mainPanel")?.classList.add('hidden');renderBalances()};const closeBalances=$("closeBalances");if(closeBalances)closeBalances.onclick=()=>{$("balancesPanel")?.classList.add('hidden');$("mainPanel")?.classList.remove('hidden')};
function exportBalancesPdf(){const selected=db.users.filter(u=>u.role==='employee'&&u.active!==false&&db.balanceVisibility[u.username]!==false).slice().sort((a,b)=>{const ba=latestWeeklyBalance(a)?.balance??0,bb=latestWeeklyBalance(b)?.balance??0;return ba-bb});const rows=selected.map(u=>{const last=latestWeeklyBalance(u);return `<tr class="${classBalance(last?.balance??0)}"><td>${u.name}</td><td>${last?fmtDate(last.start)+" → "+fmtDate(last.end):"—"}</td><td>${last?fmtMinutes(last.balance):"—"}</td></tr>`}).join("");const w=window.open("","_blank","width=900,height=700");if(!w){alert("El navegador ha bloqueado la ventana de impresión. Permite ventanas emergentes para exportar el PDF.");return}w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Balances de empleados</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#18212f}h1{font-size:22px;margin:0 0 6px}p{color:#687386;margin:0 0 24px}table{width:100%;border-collapse:collapse}th,td{padding:10px 12px;border-bottom:1px solid #ddd;text-align:left}th{background:#f4f6f8;font-size:12px;text-transform:uppercase}td:last-child{font-weight:700}tr.positive{background:#eaf7ef;color:#176b3a}tr.negative{background:#fff0f0;color:#a52c2c}tr.neutral{background:#f1f3f5;color:#56606d}tr.positive td,tr.negative td,tr.neutral td{-webkit-print-color-adjust:exact;print-color-adjust:exact}@media print{body{padding:0}}</style></head><body><h1>Balance de empleados</h1><p>Última semana disponible de la lista semanal · ${new Date().toLocaleDateString("es-ES")}</p><table><thead><tr><th>Empleado</th><th>Periodo</th><th>Balance</th></tr></thead><tbody>${rows||"<tr><td colspan='3'>No hay empleados seleccionados.</td></tr>"}</tbody></table><script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}<\/script></body></html>`);w.document.close()}
document.querySelectorAll("#exportBalancesPdf").forEach(btn=>btn.onclick=exportBalancesPdf);

$("importNotionBtn").onclick=()=>{const f=$("notionImportFile").files[0];if(!f)return alert("Selecciona un ZIP o CSV exportado de Notion.");importNotionFile(f)};
$("dashboardBtn").onclick=()=>{$("dashboardPanel").classList.remove("hidden");$("balancesPanel").classList.add("hidden");$("mainPanel").classList.add("hidden");renderDashboard("general")};$("closeDashboard").onclick=()=>{$("dashboardPanel").classList.add("hidden");$("mainPanel").classList.remove("hidden")};function shiftDashboardPeriod(delta){const v=$("dashboardMonth").value;if(!v)return;const [y,m]=v.split("-").map(Number),d=new Date(y,m-1+delta,1);$("dashboardMonth").value=`${d.getFullYear()}-${pad(d.getMonth()+1)}`;$("dashboardYear").value=d.getFullYear();renderDashboard("general")} $("dashboardMonth").onchange=()=>{$("dashboardYear").value=Number($("dashboardMonth").value.split("-")[0]);renderDashboard("general")};$("dashboardYear").onchange=()=>{const v=$("dashboardMonth").value||`${currentDate.getFullYear()}-${pad(currentDate.getMonth()+1)}`,m=v.split("-")[1];$("dashboardMonth").value=`${$("dashboardYear").value}-${m}`;renderDashboard("general")};$("dashboardPrevPeriod").onclick=()=>shiftDashboardPeriod(-1);$("dashboardNextPeriod").onclick=()=>shiftDashboardPeriod(1);$("toggleInactiveEmployees").onclick=()=>{inactiveEmployeesVisible=!inactiveEmployeesVisible;renderInactiveEmployees()};
function chartBars(items,users){
 const totals=items.map(x=>(x.segments||[]).reduce((sum,seg)=>sum+(Number(seg.minutes)||0),0)+(Number(x.vac)||0));
 const max=Math.max(1,...totals);
 const legend=(users||[]).map(u=>`<span><i class="legend-box" style="background:${u.color||'#172033'}"></i>${u.name}</span>`).join("");
 const vacationLegend=items.some(x=>x.vac>0)?'<span><i class="legend-box vacation-legend"></i>Vacaciones</span>':"";
 const body=items.map((x,index)=>{
   const parts=(x.segments||[]).filter(seg=>seg.minutes>0);
   if(x.vac>0)parts.push({name:"Vacaciones",minutes:x.vac,color:"#000000",vacation:true});
   const total=totals[index]||0;
   const stack=parts.map((seg,i)=>{
     const h=total?(seg.minutes/max)*190:0;
     const tip=`${seg.name}: ${fmtMinutes(seg.minutes)}`;
     return `<div class="bar segment-bar ${seg.vacation?"vacation-bar":""}" tabindex="0" aria-label="${tip}" data-chart-tooltip="${tip}" style="height:${h}px;background:${seg.vacation?"#000000":(seg.color||'#172033')}"></div>`;
   }).join("");
   return `<div class="chart-group"><div class="chart-bars-row"><div class="bar-stack" title="Total: ${fmtMinutes(total)}">${stack}</div></div><div class="mini-bar-total">${total?fmtMinutes(total):""}</div><small>${x.label}</small></div>`;
 }).join("");
 return `<div class="chart-legend">${legend}${vacationLegend}</div><div class="grouped-bar-chart chart-with-tooltip">${body}<div class="chart-tooltip hidden" aria-live="polite"></div></div>`;
}
function setupChartTooltips(){
 document.querySelectorAll(".chart-with-tooltip").forEach(chart=>{
   const tip=chart.querySelector(".chart-tooltip");
   chart.querySelectorAll("[data-chart-tooltip]").forEach(bar=>{
     const show=()=>{tip.textContent=bar.dataset.chartTooltip;tip.classList.remove("hidden");const br=bar.getBoundingClientRect(),cr=chart.getBoundingClientRect();tip.style.left=Math.max(4,Math.min(cr.width-190,br.left-cr.left+br.width/2-95))+"px";tip.style.top=Math.max(4,br.top-cr.top-38)+"px"};
     bar.addEventListener("mouseenter",show);bar.addEventListener("focus",show);
     bar.addEventListener("mouseleave",()=>tip.classList.add("hidden"));bar.addEventListener("blur",()=>tip.classList.add("hidden"));
     bar.addEventListener("click",show);
   });
 });
}
function dashboardUsers(mode){
 const all=(mode==="general"?db.users.filter(u=>u.role==="employee"):[selectedEmployee]).filter(Boolean);
 if(mode!=="general")return all;
 if(!selectedDashboardEmployees?.length)return [];
 return all.filter(u=>selectedDashboardEmployees.includes(u.username));
}
function renderDashboardEmployeeFilters(){
 const box=$("dashboardEmployeeFilters");if(!box)return;
 const employees=db.users.filter(u=>u.role==="employee");
 if(selectedDashboardEmployees===null)selectedDashboardEmployees=employees.filter(u=>u.active!==false).map(u=>u.username);
 box.innerHTML=employees.map(u=>`<label class="dashboard-filter-chip"><input type="checkbox" data-dashboard-employee="${u.username}" ${selectedDashboardEmployees.includes(u.username)?"checked":""}><span style="border-color:${u.color||'#172033'}">${u.name}${u.active===false?" · no activo":""}</span></label>`).join("");
 box.querySelectorAll("[data-dashboard-employee]").forEach(cb=>cb.onchange=()=>{
   selectedDashboardEmployees=[...box.querySelectorAll("[data-dashboard-employee]:checked")].map(x=>x.dataset.dashboardEmployee);
   renderDashboard("general");
 });
 $("dashboardActiveEmployees").onclick=()=>{selectedDashboardEmployees=employees.filter(u=>u.active!==false).map(u=>u.username);renderDashboard("general")};$("dashboardAllEmployees").onclick=()=>{selectedDashboardEmployees=employees.map(u=>u.username);renderDashboard("general")};
}
function dashboardMetricsForUser(user,k){
 const record=(db.records?.[user.username]||{})[k]||{};
 return {work:totalMinutes(record),vac:vacationMinutesForUser(user,k)};
}
function vacationMinutesForUser(user,k){
 const list=(db.vacations?.[user.username]||[]);
 const v=list.find(x=>k>=x.start&&k<=x.end);
 if(!v||!isWeekday(parseKey(k)))return 0;
 return (Number(user?.weeklyHours)||0)*60/5;
}
function dashboardDaySegments(users,k){
 return users.map(u=>{const q=dashboardMetricsForUser(u,k);return {username:u.username,name:u.name,color:u.color||'#172033',minutes:q.work}}).filter(x=>x.minutes>0);
}
function renderDashboard(mode="employee"){
 if(!isAdmin())return;
 renderDashboardEmployeeFilters();
 const label=$("dashboardEmployeeLabel");
 if(label)label.textContent=mode==="general"?"Resumen general de todos los empleados":`${selectedEmployee?.name||"Empleado"} · horas trabajadas y vacaciones`;
 const val=$("dashboardMonth").value||`${currentDate.getFullYear()}-${pad(currentDate.getMonth()+1)}`;
 $("dashboardMonth").value=val;
 const [y,m]=val.split("-").map(Number),days=new Date(y,m,0).getDate(),users=dashboardUsers(mode);
 let h=`<div class="dash-grid">${["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map(x=>`<div class="weekday">${x}</div>`).join("")}`;
 const first=new Date(y,m-1,1),startDay=(first.getDay()+6)%7;
 for(let i=0;i<startDay;i++)h+='<div class="dash-day empty"></div>';
 for(let d=1;d<=days;d++){
   const k=`${y}-${pad(m)}-${pad(d)}`;
   const segs=dashboardDaySegments(users,k);
   const vac=users.reduce((a,u)=>a+dashboardMetricsForUser(u,k).vac,0);
   const mins=segs.reduce((a,b)=>a+b.minutes,0);
   h+=`<div class="dash-day"><strong>${d}</strong><span>${mins||vac?fmtMinutes(mins+vac):""}</span>${segs.length?'<div class="dash-day-colors">'+segs.map(z=>`<i title="${z.name}: ${fmtMinutes(z.minutes)}" style="background:${z.color}"></i>`).join("")+'</div>':""}${vac?`<small>🏖 ${fmtMinutes(vac)}</small>`:""}</div>`;
 }
 $("dashboardCalendar").innerHTML=h+"</div>";
 const dayItems=Array.from({length:days},(_,i)=>{
   const k=`${y}-${pad(m)}-${pad(i+1)}`,segs=dashboardDaySegments(users,k);
   const vac=users.reduce((a,u)=>a+dashboardMetricsForUser(u,k).vac,0);
   const date=new Date(y,m-1,i+1),dayNames=["dom","lun","mar","mié","jue","vie","sáb"];return {label:`${i+1} · ${dayNames[date.getDay()]}`,segments:segs,vac};
 });
 const weekly=[];let d=new Date(y,0,1);while(d.getDay()!==1)d.setDate(d.getDate()-1);
 for(let i=0;i<53;i++){
   const s=d,e=new Date(d);e.setDate(e.getDate()+6);const totals={};let vac=0;
   for(let x=new Date(s);x<=e;x.setDate(x.getDate()+1)){
     const k=dateKey(x);if(parseKey(k).getFullYear()!==y)continue;
     users.forEach(u=>{const q=dashboardMetricsForUser(u,k);if(q.work)totals[u.username]=(totals[u.username]||0)+q.work;vac+=q.vac});
   }
   const segments=users.map(u=>({username:u.username,name:u.name,color:u.color||'#172033',minutes:totals[u.username]||0})).filter(x=>x.minutes>0);
   if(segments.length||vac)weekly.push({label:`${pad(s.getDate())}/${pad(s.getMonth()+1)}`,segments,vac});
   d.setDate(d.getDate()+7);
 }
 const monthly=Array.from({length:12},(_,i)=>{
   const totals={};let vac=0,md=new Date(y,i+1,0).getDate();
   for(let dd=1;dd<=md;dd++){
     const k=`${y}-${pad(i+1)}-${pad(dd)}`;
     users.forEach(u=>{const q=dashboardMetricsForUser(u,k);if(q.work)totals[u.username]=(totals[u.username]||0)+q.work;vac+=q.vac});
   }
   const segments=users.map(u=>({username:u.username,name:u.name,color:u.color||'#172033',minutes:totals[u.username]||0})).filter(x=>x.minutes>0);
   return {label:new Date(y,i,1).toLocaleDateString("es-ES",{month:"short"}).replace(".",""),segments,vac};
 }).filter(x=>x.segments.length||x.vac);
 $("barChart").innerHTML=chartBars(dayItems,users);
 $("weeklyBarChart").innerHTML=chartBars(weekly,users);
 $("monthlyBarChart").innerHTML=chartBars(monthly,users);setupChartTooltips();
 renderDashboardComparison(users);
}
function startOfWeek(d){
 const x=new Date(d);x.setHours(0,0,0,0);x.setDate(x.getDate()-((x.getDay()+6)%7));return x;
}
function comparisonPeriod(type,value){
 if(type==="month"){
   const [y,m]=String(value||"").split("-").map(Number);if(!y||!m)return null;
   return {start:new Date(y,m-1,1),end:new Date(y,m,0)};
 }
 const d=parseKey(String(value||""));if(isNaN(d))return null;
 const start=startOfWeek(d),end=new Date(start);end.setDate(end.getDate()+6);return {start,end};
}
function comparisonData(users,type,value){
 const p=comparisonPeriod(type,value);if(!p)return {label:"—",segments:[],vac:0};
 const totals={},vac=0;
 let vacationTotal=0;
 for(let d=new Date(p.start);d<=p.end;d.setDate(d.getDate()+1)){
   const k=dateKey(d);
   users.forEach(u=>{const q=dashboardMetricsForUser(u,k);if(q.work)totals[u.username]=(totals[u.username]||0)+q.work;vacationTotal+=q.vac});
 }
 const segments=users.map(u=>({username:u.username,name:u.name,color:u.color||"#172033",minutes:totals[u.username]||0})).filter(x=>x.minutes>0);
 const label=type==="month"?p.start.toLocaleDateString("es-ES",{month:"long",year:"numeric"}):`Semana ${fmtDate(dateKey(p.start))} → ${fmtDate(dateKey(p.end))}`;
 return {label,segments,vac:vacationTotal};
}
function renderDashboardComparison(users){
 const type=$("comparisonType")?.value||"week",a=$("comparisonA")?.value,b=$("comparisonB")?.value;
 if(!a||!b)return;
 const first=comparisonData(users,type,a),second=comparisonData(users,type,b);
 const chart=chartBars([first,second],users);
 $("comparisonResult").innerHTML=chart;setupChartTooltips();
}
function csvRows(text){const rows=[];let row=[],cell='',q=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(q&&text[i+1]==='"'){cell+='"';i++;}else q=!q}else if(c===','&&!q){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()!==''))rows.push(row);row=[];cell=''}else cell+=c}if(cell!==''||row.length){row.push(cell);if(row.some(x=>x.trim()!==''))rows.push(row)}return rows}
function normalizeNotionHeader(v){return String(v??'').replace(/^\uFEFF/,'').trim().toLowerCase()}
function parseCsv(text){const rows=csvRows(text),head=(rows.shift()||[]).map(normalizeNotionHeader);return rows.map(r=>Object.fromEntries(head.map((h,i)=>[h,(r[i]??'').trim()])))}
function notionField(row,...names){for(const name of names){const k=normalizeNotionHeader(name);if(Object.prototype.hasOwnProperty.call(row,k))return row[k]??''}return ''}
function normalizePersonName(v){return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\\s+/g,' ').trim().toLowerCase()}
function notionDateTime(v){const raw=String(v||'').trim();let m=raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);if(m)return{date:m[3]+'-'+pad(m[2])+'-'+pad(m[1]),time:pad(m[4])+':'+m[5]};m=raw.match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})\s+(\d{1,2}):(\d{2})/i);if(!m)return null;const mo=monthsEs[m[2].toLowerCase()];return mo==null?null:{date:m[3]+'-'+pad(mo+1)+'-'+pad(m[1]),time:pad(m[4])+':'+m[5]}}
function notionDateRange(v){const parts=String(v||'').split('→');if(parts.length<2)return null;const a=parseSpanishDate(parts[0].trim()),b=parseSpanishDate(parts[1].trim());return a&&b?{start:a,end:b}:null}
function numNotion(v){if(v==null||String(v).trim()==='')return 0;const s=String(v).trim().replace(/\./g,'').replace(',','.');return Number(s)||0}
const monthsEs={enero:0,febrero:1,marzo:2,abril:3,mayo:4,junio:5,julio:6,agosto:7,septiembre:8,octubre:9,noviembre:10,diciembre:11};
function parseSpanishDate(s){const m=String(s||'').match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/i);if(!m)return null;const mo=monthsEs[m[2].toLowerCase()];return mo==null?null:m[3]+'-'+pad(mo+1)+'-'+pad(m[1])}
function parseWeeklyRange(s){const parts=String(s||'').split('→');if(parts.length<2)return null;const a=parseSpanishDate(parts[0].trim()),b=parseSpanishDate(parts[1].trim());return a&&b?{start:a,end:b}:null}
function addNotionVacation(username,start,end){const arr=db.vacations[username]=db.vacations[username]||[];const exists=arr.find(v=>v.start===start&&v.end===end);if(exists)return false;arr.push({id:'v_'+Date.now()+'_'+Math.random().toString(36).slice(2),start,end});return true}
async function importNotionFile(file){if(!isAdmin())return alert('Solo el admin puede importar datos.');const target=selectedEmployee?.username;if(!target)return alert('Selecciona primero un empleado.');const targetEmployee=db.users.find(u=>u.username===target);if(!targetEmployee)return alert('Empleado no encontrado.');let files=[];if(file.name.toLowerCase().endsWith('.zip')){const zipBase=file.name.replace(/\.zip$/i,'').trim();if(normalizePersonName(zipBase)!==normalizePersonName(targetEmployee.name))return alert('El nombre del ZIP no coincide con el empleado seleccionado.\n\nEmpleado: '+targetEmployee.name+'\nZIP: '+zipBase+'\n\nEl ZIP debe llamarse: '+targetEmployee.name+'.zip');if(!window.JSZip)return alert('No se pudo cargar el lector ZIP. Recarga la página e inténtalo de nuevo.');const z=await JSZip.loadAsync(file);for(const [name,obj] of Object.entries(z.files)){if(!obj.dir&&name.toLowerCase().endsWith('.csv'))files.push({name,text:await obj.async('text')})}}else{files=[{name:file.name,text:await file.text()}]}
 ensureUserData(target);let days=0,weekly=0,vacationsImported=0;const seenDaily=new Set(),seenWeekly=new Set();
 for(const f of files){const rows=parseCsv(f.text);for(const row of rows){
   const entryRaw=notionField(row,'entrada'),exitRaw=notionField(row,'salida'),obs=notionField(row,'observaciones'),staff=notionField(row,'staff');
   // El empleado ya se selecciona en la pantalla de importación. No filtramos por Staff para no perder históricos cuando Notion usa un nombre distinto o con apellidos.
   const weeklyDate=notionField(row,'fecha');
   if(weeklyDate&&notionField(row,'contrato')!==''){
     const range=parseWeeklyRange(weeklyDate);if(!range)continue;
     const key=range.start+'|'+range.end;if(seenWeekly.has(key))continue;seenWeekly.add(key);
     const exists=(db.weekly[target]||[]).find(x=>x.start===range.start&&x.end===range.end);
     const item={id:exists?.id||('w_'+Date.now()+'_'+Math.random().toString(36).slice(2)),start:range.start,end:range.end,previous:numNotion(notionField(row,'anterior')),contract:numNotion(notionField(row,'contrato')),worked:numNotion(notionField(row,'esta semana')),locked:true};
     if(exists)Object.assign(exists,item);else db.weekly[target].push(item);weekly++;continue;
   }
   const range=notionDateRange(entryRaw)||notionDateRange(exitRaw);
   if(range && /vacacion/i.test(obs)){if(addNotionVacation(target,range.start,range.end))vacationsImported++;continue}
   const dt=notionDateTime(entryRaw);if(!dt)continue;
   const out=notionDateTime(exitRaw),key=dt.date,ex=numNotion(notionField(row,'hs extras')),worked=numNotion(notionField(row,'horas'));
   const prev=db.records[target][key]||{};
   db.records[target][key]={...prev,entry:prev.entry||dt.time,exit:out?.time||prev.exit||'',extraHours:ex,workedHours:worked,comments:obs};
   if(!seenDaily.has(key)){seenDaily.add(key);days++}
 }}
 await saveDB();alert('Importación completada para '+selectedEmployee.name+': '+days+' días, '+weekly+' semanas y '+vacationsImported+' periodos de vacaciones.');render();}
setupRange();
$("dashboardMonth").value=`${currentDate.getFullYear()}-${pad(currentDate.getMonth()+1)}`;$("dashboardYear").value=currentDate.getFullYear();
function setupDashboardComparisonDefaults(){
 const now=new Date(),thisWeek=startOfWeek(now),prevWeek=new Date(thisWeek);prevWeek.setDate(prevWeek.getDate()-7);
 const thisMonth=`${now.getFullYear()}-${pad(now.getMonth()+1)}`,prevMonthDate=new Date(now.getFullYear(),now.getMonth()-1,1),prevMonth=`${prevMonthDate.getFullYear()}-${pad(prevMonthDate.getMonth()+1)}`;
 $("comparisonType").value="week";$("comparisonA").value=dateKey(thisWeek);$("comparisonB").value=dateKey(prevWeek);
 $("comparisonType").onchange=()=>{
   const type=$("comparisonType").value;
   if(type==="month"){$("comparisonA").type="month";$("comparisonB").type="month";$("comparisonA").value=thisMonth;$("comparisonB").value=prevMonth}
   else {$("comparisonA").type="date";$("comparisonB").type="date";$("comparisonA").value=dateKey(thisWeek);$("comparisonB").value=dateKey(prevWeek)}
   renderDashboard("general");
 };
 $("comparisonRefresh").onclick=()=>renderDashboard("general");
}
setupDashboardComparisonDefaults();


async function setupPersonalDocuments(){
 const box=$("personalDocumentsBox");if(!box)return;
 const esc=s=>String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
 if(isAdmin()&&!$("personalDocumentsAdminTools")){
  const tools=document.createElement("div");tools.id="personalDocumentsAdminTools";tools.className="personal-space-card payroll-admin";
  tools.innerHTML='<div class="payroll-form-heading"><div class="personal-space-card-icon">🗂️</div><h3>Gestionar contratos y documentos</h3><p>Añade enlaces de Google Drive. Los empleados solo podrán abrir y consultar sus propios documentos.</p></div><div class="payroll-upload-form"><label>Empleado<select id="documentEmployee" required></select></label><label>Tipo<select id="documentType"><option>Contrato</option><option>Documento laboral</option><option>Certificado</option><option>Otro</option></select></label><label>Nombre del documento<input id="documentTitle" maxlength="160" placeholder="Ej. Contrato de trabajo" required></label><label>Periodo (opcional)<input id="documentMonth" type="month"></label><label>Enlace de Google Drive<input id="documentDriveUrl" type="url" placeholder="https://drive.google.com/..." required></label><button id="addPersonalDocumentBtn" class="primary" type="button">🔗 Añadir documento</button></div><div id="documentUploadStatus" class="muted"></div>';
  $("personalSpacePanel")?.querySelector(".personal-space-grid")?.appendChild(tools);
  const sel=$("documentEmployee");if(sel)sel.innerHTML=db.users.filter(u=>u.role==="employee"&&u.active!==false).map(u=>'<option value="'+esc(u.username)+'">'+esc(u.name)+'</option>').join("");
  if(sel){sel.value=selectedEmployee?.username||sel.value;sel.onchange=()=>{if(!isAdmin())return;selectedEmployee=db.users.find(u=>u.username===sel.value)||selectedEmployee;syncPersonalSpaceEmployee();}}
  $("addPersonalDocumentBtn").onclick=async()=>{
   const username=$("documentEmployee").value,title=$("documentTitle").value.trim(),type=$("documentType").value,month=$("documentMonth").value,driveUrl=$("documentDriveUrl").value.trim(),status=$("documentUploadStatus");
   if(!username||!title||!driveUrl){alert("Completa empleado, nombre y enlace.");return}
   try{const u=new URL(driveUrl);if(u.protocol!=="https:"||!["drive.google.com","docs.google.com"].includes(u.hostname))throw new Error("Usa un enlace HTTPS de Google Drive.")}catch(e){alert(e.message||"Enlace no válido.");return}
   status.textContent="Guardando documento…";
   try{await api("/api/admin/documents",{method:"POST",body:JSON.stringify({username,title,type,month,driveUrl})});$("documentTitle").value="";$("documentDriveUrl").value="";status.textContent="Documento añadido correctamente.";await renderPersonalDocuments()}catch(e){status.textContent=e.message}
  };
 }
 await renderPersonalDocuments();
}
async function renderPersonalDocuments(){
 const box=$("personalDocumentsBox");if(!box||!currentUser)return;
 const esc=s=>String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
 try{
  const docs=isAdmin()?await api("/api/admin/documents"):await api("/api/my-documents");
  const mine=isAdmin()?docs.filter(d=>d.username===selectedEmployee?.username):docs;
  box.innerHTML=mine.length?'<div class="personal-documents-list">'+mine.map(d=>'<div class="payroll-row"><div class="payroll-period"><strong>'+esc(d.title)+'</strong><span>'+esc(d.type)+(d.month?' · '+esc(d.month.split("-").reverse().join("/")):'')+'</span></div><div class="payroll-actions"><a class="small-btn" href="'+esc(d.driveUrl)+'" target="_blank" rel="noopener noreferrer">🔗 Abrir documento</a>'+(isAdmin()?'<button type="button" class="small-btn" data-edit-personal-doc="'+esc(d.id)+'">Editar</button><button type="button" class="small-btn danger-small" data-delete-personal-doc="'+esc(d.id)+'">Eliminar</button>':'')+'</div></div>').join("")+'</div>':'<div class="personal-space-empty">Todavía no hay contratos ni otros documentos disponibles.</div>';
  box.querySelectorAll("[data-edit-personal-doc]").forEach(b=>b.onclick=async()=>{if(!isAdmin())return;const d=docs.find(x=>String(x.id)===b.dataset.editPersonalDoc);if(!d)return;const title=prompt("Nombre del documento:",d.title);if(title===null)return;const driveUrl=prompt("Enlace de Google Drive:",d.driveUrl);if(driveUrl===null)return;const month=prompt("Periodo (AAAA-MM), vacío si no aplica:",d.month||"");if(month===null)return;const type=prompt("Tipo (Contrato, Documento laboral, Certificado u Otro):",d.type);if(type===null)return;try{await api("/api/admin/documents/"+encodeURIComponent(d.id),{method:"PUT",body:JSON.stringify({title,driveUrl,month,type})});await renderPersonalDocuments()}catch(e){alert(e.message)}});
  box.querySelectorAll("[data-delete-personal-doc]").forEach(b=>b.onclick=async()=>{if(!isAdmin()||!confirm("¿Eliminar este documento de la lista?"))return;try{await api("/api/admin/documents/"+encodeURIComponent(b.dataset.deletePersonalDoc),{method:"DELETE"});await renderPersonalDocuments()}catch(e){alert(e.message)}});
 }catch(e){box.innerHTML='<div class="personal-space-empty">No se pudieron cargar los documentos: '+esc(e.message)+'</div>'}
}
async function loadPayrolls(){
  const box=$("payrollBox"),payrollUser=isAdmin()?selectedEmployee:currentUser;
  if(!box||!payrollUser)return;
  try{
    const rows=await api("/api/payrolls");
    const mine=rows.filter(x=>x.username===payrollUser.username).sort((a,b)=>String(b.month).localeCompare(String(a.month)));
    const esc=s=>String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    box.innerHTML=mine.length?'<div class="payroll-list">'+mine.map(x=>'<div class="payroll-row"><div class="payroll-period"><strong>'+esc(String(x.month||"").split("-").reverse().join("/"))+'</strong>'+(isAdmin()?'<span>'+esc(x.employeeName||payrollUser.name||"")+'</span>':'')+'</div>'+(isAdmin()&&x.amount!=null?'<div class="payroll-amount">'+Number(x.amount||0).toLocaleString("es-ES",{style:"currency",currency:"EUR"})+'</div>':'')+'<div class="payroll-actions">'+(x.driveUrl?'<a class="small-btn payroll-view" href="'+esc(x.driveUrl)+'" target="_blank" rel="noopener noreferrer">🔗 Abrir en Google Drive</a>':'<span class="muted">Sin enlace de Google Drive</span>')+(isAdmin()?'<button class="small-btn payroll-edit" data-payroll-id="'+esc(x.id)+'">Editar</button><button class="small-btn danger-small payroll-delete" data-payroll-id="'+esc(x.id)+'">Eliminar</button>':'')+'</div></div>').join("")+'</div>':'<div class="empty-state">Todavía no hay nóminas cargadas.</div>';
    box.querySelectorAll(".payroll-edit").forEach(b=>b.onclick=async()=>{if(!isAdmin())return;const p=mine.find(x=>String(x.id)===b.dataset.payrollId);if(!p)return;const month=prompt("Periodo (AAAA-MM):",p.month);if(month===null)return;const amount=prompt("Importe (€), vacío si no quieres indicar:",p.amount??"");if(amount===null)return;const driveUrl=prompt("Enlace de Google Drive:",p.driveUrl||"");if(driveUrl===null)return;try{await api("/api/admin/payroll/"+encodeURIComponent(p.id),{method:"PUT",body:JSON.stringify({month,amount,driveUrl})});await loadPayrolls()}catch(e){alert(e.message)}});
    box.querySelectorAll(".payroll-delete").forEach(b=>b.onclick=async()=>{if(!confirm("¿Eliminar esta nómina de la lista?"))return;try{await api("/api/admin/payroll/"+encodeURIComponent(b.dataset.payrollId),{method:"DELETE"});loadPayrolls();}catch(e){alert(e.message)}});
  }catch(e){box.innerHTML='<div class="empty-state">No se pudieron cargar las nóminas: '+String(e.message)+'</div>'}
}
function syncPersonalSpaceEmployee(){
 if(!isAdmin()||!selectedEmployee)return;
 ['documentEmployee','payrollEmployee'].forEach(id=>{const el=$(id);if(el)el.value=selectedEmployee.username});
 renderMyVacations();loadPayrolls();renderPersonalDocuments();
}
async function renderPersonalSpaceAdminOverview(){
 const overview=$('personalSpaceAdminOverview');if(!overview)return;
 if(!isAdmin()){overview.classList.add('hidden');return}
 overview.classList.remove('hidden');
 const host=$('personalSpaceAdminTable');if(!host)return;
 const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 try{
  const [docs,payrolls]=await Promise.all([api('/api/admin/documents'),api('/api/payrolls')]);
  const employees=(db.users||[]).filter(u=>u.role==='employee'&&u.active!==false).slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'es'));
  const rows=employees.map(u=>({u,docs:docs.filter(d=>d.username===u.username),payrolls:payrolls.filter(p=>p.username===u.username).sort((a,b)=>String(b.month).localeCompare(String(a.month)))}));
  const yearSelect=$('spacePayrollYear');
  if(yearSelect){
   const selectedYear=yearSelect.value;
   const years=[...new Set(rows.flatMap(r=>r.payrolls.map(p=>String(p.month||'').slice(0,4)).filter(y=>/^\\d{4}$/.test(y))))].sort((a,b)=>b.localeCompare(a));
   yearSelect.innerHTML='<option value="">Todos los años</option>'+years.map(y=>'<option value="'+esc(y)+'">'+esc(y)+'</option>').join('');
   if(years.includes(selectedYear))yearSelect.value=selectedYear;
  }
  const render=()=>{
   const q=String($('spaceEmployeeSearch')?.value||'').trim().toLocaleLowerCase('es'),f=$('spaceEmployeeFilter')?.value||'all',year=yearSelect?.value||'';
   const visible=rows.filter(r=>{if(q&&!String(r.u.name+' '+r.u.username).toLocaleLowerCase('es').includes(q))return false;if(f==='payroll'&&!r.payrolls.length)return false;if(f==='documents'&&!r.docs.some(d=>d.type!=='Contrato'))return false;if(f==='missing'&&(r.docs.length||r.payrolls.length))return false;return true});
   host.innerHTML=visible.length?'<div class="table-wrap"><table class="published-schedule-table"><thead><tr><th>Empleado</th><th>Contrato</th><th>Documentos</th><th>Nóminas</th></tr></thead><tbody>'+visible.map(r=>{
    const contracts=r.docs.filter(d=>d.type==='Contrato'),otherDocs=r.docs.filter(d=>d.type!=='Contrato');
    const contractHtml=contracts.length?contracts.map(d=>'<div class="personal-space-file"><a href="'+esc(d.driveUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(d.title)+'</a>'+(d.month?'<small>'+esc(d.month)+'</small>':'')+'</div>').join(''):'<span class="muted">Sin contrato cargado</span>';
    const filteredPayrolls=r.payrolls.filter(p=>!year||String(p.month||'').startsWith(year));
    const payrollHtml=filteredPayrolls.length?'<div class="personal-space-month-list">'+filteredPayrolls.map(p=>p.driveUrl?'<a class="personal-space-month" href="'+esc(p.driveUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(p.month)+'</a>':'<span class="personal-space-month">'+esc(p.month)+'</span>').join('')+'</div>':'<div class="muted">'+(r.payrolls.length?'Sin nóminas en este año':'Sin nóminas')+'</div>';
    const docsHtml=otherDocs.length?otherDocs.map(d=>'<div class="personal-space-file"><a href="'+esc(d.driveUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(d.title)+'</a><small>'+esc(d.type)+(d.month?' · '+esc(d.month):'')+'</small></div>').join(''):'<span class="muted">Sin documentos</span>';
    return '<tr><td><strong>'+esc(r.u.name)+'</strong><div class="muted">'+esc(r.u.username)+'</div><button type="button" class="small-btn" data-space-view-employee="'+esc(r.u.username)+'">Gestionar empleado</button></td><td>'+contractHtml+'</td><td>'+docsHtml+'</td><td>'+payrollHtml+'</td></tr>';
   }).join('')+'</tbody></table></div>':'<p class="personal-space-empty">No hay empleados que coincidan con el filtro.</p>';
   host.querySelectorAll('[data-space-view-employee]').forEach(btn=>btn.onclick=()=>{const u=(db.users||[]).find(x=>x.username===btn.dataset.spaceViewEmployee);if(!u)return;selectedEmployee=u;syncPersonalSpaceEmployee();$('personalSpacePanel')?.querySelector('.personal-space-grid')?.scrollIntoView({behavior:'smooth',block:'start'});});
  };
  $('spaceEmployeeSearch').oninput=render;$('spaceEmployeeFilter').onchange=render;if(yearSelect)yearSelect.onchange=render;render();
 }catch(e){host.innerHTML='<p class="error">No se pudo cargar el resumen: '+esc(e.message)+'<br>Si aparece «No autorizado», vuelve a iniciar sesión.</p>'}
}
function setupPayrollUI(){
  if(isAdmin()&&!$("payrollAdminTools")){
    const panel=$("personalSpacePanel");
    if(panel){
      const box=document.createElement("div");box.id="payrollAdminTools";box.className="personal-space-card payroll-admin";
      box.innerHTML='<div class="payroll-form-heading"><div class="personal-space-card-icon">📄</div><h3>Gestionar nóminas</h3><p>Registra el enlace de Google Drive de cada nómina para el empleado y el mes correspondiente.</p></div><div class="payroll-upload-form"><label>Empleado<select id="payrollEmployee" required></select></label><label>Periodo (mes y año)<input id="payrollMonth" type="month" required></label><label>Importe (€), solo administración<input id="payrollAmount" type="number" min="0" step="0.01" placeholder="Ej. 1450,00"></label><label>Enlace de Google Drive<input id="payrollDriveUrl" type="url" placeholder="https://drive.google.com/..." required></label><button id="uploadPayrollBtn" class="primary" type="button">🔗 Guardar enlace de nómina</button></div><div id="payrollUploadStatus" class="muted"></div>';
      panel.querySelector(".personal-space-grid")?.appendChild(box);
      const sel=$("payrollEmployee");sel.innerHTML=db.users.filter(u=>u.role==="employee"&&u.active!==false).map(u=>'<option value="'+String(u.username).replace(/"/g,"&quot;")+'">'+String(u.name).replace(/</g,'&lt;')+'</option>').join("");
      sel.value=selectedEmployee?.username||sel.value;sel.onchange=()=>{if(!isAdmin())return;selectedEmployee=db.users.find(u=>u.username===sel.value)||selectedEmployee;syncPersonalSpaceEmployee();};$("payrollMonth").value=dateKey(new Date()).slice(0,7);$("uploadPayrollBtn").onclick=uploadPayroll;
    }
  }
  loadPayrolls();
  setupPersonalDocuments();
}
async function uploadPayroll(){
  if(!isAdmin())return alert("Solo el administrador puede gestionar nóminas.");
  const username=$("payrollEmployee")?.value,month=$("payrollMonth")?.value,amount=$("payrollAmount")?.value,driveUrl=$("payrollDriveUrl")?.value?.trim(),status=$("payrollUploadStatus");
  if(!username||!month||!driveUrl)return alert("Selecciona empleado, mes y pega el enlace de Google Drive.");
  try{const url=new URL(driveUrl);if(url.protocol!=="https:"||!["drive.google.com","docs.google.com"].includes(url.hostname))return alert("Introduce un enlace válido de Google Drive.");}catch(e){return alert("Introduce un enlace válido de Google Drive.");}
  if(amount!==""&&(!Number.isFinite(Number(amount))||Number(amount)<0))return alert("El importe debe ser un número igual o superior a cero.");
  if(status)status.textContent="Guardando enlace de Google Drive…";
  try{
    await api("/api/admin/payroll",{method:"POST",body:JSON.stringify({username,month,amount:amount===""?null:Number(amount),driveUrl})});
    if(status)status.textContent="Enlace de nómina guardado correctamente.";
    $("payrollDriveUrl").value="";$("payrollAmount").value="";
    selectedEmployee=db.users.find(u=>u.username===username)||selectedEmployee;loadPayrolls();
  }catch(e){if(status)status.textContent=e.message||"No se pudo guardar el enlace."}
}




function allVacationRows(){
 const rows=[];
 (db.dayOffRequests||[]).forEach(r=>{const u=(db.users||[]).find(x=>x.username===r.username);if(u)rows.push({...r,employeeName:u.name,year:Number(String(r.start||'').slice(0,4)),isDayOffRequest:true})});
 (db.users||[]).filter(u=>u.role==='employee'&&u.active!==false).forEach(u=>(db.vacations?.[u.username]||[]).forEach((v,i)=>rows.push({...v,username:u.username,employeeName:u.name,year:Number(v.year)||Number(String(v.start||'').slice(0,4)),_index:i})));
 return rows.sort((a,b)=>b.start.localeCompare(a.start)||b.end.localeCompare(a.end)||a.employeeName.localeCompare(b.employeeName));
}
function vacationFiltersInit(){
 const emp=$('vacFilterEmployee'),yr=$('vacFilterYear');if(!emp||!yr)return;
 const currentEmp=emp.value,currentYear=yr.value;
 emp.innerHTML='<option value="">Todos los empleados</option>'+(db.users||[]).filter(u=>u.role==='employee'&&u.active!==false).map(u=>'<option value="'+escapeHtml(u.username)+'">'+escapeHtml(u.name)+'</option>').join('');
 const years=[...new Set(allVacationRows().map(v=>v.year).filter(Boolean).concat([new Date().getFullYear()]))].sort((a,b)=>b-a);
 yr.innerHTML='<option value="">Todos los años</option>'+years.map(y=>'<option value="'+y+'">'+y+'</option>').join('');
 emp.value=currentEmp;yr.value=currentYear;
}
function filteredVacationRows(){
 const all=allVacationRows();
 const emp=$('vacFilterEmployee')?.value||'',year=$('vacFilterYear')?.value||'',from=$('vacFilterStart')?.value||'',to=$('vacFilterEnd')?.value||'',status=$('vacFilterStatus')?.value||'',q=($('vacFilterSearch')?.value||'').trim().toLowerCase(),today=dateKey(new Date());
 return all.filter(v=>{
  if(emp&&v.username!==emp)return false;
  if(year&&String(v.year)!==year)return false;
  if(from&&v.end<from)return false;
  if(to&&v.start>to)return false;
  if(status==='upcoming'&&v.start<=today)return false;
  if(status==='current'&&!(v.start<=today&&v.end>=today))return false;
  if(status==='past'&&v.end>=today)return false;
  if(q&&!String(v.employeeName+' '+v.filename+' '+v.year).toLowerCase().includes(q))return false;
  return true;
 });
}
function inferVacationWeek(username,v){const year=Number(v.year)||Number(String(v.start||'').slice(0,4));const rows=(db.vacations?.[username]||[]).filter(x=>(Number(x.year)||Number(String(x.start||'').slice(0,4)))===year).slice().sort((a,b)=>String(a.start).localeCompare(String(b.start)));const idx=rows.findIndex(x=>String(x.id)===String(v.id));return Math.min(4,Math.max(1,idx+1))}
function renderMyVacations(){
 const box=$('myVacationsBox');if(!box||!currentUser)return;
 const target=isAdmin()?selectedEmployee:currentUser;if(!target)return;
 const mine=(db.vacations?.[target.username]||[]).slice().sort((a,b)=>b.start.localeCompare(a.start)||b.end.localeCompare(a.end));
 box.innerHTML=mine.length?'<div class="my-vacations-list">'+mine.map(v=>{const n=workingDaysInclusive(parseKey(v.start),parseKey(v.end));return '<div class="my-vacation-row '+(v.cancelled?'vac-list-cancelled':'')+'"><div class="my-vacation-info"><strong>'+fmtDate(v.start)+' → '+fmtDate(v.end)+(v.cancelled?' <span class="vac-cancelled-badge">ANULADAS</span>':'')+'</strong><span>Año '+(Number(v.year)||String(v.start||'').slice(0,4))+' · Semana '+(Number(v.week)||inferVacationWeek(target.username,v))+' de 4</span><span>'+n+' días laborables · '+fmtMinutes(n*dailyContractMinutes(target))+' horas</span>'+(isAdmin()&&v.adminObservations?'<small class="vac-admin-observation"><b>Observaciones:</b> '+escapeHtml(v.adminObservations)+'</small>':'')+'</div>'+(v.driveLink?'<a class="small-btn" href="'+escapeHtml(v.driveLink)+'" target="_blank" rel="noopener noreferrer">Abrir Drive</a>':'')+(v.pdfData?'<button type="button" class="small-btn" data-my-vac-pdf="'+escapeHtml(v.id)+'">Ver PDF</button>':'')+(isAdmin()?'<div class="vacation-actions"><button type="button" class="small-btn" data-space-vac-edit="'+escapeHtml(v.id)+'">Editar</button><button type="button" class="small-btn danger-small" data-space-vac-delete="'+escapeHtml(v.id)+'">Eliminar</button></div>':'')+'</div>'}).join('')+'</div>':'<div class="personal-space-empty">Todavía no hay vacaciones registradas para '+escapeHtml(target.name)+'.</div>';
 box.querySelectorAll('[data-my-vac-pdf]').forEach(b=>b.onclick=()=>{const v=mine.find(x=>String(x.id)===b.dataset.myVacPdf);if(v?.pdfData)openVacationPdf(v)});
 box.querySelectorAll('[data-space-vac-edit]').forEach(b=>b.onclick=()=>openVacationEditForm(target.username,b.dataset.spaceVacEdit));
 box.querySelectorAll('[data-space-vac-delete]').forEach(b=>b.onclick=async()=>{if(!isAdmin()||!confirm('¿Eliminar este periodo de vacaciones de '+target.name+'?'))return;db.vacations[target.username]=(db.vacations[target.username]||[]).filter(v=>String(v.id)!==b.dataset.spaceVacDelete);try{await saveDB();renderMyVacations();renderVacationsSection()}catch(e){alert(e.message)}});
}
async function refreshPrivateRequests(){try{const data=await api('/api/state');if(Array.isArray(data.dayOffRequests))db.dayOffRequests=data.dayOffRequests;}catch(e){console.warn('No se pudieron actualizar las solicitudes',e)}}
function requestStatusLabel(status){return status==='approved'?'Aceptada':status==='rejected'?'Rechazada':'Pendiente'}
function requestFlags(r){return Array.isArray(r.statuses)?r.statuses:(r.status&&r.status!=='pending'?[r.status]:[])}
function requestFlagsLabel(r){const a=requestFlags(r);return [a.includes('read')?'Leída':'',a.includes('approved')?'Aceptada':'',a.includes('rejected')?'Rechazada':''].filter(Boolean).join(' · ')||'Pendiente'}
function openDayOffRequest(id){if(!isAdmin())return;const r=(db.dayOffRequests||[]).find(x=>x.id===id);if(!r)return;let modal=document.getElementById('dayOffAdminModal');if(!modal){modal=document.createElement('div');modal.id='dayOffAdminModal';modal.className='modal';modal.innerHTML='<div class="modal-card day-off-admin-modal"><button type="button" class="modal-close" id="closeDayOffAdmin">×</button><p class="eyebrow">SOLICITUD DE DÍA LIBRE</p><h2 id="dayOffAdminTitle"></h2><div id="dayOffAdminDetails"></div><form id="dayOffAdminForm"><p><b>Marcar estados (puedes elegir más de uno)</b></p><label class="checkbox-line"><input type="checkbox" id="dayOffFlagRead"> Leída</label><label class="checkbox-line"><input type="checkbox" id="dayOffFlagApproved"> Aceptada</label><label class="checkbox-line"><input type="checkbox" id="dayOffFlagRejected"> Rechazada</label><div class="modal-actions"><button type="button" class="danger" id="deleteDayOffAdmin">Eliminar solicitud</button><button type="button" class="ghost" id="cancelDayOffAdmin">Cerrar</button><button type="submit" class="primary">Guardar estados</button></div></form></div>';document.body.appendChild(modal);modal.querySelector('#closeDayOffAdmin').onclick=modal.querySelector('#cancelDayOffAdmin').onclick=()=>modal.classList.add('hidden');modal.querySelector('#deleteDayOffAdmin').onclick=async()=>{const requestId=modal.dataset.requestId;if(!confirm('¿Eliminar definitivamente esta solicitud? También desaparecerá para el empleado.'))return;try{await api('/api/day-off-requests/'+encodeURIComponent(requestId),{method:'DELETE'});modal.classList.add('hidden');await refreshPrivateRequests();renderVacationsSection();renderCalendar()}catch(err){alert(err.message)}};modal.querySelector('#dayOffAdminForm').onsubmit=async e=>{e.preventDefault();const statuses=[];if(modal.querySelector('#dayOffFlagRead').checked)statuses.push('read');if(modal.querySelector('#dayOffFlagApproved').checked)statuses.push('approved');if(modal.querySelector('#dayOffFlagRejected').checked)statuses.push('rejected');try{await api('/api/admin/day-off-requests/'+encodeURIComponent(modal.dataset.requestId),{method:'PUT',body:JSON.stringify({statuses})});await refreshPrivateRequests();renderVacationsSection();renderCalendar();openDayOffRequest(modal.dataset.requestId)}catch(err){alert(err.message)}}}modal.dataset.requestId=id;const user=(db.users||[]).find(u=>u.username===r.username);modal.querySelector('#dayOffAdminTitle').textContent=user?.name||r.username;modal.querySelector('#dayOffAdminDetails').innerHTML='<p><b>Fechas:</b> '+escapeHtml(fmtDate(r.start))+' → '+escapeHtml(fmtDate(r.end))+'</p><p><b>Prioridad:</b> '+({green:'🟢 Verde · Si se puede',yellow:'🟡 Amarillo · Es importante',red:'🔴 Rojo · Realmente necesito el día'}[r.priority]||'')+'</p><p><b>Observaciones:</b><br>'+escapeHtml(r.observations||'Sin observaciones')+'</p><p><b>Estado actual:</b> '+escapeHtml(requestFlagsLabel(r))+'</p>';const flags=requestFlags(r);modal.querySelector('#dayOffFlagRead').checked=flags.includes('read');modal.querySelector('#dayOffFlagApproved').checked=flags.includes('approved');modal.querySelector('#dayOffFlagRejected').checked=flags.includes('rejected');modal.classList.remove('hidden')}
let editingInvoiceId=null;
function invoices(){if(!Array.isArray(db.invoices))db.invoices=[];return db.invoices}
function renderInvoices(){if(!isAdmin())return;const providerFilter=String($('invoiceFilterProvider')?.value||'').trim().toLocaleLowerCase('es');const methodFilter=String($('invoiceFilterMethod')?.value||'');const sortBy=$('invoiceSortBy')?.value||'date';const sortDir=$('invoiceSortDir')?.value||'desc';const rows=invoices().filter(v=>(!providerFilter||String(v.provider||'').toLocaleLowerCase('es').includes(providerFilter))&&(!methodFilter||String(v.method||'')===methodFilter)).slice().sort((a,b)=>{let x,y;if(sortBy==='amount'){x=Number(a.amount||0);y=Number(b.amount||0)}else if(sortBy==='method'){x=String(a.method||'');y=String(b.method||'')}else if(sortBy==='provider'){x=String(a.provider||a.name||'').toLocaleLowerCase('es');y=String(b.provider||b.name||'').toLocaleLowerCase('es')}else{x=String(a.date||'');y=String(b.date||'')}const cmp=typeof x==='number'?x-y:String(x).localeCompare(String(y),'es');return sortDir==='asc'?cmp:-cmp});$('invoiceCount').textContent=rows.length+' de '+invoices().length+' '+(invoices().length===1?'factura':'facturas');$('invoiceList').innerHTML=rows.length?'<div class="invoice-table-wrap"><table class="invoice-table"><thead><tr><th>Fecha</th><th>Nombre</th><th>Importe</th><th>Método</th><th>Proveedor</th><th>Enlaces</th><th>Observaciones</th><th>Acciones</th></tr></thead><tbody>'+rows.map(v=>'<tr><td>'+escapeHtml(fmtDate(v.date))+'</td><td><strong>'+escapeHtml(v.name)+'</strong></td><td class="invoice-amount">'+Number(v.amount||0).toLocaleString('es-ES',{style:'currency',currency:'EUR'})+'</td><td><span class="invoice-method invoice-method-'+escapeHtml(String(v.method).toLowerCase())+'">'+escapeHtml(v.method)+'</span></td><td>'+escapeHtml(v.provider||'—')+'</td><td class="invoice-links">'+(v.driveUrl?'<a href="'+escapeHtml(v.driveUrl)+'" target="_blank" rel="noopener">Drive</a>':'')+(v.pdfUrl?(v.driveUrl?' · ':'')+'<a href="'+escapeHtml(v.pdfUrl)+'" target="_blank" rel="noopener">PDF</a>':'')+(!v.driveUrl&&!v.pdfUrl?'—':'')+'</td><td class="invoice-notes-cell">'+escapeHtml(v.observations||'—')+'</td><td><div class="invoice-row-actions"><button type="button" class="small-btn" data-invoice-edit="'+escapeHtml(v.id)+'">Editar</button><button type="button" class="small-btn danger" data-invoice-delete="'+escapeHtml(v.id)+'">Eliminar</button></div></td></tr>').join('')+'</tbody></table></div>':'<div class="personal-space-empty">No hay facturas que coincidan con los filtros.</div>'}
function resetInvoiceForm(){editingInvoiceId=null;$('invoiceForm').reset();$('invoiceId').value='';$('invoiceSaveBtn').textContent='Guardar factura';$('invoiceCancelBtn').classList.add('hidden');$('invoiceDate').value=dateKey(new Date())}
function invoiceDedupKey(v){return [String(v.date||''),String(v.name||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),Number(v.amount||0).toFixed(2),String(v.method||'').toUpperCase()].join('|')}
function setupInvoices(){if(!isAdmin())return;resetInvoiceForm();for(const id of ['invoiceFilterProvider','invoiceFilterMethod','invoiceSortBy','invoiceSortDir'])$(id)?.addEventListener('input',renderInvoices);renderInvoices();$('invoiceImportBtn').onclick=()=>$('invoiceImportFile').click();$('invoiceImportFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const parsed=JSON.parse(await file.text());if(!Array.isArray(parsed))throw new Error('El archivo debe contener una lista JSON de facturas.');const existing=new Set(invoices().map(invoiceDedupKey));let added=0,duplicates=0,invalid=0,updated=0;for(const raw of parsed){const v={date:String(raw.date||''),name:String(raw.name||'').trim(),provider:String(raw.provider||raw.proveedor||'').trim(),amount:Number(raw.amount),method:String(raw.method||'').toUpperCase(),driveUrl:String(raw.driveUrl||''),pdfUrl:String(raw.pdfUrl||''),observations:String(raw.observations||'')};if(!/^\d{4}-\d{2}-\d{2}$/.test(v.date)||!v.name||!Number.isFinite(v.amount)||v.amount<0||!['CASH','CARD','BANK'].includes(v.method)){invalid++;continue}const key=invoiceDedupKey(v);if(existing.has(key)){duplicates++;const current=invoices().find(item=>invoiceDedupKey(item)===key);if(current&&v.provider&&current.provider!==v.provider){current.provider=v.provider;updated++}continue}existing.add(key);v.id='inv-'+Date.now()+'-'+added+'-'+Math.random().toString(36).slice(2,8);invoices().push(v);added++}if(added||updated){await saveDB();renderInvoices()}alert('Importación terminada.\nAñadidas: '+added+'\nProveedores actualizados: '+updated+'\nDuplicados sin cambios: '+(duplicates-updated)+'\nFilas no válidas omitidas: '+invalid); }catch(err){alert('No se pudo importar el archivo: '+err.message)}finally{$('invoiceImportFile').value=''}};$('invoiceForm').onsubmit=async e=>{e.preventDefault();const date=$('invoiceDate').value,name=$('invoiceName').value.trim(),provider=$('invoiceProvider').value.trim(),amount=Number($('invoiceAmount').value),method=$('invoiceMethod').value,driveUrl=$('invoiceDrive').value.trim(),pdfUrl=$('invoicePdf').value.trim(),observations=$('invoiceNotes').value.trim();if(!date||!name||!Number.isFinite(amount)||amount<0)return alert('Revisa la fecha, el nombre y el importe.');for(const url of [driveUrl,pdfUrl])if(url){try{const parsed=new URL(url);if(parsed.protocol!=='https:')throw new Error()}catch{return alert('Los enlaces deben ser URL HTTPS válidas.')}}const entry={id:editingInvoiceId||('inv-'+Date.now()+'-'+Math.random().toString(36).slice(2,8)),date,name,provider,amount,method,driveUrl,pdfUrl,observations};const rows=invoices();if(editingInvoiceId){const idx=rows.findIndex(x=>x.id===editingInvoiceId);if(idx>=0)rows[idx]=entry}else rows.push(entry);await saveDB();renderInvoices();resetInvoiceForm()};$('invoiceCancelBtn').onclick=resetInvoiceForm;$('invoiceList').onclick=async e=>{const edit=e.target.closest('[data-invoice-edit]');if(edit){const v=invoices().find(x=>x.id===edit.dataset.invoiceEdit);if(!v)return;editingInvoiceId=v.id;$('invoiceId').value=v.id;$('invoiceDate').value=v.date;$('invoiceName').value=v.name;$('invoiceProvider').value=v.provider||'';$('invoiceAmount').value=v.amount;$('invoiceMethod').value=v.method;$('invoiceDrive').value=v.driveUrl||'';$('invoicePdf').value=v.pdfUrl||'';$('invoiceNotes').value=v.observations||'';$('invoiceSaveBtn').textContent='Guardar cambios';$('invoiceCancelBtn').classList.remove('hidden');$('invoiceForm').scrollIntoView({behavior:'smooth',block:'start'});return}const del=e.target.closest('[data-invoice-delete]');if(del){const v=invoices().find(x=>x.id===del.dataset.invoiceDelete);if(v&&confirm('¿Eliminar la factura «'+v.name+'»?')){db.invoices=invoices().filter(x=>x.id!==v.id);await saveDB();renderInvoices()}}}}
function renderVacationsSection(){
 vacationFiltersInit();
 $('vacationFilters')?.classList.toggle('hidden',!isAdmin());
 $('vacListBtn')?.classList.remove('hidden');
 /* Los empleados también pueden consultar la lista compartida. */
 const y=vacationsMonth.getFullYear(),m=vacationsMonth.getMonth(),label=vacationsMonth.toLocaleDateString('es-ES',{month:'long',year:'numeric'});
 $('vacMonthLabel').textContent=label.charAt(0).toUpperCase()+label.slice(1);
 $('vacAddBtn').classList.toggle('hidden',!isAdmin());
 $('vacCalendarBtn').classList.toggle('primary',vacationsViewMode==='calendar');$('vacCalendarBtn').classList.toggle('ghost',vacationsViewMode!=='calendar');
 $('vacListBtn').classList.toggle('primary',vacationsViewMode==='list');$('vacListBtn').classList.toggle('ghost',vacationsViewMode!=='list');
 $('vacationsCalendar').classList.toggle('hidden',vacationsViewMode!=='calendar');$('vacationsList').classList.toggle('hidden',vacationsViewMode!=='list');
 const visibleRows=filteredVacationRows();
 // El calendario y la lista muestran las vacaciones de todos los empleados activos; solo administración puede editar.
 const calendarRows=allVacationRows().filter(v=>!v.isDayOffRequest||isAdmin()||v.username===currentUser?.username);
 const first=new Date(y,m,1),offset=(first.getDay()+6)%7,days=new Date(y,m+1,0).getDate();
 const names=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];let grid=names.map(n=>'<div class="vac-cal-head">'+n+'</div>').join('');db.calendarDayTypes=db.calendarDayTypes||{};db.calendarEvents=Array.isArray(db.calendarEvents)?db.calendarEvents:[];
 $('vacationCalendarAdminTools')?.classList.toggle('hidden',!isAdmin()||vacationsViewMode!=='calendar');
 for(let i=0;i<offset;i++)grid+='<div class="vac-cal-empty"></div>';
 for(let d=1;d<=days;d++){const key=dateKey(new Date(y,m,d)),isToday=key===dateKey(new Date()),dayType=db.calendarDayTypes[key]||'',specialEvents=db.calendarEvents.filter(ev=>ev.date===key);const todays=calendarRows.filter(v=>v.start<=key&&v.end>=key);grid+='<div class="vac-cal-day '+(dayType==='week'?'vac-cal-week-type':dayType==='holiday'?'vac-cal-holiday-type':'')+'"><div class="vac-cal-day-top"><strong class="'+(isToday?'vac-cal-today':'')+'">'+d+'</strong>'+(isAdmin()?calendarMarkControl(key,dayType,'vac'):'')+'</div><div class="vac-cal-events">'+todays.map(v=>{if(v.isDayOffRequest)return '<div class="day-off-request-item"><button type="button" class="vac-cal-pill day-off-'+escapeHtml(v.priority)+' day-off-open" data-id="'+escapeHtml(v.id)+'" title="Abrir solicitud">'+(isAdmin()?'Pide: '+escapeHtml(v.employeeName):'Solicitud · '+escapeHtml(requestFlagsLabel(v)))+'</button><button type="button" class="day-off-delete" data-id="'+escapeHtml(v.id)+'" title="Eliminar solicitud" aria-label="Eliminar solicitud">×</button></div>';const employee=(db.users||[]).find(u=>u.username===v.username)||{};const color=isAdmin()&&employee.color&&!v.cancelled?'background:'+escapeHtml(employee.color)+';color:#172033;':'';return '<div class="vac-cal-pill '+(v.cancelled?'vac-cal-cancelled':'')+'" style="'+color+'" title="'+escapeHtml(v.employeeName)+(v.cancelled?' · ANULADAS':'')+'">'+(v.cancelled?'<s>':'')+(isAdmin()?'Vacaciones: ':'')+escapeHtml(v.employeeName)+(v.cancelled?'</s> · ANULADAS':'')+'</div>'}).join('')+specialEvents.map(ev=>'<div class="calendar-special-event" title="'+escapeHtml(ev.observations)+'">📌 '+escapeHtml(ev.observations)+'</div>').join('')+'</div></div>'}
 $('vacationsCalendar').innerHTML=grid;
 const addEv=$('vacationAddCalendarEventBtn'),evForm=$('vacationCalendarEventForm');if(addEv&&evForm){addEv.onclick=()=>{evForm.classList.toggle('hidden');if(!$('vacationCalendarEventDate').value)$('vacationCalendarEventDate').value=dateKey(new Date(y,m,1))};$('vacationCancelCalendarEvent').onclick=()=>evForm.classList.add('hidden');$('vacationCalendarEventFormInner').onsubmit=async e=>{e.preventDefault();const date=$('vacationCalendarEventDate').value,observations=$('vacationCalendarEventObservations').value.trim();if(!isAdmin()||!date||!observations)return;db.calendarEvents.push({id:'cal-event-'+Date.now(),date,observations});await saveDB();evForm.classList.add('hidden');renderVacationsSection()}}
 bindCalendarMarkControls($('vacationsCalendar'),renderVacationsSection);
 $('vacationsCalendar').querySelectorAll('.day-off-open').forEach(b=>b.onclick=e=>{e.stopPropagation();openDayOffRequest(b.dataset.id)});
 $('vacationsCalendar').querySelectorAll('.day-off-delete').forEach(b=>b.onclick=async e=>{e.stopPropagation();const id=b.dataset.id;if(!confirm('¿Eliminar definitivamente esta solicitud de día libre? Desaparecerá también para administración.'))return;try{await api('/api/day-off-requests/'+encodeURIComponent(id),{method:'DELETE'});await refreshPrivateRequests();renderVacationsSection();renderCalendar()}catch(err){alert(err.message)}});
 const todayKey=dateKey(new Date());const sortedVacationRows=visibleRows.slice().sort((a,b)=>b.start.localeCompare(a.start)||b.end.localeCompare(a.end));let lastVacationYear=null;const vacationListHtml=sortedVacationRows.map(v=>{const year=Number(v.year||String(v.start).slice(0,4));const heading=year!==lastVacationYear?'<div class="vac-list-year"><span></span><strong>'+year+'</strong><span></span></div>':'';lastVacationYear=year;const isPast=!v.cancelled&&v.end<todayKey;return heading+'<div class="vac-list-row '+(v.cancelled?'vac-list-cancelled':isPast?'vac-list-past':'')+'"><strong>'+escapeHtml(v.employeeName)+(v.cancelled?' <b class="vac-cancelled-badge">ANULADAS</b>':isPast?' <b class="vac-past-badge">PASADAS</b>':'')+(isAdmin()&&v.adminObservations?'<small class="vac-admin-observation"><b>Observaciones:</b> '+escapeHtml(v.adminObservations)+'</small>':'')+'</strong><span>'+fmtDate(v.start)+'</span><span>'+fmtDate(v.end)+'</span><span>'+year+'</span><span>'+(v.pdfData?'<button class="ghost" data-vac-pdf="'+v.id+'">Ver PDF</button>':(v.driveLink?'<span class="vac-doc-note">Disponible en Mi espacio</span>':escapeHtml(v.filename||'—')))+'</span><span>'+(isAdmin()?'<button class="ghost" data-vac-edit="'+v.username+'|'+v.id+'">Editar</button> '+(v.cancelled?'<button class="ghost" data-vac-restore="'+v.username+'|'+v.id+'">Reactivar</button>':'<button class="danger" data-vac-cancel="'+v.username+'|'+v.id+'">Anular</button>')+' <button class="danger" data-vac-delete="'+v.username+'|'+v.id+'">Eliminar</button>':'')+'</span></div>'}).join('');$('vacationsList').innerHTML=visibleRows.length?'<div class="vac-list-head"><span>Empleado</span><span>Desde</span><span>Hasta</span><span>Año</span><span>Adjunto</span><span>Acciones</span></div>'+vacationListHtml:'<div class="empty-state">No hay vacaciones que coincidan con los filtros.</div>';
}

function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function addVacationAdmin(){
 if(!isAdmin())return;
 const employees=(db.users||[]).filter(u=>u.role==='employee'&&u.active!==false);
 if(!employees.length)return alert('No hay empleados activos.');
 const sel=$('createVacationEmployee');
 sel.innerHTML=employees.map(u=>'<option value="'+escapeHtml(u.username)+'">'+escapeHtml(u.name)+'</option>').join('');
 const today=dateKey(new Date());
 $('createVacationStart').value='';$('createVacationEnd').value='';$('createVacationYear').value=today.slice(0,4);$('createVacationWeek').value='1';
 $('createVacationDriveLink').value='';$('createVacationObservations').value='';$('createVacationPdf').value='';$('createVacationFileName').textContent='Ningún PDF seleccionado';
 $('adminVacationCreateModal').classList.remove('hidden');
}
function closeVacationCreateForm(){$('adminVacationCreateModal').classList.add('hidden');$('adminVacationCreateForm').reset();$('createVacationFileName').textContent='Ningún PDF seleccionado'}
$('closeAdminVacationCreate').onclick=closeVacationCreateForm;$('cancelAdminVacationCreate').onclick=closeVacationCreateForm;
$('adminVacationCreateModal').addEventListener('click',e=>{if(e.target.id==='adminVacationCreateModal')closeVacationCreateForm()});
$('createVacationStart').addEventListener('change',()=>{if($('createVacationStart').value)$('createVacationYear').value=$('createVacationStart').value.slice(0,4)});
$('createVacationPdf').addEventListener('change',()=>{$('createVacationFileName').textContent=$('createVacationPdf').files?.[0]?.name||'Ningún PDF seleccionado'});
$('adminVacationCreateForm').onsubmit=async e=>{
 e.preventDefault();if(!isAdmin())return;
 const username=$('createVacationEmployee').value,start=$('createVacationStart').value,end=$('createVacationEnd').value,year=Number($('createVacationYear').value),week=Number($('createVacationWeek').value),driveLink=$('createVacationDriveLink').value.trim(),adminObservations=$('createVacationObservations').value.trim(),file=$('createVacationPdf').files?.[0];
 if(!username||!start||!end||end<start)return alert('Comprueba el empleado y las fechas.');
 if(!Number.isInteger(year)||year<2000||year>2100)return alert('Introduce un año válido.');
 if(!Number.isInteger(week)||week<1||week>4)return alert('Selecciona la semana de vacaciones (1 a 4).');
 if(driveLink&&!/^https:\/\/(drive\.google\.com|docs\.google\.com)\//i.test(driveLink))return alert('Introduce un enlace válido de Google Drive.');
 if(file&&file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf'))return alert('El adjunto debe ser PDF.');
 if(file&&file.size>8*1024*1024)return alert('El PDF no puede superar 8 MB.');
 const prior=(db.vacations?.[username]||[]).filter(v=>(Number(v.year)||Number(String(v.start||'').slice(0,4)))===year);
 if(prior.length>=4&&!confirm((db.users.find(u=>u.username===username)?.name||username)+' ya tiene 4 periodos en '+year+'. ¿Añadir otro como administrador?'))return;
 const btn=$('saveAdminVacationCreate');btn.disabled=true;btn.textContent='Guardando…';
 try{
  let fileData={};if(file){const pdfData=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file)});fileData={filename:file.name,pdfData,mimeType:'application/pdf'}}
  ensureUserData(username);db.vacations[username].push({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),start,end,year,week,driveLink,adminObservations,...fileData,createdAt:new Date().toISOString()});
  await saveDB();closeVacationCreateForm();vacationFiltersInit();renderVacationsSection();
 }catch(err){alert('No se pudieron guardar las vacaciones: '+err.message)}
 finally{btn.disabled=false;btn.textContent='Guardar vacaciones'}
};

let editingVacationRef=null;
function openVacationEditForm(username,id){
 if(!isAdmin())return;
 const v=(db.vacations?.[username]||[]).find(x=>String(x.id)===String(id));if(!v)return;
 editingVacationRef={username,id:String(id)};
 const emp=$('adminVacationEmployee');
 emp.innerHTML=(db.users||[]).filter(u=>u.role==='employee'&&u.active!==false).map(u=>'<option value="'+escapeHtml(u.username)+'">'+escapeHtml(u.name)+'</option>').join('');
 emp.value=username;$('adminVacationStart').value=v.start;$('adminVacationEnd').value=v.end;$('adminVacationYear').value=v.year||String(v.start||'').slice(0,4);$('adminVacationWeek').value=String(v.week||inferVacationWeek(username,v));
 $('adminVacationCurrentFile').textContent=v.filename||'No hay PDF adjunto';$('adminVacationPdf').value='';$('adminVacationDriveLink').value=v.driveLink||'';$('adminVacationObservations').value=v.adminObservations||'';
 $('adminVacationEditTitle').textContent='Editar vacaciones';$('adminVacationEditModal').classList.remove('hidden');
}
function closeVacationEditForm(){$('adminVacationEditModal').classList.add('hidden');editingVacationRef=null;$('adminVacationEditForm').reset()}
$('closeAdminVacationEdit').onclick=closeVacationEditForm;$('cancelAdminVacationEdit').onclick=closeVacationEditForm;
$('adminVacationEditModal').addEventListener('click',e=>{if(e.target.id==='adminVacationEditModal')closeVacationEditForm()});
$('adminVacationEditForm').onsubmit=async e=>{
 e.preventDefault();if(!isAdmin()||!editingVacationRef)return;
 const {username,id}=editingVacationRef,start=$('adminVacationStart').value,end=$('adminVacationEnd').value,year=Number($('adminVacationYear').value),week=Number($('adminVacationWeek').value),target=$('adminVacationEmployee').value,file=$('adminVacationPdf').files?.[0],driveLink=$('adminVacationDriveLink').value.trim(),adminObservations=$('adminVacationObservations').value.trim();
 if(!start||!end||end<start)return alert('Comprueba las fechas de inicio y fin.');
 if(!Number.isInteger(year)||year<2000||year>2100)return alert('Introduce un año válido.');
 if(!Number.isInteger(week)||week<1||week>4)return alert('Selecciona la semana de vacaciones (1 a 4).');
 if(!target||!(db.users||[]).some(u=>u.username===target&&u.role==='employee'))return alert('Selecciona un empleado válido.');
 if(file&&file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf'))return alert('El adjunto debe ser un PDF.');
 if(file&&file.size>8*1024*1024)return alert('El PDF no puede superar 8 MB.');
 const btn=$('saveAdminVacationEdit');btn.disabled=true;btn.textContent='Guardando…';
 try{
  let fileData={};if(file){const pdfData=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file)});fileData={filename:file.name,pdfData,mimeType:'application/pdf'}}
  const old=(db.vacations?.[username]||[]).find(v=>String(v.id)===id);if(!old)return;
  db.vacations[username]=(db.vacations[username]||[]).filter(v=>String(v.id)!==id);
  ensureUserData(target);
  db.vacations[target].push({...old,start,end,year,week,driveLink,adminObservations,...fileData});
  await saveDB();closeVacationEditForm();vacationFiltersInit();renderVacationsSection();renderMyVacations();
 }catch(err){alert('No se pudieron guardar las vacaciones: '+err.message)}
 finally{btn.disabled=false;btn.textContent='Guardar cambios'}
};

document.addEventListener('click',async e=>{
 if(e.target.closest('#vacCalendarBtn')){vacationsViewMode='calendar';renderVacationsSection()}
 if(e.target.closest('#vacListBtn')){vacationsViewMode='list';renderVacationsSection()}
 if(e.target.closest('#vacPrevMonth')){vacationsMonth.setMonth(vacationsMonth.getMonth()-1);renderVacationsSection()}
 if(e.target.closest('#vacNextMonth')){vacationsMonth.setMonth(vacationsMonth.getMonth()+1);renderVacationsSection()}
 if(e.target.closest('#vacAddBtn'))addVacationAdmin();
 const cancel=e.target.closest('[data-vac-cancel]');if(cancel&&isAdmin()){const [username,id]=cancel.dataset.vacCancel.split('|');const v=(db.vacations[username]||[]).find(x=>String(x.id)===id);if(v&&confirm('¿Anular estas vacaciones? Seguirán visibles, pero no contarán como horas.')){v.cancelled=true;await saveDB();renderVacationsSection()}}
 const restore=e.target.closest('[data-vac-restore]');if(restore&&isAdmin()){const [username,id]=restore.dataset.vacRestore.split('|');const v=(db.vacations[username]||[]).find(x=>String(x.id)===id);if(v&&confirm('¿Reactivar estas vacaciones?')){v.cancelled=false;await saveDB();renderVacationsSection()}}
 const edit=e.target.closest('[data-vac-edit]');if(edit&&isAdmin()){const [username,id]=edit.dataset.vacEdit.split('|');openVacationEditForm(username,id)}
 const del=e.target.closest('[data-vac-delete]');if(del&&isAdmin()){const [username,id]=del.dataset.vacDelete.split('|');if(confirm('¿Eliminar este periodo de vacaciones?')){db.vacations[username]=(db.vacations[username]||[]).filter(v=>String(v.id)!==id);await saveDB();renderVacationsSection()}}
 const pdf=e.target.closest('[data-vac-pdf]');if(pdf){const v=allVacationRows().find(x=>String(x.id)===pdf.dataset.vacPdf);if(v?.pdfData){const a=document.createElement('a');a.href='data:application/pdf;base64,'+v.pdfData;a.download=v.filename||'vacaciones.pdf';a.click()}}
});


['vacFilterEmployee','vacFilterYear','vacFilterStart','vacFilterEnd','vacFilterStatus','vacFilterSearch'].forEach(id=>{const el=$(id);if(el)el.addEventListener('input',()=>renderVacationsSection())});
const clearVacationFilters=$('vacFilterClear');if(clearVacationFilters)clearVacationFilters.onclick=()=>{['vacFilterEmployee','vacFilterYear','vacFilterStart','vacFilterEnd','vacFilterStatus','vacFilterSearch'].forEach(id=>{const el=$(id);if(el)el.value=''});renderVacationsSection()};


async function loadScheduleWeeklyHoursSummary(){
 const box=$('scheduleWeeklyHoursSummary');if(!box||!isAdmin())return;
 box.innerHTML='<p class="muted">Calculando horas del cuadrante…</p>';
 try{
  const data=await api('/api/horarios/state');const h=data.horarios||{};const employees=h.empleados||[];const shifts=h.turnos||[];
  if(!h.semanaGenerada||!shifts.length){box.innerHTML='<p class="muted">Publica o genera un cuadrante para ver las horas semanales por empleado.</p>';return;}
  const dates=[...(h.diasSemana||[])].map(d=>typeof d==='string'?d:(d.isoFecha||d.fecha||d.date||d.dia||'')).filter(Boolean);
  const duration=t=>{const [a,b]=[String(t.horaInicio||'').split(':').map(Number),String(t.horaFin||'').split(':').map(Number)];return Math.max(0,(b[0]*60+(b[1]||0)-a[0]*60-(a[1]||0))/60);};
  const totals=employees.map(e=>({name:e.nombre||e.name||'Empleado',hours:shifts.filter(t=>String(t.empleadoId)===String(e.id)&&(!dates.length||dates.includes(String(t.fecha)))).reduce((s,t)=>s+duration(t),0)})).filter(e=>e.hours>0).sort((a,b)=>a.name.localeCompare(b.name,'es'));
  box.innerHTML='<div class="schedule-weekly-hours-head"><h3>🕒 Horas semanales del cuadrante</h3><span>Según los turnos asignados</span></div>'+(totals.length?'<div class="schedule-weekly-hours-grid">'+totals.map(e=>'<div class="schedule-weekly-hours-item"><span>'+vendorEscape(e.name)+'</span><strong>'+Number(e.hours.toFixed(1)).toLocaleString('es-ES')+' h</strong></div>').join('')+'</div>':'<p class="muted">Todavía no hay turnos asignados.</p>');
 }catch(err){box.innerHTML='<p class="muted">No se pudieron cargar las horas del cuadrante.</p>';console.error(err);}
}
document.addEventListener('click',e=>{const tab=e.target.closest('[data-section="employeesPanel"]');if(tab)setTimeout(loadScheduleWeeklyHoursSummary,0);},true);
async function loadPublishedSchedule(){
 const box=$('publishedScheduleContent');if(!box)return;
 box.innerHTML='<p class="muted">Cargando el último horario guardado…</p>';
 try{
  const data=await api('/api/horarios/state');const h=data.horarios||{};const employees=h.empleados||[],turnos=h.turnos||[];
  if(!h.semanaGenerada||!turnos.length){box.innerHTML=isAdmin()?'<p class="empty-state">No hay un cuadrante publicado todavía. Puedes crear o revisar el cuadrante desde el generador y publicarlo cuando esté listo.</p><button type="button" class="primary" id="openScheduleGenerator">📅 Abrir generador de horarios</button>':'<p class="empty-state">📅 No hay un cuadrante publicado todavía. Cuando el administrador lo publique, podrás verlo aquí.</p>';return;}
  const dates=[...new Set([...(h.diasSemana||[]).map(d=>typeof d==='string'?d:(d.fecha||d.date||d.dia||'')),...turnos.map(t=>String(t.fecha||''))].filter(v=>/^\\d{4}-\\d{2}-\\d{2}$/.test(v)))].sort();
  const weekdayNames=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const shiftClass=t=>{const a=String(t.horaInicio||'').replace(':',''),b=String(t.horaFin||'').replace(':','');if(a==='1600'&&b==='2100')return 'shift-sky';if(a==='1100'&&b==='2100')return 'shift-green';return ''};
  const normalizeRole=t=>String(t.puesto||t.rol||t.area||t.departamento||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase();
  const roleFor=t=>{const p=normalizeRole(t);if(/cumple|birthday|fiesta/.test(p))return 'cumples';if(/monitor/.test(p))return 'monitores';if(/kiosko|kiosco/.test(p))return 'kiosko';return 'vendedores'};
  const roleLabel={vendedores:'Vendedores',monitores:'Monitores',kiosko:'Kiosko'};
  let html='<p class="published-schedule-period"><strong>Semana:</strong> '+vendorEscape(h.fechaInicio||dates[0]||'')+' <span>· Solo lectura</span></p><div class="simple-published-schedule">';
  for(const date of dates){
   const dayRows=turnos.filter(t=>String(t.fecha||'')===date);
   const d=new Date(date+'T12:00:00');
   html+='<section class="simple-schedule-day"><h3>'+weekdayNames[d.getDay()]+' '+d.getDate()+'/'+String(d.getMonth()+1).padStart(2,'0')+'</h3><div class="simple-schedule-columns">';
   const groups=['vendedores','monitores','kiosko'];
   for(const group of groups){
    const rows=dayRows.filter(t=>roleFor(t)===group);
    const birthdays=group==='vendedores'?dayRows.filter(t=>roleFor(t)==='cumples'):[];
    html+='<div class="simple-schedule-group"><h4>'+roleLabel[group]+'</h4>';
    if(group==='vendedores')html+='<div class="simple-schedule-birthdays"><strong>Cumples</strong>'+(birthdays.length?birthdays.map(t=>'<div class="simple-birthday-line">'+vendorEscape([t.horaInicio&&t.horaFin?[t.horaInicio,t.horaFin].join('–'):'',t.descripcion||t.detalle||t.nombreCumple||t.cumple||t.observaciones||t.nota||t.puesto].filter(Boolean).join(' · '))+'</div>').join(''):'<span class="muted">—</span>')+'</div>';
    html+='<ul>'+rows.map(t=>{const emp=employees.find(e=>String(e.id)===String(t.empleadoId));const name=emp?.nombre||emp?.username||t.empleadoNombre||t.nombreEmpleado||t.empleadoId||'Empleado';const time=[t.horaInicio||'',t.horaFin||''].filter(Boolean).join('–');const details=[t.puesto&&roleFor(t)!=='vendedores'?t.puesto:'',t.observaciones||t.nota||''].filter(Boolean).join(' · ');return '<li><strong>'+vendorEscape(name)+'</strong> <span class="schedule-shift '+shiftClass(t)+'">'+vendorEscape(time)+'</span>'+(details?' <span class="simple-schedule-detail">'+vendorEscape(details)+'</span>':'')+'</li>'}).join('')+'</ul></div>';
   }
   html+='</div></section>';
  }
  html+='</div>';box.innerHTML=html;
 }catch(e){box.innerHTML='<p class="error">No se pudo cargar el horario publicado: '+vendorEscape(e.message)+'</p>'}
}
document.addEventListener('click',e=>{if(e.target.closest('#refreshPublishedSchedule'))loadPublishedSchedule();if(e.target.closest('#openScheduleGenerator')&&isAdmin())showSection('horariosPanel')});


async function renderWages(){
 if(!isAdmin())return;
 const panel=$('wagesPanel');if(panel)panel.classList.remove('hidden');
 try{const saved=await api('/api/admin/wages');if(!saved||typeof saved!=='object'||!saved.wages||typeof saved.wages!=='object'||!Array.isArray(saved.wageReference))throw new Error('La API devolvió un formato de datos inesperado');db.wages=saved.wages;db.wageReference=saved.wageReference;db.wage_reference=saved.wageReference;renderWages.loaded=true;}catch(e){$('wageStatus').textContent='Error al cargar sueldos: '+e.message;$('wageCurrent').innerHTML='<p class="error">No se pudieron cargar los datos guardados. No se han borrado; vuelve a intentarlo o recarga la página.</p>';return}db.wages=db.wages||{};db.wageReference=db.wageReference||[];
 // Eliminar referencias duplicadas exactas generadas por listeners repetidos.
 const seenRefs=new Set();
 db.wageReference=db.wageReference.filter(r=>{
  const key=JSON.stringify([Number(r.hours||0),String(r.type||'Normal'),Number(r.payroll||0),Number(r.holiday||0),Number(r.extra||0),String(r.note||'').trim()]);
  if(seenRefs.has(key))return false;seenRefs.add(key);return true;
 });
 const sel=$('wageEmployee'),filter=$('wageHistoryEmployee');
 if(!sel||!filter)return;
 const employees=(Array.isArray(db.users)?db.users:[]).filter(u=>String(u.username||'').toLowerCase()!=='admin'&&String(u.username||'').toLowerCase()!=='vendedor'&&String(u.role||'').toLowerCase()!=='admin'&&String(u.role||'').toLowerCase()!=='vendedor');
 const oldSelected=[...sel.selectedOptions].map(o=>o.value);
 sel.innerHTML='<option value="">Selecciona un empleado</option>'+employees.map(u=>'<option value="'+vendorEscape(u.username)+'">'+vendorEscape(u.name)+'</option>').join('');
 oldSelected.forEach(v=>{const o=[...sel.options].find(x=>x.value===v);if(o)o.selected=true});
 
 const oldFilter=filter.value;
 filter.innerHTML='<option value="">Todos los empleados</option>'+employees.map(u=>'<option value="'+vendorEscape(u.username)+'">'+vendorEscape(u.name)+'</option>').join('');
 if(employees.some(u=>u.username===oldFilter))filter.value=oldFilter;
 const selectedUsers=()=>[...sel.selectedOptions].map(o=>o.value);
 const renderReference=()=>{
  const refs=db.wageReference||[];
  $('wageReferenceTable').innerHTML=refs.length?'<table class="published-schedule-table"><thead><tr><th>Hs</th><th>Tipo</th><th>Nómina</th><th>Festivos</th><th>Extra</th><th>Observaciones</th><th></th></tr></thead><tbody>'+refs.map((r,i)=>'<tr><td>'+Number(r.hours||0).toFixed(2)+' hs</td><td>'+vendorEscape(r.type||'Normal')+'</td><td>'+Number(r.payroll||0).toFixed(2)+' €</td><td>'+Number(r.holiday||0).toFixed(2)+' €</td><td>'+Number(r.extra||0).toFixed(2)+' €</td><td>'+vendorEscape(r.note||'')+'</td><td><button type="button" data-ref-delete="'+i+'">Eliminar</button></td></tr>').join('')+'</tbody></table>':'<p>Aún no hay contratos de referencia. Añade las tarifas habituales arriba.</p>';
 };
 const renderCurrent=()=>{
  const usernames=selectedUsers();
  if(!usernames.length){$('wageCurrent').innerHTML='<p>Selecciona un empleado en el formulario para ver su sueldo actual.</p>';return}
  $('wageCurrent').innerHTML=usernames.map(username=>{
   const rows=db.wages[username]||[],cur=rows[rows.length-1],name=employees.find(u=>u.username===username)?.name||username;
   return cur?'<p><strong>'+vendorEscape(name)+'</strong>: '+(cur.type==='special'?'Contrato especial':'Por hora')+' · '+Number(cur.hours||0).toFixed(2)+' hs · '+Number(cur.amount||0).toFixed(2)+' €'+(cur.type==='hourly'?' / hora':'')+' · Extra: '+Number(cur.extra||0).toFixed(2)+' € · Hora festivo: '+Number(cur.holidayRate||0).toFixed(2)+' €/h'+(cur.note?' · '+vendorEscape(cur.note):'')+' · actualizado '+vendorEscape(new Date(cur.at).toLocaleString('es-ES'))+'</p>':'<p><strong>'+vendorEscape(name)+'</strong>: Sin sueldo configurado.</p>';
  }).join('');
 };
 const renderHistory=()=>{
  const chosen=filter.value;
  const rows=[];
  Object.entries(db.wages||{}).forEach(([username,history])=>{const u=(db.users||[]).find(e=>String(e.username).toLowerCase()===String(username).toLowerCase());if(chosen&&username!==chosen)return;(Array.isArray(history)?history:[]).forEach((x,historyIndex)=>rows.push({...x,historyIndex,employeeName:u?.name||username,username}));});
  rows.sort((a,b)=>String(b.at||'').localeCompare(String(a.at||'')));
  $('wageHistory').innerHTML=rows.length?'<table class="published-schedule-table"><thead><tr><th>Fecha</th><th>Contrato</th><th>Hs</th><th>Importe</th><th>Extra</th><th>Hora festivo</th><th>Empleado</th><th>Observaciones</th></tr></thead><tbody>'+rows.map(x=>'<tr><td><input aria-label="Fecha del historial" type="datetime-local" data-wage-date-user="'+vendorEscape(x.username)+'" data-wage-date-index="'+x.historyIndex+'" value="'+vendorEscape(new Date(x.at).getTime()&&!Number.isNaN(new Date(x.at).getTime())?new Date(new Date(x.at).getTime()-new Date(x.at).getTimezoneOffset()*60000).toISOString().slice(0,16):'')+'"></td><td>'+(x.type==='special'?'Especial':'Por hora')+'</td><td>'+Number(x.hours||0).toFixed(2)+'</td><td>'+Number(x.amount||0).toFixed(2)+' €'+(x.type==='hourly'?' / h':'')+'</td><td>'+Number(x.extra||0).toFixed(2)+' €</td><td>'+Number(x.holidayRate||0).toFixed(2)+' €/h</td><td>'+vendorEscape(x.employeeName)+'</td><td>'+vendorEscape(x.note||'')+'</td></tr>').join('')+'</tbody></table>':'<p>Sin historial para este filtro.</p>';
 };
 const render=()=>{
  const username=selectedUsers()[0],rows=db.wages[username]||[],cur=rows[rows.length-1];
  if(cur){$('wageAmount').value=cur.amount??'';$('wageHours').value=Number(cur.hours||0);$('wageType').value=cur.type||'hourly';$('wageExtra').value=Number(cur.extra||0);$('wageHolidayRate').value=Number(cur.holidayRate||0);$('wageNote').value=cur.note||''}
  renderCurrent();renderHistory();renderReference();
 };
 if(!$('wageDate').value){const now=new Date();$('wageDate').value=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,16)}
 $('wageReferenceForm').onsubmit=async e=>{
  e.preventDefault();if(!isAdmin())return;
  db.wageReference=db.wageReference||[];
  db.wageReference.push({hours:Number($('refHours').value),type:$('refType').value,payroll:Number($('refPayroll').value),holiday:Number($('refHoliday').value),extra:Number($('refExtra').value),note:$('refNote').value.trim(),createdAt:new Date().toISOString()});
  try{const saved=await api('/api/admin/wages',{method:'PUT',body:JSON.stringify({wages:db.wages||{},wageReference:db.wageReference})});db.wages=saved.wages;db.wageReference=saved.wageReference;$('refNote').value='';renderWages()}catch(err){$('wageStatus').textContent='No se pudo guardar la referencia: '+err.message}
 };
 $('wageReferenceTable').onclick=async e=>{
  const btn=e.target.closest('[data-ref-delete]');if(!btn||!isAdmin())return;
  const previous=db.wageReference.slice();db.wageReference.splice(Number(btn.dataset.refDelete),1);try{const saved=await api('/api/admin/wages',{method:'PUT',body:JSON.stringify({wages:db.wages||{},wageReference:db.wageReference})});db.wages=saved.wages;db.wageReference=saved.wageReference;renderWages()}catch(err){db.wageReference=previous;alert('No se pudo eliminar: '+err.message)}
 };
 $('wageHistory').onchange=async e=>{
  const input=e.target.closest('[data-wage-date-user]');if(!input||!isAdmin()||!input.value)return;
  const username=input.dataset.wageDateUser,index=Number(input.dataset.wageDateIndex);
  if(!db.wages?.[username]?.[index])return;
  const date=new Date(input.value);if(Number.isNaN(date.getTime()))return;
  const previous=db.wages[username][index].at;db.wages[username][index].at=date.toISOString();try{const saved=await api('/api/admin/wages',{method:'PUT',body:JSON.stringify({wages:db.wages||{},wageReference:db.wageReference||[]})});db.wages=saved.wages;db.wageReference=saved.wageReference;renderWages()}catch(err){db.wages[username][index].at=previous;alert('No se pudo actualizar la fecha: '+err.message)}
 };
 sel.onchange=render;filter.onchange=renderHistory;render();
}
$('wageForm')?.addEventListener('submit',async e=>{
 e.preventDefault();if(!isAdmin())return;
 const usernames=[$('wageEmployee').value].filter(Boolean);
 if(!usernames.length){$('wageStatus').textContent='Selecciona un empleado antes de guardar.';return}
 const hours=Number($('wageHours').value),amount=Number($('wageAmount').value),extra=Number($('wageExtra').value),holidayRate=Number($('wageHolidayRate').value);
 if(!Number.isFinite(hours)||hours<0||!Number.isFinite(amount)||amount<0||!Number.isFinite(extra)||extra<0||!Number.isFinite(holidayRate)||holidayRate<0){$('wageStatus').textContent='Revisa las horas, el importe y el extra.';return}
 db.wages=db.wages||{};
 const at=$('wageDate').value?new Date($('wageDate').value).toISOString():new Date().toISOString(),type=$('wageType').value,note=$('wageNote').value.trim();
 usernames.forEach(username=>{
  db.wages[username]=db.wages[username]||[];
  db.wages[username].push({type,hours,amount,extra,holidayRate,note,at});
 });
 try{const saved=await api('/api/admin/wages',{method:'PUT',body:JSON.stringify({wages:db.wages||{},wageReference:db.wageReference||[]})});db.wages=saved.wages;db.wageReference=saved.wageReference;$('wageStatus').textContent='✅ Sueldo/hs guardado correctamente para '+(db.users.find(u=>u.username===usernames[0])?.name||usernames[0])+'.';renderWages()}catch(err){$('wageStatus').textContent='No se pudo guardar el sueldo: '+err.message}
});
const tipHourOverrides = window.__tipHourOverrides || (window.__tipHourOverrides = {});
function parseManualHours(value){
 const s=String(value??'').trim();
 if(!s)return 0;
 const m=s.match(/^(\d+)(?::([0-5]?\d))?$/);
 if(!m)return null;
 const hours=Number(m[1]),minutes=Number(m[2]||0);
 if(!Number.isFinite(hours)||!Number.isFinite(minutes))return null;
 return hours*60+minutes;
}
function renderMonthlyHours(){
 if(!isAdmin())return;
 const inp=$('monthlyHoursMonth');if(!inp)return;
 if(!inp.value)inp.value=dateKey(new Date()).slice(0,7);
 const month=inp.value;
 const employees=db.users.filter(u=>u.role==='employee'&&u.active!==false);
 const rows=[];
 for(const u of employees){
  let worked=0,vac=0;
  for(let day=1;day<=new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate();day++){
   const k=month+'-'+String(day).padStart(2,'0');
   worked+=totalMinutes((db.records?.[u.username]||{})[k]||{});
   if((db.vacations?.[u.username]||[]).some(v=>!v.cancelled&&k>=v.start&&k<=v.end)&&isWeekday(parseKey(k)))vac+=dailyContractMinutes(u);
  }
  const overrideKey=month+':'+u.username;
  rows.push({u,worked:tipHourOverrides[overrideKey]??worked,originalWorked:worked,vac,overrideKey});
 }
 $('monthlyHoursTable').innerHTML='<div class="published-schedule-table-wrap"><table class="published-schedule-table"><thead><tr><th>Empleado</th><th>Horas para propinas (editable HH:MM)</th><th>Vacaciones (aparte)</th></tr></thead><tbody>'+rows.map(x=>'<tr><th>'+vendorEscape(x.u.name)+'</th><td><input class="tip-hours-manual" data-tip-hours-key="'+vendorEscape(x.overrideKey)+'" aria-label="Horas para propinas de '+vendorEscape(x.u.name)+'" type="text" inputmode="numeric" placeholder="HH:MM" value="'+vendorEscape(fmtMinutes(x.worked))+'" style="max-width:110px"></td><td>'+fmtMinutes(x.vac)+'</td></tr>').join('')+'</tbody></table></div><p class="muted">Puedes editar las horas solo para este reparto. Los registros originales del horario no se modifican. Para volver a las horas registradas, borra el valor editado y vuelve a calcular.</p>';
 const calculate=()=>{
  const totalInput=Number(String($('tipTotal').value||'0').replace(',','.'));
  const totalCents=Math.max(0,Math.round((Number.isFinite(totalInput)?totalInput:0)*100));
  const mins=rows.reduce((sum,x)=>sum+Math.max(0,Number(x.worked)||0),0);
  const result=$('tipResults');
  if(!mins){result.innerHTML='<p>No hay horas trabajadas para repartir.</p>';return null;}
  const allocations=rows.map((x,index)=>{const exactCents=totalCents*Math.max(0,Number(x.worked)||0)/mins;return {x,index,cents:Math.floor(exactCents),remainder:exactCents-Math.floor(exactCents)}});
  let remaining=totalCents-allocations.reduce((sum,a)=>sum+a.cents,0);
  allocations.slice().sort((a,b)=>b.remainder-a.remainder||a.index-b.index).slice(0,remaining).forEach(a=>{allocations[a.index].cents+=1});
  const distributed=allocations.reduce((sum,a)=>sum+a.cents,0);
  result.innerHTML='<table class="published-schedule-table"><thead><tr><th>Empleado</th><th>Horas</th><th>Propina</th></tr></thead><tbody>'+allocations.map(a=>'<tr><th>'+vendorEscape(a.x.u.name)+'</th><td>'+fmtMinutes(a.x.worked)+'</td><td>'+(a.cents/100).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €</td></tr>').join('')+'</tbody></table><p><strong>Total propina:</strong> '+(distributed/100).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' € · <strong>Total horas:</strong> '+fmtMinutes(mins)+'</p>';
  return {month,totalCents,mins,allocations,distributed};
 };
 $('calculateTips').onclick=calculate;
 $('exportTipsPdf').onclick=()=>{
  const report=calculate();
  if(!report)return;
  const monthLabel=new Date(Number(month.slice(0,4)),Number(month.slice(5,7))-1,1).toLocaleDateString('es-ES',{month:'long',year:'numeric'});
  const money=c=>(c/100).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
  const rowsHtml=report.allocations.map(a=>'<tr><td>'+vendorEscape(a.x.u.name)+'</td><td>'+fmtMinutes(a.x.worked)+'</td><td>'+money(a.cents)+'</td></tr>').join('');
  const html='<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Reparto de propinas - '+monthLabel+'</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#111}h1{font-size:22px}p{margin:8px 0}table{width:100%;border-collapse:collapse;margin-top:22px}th,td{border:1px solid #bbb;padding:9px;text-align:left}th{background:#eee}.summary{margin-top:18px;padding:12px;border:1px solid #bbb}@media print{button{display:none}body{margin:15mm}}</style></head><body><h1>Informe de reparto de propinas</h1><p><strong>Mes:</strong> '+monthLabel+'</p><div class="summary"><p><strong>Total propina:</strong> '+money(report.totalCents)+'</p><p><strong>Total horas computadas:</strong> '+fmtMinutes(report.mins)+'</p><p><strong>Empleados incluidos:</strong> '+report.allocations.length+'</p></div><table><thead><tr><th>Empleado</th><th>Horas para el reparto</th><th>Propina correspondiente</th></tr></thead><tbody>'+rowsHtml+'</tbody><tfoot><tr><th colspan="2">TOTAL</th><th>'+money(report.distributed)+'</th></tr></tfoot></table><p style="margin-top:24px;font-size:12px">El reparto se calcula proporcionalmente a las horas indicadas. Las horas editadas manualmente afectan solo a este reparto y no modifican el registro horario original.</p><button onclick="window.print()">Imprimir / Guardar como PDF</button><script>window.onload=()=>window.print()<\/script></body></html>';
  const win=window.open('','_blank');
  if(!win){alert('El navegador bloqueó la ventana del PDF. Permite ventanas emergentes para esta web y vuelve a intentarlo.');return;}
  win.document.open();win.document.write(html);win.document.close();
 };
 // Aplicar cambios manuales solo al cálculo de propinas; no se alteran los registros horarios.
 $('monthlyHoursTable').querySelectorAll('.tip-hours-manual').forEach(input=>{
  input.addEventListener('change',()=>{
   const parsed=parseManualHours(input.value);
   if(parsed===null){input.setCustomValidity('Introduce las horas como HH:MM, por ejemplo 97:30.');input.reportValidity();input.value=fmtMinutes(rows.find(x=>x.overrideKey===input.dataset.tipHoursKey)?.worked||0);return;}
   input.setCustomValidity('');
   const row=rows.find(x=>x.overrideKey===input.dataset.tipHoursKey);
   if(!row)return;
   if(input.value.trim()===''){delete tipHourOverrides[row.overrideKey];row.worked=row.originalWorked;input.value=fmtMinutes(row.worked);}
   else{tipHourOverrides[row.overrideKey]=parsed;row.worked=parsed;input.value=fmtMinutes(parsed);}
   calculate();
  });
 });
}
$('monthlyHoursMonth')?.addEventListener('change',renderMonthlyHours);

function updateSectionTabsVisibility(){
  const admin=isAdmin();
  document.querySelectorAll('.section-tab.admin-tab').forEach(t=>t.classList.toggle('hidden', !admin));
  $('importExportPanel')?.classList.toggle('hidden', !admin || $('importExportPanel').dataset.active !== 'true');
  // Never expose admin upload/edit controls in an employee session, including
  // elements left in the DOM after a role/session change.
  document.querySelectorAll('#personalSpacePanel .payroll-admin').forEach(el=>el.classList.toggle('hidden',!admin));
  $('personalSpaceAdminOverview')?.classList.toggle('hidden',!admin);
}

function showSection(sectionId){
  if((sectionId==='importExportPanel'||sectionId==='invoicesPanel'||sectionId==='wagesPanel'||sectionId==='monthlyHoursPanel'||sectionId==='vendorWorkspace')&&!isAdmin())return;
  if(sectionId==='horariosPanel'&&!isAdmin())sectionId='publishedSchedulePanel';
  if(['dashboardPanel','balancesPanel','employeesPanel','hugoErikaPanel'].includes(sectionId)&&!isAdmin())return;
  ['mainPanel','dashboardPanel','balancesPanel','employeesPanel','hugoErikaPanel','importExportPanel','horariosPanel','publishedSchedulePanel','vacationsPanel','personalSpacePanel','invoicesPanel','wagesPanel','monthlyHoursPanel','vendorWorkspace'].forEach(id=>$(id)?.classList.toggle('hidden',id!==sectionId));
  const importPanel=$('importExportPanel');
  if(importPanel)importPanel.dataset.active=sectionId==='importExportPanel'?'true':'false';
  updateSectionTabsVisibility();
  document.querySelectorAll('.section-tab').forEach(t=>t.classList.toggle('active',t.dataset.section===sectionId));
  if(sectionId==='dashboardPanel'&&isAdmin())renderDashboard('general');if(sectionId==='vacationsPanel')renderVacationsSection();if(sectionId==='invoicesPanel'&&isAdmin())setupInvoices();
  if(sectionId==='importExportPanel'&&isAdmin())renderLastBackupLabel();
  if(sectionId==='publishedSchedulePanel')loadPublishedSchedule();
  if(sectionId==='wagesPanel')renderWages();
  if(sectionId==='monthlyHoursPanel')renderMonthlyHours();
  if(sectionId==='personalSpacePanel'){if(isAdmin())renderPersonalSpaceAdminOverview();setupPayrollUI();}
  if(sectionId==='vendorWorkspace'&&isAdmin()){api('/api/vendor/sheets').then(out=>renderVendorWorkspace(out.sheets||{})).catch(err=>{const box=$('vendorSheetContainer');if(box)box.innerHTML='<p>No se pudo cargar Stock: '+vendorEscape(err.message)+'</p>';});}
  $(sectionId)?.scrollIntoView({behavior:'smooth',block:'start'});
}
document.addEventListener('click',e=>{
  if(e.target.closest('#horariosBtn')){e.preventDefault();showSection('horariosPanel')}
  else if(e.target.closest('#dashboardBtn')){e.preventDefault();showSection('dashboardPanel')}
  else if(e.target.closest('#balancesBtn')){e.preventDefault();showSection('balancesPanel')}
  else if(e.target.closest('#closeHorarios')){e.preventDefault();showSection('mainPanel')}
});

$('publishHorarioBtn')?.addEventListener('click',async()=>{if(!isAdmin())return;if(!confirm('¿Publicar el horario actual? Los empleados dejarán de ver el horario anterior y verán este nuevo horario.'))return;const button=$('publishHorarioBtn');button.disabled=true;try{await api('/api/horarios/publish',{method:'POST',body:JSON.stringify({})});alert('Horario publicado. Los empleados ya pueden verlo.');}catch(e){alert('No se pudo publicar el horario: '+e.message)}finally{button.disabled=false}});
