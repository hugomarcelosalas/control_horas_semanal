const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Pool } = require('pg');
const { google } = require('googleapis');
const { Readable } = require('stream');
const path = require('path');

const app = express();
app.use(express.json({limit:'15mb'}));
app.use(express.static(__dirname));
app.use('/horarios', express.static(path.join(__dirname,'horarios-app','build')));

const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: {rejectUnauthorized:false} }) : null;
const TEST_MODE = process.env.TEST_MODE === '1';
let memoryDb = null;
const sessions = new Map();
const DEFAULT_USERS = [
  {username:'admin',name:'Administrador',role:'admin',weeklyHours:40},
  {username:'carli',name:'Carli Carmona',role:'employee',weeklyHours:40,active:true,color:'#2563eb'},
  {username:'hugo',name:'Hugo',role:'employee',weeklyHours:40,active:true,color:'#dc2626'},
  {username:'erika',name:'Erika',role:'employee',weeklyHours:40,active:true,color:'#16a34a'},
  {username:'jose',name:'Jose',role:'employee',weeklyHours:40,active:true,color:'#9333ea'},
  {username:'hakim',name:'Hakim',role:'employee',weeklyHours:40,active:true,color:'#ea580c'},
  {username:'aitana',name:'Aitana',role:'employee',weeklyHours:40,active:true,color:'#0891b2'}
];

function createInitialDb(password){
  const users=DEFAULT_USERS.map(u=>({...u,passwordHash:u.username==='admin'?bcrypt.hashSync(password,12):bcrypt.hashSync(u.username,12)}));
  const db={users,records:{},locks:{},weekly:{},vacations:{},payrolls:[],horarios:{fechaInicio:'',semanaGenerada:false,diasSemana:[],empleados:[],turnos:[],cumples:[]},balanceVisibility:{},monthLocks:{},auditLog:[],version:8};
  for(const u of users){db.records[u.username]={};db.locks[u.username]={};db.weekly[u.username]=[];db.vacations[u.username]=[];}
  return db;
}
async function init(){
  if(TEST_MODE && !process.env.DATABASE_URL){
    memoryDb=createInitialDb(process.env.ADMIN_PASSWORD||'pruebas');
    return;
  }
  if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  await pool.query(`CREATE TABLE IF NOT EXISTS app_state (id integer primary key, data jsonb not null, updated_at timestamptz not null default now())`);
  const r=await pool.query('SELECT id FROM app_state WHERE id=1');
  if(!r.rowCount){
    const password=process.env.ADMIN_PASSWORD;
    if(!password) throw new Error('ADMIN_PASSWORD is required on first startup');
    await pool.query('INSERT INTO app_state(id,data) VALUES(1,$1)',[createInitialDb(password)]);
  }
}
function driveConfig(){
  const folderId=process.env.GOOGLE_DRIVE_FOLDER_ID;
  const clientId=process.env.GOOGLE_CLIENT_ID;
  const clientSecret=process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken=process.env.GOOGLE_REFRESH_TOKEN;
  if(!folderId||!clientId||!clientSecret||!refreshToken) throw new Error('Faltan las variables de Google Drive');
  const auth=new google.auth.OAuth2(clientId,clientSecret);
  auth.setCredentials({refresh_token:refreshToken});
  return {drive:google.drive({version:'v3',auth}),folderId};
}
function ensurePayrolls(db){db.payrolls=db.payrolls||[];return db.payrolls}
async function getDb(){if(TEST_MODE && !process.env.DATABASE_URL)return memoryDb;const r=await pool.query('SELECT data FROM app_state WHERE id=1');return r.rows[0].data}
async function putDb(db){if(TEST_MODE && !process.env.DATABASE_URL){memoryDb=db;return}await pool.query('UPDATE app_state SET data=$1,updated_at=now() WHERE id=1',[db])}
function publicDb(db){return {...db,users:db.users.map(({passwordHash,...u})=>u),payrolls:(db.payrolls||[]).map(({driveFileId,...p})=>p)} }
function tokenUser(req){const token=(req.headers.authorization||'').replace(/^Bearer\s+/,'');return token?sessions.get(token):null}
function requireAuth(req,res,next){const u=tokenUser(req);if(!u)return res.status(401).json({error:'No autorizado'});req.auth=u;next()}
function sanitizeIncoming(db){db.version=8;db.records=db.records||{};db.locks=db.locks||{};db.weekly=db.weekly||{};db.vacations=db.vacations||{};db.horarios=db.horarios||{fechaInicio:'',semanaGenerada:false,diasSemana:[],empleados:[],turnos:[],cumples:[]};db.balanceVisibility=db.balanceVisibility||{};db.monthLocks=db.monthLocks||{};delete db.payrolls;db.users=(db.users||[]).map(u=>({...u,active:u.role==='admin'?true:u.active!==false}));return db}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b)}
function publicUsers(users){return users.map(({passwordHash,...u})=>u)}
function auditChanges(old,incoming,actor){const out=[],now=new Date().toISOString(),actorName=actor?.name||actor?.username||'Administrador',add=message=>out.push({at:now,actorName,message});for(const u of incoming.users||[]){const o=(old.users||[]).find(x=>x.username===u.username);if(!o)add('Creó al empleado '+u.name);else if(JSON.stringify({...o,passwordHash:undefined})!==JSON.stringify({...u,passwordHash:undefined}))add('Actualizó al empleado '+u.name)}for(const u of old.users||[]){if(!(incoming.users||[]).some(x=>x.username===u.username))add('Eliminó al empleado '+u.name)}for(const type of ['records','weekly','vacations','locks']){const users=new Set([...Object.keys(old[type]||{}),...Object.keys(incoming[type]||{})]);for(const username of users){const a=old[type]?.[username]||{},b=incoming[type]?.[username]||{};if(JSON.stringify(a)!==JSON.stringify(b)){const name=(incoming.users||old.users||[]).find(x=>x.username===username)?.name||username;add('Modificó '+type+' de '+name)}}}return out}

