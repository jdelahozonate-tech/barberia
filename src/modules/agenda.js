// Módulo de agenda, creación y gestión de citas.
export function crearModuloAgenda(deps) {
 const { $, app, dlg, sb, S, esc, hora, bonito, fecha, traducir, toast, nuevaVenta, mio, ir } = deps;
 function partesNegocio(iso){
 const zona=S.negocio?.zona_horaria||'America/Bogota';
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zona,year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso)).map(x=>[x.type,x.value]));
 return {fecha:p.year+'-'+p.month+'-'+p.day,dia:{Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[p.weekday],minutos:Number(p.hour)*60+Number(p.minute)};
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
 const vista=S.vistaAgenda||'dia',base=new Date(S.dia+'T12:00:00Z'),p=n=>String(n).padStart(2,'0'),fmt=d=>d.getUTCFullYear()+'-'+p(d.getUTCMonth()+1)+'-'+p(d.getUTCDate()),sum=(d,n)=>{const x=new Date(d);x.setUTCDate(x.getUTCDate()+n);return x};
 let primero=new Date(base),ultimo;
 if(vista==='semana'){const offset=(base.getUTCDay()+6)%7;primero=sum(base,-offset);ultimo=sum(primero,7)}
 else if(vista==='mes'){primero=new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth(),1));primero=sum(primero,-((primero.getUTCDay()+6)%7));ultimo=sum(primero,42)}
 else{primero=new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth(),base.getUTCDate()));ultimo=sum(primero,1)}
 const desde=instanteNegocio(fmt(primero)+'T00:00').toISOString(),hasta=instanteNegocio(fmt(ultimo)+'T00:00').toISOString();
 let consulta=sb.from('citas').select('*,clientes(nombre,telefono),barberos(nombre),servicios(nombre,duracion_minutos)').eq('negocio_id',S.perfil.negocio_id).gte('inicio',desde).lt('inicio',hasta).order('inicio');
 if(S.barberoAgenda)consulta=consulta.eq('barbero_id',S.barberoAgenda);
 const [rCitas,rBarberos]=await Promise.all([mio(consulta),sb.from('barberos').select('id,nombre').eq('negocio_id',S.perfil.negocio_id).eq('estado','ACTIVO').order('nombre')]);
 if(rCitas.error)return toast(rCitas.error.message,true);
 if(rBarberos.error)return toast(rBarberos.error.message,true);
 const data=rCitas.data||[],barberos=rBarberos.data||[],dias=[];
 for(let d=new Date(primero);d<ultimo;d=sum(d,1))dias.push(fmt(d));
 const etiqueta=d=>new Date(d+'T12:00:00Z').toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long',timeZone:'UTC'});
 const citasDia=d=>data.filter(c=>partesNegocio(c.inicio).fecha===d);
 const fila=c=>'<button class="row" data-id="'+c.id+'"><span><strong>'+hora(c.inicio)+' a '+hora(c.fin)+'</strong><br>'+esc(c.clientes?.nombre)+'<br><small>'+esc(c.servicios?.nombre)+' con '+esc(c.barberos?.nombre)+'</small></span><span class="chip '+c.estado+'">'+bonito(c.estado)+'</span></button>';
 let contenido='';
 if(vista==='dia'){const xs=citasDia(fmt(base));contenido=xs.length?xs.map(fila).join(''):'<p class="empty">No hay citas este día. Toca “Nueva cita” para agendar.</p>';}
 else if(vista==='semana'){contenido='<div class="agenda-semana">'+dias.map(d=>'<section class="card"><strong>'+esc(etiqueta(d))+'</strong>'+(citasDia(d).map(fila).join('')||'<p class="mute">Sin citas</p>')+'</section>').join('')+'</div>';}
 else{contenido='<div class="agenda-mes" style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px"><div class="mute">Lun</div><div class="mute">Mar</div><div class="mute">Mié</div><div class="mute">Jue</div><div class="mute">Vie</div><div class="mute">Sáb</div><div class="mute">Dom</div>'+dias.map(d=>'<section class="card" style="padding:6px;min-width:0;opacity:'+(d.slice(0,7)===S.dia.slice(0,7)?'1':'.55')+'"><strong>'+Number(d.slice(8,10))+'</strong>'+(citasDia(d).map(c=>'<button class="btn sec" style="display:block;width:100%;padding:4px 2px;margin:3px 0;font-size:11px;white-space:normal" data-id="'+c.id+'">'+hora(c.inicio)+' '+esc(c.clientes?.nombre)+'</button>').join('')||'')+'</section>').join('')+'</div>';}
 const anterior=vista==='mes'?-1:vista==='semana'?-7:-1,siguiente=-anterior;
 const rango=vista==='mes'?new Date(base).toLocaleDateString('es-CO',{month:'long',year:'numeric',timeZone:'UTC'}):vista==='semana'?etiqueta(fmt(primero))+' – '+etiqueta(fmt(sum(ultimo,-1))):etiqueta(fmt(base));
 main.innerHTML='<div class="head"><h2>Agenda</h2><button class="btn" id="nv">Nueva cita</button></div><div class="dia"><button class="btn sec" id="pv" aria-label="Periodo anterior">‹</button><input type="date" id="dd" value="'+S.dia+'" aria-label="Fecha"><button class="btn sec" id="nx" aria-label="Periodo siguiente">›</button></div><div class="dia"><label>Vista <select id="va"><option value="dia"'+(vista==='dia'?' selected':'')+'>Día</option><option value="semana"'+(vista==='semana'?' selected':'')+'>Semana</option><option value="mes"'+(vista==='mes'?' selected':'')+'>Mes</option></select></label><label>Barbero <select id="fb"><option value="">Todos</option>'+barberos.map(b=>'<option value="'+b.id+'"'+(S.barberoAgenda===b.id?' selected':'')+'>'+esc(b.nombre)+'</option>').join('')+'</select></label></div><p class="mute cap">'+esc(rango)+'</p>'+contenido;
 const mover=n=>{const d=vista==='mes'?new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth()+n,1)):sum(base,n);S.dia=fmt(d);agenda()};
 $('#pv').onclick=()=>mover(anterior);$('#nx').onclick=()=>mover(siguiente);
 $('#dd').onchange=e=>{if(e.target.value){S.dia=e.target.value;agenda()}};
 $('#va').onchange=e=>{S.vistaAgenda=e.target.value;agenda()};$('#fb').onchange=e=>{S.barberoAgenda=e.target.value;agenda()};
 $('#nv').onclick=nuevaCita;
 document.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>editarCita(data.find(x=>x.id===b.dataset.id)));
}
async function nuevaCita(){
 const rs=await Promise.all([['clientes','id,nombre'],['barberos','id,nombre'],['servicios','id,nombre,duracion_minutos']].map(([t,s])=>sb.from(t).select(s).eq('negocio_id',S.perfil.negocio_id).eq('estado','ACTIVO').order('nombre')));
 const fallo=rs.find(r=>r.error);if(fallo)return toast(traducir(fallo.error.message),true);
 const[cl,ba,se]=rs.map(r=>r.data||[]);
 if(!cl.length||!ba.length||!se.length)return toast('Antes de agendar crea al menos un cliente, un barbero y un servicio.',true);
 const loc=S.dia+'T09:00';
 const op=a=>a.map(o=>`<option value="${o.id}">${esc(o.nombre)}</option>`).join('');
 dlg.innerHTML=`<form id="df"><h2>Nueva cita</h2>
 <label for="a1">Cliente</label><select id="a1" name="cliente_id" required>${op(cl)}</select>
 <label for="a2">Servicio</label><select id="a2" name="servicio_id" required>${op(se)}</select>
 <label for="a3">Barbero</label><select id="a3" name="barbero_id" required>${op(ba)}</select>
 <label for="a4">Fecha y hora</label><input id="a4" name="inicio" type="datetime-local" value="${loc}" required>
 <label for="a5">Observaciones</label><textarea id="a5" name="observaciones" rows="2"></textarea>
 <div class="acts"><button type="button" class="btn sec" id="cx">Cancelar</button><button class="btn">Agendar cita</button></div></form>`;
 dlg.showModal();$('#cx').onclick=()=>dlg.close();
 let guardando=false;
 $('#df').onsubmit=async e=>{e.preventDefault();if(guardando)return;guardando=true;const boton=e.target.querySelector('button[type="submit"],button:not([type])');if(boton)boton.disabled=true;const f=Object.fromEntries(new FormData(e.target));
  const i=instanteNegocio(f.inicio),dur=Number(se.find(s=>s.id===f.servicio_id)?.duracion_minutos||0),fin=new Date(i.getTime()+dur*6e4);
  if(!Number.isFinite(i.getTime())||!dur){guardando=false;if(boton)boton.disabled=false;return toast('La fecha o duración del servicio no es válida.',true)}
  const disponibilidad=await validarDisponibilidad({barbero:f.barbero_id,cliente:f.cliente_id,inicio:i.toISOString(),fin:fin.toISOString()});
  if(disponibilidad){guardando=false;if(boton)boton.disabled=false;return toast(disponibilidad,true)}
  const{error}=await sb.from('citas').insert({cliente_id:f.cliente_id,servicio_id:f.servicio_id,barbero_id:f.barbero_id,observaciones:f.observaciones||null,inicio:i.toISOString(),fin:fin.toISOString(),negocio_id:S.perfil.negocio_id,creado_por:S.perfil.id,origen:'APP'});
  if(error){guardando=false;if(boton)boton.disabled=false;return toast(traducir(error.message),true)}
  dlg.close();toast('Cita agendada');S.dia=partesNegocio(i.toISOString()).fecha;agenda()};
}
function editarCita(c){
 const admin=['ADMINISTRADOR','SUPERVISOR'].includes(S.perfil.rol);
 const E=['PENDIENTE','CONFIRMADA','ATENDIDA','CANCELADA','NO_ASISTIO'];
 const dur=Number(c.servicios?.duracion_minutos||Math.max(0,(new Date(c.fin)-new Date(c.inicio))/60000));
 const local=valorLocal(c.inicio);
 dlg.innerHTML='<form id="df"><h2>'+esc(c.clientes?.nombre)+'</h2><p class="mute">'+esc(c.servicios?.nombre)+' con '+esc(c.barberos?.nombre)+'.</p>'+
 (admin?'<label for="e3">Nueva fecha y hora</label><input id="e3" name="inicio" type="datetime-local" value="'+local+'" required><label for="e1">Estado</label><select id="e1" name="estado">'+E.map(o=>'<option value="'+o+'"'+(o===c.estado?' selected':'')+'>'+bonito(o)+'</option>').join('')+'</select><label for="e2">Observaciones</label><textarea id="e2" name="observaciones" rows="3">'+esc(c.observaciones||'')+'</textarea>'+wa(c,c.estado==='PENDIENTE'): '<p class="info">Vista de solo lectura. Solo un administrador o supervisor puede modificar esta cita.</p>')+
 '<div class="acts"><button type="button" class="btn sec" id="cx">Cerrar</button>'+(admin?'<button class="btn">Guardar cambios</button>':'')+'</div></form>';
 dlg.showModal();$('#cx').onclick=()=>dlg.close();
 let guardando=false;
 if(admin)$('#df').onsubmit=async e=>{
  e.preventDefault();if(guardando)return;guardando=true;
  const boton=e.target.querySelector('button[type="submit"],button:not([type])');if(boton)boton.disabled=true;
  const f=Object.fromEntries(new FormData(e.target)),i=instanteNegocio(f.inicio);
  if(!Number.isFinite(i.getTime())||!dur){guardando=false;if(boton)boton.disabled=false;return toast('La fecha o duración de la cita no es válida.',true)}
  const fin=new Date(i.getTime()+dur*60000),cambioHorario=i.toISOString()!==new Date(c.inicio).toISOString();
  if(['PENDIENTE','CONFIRMADA'].includes(f.estado)&&(cambioHorario||!['PENDIENTE','CONFIRMADA'].includes(c.estado))){
   const disponibilidad=await validarDisponibilidad({barbero:c.barbero_id,cliente:c.cliente_id,inicio:i.toISOString(),fin:fin.toISOString(),excluir:c.id});
   if(disponibilidad){guardando=false;if(boton)boton.disabled=false;return toast(disponibilidad,true)}
  }
  const cambios={estado:f.estado,observaciones:f.observaciones||null};
  if(cambioHorario){cambios.inicio=i.toISOString();cambios.fin=fin.toISOString()}
  const{error}=await sb.from('citas').update(cambios).eq('negocio_id',S.perfil.negocio_id).eq('id',c.id);
  if(error){guardando=false;if(boton)boton.disabled=false;return toast(traducir(error.message),true)}
  dlg.close();toast(cambioHorario?'Cita reprogramada':'Cita actualizada');S.dia=partesNegocio(i.toISOString()).fecha;agenda();
  if(f.estado==='ATENDIDA'&&c.estado!=='ATENDIDA')cobrarCita(c);
 };
 const cf=$('#cf');if(admin&&cf)cf.onclick=async()=>{if(guardando)return;guardando=true;cf.style.pointerEvents='none';const{error}=await sb.from('citas').update({estado:'CONFIRMADA'}).eq('negocio_id',S.perfil.negocio_id).eq('id',c.id);if(error){guardando=false;cf.style.pointerEvents='';return toast(traducir(error.message),true)}dlg.close();toast('Cita confirmada');ir()};
}
/* ---------- Cobro de la cita y citas por confirmar ---------- */
async function cobrarCita(c){
 const{data:ya,error:errorVenta}=await sb.from('ventas').select('id').eq('negocio_id',S.perfil.negocio_id).eq('cita_id',c.id).limit(1);
 if(errorVenta)return toast(traducir(errorVenta.message),true);
 if(ya&&ya.length)return;
 let fee=null;
 if(Number(S.negocio.valor_cita)>0){const{data:s,error:errorServicio}=await sb.from('servicios').select('id').eq('negocio_id',S.perfil.negocio_id).eq('categoria','CITA').eq('estado','ACTIVO').limit(1);if(errorServicio)return toast(traducir(errorServicio.message),true);fee=s?.[0]?.id||null}
 nuevaVenta({cliente_id:c.cliente_id,barbero_id:c.barbero_id,servicio_id:c.servicio_id,cita_id:c.id,fee});
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
