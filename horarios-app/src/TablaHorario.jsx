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
  const isAdmin = parentUser.role === 'admin';
  const [datosServidorCargados, setDatosServidorCargados] = useState(false);
  const [pestanaActiva, setPestanaActiva] = useState(isAdmin ? 'admin' : 'visualizacion'); 
  const [vistaVisualizacion, setVistaVisualizacion] = useState('carriles'); 

  const [fechaInicio, setFechaInicio] = useState('');
  const [semanaGenerada, setSemanaGenerada] = useState(false);
  const [diasSemana, setDiasSemana] = useState([]);

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
  const token = window.parent && window.parent.__CONTROL_HORARIO_TOKEN__;
  fetch('/api/horarios/state', {headers: token ? {Authorization: 'Bearer '+token} : {}})
    .then(r => { if(!r.ok) throw new Error('No se pudo cargar el cuadrante'); return r.json(); })
    .then(data => {
      if(!activo) return;
      const h=data.horarios||{};
      if(h.fechaInicio) setFechaInicio(h.fechaInicio);
      setSemanaGenerada(Boolean(h.semanaGenerada));
      setDiasSemana(Array.isArray(h.diasSemana)?h.diasSemana:[]);
      setTurnos(Array.isArray(h.turnos)?h.turnos:[]);
      setCumples(Array.isArray(h.cumples)?h.cumples:[]);
      setEmpleados(Array.isArray(data.employees)?data.employees:[]);
      setDatosServidorCargados(true);
    })
    .catch(err => { console.error(err); setDatosServidorCargados(true); });
  return () => { activo=false; };
}, []);