app.post('/api/login',async(req,res)=>{try{const username=String(req.body.username||'').trim().toLowerCase(),password=String(req.body.password||'');const db=await getDb();const u=db.users.find(x=>x.username===username);if(!u||u.role!=='admin'&&u.active===false||!bcrypt.compareSync(password,u.passwordHash))return res.status(401).json({error:'Usuario o contraseña incorrectos'});const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{username:u.username,role:u.role,name:u.name,weeklyHours:u.weeklyHours});res.json({token,user:{username:u.username,role:u.role,name:u.name,weeklyHours:u.weeklyHours},db:publicDb(db)});}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/logout',requireAuth,(req,res)=>{for(const [t,u] of sessions)if(u.username===req.auth.username)sessions.delete(t);res.json({ok:true})});
app.get('/api/state',requireAuth,async(req,res)=>{res.json(publicDb(await getDb()))});
app.get('/api/audit',requireAuth,async(req,res)=>{if(req.auth.role!=='admin')return res.status(403).json({error:'Solo admin'});const db=await getDb();res.json((db.auditLog||[]).slice().reverse())});
app.put('/api/state',requireAuth,async(req,res)=>{try{const old=await getDb(), incoming=sanitizeIncoming(req.body);incoming.payrolls=old.payrolls||[];const me=req.auth;
  if(me.role!=='admin'){
    if(!same(publicUsers(old.users),incoming.users)||!same(old.balanceVisibility,incoming.balanceVisibility))return res.status(403).json({error:'No tienes permiso para cambiar la administración'});
    if(!same(old.locks,incoming.locks)||!same(old.weekly,incoming.weekly))return res.status(403).json({error:'Solo el admin puede modificar bloqueos y la lista semanal'});
    for(const key of ['records','vacations']){
      for(const username of Object.keys(incoming[key]||{})) if(username!==me.username && !same(old[key]?.[username]||{},incoming[key]?.[username]||{})) return res.status(403).json({error:'No tienes permiso para modificar otros empleados'});
    }
  }
  const oldByUser=new Map(old.users.map(u=>[u.username,u]));
  incoming.users=(incoming.users||[]).map(u=>({...u,passwordHash:oldByUser.get(u.username)?.passwordHash}));
  const changes=auditChanges(old,incoming,me);incoming.auditLog=[...(old.auditLog||[]),...changes].slice(-500);await putDb(incoming);res.json({ok:true,db:publicDb(incoming)});
}catch(e){res.status(500).json({error:e.message})}});

app.post('/api/admin/user',requireAuth,async(req,res)=>{if(req.auth.role!=='admin')return res.status(403).json({error:'Solo admin'});try{const db=await getDb(),{name,username,password,weeklyHours,active,color}=req.body;const u=String(username||'').trim().toLowerCase();if(!name||!u||!password)return res.status(400).json({error:'Faltan datos'});if(db.users.some(x=>x.username===u))return res.status(409).json({error:'Ese usuario ya existe'});db.users.push({username:u,name:String(name).trim(),role:'employee',weeklyHours:Number(weeklyHours)||40,active:active!==false,color:String(color||'#2563eb'),passwordHash:bcrypt.hashSync(String(password),12)});db.records[u]={};db.locks[u]={};db.weekly[u]=[];db.vacations[u]=[];db.balanceVisibility[u]=true;await putDb(db);res.json(publicDb(db));}catch(e){res.status(500).json({error:e.message})}});
app.put('/api/admin/user/:username',requireAuth,async(req,res)=>{if(req.auth.role!=='admin')return res.status(403).json({error:'Solo admin'});try{const db=await getDb(),u=db.users.find(x=>x.username===req.params.username);if(!u||u.role==='admin')return res.status(404).json({error:'Empleado no encontrado'});u.name=String(req.body.name||u.name).trim();u.weeklyHours=Number(req.body.weeklyHours)||40;u.active=req.body.active!==false;u.color=String(req.body.color||u.color||'#2563eb');if(req.body.password)u.passwordHash=bcrypt.hashSync(String(req.body.password),12);await putDb(db);res.json(publicDb(db));}catch(e){res.status(500).json({error:e.message})}});
app.delete('/api/admin/user/:username',requireAuth,async(req,res)=>{if(req.auth.role!=='admin')return res.status(403).json({error:'Solo admin'});try{const db=await getDb(),u=db.users.find(x=>x.username===req.params.username);if(!u||u.role==='admin')return res.status(404).json({error:'Empleado no encontrado'});db.users=db.users.filter(x=>x.username!==u.username);delete db.records[u.username];delete db.locks[u.username];delete db.weekly[u.username];delete db.vacations[u.username];delete db.balanceVisibility[u.username];await putDb(db);res.json(publicDb(db));}catch(e){res.status(500).json({error:e.message})}});


app.get('/api/horarios/summary',requireAuth,async(req,res)=>{try{const db=await getDb();const username=req.auth.role==='admin'&&req.query.username?String(req.query.username):req.auth.username;const start=String(req.query.start||'');const end=String(req.query.end||'');const h=db.horarios||{};const turnos=Array.isArray(h.turnos)?h.turnos:[];const employees=Array.isArray(h.empleados)?h.empleados:[];const emp=employees.find(e=>String(e.id)===username||String(e.username)===username);const sourceId=emp?.id||username;const inRange=t=>String(t.fecha)>=start&&String(t.fecha)<=end&&String(t.empleadoId)===String(sourceId);const minutes=turnos.filter(inRange).reduce((sum,t)=>{const [h1,m1]=String(t.horaInicio||'00:00').split(':').map(Number);const [h2,m2]=String(t.horaFin||'00:00').split(':').map(Number);const a=h1*60+(m1||0),b=h2*60+(m2||0);return sum+(b>a?b-a:0)},0);res.json({username,plannedMinutes:minutes,turnos:turnos.filter(inRange).length});}catch(e){res.status(500).json({error:e.message})}});
app.get('/api/horarios/state',requireAuth,async(req,res)=>{try{const db=await getDb();const h=db.horarios||{fechaInicio:'',semanaGenerada:false,diasSemana:[],empleados:[],turnos:[],cumples:[]};const employees=(db.users||[]).filter(u=>u.role==='employee'&&u.active!==false).map(u=>({id:u.username,username:u.username,nombre:u.name,horasContratadas:Number(u.weeklyHours)||40,color:u.color||'#2563eb'}));res.json({horarios:h,employees,user:{username:req.auth.username,role:req.auth.role,name:req.auth.name}})}catch(e){res.status(500).json({error:e.message})}});
app.put('/api/horarios/state',requireAuth,async(req,res)=>{if(req.auth.role!=='admin')return res.status(403).json({error:'Solo el admin puede modificar el cuadrante'});try{const db=await getDb();const h=req.body||{};h.fechaInicio=String(h.fechaInicio||'');h.semanaGenerada=Boolean(h.semanaGenerada);h.diasSemana=Array.isArray(h.diasSemana)?h.diasSemana:[];h.turnos=Array.isArray(h.turnos)?h.turnos:[];h.cumples=Array.isArray(h.cumples)?h.cumples:[];const employees=(db.users||[]).filter(u=>u.role==='employee'&&u.active!==false).map(u=>({id:u.username,username:u.username,nombre:u.name,horasContratadas:Number(u.weeklyHours)||40,color:u.color||'#2563eb'}));const validIds=new Set(employees.map(e=>String(e.id)));const oldEmployees=Array.isArray(db.horarios?.empleados)?db.horarios.empleados:[];const oldByName=new Map(oldEmployees.map(e=>[String(e.nombre||'').trim().toLowerCase(),e]));h.empleados=employees.map(e=>{const old=oldByName.get(String(e.nombre).trim().toLowerCase());return {...e,id:e.id,username:e.username,legacyId:old?.id??null}});const allowedNames=new Map(employees.map(e=>[e.id,e.nombre]));h.turnos=h.turnos.map(t=>{const id=String(t.empleadoId||'');if(validIds.has(id))return {...t,empleadoId:id};const old=oldEmployees.find(e=>String(e.id)===id);const match=old?employees.find(e=>String(e.nombre).trim().toLowerCase()===String(old.nombre||'').trim().toLowerCase()):null;return match?{...t,empleadoId:match.id}:t;});db.horarios=h;await putDb(db);res.json({ok:true,horarios:h,employees});}catch(e){res.status(500).json({error:e.message})}});

app.get('/api/payrolls',requireAuth,async(req,res)=>{try{const db=await getDb();const all=ensurePayrolls(db);const rows=req.auth.role==='admin'?all:all.filter(x=>x.username===req.auth.username);res.json(rows.map(({driveFileId,...x})=>({...x,driveFileId:undefined})));}catch(e){res.status(500).json({error:e.message})}});
app.post('/api/admin/payroll',requireAuth,async(req,res)=>{if(req.auth.role!=='admin')return res.status(403).json({error:'Solo admin'});try{const {username,month,filename,mimeType,dataBase64}=req.body;const db=await getDb();const u=db.users.find(x=>x.username===username&&x.role==='employee');if(!u)return res.status(404).json({error:'Empleado no encontrado'});if(!/^\\d{4}-\\d{2}$/.test(String(month||'')))return res.status(400).json({error:'Mes no válido'});if(!filename||!dataBase64)return res.status(400).json({error:'Falta el PDF'});if(!String(filename).toLowerCase().endsWith('.pdf'))return res.status(400).json({error:'Solo se admiten PDF'});const {drive,folderId}=driveConfig();const safeName=String(filename).replace(/[\\/:*?"<>|]/g,'_');const meta={name:u.name+' - Nómina '+month+' - '+safeName,parents:[folderId],description:'Nómina de '+u.name+' ('+month+')'};const media={mimeType:'application/pdf',body:Readable.from(Buffer.from(String(dataBase64),'base64'))};const up=await drive.files.create({requestBody:meta,media,fields:'id,name,webViewLink'});ensurePayrolls(db).push({id:crypto.randomUUID(),username:u.username,employeeName:u.name,month:String(month),filename:safeName,driveFileId:up.data.id,createdAt:new Date().toISOString()});await putDb(db);res.json({ok:true,payroll:ensurePayrolls(db).at(-1)});}catch(e){console.error(e);res.status(500).json({error:e.message})}});
app.get('/api/payroll/:id',requireAuth,async(req,res)=>{try{const db=await getDb();const p=ensurePayrolls(db).find(x=>x.id===req.params.id);if(!p)return res.status(404).json({error:'Nómina no encontrada'});if(req.auth.role!=='admin'&&p.username!==req.auth.username)return res.status(403).json({error:'No tienes permiso para ver esta nómina'});const {drive}=driveConfig();const meta=await drive.files.get({fileId:p.driveFileId,fields:'name,mimeType'});res.setHeader('Content-Type','application/pdf');res.setHeader('Content-Disposition','inline; filename="'+String(p.filename).replace(/"/g,'')+'"');const file=await drive.files.get({fileId:p.driveFileId}, {responseType:'stream'});file.data.pipe(res);}catch(e){console.error(e);res.status(500).json({error:'No se pudo abrir la nómina'})}});
app.delete('/api/admin/payroll/:id',requireAuth,async(req,res)=>{if(req.auth.role!=='admin')return res.status(403).json({error:'Solo admin'});try{const db=await getDb();const idx=ensurePayrolls(db).findIndex(x=>x.id===req.params.id);if(idx<0)return res.status(404).json({error:'Nómina no encontrada'});const p=db.payrolls[idx];const {drive}=driveConfig();try{await drive.files.delete({fileId:p.driveFileId});}catch(e){if(e.code!==404)throw e}db.payrolls.splice(idx,1);await putDb(db);res.json({ok:true});}catch(e){res.status(500).json({error:e.message})}});

app.get('*',(req,res)=>res.sendFile(require('path').join(__dirname,'index.html')));
init().then(()=>app.listen(process.env.PORT||10000,'0.0.0.0',()=>console.log('Control horario running'))).catch(e=>{console.error(e);process.exit(1)});
