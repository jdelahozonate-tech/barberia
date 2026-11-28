// Módulo de agenda, creación y gestión de citas.
export function crearModuloAgenda(deps) {
 const { $, app, dlg, sb, S, esc, hora, bonito, fecha, traducir, toast, mio, ir } = deps;
 function partesNegocio(iso){
 const zona=S.negocio?.zona_horaria||'America/Bogota';
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zona,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso)).map(x=>[x.type,x.value]));
 return {fecha:p.year+'-'+p.month+'-'+p.day,dia:{Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[p.weekday],minutos:Number(p.hour)*60+Number(p.minute)};
}
function validarInicioFuturo(inicio){
  const instante=new Date(inicio);
  if(!Number.isFinite(instante.getTime()))return 'La fecha y hora seleccionadas no son válidas.';
  if(instante.getTime()<=Date.now())return 'No puedes agendar ni reprogramar una cita en una fecha u hora que ya pasó. Selecciona un horario futuro.';
  return null;
 }
async function validarDisponibilidad({barbero,cliente,inicio,fin,excluir=null}){
 const pi=partesNegocio(inicio),pf=partesNegocio(fin);
 if(pi.fecha!==pf.fecha)return 'La cita debe terminar dentro del mismo día de atención.';
 const [hr,au,cb,cc]=await Promise.all([
  sb.from('horarios_barbero').select('hora_inicio,hora_fin').eq('negocio_id',S.perfil.negocio_id).eq('barbero_id',barbero).eq('dia_semana',pi.dia),
  sb.from('ausencias_barbero').select('id').eq('negocio_id',S.perfil.negocio_id).eq('barbero_id',barbero).lt('desde',fin).gt('hasta',inicio).limit(1),
  sb.from('citas').select('id').eq('negocio_id',S.perfil.negocio_id).eq('barbero_id',barbero).in('estado',['PENDIENTE','CONFIRMADA']).lt('inicio',fin).gt('fin',inicio),
  sb.from('citas').select('id').eq('negocio_id',S.perfil.negocio_id).eq('cliente_id',cliente).in('estado',['PENDIENTE','CONFIRMADA']).lt('inicio',fin).gt('fin',inicio)
 ]);
 const err=[hr,au,cb,cc].find(x=>x.error);if(err)return 'No se pudo verificar la disponibilidad: '+err.error.message;
 if(!(hr.data||[]).some(h=>{const a=Number(String(h.hora_inicio).slice(0,2))*60+Number(String(h.hora_inicio).slice(3,5)),b=Number(String(h.hora_fin).slice(0,2))*60+Number(String(h.hora_fin).slice(3,5));return pi.minutos>=a&&pf.minutos<=b}))return 'El horario está fuera de los turnos configurados para este barbero.';
 if(au.data?.length)return 'El barbero tiene una ausencia registrada en ese horario.';
 if((cb.data||[]).some(x=>x.id!==excluir))return 'El barbero ya tiene otra cita en ese horario.';
 if((cc.data||[]).some(x=>x.id!==excluir))return 'El cliente ya tiene otra cita en ese horario.';
 return null;
}
function valorLocal(iso){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:S.negocio?.zona_horaria||'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso)).map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute;
}
function instanteNegocio(local){
 const [y,m,d,h,mi]=local.match(/\d+/g).map(Number),zona=S.negocio?.zona_horaria||'America/Bogota';
 let ms=Date.UTC(y,m-1,d,h,mi);
 for(let n=0;n<3;n++){const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zona,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms)).map(x=>[x.type,x.value]));const real=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute);const diff=Date.UTC(y,m-1,d,h,mi)-real;if(!diff)break;ms+=diff}
 return new Date(ms);
}
function wa(c,conf){
 const tel=String(c.clientes?.telefono||'').replace(/\D/g,'');
 if(tel.length<7)return '<p class="mute">Este cliente no tiene teléfono guardado, no se puede enviar el recordatorio.</p>';
 const num=tel.length===10?'57'+tel:tel,url=location.origin+location.pathname.replace(/[^/]*$/,'')+'cita.html?t='+c.token;
 const cuando=new Date(c.inicio).toLocaleString('es-CO',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});
 const msg=conf?`Hola ${c.clientes.nombre}, tu cita en ${S.negocio.nombre} quedó confirmada: ${cuando}, ${c.servicios?.nombre} con ${c.barberos?.nombre}.\nSi necesitas cambiar la hora o cancelarla, hazlo aquí: ${url}`:`Hola ${c.clientes.nombre}, te recordamos tu cita en ${S.negocio.nombre}: ${cuando}, ${c.servicios?.nombre} con ${c.barberos?.nombre}.\nConfirma, cancela o cambia la hora aquí: ${url}`;
 return `<a class="btn block" style="display:block;text-align:center;text-decoration:none;background:#1F7A4D" target="_blank" rel="noopener" id="${conf?'cf':'rw'}" href="https://wa.me/${num}?text=${encodeURIComponent(msg)}">${conf?'Confirmar y avisar por WhatsApp':'Recordar por WhatsApp'}</a>`;
}


