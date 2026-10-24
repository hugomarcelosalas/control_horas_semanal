import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import './TablaHorario.css';

const COLORES_OPCIONES = [
  { nombre: 'Gris claro', hex: '#a0aec0' },
  { nombre: 'Verde claro', hex: '#b2f5ea' },
  { nombre: 'Púrpura claro', hex: '#d6bcfa' },
  { nombre: 'Amarillo claro', hex: '#fefcbf' },
  { nombre: 'Naranja claro', hex: '#fbd38d' },
  { nombre: 'Azul claro', hex: '#bee3f8' },
  { nombre: 'Celeste clarito', hex: '#e0f2fe' },
  { nombre: 'Rosa suave', hex: '#fed7e2' },
];

const TablaHorario = () => {
  const parentUser = window.parent && window.parent.__CONTROL_HORARIO_USER__ ? window.parent.__CONTROL_HORARIO_USER__ : {role:'employee'};
  const esRolAdmin = (role) => String(role || '').trim().toLowerCase() === 'admin' || String(role || '').trim().toLowerCase().includes('administrador');
  const [isAdmin, setIsAdmin] = useState(esRolAdmin(parentUser.role));
  const [datosServidorCargados, setDatosServidorCargados] = useState(false);
  const [pestanaActiva, setPestanaActiva] = useState(esRolAdmin(parentUser.role) ? 'admin' : 'visualizacion'); 
  const [vistaVisualizacion, setVistaVisualizacion] = useState('carriles');
  const [subVista, setSubVista] = useState(esRolAdmin(parentUser.role) ? 'detallada' : 'mia');
  const [usuarioActual, setUsuarioActual] = useState(parentUser);
  const [empleadoVistaMia, setEmpleadoVistaMia] = useState(parentUser.username || '');
  const [modoPantalla, setModoPantalla] = useState('ajustado');
  const vistaSimplePDFRef = useRef(null);

  const [fechaInicio, setFechaInicio] = useState('');
  const [semanaGenerada, setSemanaGenerada] = useState(false);
  const [diasSemana, setDiasSemana] = useState([]);
  const [capacidadParque, setCapacidadParque] = useState(150);

  // Empleados actualizados con los nuevos nombres y colores RGB convertidos a Hex
  const EMPLEADOS_INICIALES = [
  { id: 1, nombre: 'Hugo', horasContratadas: 40, color: '#a0aec0' },
  { id: 2, nombre: 'Carli', horasContratadas: 30, color: '#6ffb3c' },     // RGB: 111 251 60 -> #6ffb3c
  { id: 3, nombre: 'Erika', horasContratadas: 40, color: '#d6bcfa' },
  { id: 4, nombre: 'Jose', horasContratadas: 40, color: '#fcff2e' },     // RGB: 252 255 46 -> #fcff2e
  { id: 5, nombre: 'Hakim', horasContratadas: 40, color: '#fc9622' },    // RGB: 252 150 34 -> #fc9622
  { id: 6, nombre: 'Aitana', horasContratadas: 40, color: '#3baff1' },   // RGB: 59 175 241 -> #3baff1
  { id: 7, nombre: 'Laura', horasContratadas: 40, color: '#f5c3f9' },    // RGB: 245 195 249 -> #f5c3f9 (Sustituye a Bruno)
  { id: 8, nombre: 'Carlos III', horasContratadas: 40, color: '#f71d32' },// RGB: 247 29 50 -> #f71d32
  { id: 9, nombre: 'Pablo', horasContratadas: 40, color: '#ac6b11' },    // RGB: 172 107 17 -> #ac6b11
  { id: 10, nombre: 'Guille', horasContratadas: 40, color: '#c9f99a' },  // RGB: 201 249 154 -> #c9f99a
  { id: 11, nombre: 'Alba', horasContratadas: 20, color: '#87CEEB' },
  { id: 12, nombre: 'Ainara', horasContratadas: 20, color: '#F4A6A6' }
];

const [empleados, setEmpleados] = useState(EMPLEADOS_INICIALES);

  const [turnos, setTurnos] = useState([]);
  const [cumples, setCumples] = useState([]);
  const [historial, setHistorial] = useState([]);

  const [mostrarModalGestionEmp, setMostrarModalGestionEmp] = useState(false);
  const [idEmpPlantillaEdit, setIdEmpPlantillaEdit] = useState(null);
  const [nombreEmpPlantilla, setNombreEmpPlantilla] = useState('');
  const [horasEmpPlantilla, setHorasEmpPlantilla] = useState('');
  const [colorEmpPlantilla, setColorEmpPlantilla] = useState('#a0aec0');

  const [mostrarModalTurno, setMostrarModalTurno] = useState(false);
  const [idTurnoEdit, setIdTurnoEdit] = useState(null);
  const [turnoEmpId, setTurnoEmpId] = useState('');
  const [turnoFecha, setTurnoFecha] = useState('');
  const [turnoUbicacion, setTurnoUbicacion] = useState('vendedor');
  const [turnoHoraInicio, setTurnoHoraInicio] = useState('10:00');
  const [turnoHoraFin, setTurnoHoraFin] = useState('14:00');
  const [turnoSiEsNecesario, setTurnoSiEsNecesario] = useState(false);
  const [turnoEncargado, setTurnoEncargado] = useState(false);

  const [mostrarModalCumple, setMostrarModalCumple] = useState(false);
  const [idCumpleEdit, setIdCumpleEdit] = useState(null);
  const [cumpleFecha, setCumpleFecha] = useState('');
  const [cumpleHoraInicio, setCumpleHoraInicio] = useState('17:00');
  const [cumpleTipo, setCumpleTipo] = useState('XT');
  const [cumpleCantNinos, setCumpleCantNinos] = useState('');
  const [cumpleEdad, setCumpleEdad] = useState('');
  const [cumpleObservaciones, setCumpleObservaciones] = useState('');

  const areaExportarRef = useRef();
  const vistaHorizontalRef = useRef();
  const vistaVerticalRef = useRef();

useEffect(() => {
  let activo = true;
  let cargando = false;
  const cargarCuadrante = async () => {
    const token = window.parent && window.parent.__CONTROL_HORARIO_TOKEN__;
    if (!token || cargando) return;
    cargando = true;
    try {
      const response = await fetch('/api/horarios/state', {headers:{Authorization:'Bearer '+token}});
      if (!response.ok) throw new Error('No se pudo cargar el cuadrante ('+response.status+')');
      const data = await response.json();
      if (!activo) return;
      const h = data.horarios || {};
      setFechaInicio(h.fechaInicio || '');
      setCapacidadParque(Math.max(1, Number(h.capacidadParque) || 150));
      setSemanaGenerada(Boolean(h.semanaGenerada));
      setDiasSemana(Array.isArray(h.diasSemana) ? h.diasSemana : []);
      setTurnos(Array.isArray(h.turnos) ? h.turnos : []);
      setCumples(Array.isArray(h.cumples) ? h.cumples : []);
      setEmpleados(Array.isArray(data.employees) ? data.employees : []);
      const role = data.user?.role || (window.parent && window.parent.__CONTROL_HORARIO_USER__?.role);
      if (data.user) {
        setUsuarioActual(data.user);
        if (data.user.username) setEmpleadoVistaMia(data.user.role === 'admin' ? (data.employees?.[0]?.id || '') : data.user.username);
      }
      const admin = esRolAdmin(role);
      setIsAdmin(admin);
      setPestanaActiva(admin ? 'admin' : 'visualizacion');
      if(!admin) setSubVista('mia');
      setDatosServidorCargados(true);
    } catch (err) { console.error('Error cargando el cuadrante:', err); }
    finally { cargando = false; }
  };
  const onAuth = () => { cargarCuadrante(); };
  window.addEventListener('control-horario-auth', onAuth);
  cargarCuadrante();
  return () => { activo = false; window.removeEventListener('control-horario-auth', onAuth); };
}, []);

useEffect(() => {
  const syncRole = () => {
    const role = window.parent && window.parent.__CONTROL_HORARIO_USER__?.role;
    if(role) {
      const admin = esRolAdmin(role);
      setIsAdmin(admin);
      if(!admin) { setPestanaActiva('visualizacion'); setSubVista('mia'); }
    }
  };
  window.addEventListener('control-horario-auth', syncRole);
  syncRole();
  return () => window.removeEventListener('control-horario-auth', syncRole);
}, []);

useEffect(() => {
  if(!datosServidorCargados || !isAdmin) return;
  const timer=setTimeout(() => {
    const token = window.parent && window.parent.__CONTROL_HORARIO_TOKEN__;
    fetch('/api/horarios/state', {
      method:'PUT',
      headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
      body:JSON.stringify({fechaInicio,semanaGenerada,diasSemana,empleados,turnos,cumples,capacidadParque:Number(capacidadParque)||150})
    }).catch(err => console.error('No se pudo guardar el cuadrante',err));
  }, 500);
  return () => clearTimeout(timer);
}, [datosServidorCargados,isAdmin,fechaInicio,semanaGenerada,diasSemana,empleados,turnos,cumples,capacidadParque]);

  const registrarHistorial = () => {
    const estadoActual = {
      fechaInicio,
      semanaGenerada,
      diasSemana,
      empleados: JSON.parse(JSON.stringify(empleados)),
      turnos: JSON.parse(JSON.stringify(turnos)),
      cumples: JSON.parse(JSON.stringify(cumples))
    };
    setHistorial(prev => [...prev, estadoActual]);
  };

  const deshacerUltimaAccion = () => {
    if (historial.length === 0) {
      alert("No hay acciones anteriores para deshacer.");
      return;
    }
    const ultimoEstado = historial[historial.length - 1];
    const nuevoHistorial = historial.slice(0, historial.length - 1);

    setFechaInicio(ultimoEstado.fechaInicio);
    setSemanaGenerada(ultimoEstado.semanaGenerada);
    setDiasSemana(ultimoEstado.diasSemana);
    setEmpleados(ultimoEstado.empleados);
    setTurnos(ultimoEstado.turnos);
    setCumples(ultimoEstado.cumples);
    setHistorial(nuevoHistorial);
  };

  const calcularNuevosDiasSemana = (nuevaFechaInicio) => {
    const fechaBase = new Date(nuevaFechaInicio);
    const dias = [];
    const opcionesDia = { weekday: 'long' };

    for (let i = 0; i < 7; i++) {
      const diaActual = new Date(fechaBase);
      diaActual.setDate(fechaBase.getDate() + i);
      const nombreDia = diaActual.toLocaleDateString('es-ES', opcionesDia);
      const isoFecha = diaActual.toISOString().split('T')[0];
      const diaNum = String(diaActual.getDate()).padStart(2, '0');
      const mesNum = String(diaActual.getMonth() + 1).padStart(2, '0');
      const anioNum = diaActual.getFullYear();

      dias.push({
        clave: `dia_${i}`,
        isoFecha: isoFecha,
        nombre: nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1),
        fecha: `${diaNum}/${mesNum}`,
        anio: anioNum,
        colorFondo: '#ffffff',
        coloresBloques: { manana: '#ffffff', mediodia: '#ffffff', tarde: '#ffffff' },
        clima: ''
      });
    }
    return dias;
  };

  const actualizarDia = (isoFecha, cambios) => {
    if(!isAdmin) return;
    setDiasSemana(prev => prev.map(d => d.isoFecha === isoFecha ? { ...d, ...cambios } : d));
  };

  const imagenClima = (clima) => {
    if (!clima) return null;
    const comunes = { width: 54, height: 42, viewBox: '0 0 100 76', role: 'img', 'aria-label': clima };
    if (clima === 'soleado') return <svg {...comunes} className="imagen-clima" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="solGrad"><stop offset="0" stopColor="#FFF59D"/><stop offset="1" stopColor="#FFB300"/></radialGradient></defs><g stroke="#F59E0B" strokeWidth="5" strokeLinecap="round">{Array.from({length:8},(_,i)=><line key={i} x1="50" y1="7" x2="50" y2="17" transform={`rotate(${i*45} 50 31)`}/>)}</g><circle cx="50" cy="31" r="19" fill="url(#solGrad)" stroke="#F59E0B" strokeWidth="2"/></svg>;
    if (clima === 'nublado') return <svg {...comunes} className="imagen-clima" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="nubeGrad" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#F8FAFC"/><stop offset="1" stopColor="#AAB8C8"/></linearGradient></defs><path d="M22 58h55a16 16 0 0 0 0-32 25 25 0 0 0-47-3 18 18 0 0 0-8 35Z" fill="url(#nubeGrad)" stroke="#8A9AAD" strokeWidth="3"/></svg>;
    return <svg {...comunes} className="imagen-clima" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="lluviaNube" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#E8EEF5"/><stop offset="1" stopColor="#8B9CAF"/></linearGradient></defs><path d="M22 43h55a16 16 0 0 0 0-32 25 25 0 0 0-47-3 18 18 0 0 0-8 35Z" transform="translate(0 5)" fill="url(#lluviaNube)" stroke="#7C8DA2" strokeWidth="3"/><g stroke="#3298DB" strokeWidth="5" strokeLinecap="round"><path d="m32 56-6 12M53 56l-6 12M74 56l-6 12"/></g></svg>;
  };

  const obtenerColorBloque = (dia, hora) => {
    const h = Number(String(hora || '').split(':')[0]);
    const bloques = dia.coloresBloques || {};
    if (h >= 10 && h < 14) return bloques.manana || dia.colorFondo || '#ffffff';
    if (h >= 14 && h < 16) return bloques.mediodia || dia.colorFondo || '#ffffff';
    if (h >= 16) return bloques.tarde || dia.colorFondo || '#ffffff';
    return dia.colorFondo || '#ffffff';
  };

  const controlesDia = (dia) => {
    if (!isAdmin) return null;
    const colores = dia.coloresBloques || {};
    const opcionesColor = <>
      <option value="#ffffff">Blanco</option>
      <option value="#e5f4e3">Verde pastel</option>
      <option value="#fff7cc">Amarillo pastel</option>
      <option value="#fde2e2">Rojo pastel</option>
    </>;
    return (
      <div className="controles-dia fila-selectores-dia" data-html2canvas-ignore="true" onClick={(e) => e.stopPropagation()}>
        <div className="selectores-color-bloques">
          <div className="selector-bloque-color">
            <strong>1. 10:00–14:00</strong>
            <select aria-label={`Color de 10:00 a 14:00 de ${dia.nombre}`} value={colores.manana || '#ffffff'} onChange={(e) => actualizarDia(dia.isoFecha, { coloresBloques: { ...colores, manana: e.target.value } })}>{opcionesColor}</select>
          </div>
          <div className="selector-bloque-color">
            <strong>2. 14:00–16:00</strong>
            <select aria-label={`Color de 14:00 a 16:00 de ${dia.nombre}`} value={colores.mediodia || '#ffffff'} onChange={(e) => actualizarDia(dia.isoFecha, { coloresBloques: { ...colores, mediodia: e.target.value } })}>{opcionesColor}</select>
          </div>
          <div className="selector-bloque-color">
            <strong>3. 16:00–fin</strong>
            <select aria-label={`Color desde las 16:00 hasta el final de ${dia.nombre}`} value={colores.tarde || '#ffffff'} onChange={(e) => actualizarDia(dia.isoFecha, { coloresBloques: { ...colores, tarde: e.target.value } })}>{opcionesColor}</select>
          </div>
        </div>
        <div className="selector-clima-wrap">
          {imagenClima(dia.clima)}
          <select aria-label={`Clima de ${dia.nombre}`} value={dia.clima || ''} onChange={(e) => actualizarDia(dia.isoFecha, { clima: e.target.value })} title="Seleccionar clima">
            <option value="">Seleccionar clima</option><option value="soleado">Soleado</option><option value="nublado">Nublado</option><option value="lluvia">Lluvia</option>
          </select>
        </div>
      </div>
    );
  };

  const obtenerOcupacionDia = (dia) => {
    const ninos = cumples.filter(c => c.fecha === dia.isoFecha).reduce((n, c) => n + (Number(c.cantNinos) || 0), 0);
    const capacidad = Math.max(1, Number(capacidadParque) || 150);
    return { ninos, capacidad, porcentaje: ninos / capacidad };
  };

  const estiloCeldaOcupacionDia = (dia) => {
    const { porcentaje } = obtenerOcupacionDia(dia);
    const limitar = (v) => Math.max(0, Math.min(255, Math.round(v)));
    const mezclar = (a, b, t) => {
      const hex = (h) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
      const ca = hex(a), cb = hex(b);
      return '#' + ca.map((v,i) => limitar(v + (cb[i] - v) * t).toString(16).padStart(2,'0')).join('');
    };
    if (porcentaje > 1) return { backgroundColor: '#ef7777', transition: 'background-color .3s ease' };
    const color = porcentaje <= 0.5
      ? mezclar('#b7efc5', '#ffe082', porcentaje * 2)
      : mezclar('#ffe082', '#f28b82', (porcentaje - 0.5) * 2);
    return { backgroundColor: color, transition: 'background-color .3s ease' };
  };

  const datosCabeceraDia = (dia, mostrarFecha = true, abreviarNinos = false) => {
    const { ninos, capacidad, porcentaje } = obtenerOcupacionDia(dia);
    const excedido = ninos > capacidad;
    return (
      <div className="datos-cabecera-dia">
        <strong className="nombre-dia-grande">{dia.nombre}</strong>
        <span className="fecha-dia-grande">{dia.fecha || (dia.isoFecha ? new Date(dia.isoFecha+'T12:00:00').toLocaleDateString('es-ES',{day:'numeric',month:'numeric'}) : '')}</span>
        <span className="ninos-dia-grande">{abreviarNinos ? ninos+' k' : ninos+' niños'}</span>
        <small className="ocupacion-dia-texto">{ninos}/{capacidad} niños · {excedido ? 'superada en '+(ninos-capacidad) : Math.round(porcentaje*100)+'% ocupado'}</small>
        {dia.clima && <span className="clima-dia-grande">{imagenClima(dia.clima)}</span>}
      </div>
    );
  };

  const borrarYReiniciar = () => {
    if(!isAdmin) return;
    const opcion = window.prompt(
      "¿Qué deseas hacer?\n1: Reiniciar todo (borrar empleados, turnos y eventos)\n2: Solo cambiar fecha (mantener empleados, turnos y eventos)",
      "1"
    );

    if (opcion === "1") {
      if (window.confirm("¿Seguro que quieres borrar todo el cuadrante actual y reiniciar?")) {
        registrarHistorial();
        localStorage.removeItem('cuadrante_horario');
        setSemanaGenerada(false);
        setTurnos([]);
        setCumples([]);
        setFechaInicio('');
      }
    } else if (opcion === "2") {
      const nuevaFecha = window.prompt("Introduce la nueva fecha de inicio (YYYY-MM-DD):", fechaInicio);
      if (nuevaFecha) {
        registrarHistorial();
        const nuevosDias = calcularNuevosDiasSemana(nuevaFecha);
        
        if (diasSemana.length > 0 && nuevosDias.length > 0) {
          const fechaAntiguaBase = new Date(diasSemana[0].isoFecha);
          const fechaNuevaBase = new Date(nuevaFecha);
          const diferenciaTiempo = fechaNuevaBase.getTime() - fechaAntiguaBase.getTime();
          const diferenciaDias = Math.round(diferenciaTiempo / (1000 * 3600 * 24));

          const turnosActualizados = turnos.map(t => {
            const fTurno = new Date(t.fecha);
            fTurno.setDate(fTurno.getDate() + diferenciaDias);
            return { ...t, fecha: fTurno.toISOString().split('T')[0] };
          });

          const cumplesActualizados = cumples.map(c => {
            const fCumple = new Date(c.fecha);
            fCumple.setDate(fCumple.getDate() + diferenciaDias);
            return { ...c, fecha: fCumple.toISOString().split('T')[0] };
          });

          setTurnos(turnosActualizados);
          setCumples(cumplesActualizados);
        }

        setFechaInicio(nuevaFecha);
        setDiasSemana(nuevosDias);
        if (nuevosDias.length > 0) {
          setTurnoFecha(nuevosDias[0].isoFecha);
          setCumpleFecha(nuevosDias[0].isoFecha);
        }
      }
    }
  };

  const generarFranjasHorarias = () => {
    const franjas = [];
    for (let hora = 10; hora < 22; hora++) {
      const hStr = hora.toString().padStart(2, '0');
      franjas.push(`${hStr}:00`);
      franjas.push(`${hStr}:30`);
    }
    franjas.push('22:00');
    return franjas;
  };

  const generarOpcionesHorasEmpleado = () => {
    const opciones = [];
    for (let i = 10; i <= 22; i++) {
      const horaStr = i.toString().padStart(2, '0');
      opciones.push(`${horaStr}:00`);
      if (i < 22) {
        opciones.push(`${horaStr}:30`);
      }
    }
    return opciones;
  };

  const renderDiaSimple = (dia) => {
    const turnosDia=turnos.filter(t=>t.fecha===dia.isoFecha&&empleados.some(e=>String(e.id)===String(t.empleadoId))).slice().sort((a,b)=>String(a.horaInicio||'').localeCompare(String(b.horaInicio||'')));
    const cats=[{clave:'vendedor',titulo:'Vendedores'},{clave:'monitor',titulo:'Monitores'},{clave:'kiosko',titulo:'Kiosko'},{clave:'otros',titulo:'Otros'}];
    const hs=c=>c.horaEvento||(()=>{const [h,m]=String(c.horaInicio||'').split(':').map(Number);const n=h*60+m+30;return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;})();
    const ev=cumples.filter(c=>c.fecha===dia.isoFecha).sort((a,b)=>hs(a).localeCompare(hs(b)));
    const duracionHoras=t=>{const [h1,m1]=String(t.horaInicio||'0:0').split(':').map(Number);const [h2,m2]=String(t.horaFin||'0:0').split(':').map(Number);return (h2*60+m2-h1*60-m1)/60;};
    const esDiaCompleto=t=>duracionHoras(t)>6;
    const desfaseHora=(hora,base)=>{const [h,m]=String(hora||base).split(':').map(Number);const [bh,bm]=base.split(':').map(Number);return Math.max(0,Math.min(60,((h*60+m)-(bh*60+bm))/6));};
    const shiftClass=t=>t.horaInicio==='16:00'&&t.horaFin==='21:00'?'turno-celeste':t.horaInicio==='11:00'&&t.horaFin==='21:00'?'turno-verde-pastel':'';
    const personRow=(emp,t)=>{const inicio=Number(String(t.horaInicio||'11:00').split(':')[0])*60+Number(String(t.horaInicio||'11:00').split(':')[1]||0);const fin=Number(String(t.horaFin||'21:00').split(':')[0])*60+Number(String(t.horaFin||'21:00').split(':')[1]||0);const esManana=String(t.horaInicio||'')<'15:00';const base=esManana?630:930;const limite=esManana?930:1260;const left=esManana?Math.max(0,(inicio-base)/(limite-base)*100):Math.max(0,(inicio-base)/(limite-base)*100);const width=esManana?Math.max(0,Math.min(200-left,(fin-inicio)/(limite-base)*100)):Math.max(0,Math.min(100-left,(fin-inicio)/(limite-base)*100));return <div style={esDiaCompleto(t)?undefined:{marginLeft:0,width:'100%',position:'relative'}} className={`simple-turno-persona ${esDiaCompleto(t)?'simple-dia-completo-persona':''}`} key={t.id}><span className={`simple-turno-badge ${esDiaCompleto(t)?'turno-dia-completo':shiftClass(t)}`} style={{position:'absolute',left:esDiaCompleto(t)?0:`${left}%`,width:esDiaCompleto(t)?'100%':`${width}%`,maxWidth:'none'}}><span className="simple-turno-nombre"><i style={{backgroundColor:emp.color||'#cbd5e1'}}/>{String(emp.nombre||'').trim().split(/\s+/)[0]}{t.encargado&&<b className="simple-marca-turno" title="Encargado">★</b>}{t.siEsNecesario&&<b className="simple-marca-turno necesario" title="Solo si hace falta">!</b>}</span><span className="simple-turno-horas-texto">{t.horaInicio}–{t.horaFin}</span></span></div>;};
    const eventos=(titulo,lista)=>{const ninos=lista.reduce((s,c)=>s+Math.max(0,Number(c.cantNinos)||0),0);const pct=Math.min(100,ninos);const color=pct>=90?'#ef4444':pct>=75?'#f97316':pct>=50?'#eab308':pct>=25?'#84cc16':'#22c55e';return <div className="simple-eventos-grupo" key={titulo}><h4>{titulo}</h4><div className="simple-aforo" aria-label={`${ninos} de 100 plazas ocupadas`}><div className="simple-aforo-meta"><span>Capacidad</span><strong>{ninos}/100</strong></div><div className="simple-aforo-track"><span style={{width:`${pct}%`,background:color}}/></div></div>{lista.length?<ul>{lista.map(c=>{const [eh,em]=hs(c).split(':').map(Number);const mins=eh*60+(em||0);const esManana=titulo==='Mañana';const base=esManana?630:960;const finFranja=esManana?900:1260;const left=Math.max(0,Math.min(100,(mins-base)/(finFranja-base)*100));const tipo=String(c.tipo||'').toUpperCase();const esXT=tipo.includes('XT');const n=Number(c.cantNinos)||0;const colorEvento=n<10?'#f0f9ff':n<15?'#e0f2fe':n<=20?'#fef3c7':'#fee2e2';const bordeEvento=n<15?'#7dd3fc':n<=20?'#fcd34d':'#fca5a5';const duracion=esXT?180:120;const width=Math.max(0,Math.min(100-left,duracion/(finFranja-base)*100));return <li key={c.id} style={{margin:0,width:'100%',position:'relative',height:'auto',minHeight:38,overflow:'visible'}}><div className="simple-cumple-contenido" style={{marginLeft:`${left}%`,width:`${width}%`,minWidth:0,maxWidth:'100%'}}><div className="simple-cumple-badge" style={{background:colorEvento,borderColor:bordeEvento}}><strong>{hs(c)}</strong><span>{[c.tipo,c.cantNinos?`${c.cantNinos}k`:null,c.edad?`${c.edad}a`:null].filter(Boolean).join(' ')}</span></div></div></li>;})}</ul>:<p className="sin-eventos-franja">Sin eventos</p>}</div>;};
    return <section className="dia-simple-card" key={dia.clave}>
      <h3>{dia.nombre} <small>{dia.fecha}</small></h3>
      <div className="simple-franjas-encabezado"><strong>Mañana</strong><strong>Tarde</strong></div>
      <div className="simple-turnos-dia">{cats.map(cat=>{
        const catTurnos=turnosDia.filter(t=>cat.clave==='otros'?!['vendedor','monitor','kiosko'].includes(t.ubicacion||'vendedor'):(t.ubicacion||'vendedor')===cat.clave);
        if(!catTurnos.length)return null;
        const completos=catTurnos.filter(esDiaCompleto);
        const resto=catTurnos.filter(t=>!esDiaCompleto(t));
        const manana=resto.filter(t=>String(t.horaInicio||'')<'15:00');
        const tarde=resto.filter(t=>String(t.horaInicio||'')>='15:00');
        const renderTurnos=lista=>lista.length?lista.map(t=>{const emp=empleados.find(e=>String(e.id)===String(t.empleadoId));return emp?personRow(emp,t):null;}):<span className="simple-vacio">—</span>;
        return <div className={`simple-puesto simple-puesto-${cat.clave}`} key={cat.clave}><h4>{cat.titulo}</h4>{completos.length>0&&<div className="simple-dia-completo">{completos.map(t=>{const emp=empleados.find(e=>String(e.id)===String(t.empleadoId));return emp?personRow(emp,t):null;})}</div>}<div className="simple-puesto-franjas"><div>{renderTurnos(manana)}</div><div>{renderTurnos(tarde)}</div></div></div>;
      })}</div>

      <div className="simple-eventos"><h4 className="simple-cumples-titulo">Cumples</h4><div className="simple-eventos-columnas">{eventos('Mañana',ev.filter(c=>hs(c)>='11:00'&&hs(c)<='15:00'))}{eventos('Tarde',ev.filter(c=>hs(c)>='16:00'))}</div>{ev.some(c=>c.observaciones)&&<footer className="simple-observaciones-dia">{ev.filter(c=>c.observaciones).map(c=><p key={c.id}><b>* {hs(c)}</b> {c.observaciones}</p>)}</footer>}</div>
    </section>;
  };

  const franjasHorarias = generarFranjasHorarias();
  const opcionesHorasEmpleado = generarOpcionesHorasEmpleado();

  const franjasHorariasEnPunto = Array.from({ length: 13 }, (_, i) => {
    const h = (10 + i).toString().padStart(2, '0');
    return `${h}:00`;
  });

  const obtenerHoraInicioConAnticipacion = (horaEnPunto) => {
    if (!horaEnPunto) return '16:30';
    const [h] = horaEnPunto.split(':').map(Number);
    const minutosTotales = (h * 60) - 30;
    const horaReal = Math.floor(minutosTotales / 60);
    const minReal = minutosTotales % 60;
    return `${horaReal.toString().padStart(2, '0')}:${minReal.toString().padStart(2, '0')}`;
  };

  const calcularHoraFinEvento = (horaEnPunto, tipo) => {
    const horaInicioStr = obtenerHoraInicioConAnticipacion(horaEnPunto);
    const [hIni, mIni] = horaInicioStr.split(':').map(Number);
    
    const minutosTotalesInicio = hIni * 60 + mIni;
    const minutosASumar = tipo === 'XT' ? 210 : 150;
    const minutosTotalesFin = minutosTotalesInicio + minutosASumar;

    const hFin = Math.floor(minutosTotalesFin / 60);
    const mFin = minutosTotalesFin % 60;

    return `${hFin.toString().padStart(2, '0')}:${mFin.toString().padStart(2, '0')}`;
  };

  const calcularRowSpan = (horaInicio, horaFin) => {
    const idxInicio = franjasHorarias.indexOf(horaInicio);
    const idxFin = franjasHorarias.indexOf(horaFin);
    if (idxInicio !== -1 && idxFin !== -1 && idxFin > idxInicio) {
      return idxFin - idxInicio;
    }
    return 1;
  };

  const calcularHorasEmpleado = (empId) => {
    const turnosEmp = turnos.filter(t => String(t.empleadoId) === String(empId));
    let totalMinutos = 0;
    turnosEmp.forEach(t => {
      const [hIni, mIni = 0] = t.horaInicio.split(':').map(Number);
      const [hFin, mFin = 0] = t.horaFin.split(':').map(Number);
      const minutosIni = hIni * 60 + mIni;
      const minutosFin = hFin * 60 + mFin;
      if (minutosFin > minutosIni) {
        totalMinutos += (minutosFin - minutosIni);
      }
    });
    const horasCalculadas = totalMinutos / 60;
    return Number.isInteger(horasCalculadas) ? horasCalculadas : Number(horasCalculadas.toFixed(2));
  };

  const iniciarCuadrante = (e) => {
    e.preventDefault();
    if (!fechaInicio) return;
    registrarHistorial();

    const dias = calcularNuevosDiasSemana(fechaInicio);
    setDiasSemana(dias);
    if (dias.length > 0) {
      setTurnoFecha(dias[0].isoFecha);
      setCumpleFecha(dias[0].isoFecha);
    }
    setSemanaGenerada(true);
  };

  const calcularCarrilesEmpleados = (isoFecha) => {
    // Evitar que un mismo turno se pinte dos veces al generar la vista/impresión.
    // Se consideran duplicados solo los registros con todos los datos horarios iguales.
    const turnosZona = turnos.filter(t => t.fecha === isoFecha);
    const firmasTurnos = new Set();
    const turnosUnicos = turnosZona.filter(t => {
      const firma = [
        String(t.empleadoId), t.fecha, t.horaInicio, t.horaFin,
        t.ubicacion || 'vendedor', Boolean(t.siEsNecesario), Boolean(t.encargado)
      ].join('|');
      if (firmasTurnos.has(firma)) return false;
      firmasTurnos.add(firma);
      return true;
    });

    const elementos = turnosUnicos.map(t => {
      const emp = empleados.find(e => String(e.id) === String(t.empleadoId));
      return {
        id: `t_${t.id}`,
        tipo: 'turno',
        objetoOriginal: t,
        ubicacion: t.ubicacion || 'vendedor',
        horaInicio: t.horaInicio,
        horaFin: t.horaFin,
        nombre: emp ? emp.nombre : 'Empleado',
        siEsNecesario: Boolean(t.siEsNecesario),
        encargado: Boolean(t.encargado),
        color: emp ? emp.color : '#a0aec0'
      };
    }).sort((a, b) => {
      return franjasHorarias.indexOf(a.horaInicio) - franjasHorarias.indexOf(b.horaInicio);
    });

    const carriles = [];
    elementos.forEach(item => {
      let colocado = false;
      for (let carril of carriles) {
        const ultimoElemento = carril[carril.length - 1];
        if (franjasHorarias.indexOf(item.horaInicio) >= franjasHorarias.indexOf(ultimoElemento.horaFin)) {
          carril.push(item);
          colocado = true;
          break;
        }
      }
      if (!colocado) carriles.push([item]);
    });
    return carriles;
  };

  const calcularCarrilesEventos = (isoFecha) => {
    const cumplesZona = cumples.filter(c => c.fecha === isoFecha);
    const tonosEventos = ['#fff0bd', '#d9f1ff', '#f9d9e8', '#dff2d8', '#e8ddff', '#ffe0cc', '#d8e4ff', '#f7e3c6'];
    const elementos = cumplesZona.map((c) => {
      const datosBasicos = [
        c.cantNinos ? `${c.cantNinos} k` : null,
        c.edad ? `${c.edad} a` : null
      ].filter(Boolean).join(' - ');

      return {
        id: `c_${c.id}`,
        tipo: 'cumple',
        objetoOriginal: c,
        horaInicio: c.horaInicio,
        horaFin: c.horaFin,
        nombre: datosBasicos,
        observaciones: c.observaciones || '',
        color: '#fff0bd'
      };
    }).sort((a, b) => franjasHorarias.indexOf(a.horaInicio) - franjasHorarias.indexOf(b.horaInicio));

    // Eventos del mismo día que se solapan al menos una franja (30 min)
    // reciben tonos distintos, incluso si el solapamiento es parcial.
    elementos.forEach((item, idx) => {
      const inicio = franjasHorarias.indexOf(item.horaInicio);
      const fin = franjasHorarias.indexOf(item.horaFin);
      const coloresUsados = new Set();
      elementos.slice(0, idx).forEach(prev => {
        const prevInicio = franjasHorarias.indexOf(prev.horaInicio);
        const prevFin = franjasHorarias.indexOf(prev.horaFin);
        if (Math.min(fin, prevFin) - Math.max(inicio, prevInicio) >= 1) coloresUsados.add(prev.color);
      });
      item.color = tonosEventos.find(color => !coloresUsados.has(color)) || tonosEventos[idx % tonosEventos.length];
    });

    const carriles = [];
    elementos.forEach(item => {
      let colocado = false;
      for (let carril of carriles) {
        const ultimoElemento = carril[carril.length - 1];
        if (franjasHorarias.indexOf(item.horaInicio) >= franjasHorarias.indexOf(ultimoElemento.horaFin)) {
          carril.push(item);
          colocado = true;
          break;
        }
      }
      if (!colocado) carriles.push([item]);
    });
    return carriles;
  };

  const prioridadUbicacion = { vendedor: 0, monitor: 1, kiosko: 2 };

  const ordenarCarrilesPorUbicacion = (carriles) => [...carriles].sort((a, b) => {
    const ubicacionA = a.find(item => item.tipo === 'turno')?.ubicacion || 'vendedor';
    const ubicacionB = b.find(item => item.tipo === 'turno')?.ubicacion || 'vendedor';
    return (prioridadUbicacion[ubicacionA] ?? 3) - (prioridadUbicacion[ubicacionB] ?? 3);
  });

  const calcularCarrilesTotalesDia = (isoFecha) => {
    const carrilesEmp = ordenarCarrilesPorUbicacion(calcularCarrilesEmpleados(isoFecha));
    const carrilesEv = calcularCarrilesEventos(isoFecha);
    const cantidadVendedores = carrilesEmp.filter(c => c.some(item => item.ubicacion === 'vendedor')).length;
    const cantidadMonitores = carrilesEmp.filter(c => c.some(item => item.ubicacion === 'monitor')).length;
    const cantidadKioskos = carrilesEmp.filter(c => c.some(item => item.ubicacion === 'kiosko')).length;
    const indiceFinMonitores = cantidadVendedores + cantidadMonitores;
    const haySeparacionMonitorKiosko = cantidadMonitores > 0 && cantidadKioskos > 0;
    const carrilesConSeparador = haySeparacionMonitorKiosko
      ? [...carrilesEmp.slice(0, indiceFinMonitores), [], ...carrilesEmp.slice(indiceFinMonitores)]
      : carrilesEmp;
    return carrilesConSeparador.length && carrilesEv.length
      ? [...carrilesConSeparador, [], ...carrilesEv]
      : [...carrilesConSeparador, ...carrilesEv];
  };

  const abrirModalNuevoEmpleado = () => {
    if(!isAdmin) return;
    if(!isAdmin) return;
    setIdEmpPlantillaEdit(null);
    setNombreEmpPlantilla('');
    setHorasEmpPlantilla('');
    setColorEmpPlantilla('#a0aec0');
    setMostrarModalGestionEmp(true);
  };

  const abrirModalEditarEmpleado = (emp) => {
    if(!isAdmin) return;
    if(!isAdmin) return;
    setIdEmpPlantillaEdit(emp.id);
    setNombreEmpPlantilla(emp.nombre);
    setHorasEmpPlantilla(emp.horasContratadas);
    setColorEmpPlantilla(emp.color);
    setMostrarModalGestionEmp(true);
  };

  const guardarEmpleadoPlantilla = (e) => {
    if(!isAdmin) return;
    e.preventDefault();
    if (!nombreEmpPlantilla.trim()) return;
    registrarHistorial();

    if (idEmpPlantillaEdit) {
      setEmpleados(empleados.map(emp =>
        String(emp.id) === String(idEmpPlantillaEdit)
          ? { ...emp, nombre: nombreEmpPlantilla, horasContratadas: Number(horasEmpPlantilla) || 0, color: colorEmpPlantilla }
          : emp
      ));
    } else {
      const nuevoEmp = {
        id: Date.now(),
        nombre: nombreEmpPlantilla,
        horasContratadas: Number(horasEmpPlantilla) || 0,
        color: colorEmpPlantilla
      };
      setEmpleados([...empleados, nuevoEmp]);
    }
    setMostrarModalGestionEmp(false);
  };

  const eliminarEmpleadoPlantilla = (id) => {
    if(!isAdmin) return;
    registrarHistorial();
    setEmpleados(empleados.filter(emp => String(emp.id) !== String(id)));
    setTurnos(turnos.filter(t => String(t.empleadoId) !== String(id)));
    setMostrarModalGestionEmp(false);
  };

  const abrirModalNuevoTurno = () => {
    if(!isAdmin) return;
    if(!isAdmin) return;
    setIdTurnoEdit(null);
    setTurnoEmpId(empleados.length > 0 ? String(empleados[0].id) : '');
    setTurnoFecha(diasSemana.length > 0 ? diasSemana[0].isoFecha : '');
    setTurnoUbicacion('vendedor');
    setTurnoHoraInicio('10:00');
    setTurnoHoraFin('14:00');
    setTurnoSiEsNecesario(false);
    setTurnoEncargado(false);
    setMostrarModalTurno(true);
  };

  const abrirModalEditarTurno = (turno) => {
    if(!isAdmin) return;
    if(!isAdmin) return;
    setIdTurnoEdit(turno.id);
    setTurnoEmpId(String(turno.empleadoId));
    setTurnoFecha(turno.fecha);
    setTurnoUbicacion(turno.ubicacion || 'vendedor');
    setTurnoHoraInicio(turno.horaInicio);
    setTurnoHoraFin(turno.horaFin);
    setTurnoSiEsNecesario(Boolean(turno.siEsNecesario));
    setTurnoEncargado(Boolean(turno.encargado));
    setMostrarModalTurno(true);
  };

  const guardarTurno = (e) => {
    if(!isAdmin) return;
    e.preventDefault();
    if (!turnoEmpId) {
      alert("Por favor selecciona un empleado.");
      return;
    }
    if (!turnoFecha) {
      alert("Por favor selecciona una fecha válida.");
      return;
    }
    registrarHistorial();

    if (idTurnoEdit) {
      setTurnos(turnos.map(t =>
        t.id === idTurnoEdit
          ? { ...t, empleadoId: turnoEmpId, fecha: turnoFecha, ubicacion: turnoUbicacion, horaInicio: turnoHoraInicio, horaFin: turnoHoraFin, siEsNecesario: turnoSiEsNecesario, encargado: turnoEncargado }
          : t
      ));
    } else {
      const nuevoTurno = {
        id: Date.now(),
        empleadoId: turnoEmpId,
        fecha: turnoFecha,
        ubicacion: turnoUbicacion,
        horaInicio: turnoHoraInicio,
        horaFin: turnoHoraFin,
        siEsNecesario: turnoSiEsNecesario,
        encargado: turnoEncargado
      };
      setTurnos([...turnos, nuevoTurno]);
    }
    setMostrarModalTurno(false);
  };

  const prepararDuplicarTurno = () => {
    if(!isAdmin) return; setIdTurnoEdit(null); };

  const eliminarTurno = () => {
    if(!isAdmin) return;
    if (idTurnoEdit) {
      registrarHistorial();
      setTurnos(turnos.filter(t => t.id !== idTurnoEdit));
      setMostrarModalTurno(false);
    }
  };

  const abrirModalNuevoCumple = () => {
    if(!isAdmin) return;
    if(!isAdmin) return;
    setIdCumpleEdit(null);
    setCumpleCantNinos('');
    setCumpleEdad('');
    setCumpleObservaciones('');
    setCumpleHoraInicio('17:00');
    setCumpleTipo('XT');
    setCumpleFecha(diasSemana.length > 0 ? diasSemana[0].isoFecha : '');
    setMostrarModalCumple(true);
  };

  const abrirModalEditarCumple = (c) => {
    if(!isAdmin) return;
    if(!isAdmin) return;
    setIdCumpleEdit(c.id);
    setCumpleFecha(c.fecha);
    
    const [h, m] = (c.horaEvento || (() => { const [hi,mi]=String(c.horaInicio||'').split(':').map(Number); const total=hi*60+mi+30; return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`; })()).split(':').map(Number);
    const minutosTotales = (h * 60) + m + 30;
    const horaEnPuntoNum = Math.floor(minutosTotales / 60);
    setCumpleHoraInicio(`${horaEnPuntoNum.toString().padStart(2, '0')}:00`);

    setCumpleTipo(c.tipo || 'XT');
    setCumpleCantNinos(c.cantNinos || '');
    setCumpleEdad(c.edad || '');
    setCumpleObservaciones(c.observaciones || '');
    setMostrarModalCumple(true);
  };

  const guardarCumple = (e) => {
    if(!isAdmin) return;
    e.preventDefault();
    if (!cumpleFecha) return;
    registrarHistorial();

    const horaInicioReal = obtenerHoraInicioConAnticipacion(cumpleHoraInicio);
    const horaFinCalculada = calcularHoraFinEvento(cumpleHoraInicio, cumpleTipo);

    if (idCumpleEdit) {
      setCumples(cumples.map(c =>
        c.id === idCumpleEdit
          ? {
              ...c,
              fecha: cumpleFecha,
              horaEvento: cumpleHoraInicio,
              horaInicio: horaInicioReal,
              horaFin: horaFinCalculada,
              tipo: cumpleTipo,
                   cantNinos: cumpleCantNinos,
              edad: cumpleEdad,
              observaciones: cumpleObservaciones
            }
          : c
      ));
    } else {
      const nuevoCumple = {
        id: Date.now(),
        fecha: cumpleFecha,
        horaEvento: cumpleHoraInicio,
        horaInicio: horaInicioReal,
        horaFin: horaFinCalculada,
        tipo: cumpleTipo,
        cantNinos: cumpleCantNinos,
        edad: cumpleEdad,
        observaciones: cumpleObservaciones
      };
      setCumples([...cumples, nuevoCumple]);
    }
    setMostrarModalCumple(false);
  };

  const prepararDuplicarCumple = () => {
    if(!isAdmin) return; setIdCumpleEdit(null); };

  const eliminarCumple = () => {
    if(!isAdmin) return;
    if (idCumpleEdit) {
      registrarHistorial();
      setCumples(cumples.filter(c => c.id !== idCumpleEdit));
      setMostrarModalCumple(false);
    }
  };

  const exportarJPG = async () => {
    const elemento = areaExportarRef.current;
    if (!elemento) return;

    // Capturar el cuadrante en un clon de ancho completo y sin contenedores
    // con scroll. html2canvas puede volver a pintar celdas de tabla con rowSpan
    // cuando el elemento original está dentro de un área desplazable.
    const canvas = await html2canvas(elemento, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: Math.max(document.documentElement.clientWidth, elemento.scrollWidth, elemento.offsetWidth),
      onclone: (documentoClonado) => {
        const objetivo = documentoClonado.querySelector('.area-impresion');
        if (objetivo) {
          objetivo.style.width = objetivo.scrollWidth + 'px';
          objetivo.style.maxWidth = 'none';
          objetivo.style.overflow = 'visible';
        }
        documentoClonado.querySelectorAll('.tabla-responsive').forEach((tabla) => {
          tabla.style.overflow = 'visible';
          tabla.style.width = 'max-content';
          tabla.style.maxWidth = 'none';
        });
      }
    });

    const enlace = document.createElement('a');
    enlace.download = `Cuadrante_${diasSemana[0]?.fecha.replace('/', '_') || 'semanal'}.jpg`;
    enlace.href = canvas.toDataURL('image/jpeg', 0.90);
    enlace.click();
  };

  const exportarPDFPersonalizado = async (refObjetivo, orientacion) => {
    const elemento = refObjetivo?.current;
    if (!elemento) {
      alert('No se encontró el horario que quieres exportar. Cambia a la vista del horario e inténtalo de nuevo.');
      return;
    }

    try {
      const pdf = new jsPDF(orientacion, 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margen = 8;
      const anchoUtil = pdfWidth - margen * 2;
      const altoUtil = pdfHeight - margen * 2;

      const agregarElementoComoPagina = async (nodo, nuevaPagina) => {
        if (!nodo) return;
        const canvas = await html2canvas(nodo, {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff',
          logging: false,
          scrollX: 0,
          scrollY: 0,
          windowWidth: Math.max(document.documentElement.clientWidth, nodo.scrollWidth, nodo.offsetWidth),
          windowHeight: Math.max(document.documentElement.clientHeight, nodo.scrollHeight, nodo.offsetHeight),
          onclone: (doc) => {
            const original = nodo;
            const clonado = doc.querySelector('[data-pdf-capture-target="true"]');
            if (clonado) {
              clonado.style.width = original.offsetWidth + 'px';
              clonado.style.maxWidth = 'none';
              clonado.style.height = 'auto';
              clonado.style.maxHeight = 'none';
              clonado.style.overflow = 'visible';
              clonado.style.boxSizing = 'border-box';
            }
            doc.querySelectorAll('[data-html2canvas-ignore="true"]').forEach(n => n.style.display = 'none');
          }
        });
        if (!canvas.width || !canvas.height) return;
        const img = canvas.toDataURL('image/jpeg', 0.94);
        const props = pdf.getImageProperties(img);
        const ratio = Math.min(anchoUtil / props.width, altoUtil / props.height);
        const w = props.width * ratio;
        const h = props.height * ratio;
        if (nuevaPagina) pdf.addPage();
        pdf.addImage(img, 'JPEG', (pdfWidth - w) / 2, margen, w, h);
      };

      if (refObjetivo === vistaSimplePDFRef) {
        // Para móvil: una página de resumen y una página amplia por cada día.
        const hijos = Array.from(elemento.children);
        const resumen = hijos.find(n => n.classList.contains('resumen-semanal-simple'));
        const dias = hijos.filter(n => n.classList.contains('dia-simple-en-cuadricula'));
        const capturas = [resumen, ...dias].filter(Boolean);
        if (!capturas.length) throw new Error('No se encontraron el resumen ni los días del horario.');
        for (let i = 0; i < capturas.length; i++) {
          const nodo = capturas[i];
          nodo.setAttribute('data-pdf-capture-target', 'true');
          try {
            await agregarElementoComoPagina(nodo, i > 0);
          } finally {
            nodo.removeAttribute('data-pdf-capture-target');
          }
        }
      } else {
        const canvas = await html2canvas(elemento, {
          scale: 2, useCORS: true, allowTaint: false, backgroundColor: '#ffffff',
          logging: false, scrollX: 0, scrollY: 0,
          windowWidth: Math.max(document.documentElement.clientWidth, elemento.scrollWidth, elemento.offsetWidth),
          windowHeight: Math.max(document.documentElement.clientHeight, elemento.scrollHeight, elemento.offsetHeight)
        });
        if (!canvas.width || !canvas.height) throw new Error('La captura del horario está vacía.');
        const img = canvas.toDataURL('image/jpeg', 0.94);
        const props = pdf.getImageProperties(img);
        const ratio = Math.min(anchoUtil / props.width, altoUtil / props.height);
        const w = props.width * ratio;
        const h = props.height * ratio;
        pdf.addImage(img, 'JPEG', (pdfWidth - w) / 2, margen, w, h);
      }

      const inicio = diasSemana[0]?.isoFecha;
      const fin = diasSemana[6]?.isoFecha;
      const nombre = inicio && fin
        ? `Horario ${inicio.slice(0, 7)} ${inicio.slice(8, 10)} a ${fin.slice(8, 10)}.pdf`
        : 'Horario semanal.pdf';
      pdf.save(nombre);
    } catch (error) {
      console.error('Error al exportar el horario a PDF:', error);
      alert('No se pudo generar el PDF. Recarga la página e inténtalo otra vez. Si sigue fallando, avísame.');
    }
  };

  const colorEmpSeleccionado = empleados.find(e => String(e.id) === String(turnoEmpId))?.color || '#ffffff';

  return (
    <div className={`contenedor-horarios modo-pantalla-${modoPantalla}`}>
      <h2>HORARIO SEMANAL</h2>

      <div className="pestanas-navegacion">
        {isAdmin && <button
          className={`btn-pestana ${pestanaActiva === 'admin' ? 'activa' : ''}`}
          onClick={() => setPestanaActiva('admin')}
        >
          🛠️ Administrador
        </button>}
        <button
          className={`btn-pestana ${pestanaActiva === 'visualizacion' ? 'activa' : ''}`}
          onClick={() => setPestanaActiva('visualizacion')}
        >
          👁️ Vistas
        </button>
      </div>

      {!semanaGenerada ? (
        isAdmin ? (
          <form onSubmit={iniciarCuadrante} className="formulario-inicio">
            <label htmlFor="fecha-inicio"><strong>¿En qué fecha inicia la semana?</strong></label>
            <input id="fecha-inicio" type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} required />
            <button type="submit" className="btn-primario">Comenzar Cuadrante</button>
          </form>
        ) : (
          <div className="visor-sin-cuadrante">
            <strong>📅 No hay un cuadrante publicado todavía.</strong>
            <span>Cuando el administrador lo publique, podrás verlo aquí.</span>
          </div>
        )
      ) : (
        <>
          {/* ================= PESTAÑA 1: ADMINISTRADOR ================= */}
          {pestanaActiva === 'admin' && (
            <div className="seccion-pestana">
              <div className="controles-modo-pantalla" role="group" aria-label="Modo de visualización del cuadrante">
                <strong>Visualización:</strong>
                <button type="button" className={modoPantalla === 'ajustado' ? 'modo-activo' : ''} onClick={() => setModoPantalla('ajustado')} title="Mostrar el cuadrante con el menor desplazamiento horizontal posible">⛶ Ajustar a la pantalla</button>
                <button type="button" className={modoPantalla === 'comodo' ? 'modo-activo' : ''} onClick={() => setModoPantalla('comodo')}>↔ Cómodo</button>
                <button type="button" className={modoPantalla === 'completo' ? 'modo-activo' : ''} onClick={() => setModoPantalla('completo')}>＋ Completo</button>
              </div>
              <div className="acciones-superiores">
                <div className="grupo-botones-izquierda">
                  <button onClick={abrirModalNuevoTurno} className="btn-secundario">+ Asignar Turno Empleado</button>
                  <button
                    onClick={() => { setVistaVisualizacion('inversa'); setPestanaActiva('visualizacion'); }}
                    className="btn-terciario"
                    title="Abrir la Vista 2 del horario"
                  >
                    👁️ Vista 2
                  </button>
                  <button onClick={abrirModalNuevoEmpleado} className="btn-terciario">⚙️ Crear / Configurar Empleado</button>
                  <button 
                    onClick={deshacerUltimaAccion} 
                    className="btn-gris" 
                    title="Deshacer última acción"
                    disabled={historial.length === 0}
                    style={{ opacity: historial.length === 0 ? 0.5 : 1, cursor: historial.length === 0 ? 'not-allowed' : 'pointer' }}
                  >
                    ↩️ Atrás
                  </button>
                </div>

                <div className="grupo-botones-derecha">
                  <button onClick={abrirModalNuevoCumple} className="btn-cumple">🎂 Añadir Evento</button>
                  <button onClick={exportarJPG} className="btn-jpg">🖼️ Descargar JPG</button>
                  <button onClick={() => exportarPDFPersonalizado(areaExportarRef, 'landscape')} className="btn-exportar">📄 Descargar PDF</button>
                  <button onClick={borrarYReiniciar} className="btn-cancelar">🗑️ Reiniciar</button>
                </div>
              </div>

              <div className="contenedor-horas-empleados">
                {isAdmin && <div className="capacidad-parque-config">
                  <label htmlFor="capacidadParque">🎟️ Capacidad del parque</label>
                  <input id="capacidadParque" type="number" min="1" step="1" value={capacidadParque} onChange={e => setCapacidadParque(Math.max(1, Number(e.target.value) || 1))} />
                  <span>Se conserva hasta que la cambies manualmente.</span>
                </div>}
                <span className="titulo-chips">Plantilla y Horas Semanales Asignadas:</span>
                <div className="grid-horas-empleados">
                  {empleados.map(emp => {
                    const horasSemanales = calcularHorasEmpleado(emp.id);
                    const contrato = Number(emp.horasContratadas || 0);
                    const diferencia = horasSemanales - contrato;
                    const textoDif = diferencia > 0 ? `+${diferencia}` : `${diferencia}`;
                    const colorTexto = diferencia > 0 ? '#e53e3e' : diferencia < 0 ? '#3182ce' : '#4a5568';

                    return (
                      <div key={emp.id} className="tarjeta-emp-horas">
                        <span
                          className="chip-empleado"
                          style={{ backgroundColor: emp.color }}
                          onClick={() => abrirModalEditarEmpleado(emp)}
                          title="Haz clic para modificar datos o eliminar empleado"
                        >
                          {emp.nombre}
                        </span>
                        <div className="cuadro-horas-blanco" title="Horas hechas">
                          <strong>{horasSemanales} h</strong>
                        </div>
                        <div className="cuadro-dif-valor" style={{ color: colorTexto }} title="Diferencia con contrato">
                          <strong>{textoDif}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div ref={areaExportarRef} className="area-impresion">
                <div className="panel-info">
                  <p><strong>Semana del:</strong> {diasSemana[0]?.fecha} ({diasSemana[0]?.anio}) al {diasSemana[6]?.fecha} ({diasSemana[6]?.anio})</p>
                  <p className="rango-horas">Franjas horarias: <strong>10:00 a 22:00</strong></p>
                  <div className="leyenda-marcadores">
  <span>⚠️ Si hace falta</span>
  <span>★ Encargado</span>
</div>
                </div>

                {isAdmin && <section className="controles-semana-fuera-horario" data-html2canvas-ignore="true">
                  <h3>🎨 Colores y clima por día</h3>
                  <p>Estos controles están fuera del cuadrante para que ningún turno o empleado los tape.</p>
                  <div className="controles-semana-grid">
                    {diasSemana.map(dia => <div className="control-dia-externo" key={`controles_externos_${dia.clave}`}>
                      <strong className="control-dia-titulo">{dia.nombre} · {dia.fecha}</strong>
                      {controlesDia(dia)}
                    </div>)}
                  </div>
                </section>}
                <div className="tabla-responsive">
                  <table className="tabla-horarios tabla-compacta">
                    <thead>
                      <tr>
                        <th className="columna-dia-fijo">Día / Franja</th>
                        {franjasHorarias.map((hora) => (
                          <th key={`th_hora_${hora}`} className="cabecera-hora">
                            {hora.endsWith(':00') ? hora : ''}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {diasSemana.map((dia) => {
                        const carrilesEmpleados = calcularCarrilesEmpleados(dia.isoFecha);
                        const carrilesEventos = calcularCarrilesEventos(dia.isoFecha);
                        const carrilesOrdenados = ordenarCarrilesPorUbicacion(carrilesEmpleados);
                        const cantidadVendedores = carrilesOrdenados.filter(c => c.some(item => item.ubicacion === 'vendedor')).length;
                        const cantidadMonitores = carrilesOrdenados.filter(c => c.some(item => item.ubicacion === 'monitor')).length;
                        const cantidadKioskos = carrilesOrdenados.filter(c => c.some(item => item.ubicacion === 'kiosko')).length;
                        const indiceFinMonitores = cantidadVendedores + cantidadMonitores;
                        const haySeparacionMonitorKiosko = cantidadMonitores > 0 && cantidadKioskos > 0;
                        const carrilesConSeparador = haySeparacionMonitorKiosko
                          ? [...carrilesOrdenados.slice(0, indiceFinMonitores), [], ...carrilesOrdenados.slice(indiceFinMonitores)]
                          : carrilesOrdenados;
                        const todosLosCarriles = carrilesEventos.length && carrilesConSeparador.length
                          ? [...carrilesConSeparador, [], ...carrilesEventos]
                          : carrilesConSeparador.concat(carrilesEventos);
                        const filasADibujar = todosLosCarriles.length > 0 ? todosLosCarriles : [[]];

                        return (
                          <React.Fragment key={`fila_dia_${dia.clave}`}>
                            {filasADibujar.map((carril, idxCarril) => {
                              const esPrimerCarrilDelDia = idxCarril === 0;
                              const esUltimoCarrilDelDia = idxCarril === filasADibujar.length - 1;
                              const esSeparadorMonitorAdmin = idxCarril === cantidadVendedores + cantidadMonitores && cantidadMonitores > 0 && cantidadKioskos > 0 && carril.length === 0;

                              return (
                                <tr key={`${dia.clave}_carril_${idxCarril}`} className={`fila-horario ${carril.length === 0 ? 'fila-separacion-turnos-eventos' : ''} ${esUltimoCarrilDelDia ? 'ultimo-carril-dia' : ''} ${esSeparadorMonitorAdmin ? 'separador-monitor-kiosko' : ''}`}>
                                  {esPrimerCarrilDelDia && (
                                    <td 
                                      className="celda-dia-nombre celda-dia-ocupacion" 
                                      rowSpan={filasADibujar.length}
                                      style={estiloCeldaOcupacionDia(dia)}
                                    >
                                      {datosCabeceraDia(dia)}
                                    </td>
                                  )}

                                  {franjasHorarias.map((hora, indexHora) => {
                                    const elementoActivo = carril.find(item => item.horaInicio === hora);

                                    if (elementoActivo) {
                                      const spanCol = calcularRowSpan(elementoActivo.horaInicio, elementoActivo.horaFin);
                                      const esCumple = elementoActivo.tipo === 'cumple';

                                      return (
                                        <td
                                          key={`elem_${dia.clave}_${idxCarril}_${hora}`}
                                          colSpan={spanCol}
                                          className={`celda-bloque-activo ${isAdmin ? 'celda-click' : ''} ${esCumple ? 'celda-cumple-activo' : ''}`}
                                          style={{ backgroundColor: elementoActivo.color }}
                                          onClick={isAdmin ? () => {
                                            if (esCumple) {
                                              abrirModalEditarCumple(elementoActivo.objetoOriginal);
                                            } else {
                                              abrirModalEditarTurno(elementoActivo.objetoOriginal);
                                            }
                                          } : undefined}
                                        >
                                          <div className="texto-bloque-celda">
                                            {elementoActivo.tipo === 'turno' ? (
                                              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                                                <strong>{elementoActivo.nombre}{elementoActivo.tipo === 'turno' && <span className="marcadores-turno marcadores-turno-en-celda">{elementoActivo.siEsNecesario && <span title="Si hace falta" aria-label="Si hace falta">⚠️</span>}{elementoActivo.encargado && <span title="Encargado" aria-label="Encargado">★</span>}</span>}</strong>
                                                <small>({elementoActivo.ubicacion})</small>
                                              </div>
                                            ) : (
                                              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                                                <strong>{elementoActivo.nombre}{elementoActivo.tipo === 'turno' && <span className="marcadores-turno marcadores-turno-en-celda">{elementoActivo.siEsNecesario && <span title="Si hace falta" aria-label="Si hace falta">⚠️</span>}{elementoActivo.encargado && <span title="Encargado" aria-label="Encargado">★</span>}</span>}</strong>
                                                {elementoActivo.observaciones && <small>{elementoActivo.observaciones}</small>}
                                              </div>
                                            )}
                                          </div>
                                        </td>
                                      );
                                    }

                                    const estaEnRango = carril.some(item => {
                                      const idxInicio = franjasHorarias.indexOf(item.horaInicio);
                                      const idxFin = franjasHorarias.indexOf(item.horaFin);
                                      return indexHora > idxInicio && indexHora < idxFin;
                                    });

                                    if (estaEnRango) return null;

                                    const esZonaEventos = carrilesEventos.length > 0 && idxCarril >= carrilesConSeparador.length + 1;

                                    return <td key={`empty_${dia.clave}_${idxCarril}_${hora}`} className="celda-emp-vacia" style={{ backgroundColor: esZonaEventos ? obtenerColorBloque(dia, hora) : '#ffffff' }}></td>;
                                  })}
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================= PESTAÑA 2: VISUALIZACIÓN ================= */}
          {pestanaActiva === 'visualizacion' && (
            <div className="seccion-pestana">
              <div className="pestanas-navegacion sub-pestañas" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  <button className={`btn-pestana ${subVista === 'detallada' ? 'activa' : ''}`} onClick={() => setSubVista('detallada')}>📊 Vista detallada</button>
                  <button className={`btn-pestana ${subVista === 'simple' ? 'activa' : ''}`} onClick={() => setSubVista('simple')}>📋 Vista simple</button>
                  <button className={`btn-pestana ${subVista === 'mia' ? 'activa' : ''}`} onClick={() => setSubVista('mia')}>🙋 Vista mía</button>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {isAdmin && <button
                    onClick={() => setPestanaActiva('admin')}
                    className="btn-gris"
                    title="Volver al administrador para editar turnos y eventos"
                  >
                    ✏️ Volver a Admin
                  </button>}
                  {subVista === 'simple' && <button onClick={() => exportarPDFPersonalizado(vistaSimplePDFRef, 'portrait')} className="btn-exportar">📄 PDF Vista simple</button>}
                  <button 
                    onClick={() => exportarPDFPersonalizado(vistaVisualizacion === 'carriles' ? vistaHorizontalRef : vistaVerticalRef, 'landscape')} 
                    className="btn-exportar"
                  >
                    📄 Descargar PDF Horizontal
                  </button>
                  <button 
                    onClick={() => exportarPDFPersonalizado(vistaVisualizacion === 'carriles' ? vistaHorizontalRef : vistaVerticalRef, 'portrait')} 
                    className="btn-jpg"
                  >
                    📄 Descargar PDF Vertical
                  </button>
                </div>
              </div>

              {subVista === 'detallada' && <>
              <div className="selector-layout-detallada">
                <button className={`btn-pestana ${vistaVisualizacion === 'carriles' ? 'activa' : ''}`} onClick={() => setVistaVisualizacion('carriles')}>Horario completo (carriles)</button>
                <button className={`btn-pestana ${vistaVisualizacion === 'inversa' ? 'activa' : ''}`} onClick={() => setVistaVisualizacion('inversa')}>Horas en filas y días en columnas</button>
              </div>
              {/* Vista 1 */}
              {vistaVisualizacion === 'carriles' && (
                <div ref={vistaHorizontalRef} className="area-impresion">
                  <div className="panel-info">
                    <h3>Vista 1 - Horario General Actualizado</h3>
                    <p><strong>Semana del:</strong> {diasSemana[0]?.fecha} al {diasSemana[6]?.fecha}</p>
                    <div className="leyenda-marcadores" data-html2canvas-ignore="true"><span>⚠️ Si hace falta</span><span>★ Encargado</span></div>
                  </div>
                  <div className="tabla-responsive">
                    <table className="tabla-horarios tabla-compacta">
                      <thead>
                        <tr>
                          <th className="columna-dia-fijo">Día / Franja</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diasSemana.map((dia) => {
                          const carrilesEmpleados = calcularCarrilesEmpleados(dia.isoFecha);
                          const carrilesVendedor = carrilesEmpleados.filter(carril => carril.some(item => item.ubicacion === 'vendedor'));
                          const carrilesMonitor = carrilesEmpleados.filter(carril => carril.some(item => item.ubicacion === 'monitor'));
                          const carrilesKiosko = carrilesEmpleados.filter(carril => carril.some(item => item.ubicacion === 'kiosko'));
                          const carrilesOtros = carrilesEmpleados.filter(carril => carril.every(item => !['vendedor', 'monitor', 'kiosko'].includes(item.ubicacion)));
                          const carrilesEventos = calcularCarrilesEventos(dia.isoFecha);
                          const empleadosFilas = [
                            ...carrilesVendedor,
                            ...carrilesMonitor,
                            ...(carrilesMonitor.length > 0 && carrilesKiosko.length > 0 ? [[]] : []),
                            ...carrilesKiosko,
                            ...carrilesOtros
                          ];
                          const filasADibujar = carrilesEventos.length && empleadosFilas.length ? [...empleadosFilas, [], ...carrilesEventos] : [...empleadosFilas, ...carrilesEventos];
                          const filasFinales = filasADibujar.length > 0 ? filasADibujar : [[]];

                          return (
                            <React.Fragment key={`v1_dia_${dia.clave}`}>
                              <tr className="fila-horario fila-franja-dia">
                                <td className="celda-dia-nombre" aria-label="Día" />
                                {franjasHorarias.map((hora) => <th key={`v1_franja_${dia.clave}_${hora}`} className="cabecera-hora">{hora.endsWith(':00') ? hora : ''}</th>)}
                              </tr>
                              {filasFinales.map((carril, idxCarril) => {
                                const esPrimerCarril = idxCarril === 0;
                                const esUltimoCarril = idxCarril === filasFinales.length - 1;
                                const esSeparadorMonitor = idxCarril === carrilesVendedor.length + carrilesMonitor.length && carrilesMonitor.length > 0 && carrilesKiosko.length > 0 && carril.length === 0;

                                return (
                                  <tr key={`v1_${dia.clave}_${idxCarril}`} className={`fila-horario ${carril.length === 0 ? 'fila-separacion-turnos-eventos' : ''} ${esUltimoCarril ? 'ultimo-carril-dia' : ''} ${esSeparadorMonitor ? 'separador-monitor-kiosko' : ''}`}>
                                    {esPrimerCarril && (
                                      <td className="celda-dia-nombre celda-dia-ocupacion" rowSpan={filasFinales.length} style={estiloCeldaOcupacionDia(dia)}>
                                        {datosCabeceraDia(dia, true, true)}
                                      </td>
                                    )}
                                    {franjasHorarias.map((hora, indexHora) => {
                                      const elementoActivo = carril.find(item => item.horaInicio === hora);
                                      if (elementoActivo) {
                                        const spanCol = calcularRowSpan(elementoActivo.horaInicio, elementoActivo.horaFin);
                                        const esCumple = elementoActivo.tipo === 'cumple';
                                        return (
                                          <td
                                            key={`v1_el_${hora}`}
                                            colSpan={spanCol}
                                            className={`celda-bloque-activo ${esCumple ? 'celda-cumple-activo' : ''}`}
                                            style={{ backgroundColor: elementoActivo.color }}
                                          >
                                            <div className="texto-bloque-celda">
                                              {elementoActivo.tipo === 'turno' ? (
                                              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                                                <strong>{elementoActivo.nombre}{elementoActivo.tipo === 'turno' && <span className="marcadores-turno marcadores-turno-en-celda">{elementoActivo.siEsNecesario && <span title="Si hace falta" aria-label="Si hace falta">⚠️</span>}{elementoActivo.encargado && <span title="Encargado" aria-label="Encargado">★</span>}</span>}</strong>
                                                <small>({elementoActivo.ubicacion})</small>
                                              </div>
                                            ) : (
                                              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                                                <strong>{elementoActivo.nombre}{elementoActivo.tipo === 'turno' && <span className="marcadores-turno marcadores-turno-en-celda">{elementoActivo.siEsNecesario && <span title="Si hace falta" aria-label="Si hace falta">⚠️</span>}{elementoActivo.encargado && <span title="Encargado" aria-label="Encargado">★</span>}</span>}</strong>
                                                {elementoActivo.observaciones && <small>{elementoActivo.observaciones}</small>}
                                              </div>
                                            )}
                                            </div>
                                          </td>
                                        );
                                      }
                                      const estaEnRango = carril.some(item => {
                                        const idxInicio = franjasHorarias.indexOf(item.horaInicio);
                                        const idxFin = franjasHorarias.indexOf(item.horaFin);
                                        return indexHora > idxInicio && indexHora < idxFin;
                                      });
                                      if (estaEnRango) return null;
                                      const esZonaEventos = carrilesEventos.length > 0 && idxCarril >= empleadosFilas.length + 1;
                                       return <td key={`v1_emp_${hora}`} className="celda-emp-vacia" style={{ backgroundColor: esZonaEventos ? obtenerColorBloque(dia, hora) : '#ffffff' }}></td>;
                                    })}
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Vista 2 - Letras rotadas 90 grados individualmente */}
              {vistaVisualizacion === 'inversa' && (
                <div ref={vistaVerticalRef} className="area-impresion">
                  <div className="panel-info">
                    <h3>Vista 2 - Horario Matriz Semanal (Columnas Verticales)</h3>
                    <p><strong>Semana del:</strong> {diasSemana[0]?.fecha} al {diasSemana[6]?.fecha}</p>
                    <div className="leyenda-marcadores" data-html2canvas-ignore="true"><span>⚠️ Si hace falta</span><span>★ Encargado</span></div>
                  </div>
                  <div className="tabla-responsive">
                    <table className="tabla-horarios tabla-compacta">
                      <thead>
                        <tr>
                          <th className="columna-dia-fijo">Hora</th>
                          {diasSemana.map((dia) => {
                            const carrilesDia = calcularCarrilesTotalesDia(dia.isoFecha);
                            const numCarriles = carrilesDia.length > 0 ? carrilesDia.length : 1;
                            return (
                              <th 
                                key={`inv_th_${dia.clave}`} 
                                className="cabecera-hora celda-dia-ocupacion" 
                                colSpan={numCarriles}
                                style={{ ...estiloCeldaOcupacionDia(dia), textAlign: 'center', borderLeft: '2px solid #cbd5e0' }}
                              >
                                {datosCabeceraDia(dia)}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {franjasHorarias.map((hora, idxHora) => {
                          if (idxHora === franjasHorarias.length - 1) return null;

                          return (
                            <tr key={`inv_fila_${hora}`} className="fila-horario">
                              <td className="celda-dia-nombre" style={{ textAlign: 'center', verticalAlign: 'middle', fontSize: '10px', padding: '2px' }}>
                                <strong>{hora.endsWith(':00') ? hora : ''}</strong>
                              </td>
                              {diasSemana.map((dia) => {
                                const carrilesDia = calcularCarrilesTotalesDia(dia.isoFecha);
                                const carrilesEmpDia = ordenarCarrilesPorUbicacion(calcularCarrilesEmpleados(dia.isoFecha));
                                const cantidadVendedoresDia = carrilesEmpDia.filter(c => c.some(item => item.ubicacion === 'vendedor')).length;
                                const cantidadMonitoresDia = carrilesEmpDia.filter(c => c.some(item => item.ubicacion === 'monitor')).length;
                                const cantidadKioskosDia = carrilesEmpDia.filter(c => c.some(item => item.ubicacion === 'kiosko')).length;
                                const indiceSeparadorMonitorKiosko = cantidadVendedoresDia + cantidadMonitoresDia;
                                const haySeparadorMonitorKioskoDia = cantidadMonitoresDia > 0 && cantidadKioskosDia > 0;
                                const cantidadCarrilesEmpleadosConSeparador = carrilesEmpDia.length + (haySeparadorMonitorKioskoDia ? 1 : 0);
                                const cantidadCarrilesEventosDia = calcularCarrilesEventos(dia.isoFecha).length;
                                const indiceInicioEventosDia = cantidadCarrilesEmpleadosConSeparador + (cantidadCarrilesEventosDia > 0 ? 1 : 0);
                                
                                if (carrilesDia.length === 0) {
                                  return <td key={`inv_vacio_${dia.clave}_${hora}`} className="celda-emp-vacia" style={{ borderLeft: '2px solid #cbd5e0', backgroundColor: '#ffffff' }}></td>;
                                }

                                return carrilesDia.map((carril, idxCarril) => {
                                  const elementoActivo = carril.find(item => item.horaInicio === hora);
                                  const esBordeDia = idxCarril === 0;
                                  const esSeparadorMonitorKiosko = haySeparadorMonitorKioskoDia && idxCarril === indiceSeparadorMonitorKiosko && carril.length === 0;

                                  if (elementoActivo) {
                                    const spanFila = calcularRowSpan(elementoActivo.horaInicio, elementoActivo.horaFin);
                                    const esCumple = elementoActivo.tipo === 'cumple';

                                    return (
                                      <td
                                        key={`inv_elem_${dia.clave}_${idxCarril}_${hora}`}
                                        rowSpan={spanFila}
                                        className={`celda-bloque-activo ${isAdmin ? 'celda-click' : ''} ${esCumple ? 'celda-cumple-activo' : ''}`}
                                        onClick={isAdmin ? () => esCumple ? abrirModalEditarCumple(elementoActivo.objetoOriginal) : abrirModalEditarTurno(elementoActivo.objetoOriginal) : undefined}
                                        title={isAdmin ? 'Pulsa para editar este turno o evento' : undefined}
                                        style={{ 
                                          backgroundColor: elementoActivo.color,
                                          borderLeft: esBordeDia ? '2px solid #cbd5e0' : '1px solid #e2e8f0',
                                          verticalAlign: 'middle',
                                          textAlign: 'center',
                                          position: 'relative',
                                          minWidth: '24px',
                                          maxWidth: '24px',
                                          padding: '0px',
                                          overflow: 'hidden'
                                        }}
                                      >
                                        <div style={{
                                          display: 'flex',
                                          flexDirection: 'column',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          width: '100%',
                                          height: '100%',
                                          margin: '0 auto',
                                          overflow: 'hidden'
                                        }}>
                                          {(`${elementoActivo.nombre}${elementoActivo.tipo === 'turno' ? `${elementoActivo.siEsNecesario ? ' ⚠️' : ''}${elementoActivo.encargado ? ' ★' : ''} (${elementoActivo.ubicacion})` : elementoActivo.observaciones ? ` ${elementoActivo.observaciones}` : ''}`).split('').map((letra, index) => (
                                            <span 
                                              key={index} 
                                              style={{ 
                                                display: 'inline-block',
                                                transform: 'rotate(90deg)',
                                                fontSize: '16px',
                                                fontWeight: 600,
                                                lineHeight: '1.05',
                                                margin: '1px 0'
                                              }}
                                            >
                                              {letra === ' ' ? '\u00A0' : letra}
                                            </span>
                                          ))}
                                        </div>
                                      </td>
                                    );
                                  }

                                  const estaEnRango = carril.some(item => {
                                    const idxInicio = franjasHorarias.indexOf(item.horaInicio);
                                    const idxFin = franjasHorarias.indexOf(item.horaFin);
                                    return idxHora > idxInicio && idxHora < idxFin;
                                  });
                                  if (estaEnRango) return null;

                                  return (
                                    <td 
                                      key={`inv_empty_${dia.clave}_${idxCarril}_${hora}`} 
                                      className={`celda-emp-vacia ${esSeparadorMonitorKiosko ? 'celda-separacion-monitor-kiosko' : ''}`}
                                      style={{ borderLeft: esBordeDia ? '2px solid #cbd5e0' : '1px solid #e2e8f0', minWidth: esSeparadorMonitorKiosko ? '14px' : '24px', backgroundColor: idxCarril >= indiceInicioEventosDia ? obtenerColorBloque(dia, hora) : '#ffffff' }}
                                    ></td>
                                  );
                                });
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              </>}
              {subVista === 'simple' && (
                <div className="vista-simple-semanal" ref={vistaSimplePDFRef}>
                  <aside className="resumen-semanal-simple" aria-label="Resumen visual semanal">
                    <h3>Semana</h3>
                    <div className="resumen-semana-matriz">
                      <div className="resumen-matriz-cabecera"><span></span>{[1,2,3,4,5,6,0].map(i=><span key={i}>{['D','L','M','X','J','V','S'][i]}</span>)}</div>
                      {empleados.map(emp=><div className="resumen-matriz-fila" key={emp.id}>
                        <span className="resumen-matriz-nombre" title={emp.nombre}>{String(emp.nombre||'').trim().split(/\s+/)[0]}</span>
                        {[...diasSemana].sort((a,b)=>{const ai=new Date(a.isoFecha+'T12:00:00').getDay();const bi=new Date(b.isoFecha+'T12:00:00').getDay();return ((ai+6)%7)-((bi+6)%7)}).map(d=>{
                          const ts=turnos.filter(t=>t.fecha===d.isoFecha&&String(t.empleadoId)===String(emp.id));
                          if(!ts.length)return <span key={d.isoFecha} className="resumen-matriz-celda" title="Sin turno"/>;
                          const horas=ts.reduce((s,t)=>{const [ih,im]=String(t.horaInicio||'0:0').split(':').map(Number);const [fh,fm]=String(t.horaFin||'0:0').split(':').map(Number);return s+Math.max(0,(fh*60+(fm||0)-ih*60-(im||0))/60);},0);
                          const primerInicio=ts.map(t=>String(t.horaInicio||'11:00')).sort()[0];
                          const marca=horas>6?'C':primerInicio<'15:00'?'M':'T';
                          return <span key={d.isoFecha} className="resumen-matriz-celda resumen-matriz-turno" style={{background:emp.color||'#94a3b8'}} title={emp.nombre+' · '+(marca==='C'?'Completo':marca==='M'?'Mañana':'Tarde')}>{marca}</span>;
                        })}
                      </div>)}
                      <div className="resumen-matriz-separador"><span>Eventos · niños por día</span></div>
                      <div className="resumen-matriz-fila resumen-matriz-fila-eventos">
                        <span className="resumen-matriz-nombre">Cumples</span>
                        {[...diasSemana].sort((a,b)=>{const ai=new Date(a.isoFecha+'T12:00:00').getDay();const bi=new Date(b.isoFecha+'T12:00:00').getDay();return ((ai+6)%7)-((bi+6)%7)}).map(d=>{
                          const lista=cumples.filter(x=>x.fecha===d.isoFecha);
                          const n=lista.reduce((s,x)=>s+Math.max(0,Number(x.cantNinos)||0),0);
                          const bg=!lista.length?'#eef2f7':n<10?'#bbf7d0':n<20?'#86efac':n<35?'#d9f99d':n<50?'#fef08a':n<65?'#fed7aa':n<80?'#fdba74':n<90?'#fca5a5':'#f87171';
                          return <span key={d.isoFecha} className="resumen-matriz-celda resumen-matriz-evento" style={{background:bg}} title={lista.length?n+' niños en total':'Sin eventos'}>{lista.length?n:''}</span>;
                        })}
                      </div>
                    </div>
                    <p className="resumen-semana-leyenda">M mañana · T tarde · C más de 6 h</p>
                  </aside>
                  {diasSemana.map(dia => <div className="dia-simple-en-cuadricula" key={dia.isoFecha}>{renderDiaSimple(dia)}</div>)}
                </div>
              )}
              {subVista === 'mia' && (() => {
                const usuario = usuarioActual || {};
                const usuarioEsAdmin = isAdmin;
                const miEmpleado = usuarioEsAdmin
                  ? empleados.find(emp => String(emp.id) === String(empleadoVistaMia) || String(emp.username) === String(empleadoVistaMia))
                  : empleados.find(emp => String(emp.id) === String(usuario.username) || String(emp.username) === String(usuario.username) || String(emp.nombre || '').toLowerCase() === String(usuario.name || '').toLowerCase());
                const misTurnos = miEmpleado ? turnos.filter(t => String(t.empleadoId) === String(miEmpleado.id) || String(t.empleadoId) === String(miEmpleado.username)) : [];
                return (
                  <div className="vista-mia-semanal">
                    {usuarioEsAdmin && <label className="selector-empleado-mio">Ver horario de:
                      <select value={empleadoVistaMia} onChange={e => setEmpleadoVistaMia(e.target.value)}>
                        {empleados.map(emp => <option key={emp.id} value={emp.id}>{emp.nombre}</option>)}
                      </select>
                    </label>}
                    {miEmpleado ? (
                      <>
                        <h3>{usuarioEsAdmin ? 'Horario de ' : 'Mi horario · '}{miEmpleado.nombre}</h3>
                        <div className="dias-mios-grid">
                          {diasSemana.map(dia => {
                            const turnosDia = misTurnos.filter(t => t.fecha === dia.isoFecha);
                            return (
                              <section className={`dia-mio-card ${turnosDia.length ? 'trabaja' : 'libre'}`} key={dia.clave}>
                                <h4>{dia.nombre}</h4>
                                <strong>{dia.fecha}</strong>
                                {turnosDia.length ? turnosDia.map(t => <p key={t.id}>{t.horaInicio}–{t.horaFin}<small>{t.ubicacion ? ' · '+t.ubicacion : ''}</small></p>) : <p>No trabajas</p>}
                              </section>
                            );
                          })}
                        </div>
                      </>
                    ) : <p>No se ha podido relacionar tu usuario con un empleado del cuadrante. Pide al administrador que compruebe el nombre de usuario.</p>}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Modales */}
          {mostrarModalGestionEmp && (
            <div className="modal-overlay">
              <div className="modal-contenido">
                <h3>{idEmpPlantillaEdit ? '⚙️ Modificar Empleado' : '👤 Añadir Empleado'}</h3>
                <form onSubmit={guardarEmpleadoPlantilla}>
                  <label>Nombre:</label>
                  <input type="text" value={nombreEmpPlantilla} onChange={(e) => setNombreEmpPlantilla(e.target.value)} required />
                  <label>Horas Contrato:</label>
                  <input type="number" value={horasEmpPlantilla} onChange={(e) => setHorasEmpPlantilla(e.target.value)} />
                  <label>Color de Columna:</label>
                  <div className="contenedor-selector-color">
                    <input type="color" value={colorEmpPlantilla} onChange={(e) => setColorEmpPlantilla(e.target.value)} className="input-color" />
                    <select value={colorEmpPlantilla} onChange={(e) => setColorEmpPlantilla(e.target.value)} className="select-color-predefinido">
                      <option value="">Personalizado...</option>
                      {COLORES_OPCIONES.map(c => (
                        <option key={c.hex} value={c.hex}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div className="modal-acciones">
                    <button type="submit" className="btn-secundario">Guardar</button>
                    {idEmpPlantillaEdit && (
                      <button type="button" className="btn-cancelar" onClick={() => eliminarEmpleadoPlantilla(idEmpPlantillaEdit)}>Eliminar</button>
                    )}
                    <button type="button" className="btn-gris" onClick={() => setMostrarModalGestionEmp(false)}>Cancelar</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {mostrarModalTurno && (
            <div className="modal-overlay">
              <div className="modal-contenido">
                <h3>{idTurnoEdit ? '✏️ Modificar Turno' : '📋 Asignar / Crear Turno'}</h3>
                <form onSubmit={guardarTurno}>
                  <label>Empleado:</label>
                  <select
                    value={turnoEmpId}
                    onChange={(e) => setTurnoEmpId(e.target.value)}
                    style={{ backgroundColor: colorEmpSeleccionado, fontWeight: 'bold' }}
                    required
                  >
                    <option value="">Selecciona empleado...</option>
                    {empleados.map(emp => (
                      <option key={emp.id} value={emp.id} style={{ backgroundColor: emp.color }}>
                        {emp.nombre}
                      </option>
                    ))}
                  </select>
                  <label>Día:</label>
                  <select value={turnoFecha} onChange={(e) => setTurnoFecha(e.target.value)} required>
                    <option value="">Selecciona día...</option>
                    {diasSemana.map(d => (
                      <option key={d.isoFecha} value={d.isoFecha}>{d.nombre} ({d.fecha})</option>
                    ))}
                  </select>
                  <label>Ubicación / Puesto:</label>
                  <select value={turnoUbicacion} onChange={(e) => setTurnoUbicacion(e.target.value)}>
                    <option value="vendedor">Vendedor</option>
                    <option value="monitor">Monitor</option>
                    <option value="kiosko">Kiosko</option>
                  </select>
                  <div className="turno-opciones-marcadores">
                    <label><input type="checkbox" checked={turnoSiEsNecesario} onChange={(e) => setTurnoSiEsNecesario(e.target.checked)} /> Si es necesario</label>
                    <label><input type="checkbox" checked={turnoEncargado} onChange={(e) => setTurnoEncargado(e.target.checked)} /> Encargado</label>
                  </div>
                  <div className="horas-grid">
                    <div>
                      <label>Hora Entrada:</label>
                      <select value={turnoHoraInicio} onChange={(e) => setTurnoHoraInicio(e.target.value)}>
                        {opcionesHorasEmpleado.map(h => (
                          <option key={`ini_${h}`} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label>Hora Salida:</label>
                      <select value={turnoHoraFin} onChange={(e) => setTurnoHoraFin(e.target.value)}>
                        {opcionesHorasEmpleado.map(h => (
                          <option key={`fin_${h}`} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="modal-acciones">
                    <button type="submit" className="btn-secundario">{idTurnoEdit ? 'Guardar Cambios' : 'Crear Turno'}</button>
                    {idTurnoEdit && (
                      <>
                        <button type="button" className="btn-terciario" onClick={prepararDuplicarTurno}>📋 Cargar como Copia</button>
                        <button type="button" className="btn-cancelar" onClick={eliminarTurno}>Eliminar</button>
                      </>
                    )}
                    <button type="button" className="btn-gris" onClick={() => setMostrarModalTurno(false)}>Cancelar</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {mostrarModalCumple && (
            <div className="modal-overlay">
              <div className="modal-contenido">
                <h3>{idCumpleEdit ? '✏️ Modificar Evento' : '🎂 Registrar Evento'}</h3>
                <form onSubmit={guardarCumple}>
                  <label>Día:</label>
                  <select value={cumpleFecha} onChange={(e) => setCumpleFecha(e.target.value)} required>
                    <option value="">Selecciona día...</option>
                    {diasSemana.map(d => (
                      <option key={d.isoFecha} value={d.isoFecha}>{d.nombre} ({d.fecha})</option>
                    ))}
                  </select>
                  <div className="horas-grid">
                    <div>
                      <label>Hora Evento (en punto):</label>
                      <select value={cumpleHoraInicio} onChange={(e) => setCumpleHoraInicio(e.target.value)}>
                        {franjasHorariasEnPunto.map(h => (
                          <option key={`cumple_ini_${h}`} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label>Modalidad / Tipo:</label>
                      <select value={cumpleTipo} onChange={(e) => setCumpleTipo(e.target.value)}>
                        <option value="XT">XT (7 celdas / 3.5h)</option>
                        <option value="X">X (5 celdas / 2.5h)</option>
                      </select>
                    </div>
                  </div>
                  <div className="info-hora-calculada">
                    Horario real asignado: <strong>{obtenerHoraInicioConAnticipacion(cumpleHoraInicio)} hs</strong> a <strong>{calcularHoraFinEvento(cumpleHoraInicio, cumpleTipo)} hs</strong>
                  </div>
                  <div className="horas-grid">
                    <div>
                      <label>Niños (K):</label>
                      <input type="text" placeholder="Ej: 15" value={cumpleCantNinos} onChange={(e) => setCumpleCantNinos(e.target.value)} />
                    </div>
                    <div>
                      <label>Edad (a):</label>
                      <input type="text" placeholder="Ej: 8" value={cumpleEdad} onChange={(e) => setCumpleEdad(e.target.value)} />
                    </div>
                  </div>
                  <label>Observaciones:</label>
                  <input type="text" placeholder="Ej: Salón B / Tarta de fresa" value={cumpleObservaciones} onChange={(e) => setCumpleObservaciones(e.target.value)} />
                  <div className="modal-acciones">
                    <button type="submit" className="btn-secundario">{idCumpleEdit ? 'Guardar Cambios' : 'Crear Evento'}</button>
                    {idCumpleEdit && (
                      <>
                        <button type="button" className="btn-terciario" onClick={prepararDuplicarCumple}>📋 Cargar como Copia</button>
                        <button type="button" className="btn-cancelar" onClick={eliminarCumple}>Eliminar</button>
                      </>
                    )}
                    <button type="button" className="btn-gris" onClick={() => setMostrarModalCumple(false)}>Cancelar</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TablaHorario;