useEffect(() => {
  if(!datosServidorCargados || !isAdmin) return;
  const timer=setTimeout(() => {
    const token = window.parent && window.parent.__CONTROL_HORARIO_TOKEN__;
    fetch('/api/horarios/state', {
      method:'PUT',
      headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},
      body:JSON.stringify({fechaInicio,semanaGenerada,diasSemana,empleados,turnos,cumples})
    }).catch(err => console.error('No se pudo guardar el cuadrante',err));
  }, 500);
  return () => clearTimeout(timer);
}, [datosServidorCargados,isAdmin,fechaInicio,semanaGenerada,diasSemana,empleados,turnos,cumples]);

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

  const datosCabeceraDia = (dia, mostrarFecha = true, abreviarNinos = false) => {
    const ninos = cumples.filter(c => c.fecha === dia.isoFecha).reduce((n, c) => n + (Number(c.cantNinos) || 0), 0);
    return (
      <div className="datos-cabecera-dia">
        <strong className="nombre-dia-grande">{dia.nombre}</strong>
        <span className="ninos-dia-grande">{abreviarNinos ? `${ninos} k` : `${ninos} niños`}</span>
        {dia.clima && <span className="clima-dia-grande">{imagenClima(dia.clima)}</span>}
      </div>
    );
  };

  const borrarYReiniciar = () => {
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
    const turnosZona = turnos.filter(t => t.fecha === isoFecha);

    const elementos = turnosZona.map(t => {
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
    setIdEmpPlantillaEdit(null);
    setNombreEmpPlantilla('');
    setHorasEmpPlantilla('');
    setColorEmpPlantilla('#a0aec0');
    setMostrarModalGestionEmp(true);
  };

  const abrirModalEditarEmpleado = (emp) => {
    if(!isAdmin) return;
    setIdEmpPlantillaEdit(emp.id);
    setNombreEmpPlantilla(emp.nombre);
    setHorasEmpPlantilla(emp.horasContratadas);
    setColorEmpPlantilla(emp.color);
    setMostrarModalGestionEmp(true);
  };

  const guardarEmpleadoPlantilla = (e) => {
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
    registrarHistorial();
    setEmpleados(empleados.filter(emp => String(emp.id) !== String(id)));
    setTurnos(turnos.filter(t => String(t.empleadoId) !== String(id)));
    setMostrarModalGestionEmp(false);
  };

  const abrirModalNuevoTurno = () => {
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

  const prepararDuplicarTurno = () => { setIdTurnoEdit(null); };

  const eliminarTurno = () => {
    if (idTurnoEdit) {
      registrarHistorial();
      setTurnos(turnos.filter(t => t.id !== idTurnoEdit));
      setMostrarModalTurno(false);
    }
  };

  const abrirModalNuevoCumple = () => {
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
    setIdCumpleEdit(c.id);
    setCumpleFecha(c.fecha);
    
    const [h, m] = c.horaInicio.split(':').map(Number);
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

  const prepararDuplicarCumple = () => { setIdCumpleEdit(null); };

  const eliminarCumple = () => {
    if (idCumpleEdit) {
      registrarHistorial();
      setCumples(cumples.filter(c => c.id !== idCumpleEdit));
      setMostrarModalCumple(false);
    }
  };

  const exportarJPG = async () => {
    const elemento = areaExportarRef.current;
    if (!elemento) return;

    const canvas = await html2canvas(elemento, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false
    });

    const enlace = document.createElement('a');
    enlace.download = `Cuadrante_${diasSemana[0]?.fecha.replace('/', '_') || 'semanal'}.jpg`;
    enlace.href = canvas.toDataURL('image/jpeg', 0.90);
    enlace.click();
  };

  const exportarPDFPersonalizado = async (refObjetivo, orientacion) => {
    const elemento = refObjetivo.current;
    if (!elemento) return;

    const canvas = await html2canvas(elemento, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.90);
    const pdf = new jsPDF(orientacion, 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const imgProps = pdf.getImageProperties(imgData);
    const margen = 2;
    const anchoUtil = pdfWidth - margen * 2;
    const altoUtil = pdfHeight - margen * 2;
    const ratio = Math.min(anchoUtil / imgProps.width, altoUtil / imgProps.height);

    const widthFinal = imgProps.width * ratio;
    const heightFinal = imgProps.height * ratio;
    const x = (pdfWidth - widthFinal) / 2;
    const y = (pdfHeight - heightFinal) / 2;

    pdf.addImage(imgData, 'JPEG', x, y, widthFinal, heightFinal);
const fechaInicioPDF = diasSemana[0]?.isoFecha;
const fechaFinPDF = diasSemana[6]?.isoFecha;

const anioMes = fechaInicioPDF
  ? fechaInicioPDF.substring(0, 7)
  : '0000-00';

const diaInicial = fechaInicioPDF
  ? fechaInicioPDF.substring(8, 10)
  : '00';

const diaFinal = fechaFinPDF
  ? fechaFinPDF.substring(8, 10)
  : '00';

pdf.save(`Horario ${anioMes} ${diaInicial} a ${diaFinal}.pdf`);  };

  const colorEmpSeleccionado = empleados.find(e => String(e.id) === String(turnoEmpId))?.color || '#ffffff';

  return (
    <div className="contenedor-horarios">
      <h2>HORARIO SEMANAL</h2>

      <div className="pestanas-navegacion">
        {isAdmin && <button
          className={`btn-pestana ${pestanaActiva === 'admin' ? 'activa' : ''}`}
          onClick={() => setPestanaActiva('admin')}
        >
          🛠️ Pestaña Administrador
        </button>}
        <button
          className={`btn-pestana ${pestanaActiva === 'visualizacion' ? 'activa' : ''}`}
          onClick={() => setPestanaActiva('visualizacion')}
        >
          👁️ Pestaña Visualización
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
                                      className="celda-dia-nombre" 
                                      rowSpan={filasADibujar.length}
                                    >
                                      {datosCabeceraDia(dia)}
                                      {controlesDia(dia)}
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
                                          className={`celda-bloque-activo celda-click ${esCumple ? 'celda-cumple-activo' : ''}`}
                                          style={{ backgroundColor: elementoActivo.color }}
                                          onClick={() => {
                                            if (esCumple) {
                                              abrirModalEditarCumple(elementoActivo.objetoOriginal);
                                            } else {
                                              abrirModalEditarTurno(elementoActivo.objetoOriginal);
                                            }
                                          }}
                                        >
                                          <div className="texto-bloque-celda">
                                            {elementoActivo.tipo === 'turno' ? (
                                              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                                                <strong>{elementoActivo.nombre}{elementoActivo.tipo === 'turno' && <span className="marcadores-turno">{elementoActivo.siEsNecesario && <span title="Si hace falta">⚠️</span>}{elementoActivo.encargado && <span title="Encargado">★</span>}</span>}</strong>
                                                <small>({elementoActivo.ubicacion})</small>
                                              </div>
                                            ) : (
                                              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                                                <strong>{elementoActivo.nombre}{elementoActivo.tipo === 'turno' && <span className="marcadores-turno">{elementoActivo.siEsNecesario && <span title="Si hace falta">⚠️</span>}{elementoActivo.encargado && <span title="Encargado">★</span>}</span>}</strong>
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
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button
                    className={`btn-pestana ${vistaVisualizacion === 'carriles' ? 'activa' : ''}`}
                    onClick={() => setVistaVisualizacion('carriles')}
                  >
                    📊 Vista 1: Horario Completo (Carriles)
                  </button>
                  <button
                    className={`btn-pestana ${vistaVisualizacion === 'inversa' ? 'activa' : ''}`}
                    onClick={() => setVistaVisualizacion('inversa')}
                  >
                    🔄 Vista 2: Horas en Filas y Días/Carriles en Columnas
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {isAdmin && <button
                    onClick={() => setPestanaActiva('admin')}
                    className="btn-gris"
                    title="Volver al administrador para editar turnos y eventos"
                  >
                    ✏️ Volver a Admin
                  </button>}
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
                                      <td className="celda-dia-nombre" rowSpan={filasFinales.length}>
                                        {datosCabeceraDia(dia, true, true)}{controlesDia(dia)}
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
                                                <strong>{elementoActivo.nombre}{elementoActivo.tipo === 'turno' && <span className="marcadores-turno">{elementoActivo.siEsNecesario && <span title="Si hace falta">⚠️</span>}{elementoActivo.encargado && <span title="Encargado">★</span>}</span>}</strong>
                                                <small>({elementoActivo.ubicacion})</small>
                                              </div>
                                            ) : (
                                              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
                                                <strong>{elementoActivo.nombre}{elementoActivo.tipo === 'turno' && <span className="marcadores-turno">{elementoActivo.siEsNecesario && <span title="Si hace falta">⚠️</span>}{elementoActivo.encargado && <span title="Encargado">★</span>}</span>}</strong>
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
                                className="cabecera-hora" 
                                colSpan={numCarriles}
                                style={{ textAlign: 'center', borderLeft: '2px solid #cbd5e0' }}
                              >
                                {datosCabeceraDia(dia)}{controlesDia(dia)}
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
                                        className={`celda-bloque-activo ${esCumple ? 'celda-cumple-activo' : ''}`}
                                        onClick={() => esCumple ? abrirModalEditarCumple(elementoActivo.objetoOriginal) : abrirModalEditarTurno(elementoActivo.objetoOriginal)}
                                        title="Pulsa para editar este turno o evento"
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