async function agenda(){
 const main=$('#main'),esBarbero=S.perfil.rol==='BARBERO';
 if(esBarbero)S.barberoAgenda=S.perfil.barbero_id||null;
 const vista=S.vistaAgenda||'dia',base=new Date(S.dia+'T12:00:00Z'),p=n=>String(n).padStart(2,'0'),fmt=d=>d.getUTCFullYear()+'-'+p(d.getUTCMonth()+1)+'-'+p(d.getUTCDate()),sum=(d,n)=>{const x=new Date(d);x.setUTCDate(x.getUTCDate()+n);return x};
 let primero=new Date(base),ultimo;
 if(vista==='semana'){const offset=(base.getUTCDay()+6)%7;primero=sum(base,-offset);ultimo=sum(primero,7)}
 else if(vista==='mes'){primero=new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth(),1));primero=sum(primero,-((primero.getUTCDay()+6)%7));ultimo=sum(primero,42)}
 else{primero=new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth(),base.getUTCDate()));ultimo=sum(primero,1)}
 const desde=instanteNegocio(fmt(primero)+'T00:00').toISOString(),hasta=instanteNegocio(fmt(ultimo)+'T00:00').toISOString();
 let consulta=sb.from('citas').select('*,clientes(nombre,telefono),barberos(nombre),servicios(nombre,duracion_minutos)').eq('negocio_id',S.perfil.negocio_id).gte('inicio',desde).lt('inicio',hasta).order('inicio');
 if(S.barberoAgenda)consulta=consulta.eq('barbero_id',S.barberoAgenda);
 let consultaBarberos=sb.from('barberos').select('id,nombre').eq('negocio_id',S.perfil.negocio_id).eq('estado','ACTIVO');if(esBarbero)consultaBarberos=consultaBarberos.eq('id',S.perfil.barbero_id);const [rCitas,rBarberos]=await Promise.all([mio(consulta),consultaBarberos.order('nombre')]);
 if(rCitas.error)return toast(rCitas.error.message,true);
 if(rBarberos.error)return toast(rBarberos.error.message,true);
 const data=rCitas.data||[],barberos=rBarberos.data||[],dias=[];
 for(let d=new Date(primero);d<ultimo;d=sum(d,1))dias.push(fmt(d));
 const etiqueta=d=>new Date(d+'T12:00:00Z').toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'});
 const citasDia=d=>data.filter(c=>partesNegocio(c.inicio).fecha===d);
 const tarjeta=c=>'<button class="agenda-cita" data-id="'+c.id+'" aria-label="Abrir cita de '+esc(c.clientes?.nombre)+' a las '+hora(c.inicio)+'"><span class="agenda-cita-hora">'+hora(c.inicio)+' – '+hora(c.fin)+'</span><strong>'+esc(c.clientes?.nombre)+'</strong><span class="agenda-cita-detalle">'+esc(c.servicios?.nombre)+' · '+esc(c.barberos?.nombre)+'</span><span class="chip '+c.estado+'">'+bonito(c.estado)+'</span></button>';
 const xsHoy=citasDia(fmt(base)),canceladas=data.filter(c=>c.estado==='CANCELADA').length,confirmadas=data.filter(c=>['PENDIENTE','CONFIRMADA'].includes(c.estado)).length,atendidas=data.filter(c=>c.estado==='ATENDIDA').length;
 let contenido='';
 if(vista==='dia'){
  contenido='<section class="agenda-dia-panel"><div class="agenda-dia-titulo"><div><span class="agenda-eyebrow">AGENDA DEL DÍA</span><h3>'+esc(etiqueta(fmt(base)))+'</h3></div><span class="agenda-total-dia">'+xsHoy.length+' '+(xsHoy.length===1?'cita':'citas')+'</span></div>'+(xsHoy.length?'<div class="agenda-lista">'+xsHoy.map(tarjeta).join('')+'</div>':'<div class="agenda-vacio"><span class="agenda-vacio-icon">▦</span><strong>Tu día está despejado</strong><span>No hay citas programadas para esta fecha.</span><button class="btn" type="button" id="nv-vacio">Agendar primera cita</button></div>')+'</section>';
 }else if(vista==='semana'){
  contenido='<div class="agenda-semana-scroll"><div class="agenda-semana">'+dias.map(d=>'<section class="agenda-columna'+(d===fmt(base)?' es-hoy':'')+'"><div class="agenda-columna-head"><span>'+esc(new Date(d+'T12:00:00Z').toLocaleDateString('es-CO',{weekday:'short',timeZone:'UTC'}))+'</span><strong>'+Number(d.slice(8,10))+'</strong></div><div class="agenda-columna-citas">'+(citasDia(d).map(tarjeta).join('')||'<span class="agenda-sin-citas">Sin citas</span>')+'</div></section>').join('')+'</div></div>';
 }else{
  contenido='<div class="agenda-mes-scroll"><div class="agenda-mes"><div class="agenda-mes-dias">'+['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=>'<span>'+d+'</span>').join('')+'</div><div class="agenda-mes-grid">'+dias.map(d=>'<section class="agenda-mes-celda'+(d===fmt(base)?' es-seleccionado':'')+(d.slice(0,7)!==S.dia.slice(0,7)?' fuera-mes':'')+'"><button class="agenda-dia-numero" type="button" data-fecha="'+d+'" aria-label="Ver '+esc(etiqueta(d))+'">'+Number(d.slice(8,10))+'</button><div class="agenda-mes-citas">'+citasDia(d).slice(0,3).map(c=>'<button class="agenda-mes-cita" data-id="'+c.id+'"><time>'+hora(c.inicio)+'</time><span>'+esc(c.clientes?.nombre)+'</span></button>').join('')+(citasDia(d).length>3?'<small>+'+(citasDia(d).length-3)+' más</small>':'')+'</div></section>').join('')+'</div></div></div>';
 }
 const anterior=vista==='mes'?-1:vista==='semana'?-7:-1,siguiente=-anterior;
 const rango=vista==='mes'?new Date(base).toLocaleDateString('es-CO',{month:'long',year:'numeric',timeZone:'UTC'}):vista==='semana'?etiqueta(fmt(primero))+' – '+etiqueta(fmt(sum(ultimo,-1))):etiqueta(fmt(base));
 main.innerHTML=`<div class="agenda-shell">
 <header class="agenda-header"><div><span class="agenda-eyebrow">${esBarbero?'MI AGENDA':'GESTIÓN DE CITAS'}</span><h2>${esBarbero?'Mi agenda':'Agenda'}</h2><p>${esBarbero?'Consulta y organiza tus propias citas.':'Organiza tu equipo y mantén cada reserva bajo control.'}</p></div><button class="btn agenda-nueva" id="nv"><span aria-hidden="true">＋</span> Nueva cita</button></header>
 <section class="agenda-resumen" aria-label="Resumen de citas"><div class="agenda-metrica"><span class="agenda-metrica-icon total">▦</span><span><small>Citas del período</small><strong>${data.length}</strong></span></div><div class="agenda-metrica"><span class="agenda-metrica-icon confirmada">✓</span><span><small>Confirmadas</small><strong>${confirmadas}</strong></span></div><div class="agenda-metrica"><span class="agenda-metrica-icon atendida">★</span><span><small>Atendidas</small><strong>${atendidas}</strong></span></div><div class="agenda-metrica"><span class="agenda-metrica-icon pendiente">✕</span><span><small>Canceladas</small><strong>${canceladas}</strong></span></div></section>
 <section class="agenda-toolbar"><div class="agenda-navegacion"><button class="btn sec agenda-flecha" id="pv" aria-label="Período anterior">‹</button><input type="date" id="dd" value="${S.dia}" aria-label="Seleccionar fecha"><button class="btn sec agenda-flecha" id="nx" aria-label="Período siguiente">›</button><span class="agenda-rango">${esc(rango)}</span></div><div class="agenda-filtros"><label for="va">Vista<select id="va"><option value="dia"${vista==='dia'?' selected':''}>Día</option><option value="semana"${vista==='semana'?' selected':''}>Semana</option><option value="mes"${vista==='mes'?' selected':''}>Mes</option></select></label>${esBarbero?'':'<label for="fb">Barbero<select id="fb"><option value="">Todo el equipo</option>'+barberos.map(b=>'<option value="'+b.id+'"'+(S.barberoAgenda===b.id?' selected':'')+'>'+esc(b.nombre)+'</option>').join('')+'</select></label>'}</div></section>
 <div class="agenda-contenido">${contenido}</div>
 <footer class="agenda-leyenda"><span><i class="pendiente"></i>Pendiente</span><span><i class="confirmada"></i>Confirmada</span><span><i class="atendida"></i>Atendida</span><span><i class="cancelada"></i>Cancelada / No asistió</span></footer>
 </div>`;

 const mover=n=>{const d=vista==='mes'?new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth()+n,1)):sum(base,n);S.dia=fmt(d);agenda()};
 $('#pv').onclick=()=>mover(anterior);$('#nx').onclick=()=>mover(siguiente);
 $('#dd').onchange=e=>{if(e.target.value){S.dia=e.target.value;agenda()}};
 $('#va').onchange=e=>{S.vistaAgenda=e.target.value;agenda()};const filtroBarbero=$('#fb');if(filtroBarbero)filtroBarbero.onchange=e=>{S.barberoAgenda=e.target.value;agenda()};
 $('#nv').onclick=nuevaCita;
 const vacio=$('#nv-vacio');if(vacio)vacio.onclick=nuevaCita;
 document.querySelectorAll('[data-fecha]').forEach(b=>b.onclick=()=>{S.dia=b.dataset.fecha;S.vistaAgenda='dia';agenda()});
 document.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>editarCita(data.find(x=>x.id===b.dataset.id)));
}
async function nuevaCita(){
 const esBarbero=S.perfil.rol==='BARBERO';
 const rs=await Promise.all([['clientes','id,nombre'],['barberos','id,nombre'],['servicios','id,nombre,duracion_minutos']].map(([t,s])=>{let q=sb.from(t).select(s).eq('negocio_id',S.perfil.negocio_id).eq('estado','ACTIVO');if(t==='barberos'&&esBarbero)q=q.eq('id',S.perfil.barbero_id);return q.order('nombre')}));
 const fallo=rs.find(r=>r.error);if(fallo)return toast(traducir(fallo.error.message),true);
 const[cl,ba,se]=rs.map(r=>r.data||[]);
 if(!cl.length||!ba.length||!se.length)return toast('Antes de agendar crea al menos un cliente, un barbero y un servicio.',true);
 const loc=S.dia+'T09:00';
 const op=a=>a.map(o=>`<option value="${o.id}">${esc(o.nombre)}</option>`).join('');
 dlg.innerHTML=`<form id="df"><h2>Nueva cita</h2>
 <label for="a1">Cliente</label><select id="a1" name="cliente_id" required>${op(cl)}</select>
 <label for="a2">Servicio</label><select id="a2" name="servicio_id" required>${op(se)}</select>
 ${esBarbero?'<input type="hidden" id="a3" name="barbero_id" value="'+esc(S.perfil.barbero_id||'')+'">':'<label for="a3">Barbero</label><select id="a3" name="barbero_id" required>'+op(ba)+'</select>'}
 <label for="a4">Fecha y hora</label><input id="a4" name="inicio" type="datetime-local" min="${valorLocal(new Date()).slice(0,16)}" value="${loc}" required>
 <label for="a5">Observaciones</label><textarea id="a5" name="observaciones" rows="2"></textarea>
 <div class="acts"><button type="button" class="btn sec" id="cx">Cancelar</button><button class="btn">Agendar cita</button></div></form>`;
 dlg.showModal();$('#cx').onclick=()=>dlg.close();
 let guardando=false;
 $('#df').onsubmit=async e=>{e.preventDefault();if(guardando)return;guardando=true;const boton=e.target.querySelector('button[type="submit"],button:not([type])');if(boton)boton.disabled=true;const f=Object.fromEntries(new FormData(e.target));
  const i=instanteNegocio(f.inicio),dur=Number(se.find(s=>s.id===f.servicio_id)?.duracion_minutos||0),fin=new Date(i.getTime()+dur*6e4);
  const pasado=validarInicioFuturo(i);if(pasado){guardando=false;if(boton)boton.disabled=false;return toast(pasado,true)}
  if(!Number.isFinite(i.getTime())||!dur){guardando=false;if(boton)boton.disabled=false;return toast('La fecha o duración del servicio no es válida.',true)}
  const barberoAsignado=esBarbero?S.perfil.barbero_id:f.barbero_id;
  const disponibilidad=await validarDisponibilidad({barbero:barberoAsignado,cliente:f.cliente_id,inicio:i.toISOString(),fin:fin.toISOString()});
  if(disponibilidad){guardando=false;if(boton)boton.disabled=false;return toast(disponibilidad,true)}
  const{error}=await sb.from('citas').insert({cliente_id:f.cliente_id,servicio_id:f.servicio_id,barbero_id:barberoAsignado,observaciones:f.observaciones||null,inicio:i.toISOString(),fin:fin.toISOString(),negocio_id:S.perfil.negocio_id,creado_por:S.perfil.id,origen:'APP',estado:'CONFIRMADA'});
  if(error){guardando=false;if(boton)boton.disabled=false;return toast(traducir(error.message),true)}
  dlg.close();toast('Cita agendada');S.dia=partesNegocio(i.toISOString()).fecha;agenda()};
}
function editarCita(c){
 const admin=['ADMINISTRADOR','SUPERVISOR'].includes(S.perfil.rol);
 const E=['CONFIRMADA','ATENDIDA','CANCELADA'],estadoActual=c.estado==='PENDIENTE'?'CONFIRMADA':c.estado;if(!E.includes(estadoActual))E.push(estadoActual);
 const dur=Number(c.servicios?.duracion_minutos||Math.max(0,(new Date(c.fin)-new Date(c.inicio))/60000));
 const local=valorLocal(c.inicio);
 dlg.innerHTML='<form id="df"><h2>'+esc(c.clientes?.nombre)+'</h2><p class="mute">'+esc(c.servicios?.nombre)+' con '+esc(c.barberos?.nombre)+'.</p>'+
 (admin?'<label for="e3">Nueva fecha y hora</label><input id="e3" name="inicio" type="datetime-local" min="'+valorLocal(new Date()).slice(0,16)+'" value="'+local+'" required><label for="e1">Estado</label><select id="e1" name="estado">'+E.map(o=>'<option value="'+o+'"'+(o===estadoActual?' selected':'')+'>'+bonito(o)+'</option>').join('')+'</select><label for="e2">Observaciones</label><textarea id="e2" name="observaciones" rows="3">'+esc(c.observaciones||'')+'</textarea>'+wa(c,c.estado==='PENDIENTE'): '<p class="info">Vista de solo lectura. Solo un administrador o supervisor puede modificar esta cita.</p>')+
 (admin&&['PENDIENTE','CONFIRMADA'].includes(c.estado)?'<button type="button" class="btn block" id="rj" style="background:#C0272D;margin-top:12px">No puedo atenderte</button>':'')+
 '<div class="acts"><button type="button" class="btn sec" id="cx">Cerrar</button>'+(admin?'<button class="btn">Guardar cambios</button>':'')+'</div></form>';
 dlg.showModal();$('#cx').onclick=()=>dlg.close();
 let guardando=false;
 if(admin)$('#df').onsubmit=async e=>{
  e.preventDefault();if(guardando)return;guardando=true;
  const boton=e.target.querySelector('button[type="submit"],button:not([type])');if(boton)boton.disabled=true;
  const f=Object.fromEntries(new FormData(e.target)),i=instanteNegocio(f.inicio);
  if(!Number.isFinite(i.getTime())||!dur){guardando=false;if(boton)boton.disabled=false;return toast('La fecha o duración de la cita no es válida.',true)}
  const fin=new Date(i.getTime()+dur*60000),cambioHorario=i.toISOString()!==new Date(c.inicio).toISOString();
  if(['PENDIENTE','CONFIRMADA'].includes(f.estado)){const pasado=validarInicioFuturo(i);if(pasado){guardando=false;if(boton)boton.disabled=false;return toast(pasado,true)}}
  if(['PENDIENTE','CONFIRMADA'].includes(f.estado)&&(cambioHorario||!['PENDIENTE','CONFIRMADA'].includes(c.estado))){
   const disponibilidad=await validarDisponibilidad({barbero:c.barbero_id,cliente:c.cliente_id,inicio:i.toISOString(),fin:fin.toISOString(),excluir:c.id});
   if(disponibilidad){guardando=false;if(boton)boton.disabled=false;return toast(disponibilidad,true)}
  }
  const cambios={estado:f.estado,observaciones:f.observaciones||null};
  if(cambioHorario){cambios.inicio=i.toISOString();cambios.fin=fin.toISOString()}
  const{error}=await sb.from('citas').update(cambios).eq('negocio_id',S.perfil.negocio_id).eq('id',c.id);
  if(error){guardando=false;if(boton)boton.disabled=false;return toast(traducir(error.message),true)}
  dlg.close();toast(cambioHorario?'Cita reprogramada':'Cita actualizada');S.dia=partesNegocio(i.toISOString()).fecha;agenda();

 };
const rj=$('#rj');if(admin&&rj)rj.onclick=async()=>{
  if(guardando)return;
  if(!confirm('¿Rechazar esta cita? Se cancelará y podrás avisar al cliente por WhatsApp.'))return;
  guardando=true;rj.disabled=true;
  const nota=('No atendida por el negocio. '+(c.observaciones||'')).trim();
  const{error}=await sb.from('citas').update({estado:'CANCELADA',observaciones:nota}).eq('negocio_id',S.perfil.negocio_id).eq('id',c.id);
  if(error){guardando=false;rj.disabled=false;return toast(traducir(error.message),true)}
  const tel=String(c.clientes?.telefono||'').replace(/\D/g,'');
  dlg.close();toast('Cita rechazada');
  if(tel.length>=7){
   const num=tel.length===10?'57'+tel:tel,reservar=location.origin+location.pathname.replace(/[^/]*$/,'')+'reservar.html?n='+S.negocio.slug;
   const cuando=new Date(c.inicio).toLocaleString('es-CO',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});
   const msg='Hola '+(c.clientes?.nombre||'')+', lamentablemente no podemos atenderte el '+cuando+' en '+S.negocio.nombre+'. Te pedimos disculpas. Puedes elegir otra hora aquí: '+reservar;
   window.open('https://wa.me/'+num+'?text='+encodeURIComponent(msg),'_blank','noopener');
  }
  S.dia=partesNegocio(new Date(c.inicio).toISOString()).fecha;agenda();
 };
 const cf=$('#cf');if(admin&&cf)cf.onclick=async()=>{if(guardando)return;guardando=true;cf.style.pointerEvents='none';const{error}=await sb.from('citas').update({estado:'CONFIRMADA'}).eq('negocio_id',S.perfil.negocio_id).eq('id',c.id);if(error){guardando=false;cf.style.pointerEvents='';return toast(traducir(error.message),true)}dlg.close();toast('Cita confirmada');ir()};
}
async function porConfirmar(){
 const{data,error}=await mio(sb.from('citas').select('*,clientes(nombre,telefono),barberos(nombre),servicios(nombre)').eq('negocio_id',S.perfil.negocio_id).eq('estado','PENDIENTE').gte('inicio',new Date().toISOString())).order('inicio').limit(10);
 if(error)return toast(traducir(error.message),true);
 if(!data||!data.length||!$('#pc'))return;
 $('#pc').innerHTML=`<label>Citas por confirmar (${data.length})</label>`+data.map(c=>`<button class="row" data-c="${c.id}"><span><strong>${new Date(c.inicio).toLocaleDateString('es-CO',{weekday:'short',day:'numeric',month:'short'})}, ${hora(c.inicio)}</strong><br>${esc(c.clientes?.nombre)}<br><small>${esc(c.servicios?.nombre)} con ${esc(c.barberos?.nombre)}</small></span><span class="chip">Pendiente</span></button>`).join('');
 document.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>editarCita(data.find(c=>c.id===b.dataset.c)));
}

 return { agenda, porConfirmar };
}
