// Módulo de agenda, creación y gestión de citas.
export function crearModuloAgenda(deps) {
 const { $, app, dlg, sb, S, esc, hora, bonito, fecha, traducir, toast, nuevaVenta, mio, ir } = deps;
 function wa(c,conf){
 const tel=String(c.clientes?.telefono||'').replace(/\D/g,'');
 if(tel.length<7)return '<p class="mute">Este cliente no tiene teléfono guardado, no se puede enviar el recordatorio.</p>';
 const num=tel.length===10?'57'+tel:tel,url=location.origin+location.pathname.replace(/[^/]*$/,'')+'cita.html?t='+c.token;
 const cuando=new Date(c.inicio).toLocaleString('es-CO',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});
 const msg=conf?`Hola ${c.clientes.nombre}, tu cita en ${S.negocio.nombre} quedó confirmada: ${cuando}, ${c.servicios?.nombre} con ${c.barberos?.nombre}.\nSi necesitas cambiar la hora o cancelarla, hazlo aquí: ${url}`:`Hola ${c.clientes.nombre}, te recordamos tu cita en ${S.negocio.nombre}: ${cuando}, ${c.servicios?.nombre} con ${c.barberos?.nombre}.\nConfirma, cancela o cambia la hora aquí: ${url}`;
 return `<a class="btn block" style="display:block;text-align:center;text-decoration:none;background:#1F7A4D" target="_blank" rel="noopener" id="${conf?'cf':'rw'}" href="https://wa.me/${num}?text=${encodeURIComponent(msg)}">${conf?'Confirmar y avisar por WhatsApp':'Recordar por WhatsApp'}</a>`;
}


async function agenda(){
 const main=$('#main'),d0=new Date(S.dia+'T00:00:00'),d1=new Date(d0);d1.setDate(d1.getDate()+1);
 const{data,error}=await mio(sb.from('citas').select('*,clientes(nombre,telefono),barberos(nombre),servicios(nombre)').gte('inicio',d0.toISOString()).lt('inicio',d1.toISOString())).order('inicio');
 if(error)return toast(error.message,true);
 main.innerHTML=`<div class="head"><h2>Agenda</h2><button class="btn" id="nv">Nueva cita</button></div>
 <div class="dia"><button class="btn sec" id="pv" aria-label="Día anterior">‹</button><input type="date" id="dd" value="${S.dia}" aria-label="Fecha"><button class="btn sec" id="nx" aria-label="Día siguiente">›</button></div>
 <p class="mute cap">${d0.toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'})}</p>
 ${data.length?data.map(c=>`<button class="row" data-id="${c.id}"><span><strong>${hora(c.inicio)} a ${hora(c.fin)}</strong><br>${esc(c.clientes?.nombre)}<br><small>${esc(c.servicios?.nombre)} con ${esc(c.barberos?.nombre)}</small></span><span class="chip ${c.estado}">${bonito(c.estado)}</span></button>`).join(''):'<p class="empty">No hay citas este día. Toca “Nueva cita” para agendar.</p>'}`;
 const mover=n=>{const d=new Date(d0);d.setDate(d.getDate()+n);S.dia=fecha(d);agenda()};
 $('#pv').onclick=()=>mover(-1);$('#nx').onclick=()=>mover(1);
 $('#dd').onchange=e=>{if(e.target.value){S.dia=e.target.value;agenda()}};
 $('#nv').onclick=nuevaCita;
 document.querySelectorAll('.row').forEach(b=>b.onclick=()=>editarCita(data.find(c=>c.id===b.dataset.id)));
}
async function nuevaCita(){
 const[cl,ba,se]=await Promise.all([['clientes','id,nombre'],['barberos','id,nombre'],['servicios','id,nombre,duracion_minutos']].map(([t,s])=>sb.from(t).select(s).eq('estado','ACTIVO').order('nombre').then(r=>r.data||[])));
 if(!cl.length||!ba.length||!se.length)return toast('Antes de agendar crea al menos un cliente, un barbero y un servicio.',true);
 const ini=new Date(S.dia+'T09:00:00'),loc=new Date(ini.getTime()-ini.getTimezoneOffset()*6e4).toISOString().slice(0,16);
 const op=a=>a.map(o=>`<option value="${o.id}">${esc(o.nombre)}</option>`).join('');
 dlg.innerHTML=`<form id="df"><h2>Nueva cita</h2>
 <label for="a1">Cliente</label><select id="a1" name="cliente_id" required>${op(cl)}</select>
 <label for="a2">Servicio</label><select id="a2" name="servicio_id" required>${op(se)}</select>
 <label for="a3">Barbero</label><select id="a3" name="barbero_id" required>${op(ba)}</select>
 <label for="a4">Fecha y hora</label><input id="a4" name="inicio" type="datetime-local" value="${loc}" required>
 <label for="a5">Observaciones</label><textarea id="a5" name="observaciones" rows="2"></textarea>
 <div class="acts"><button type="button" class="btn sec" id="cx">Cancelar</button><button class="btn">Agendar cita</button></div></form>`;
 dlg.showModal();$('#cx').onclick=()=>dlg.close();
 $('#df').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));
  const i=new Date(f.inicio),dur=se.find(s=>s.id===f.servicio_id).duracion_minutos;
  const{error}=await sb.from('citas').insert({cliente_id:f.cliente_id,servicio_id:f.servicio_id,barbero_id:f.barbero_id,observaciones:f.observaciones||null,inicio:i.toISOString(),fin:new Date(i.getTime()+dur*6e4).toISOString(),negocio_id:S.perfil.negocio_id,creado_por:S.perfil.id,origen:'APP'});
  if(error)return toast(traducir(error.message),true);
  dlg.close();toast('Cita agendada');S.dia=fecha(i);agenda()};
}
function editarCita(c){
 const E=['PENDIENTE','CONFIRMADA','ATENDIDA','CANCELADA','NO_ASISTIO'];
 dlg.innerHTML=`<form id="df"><h2>${esc(c.clientes?.nombre)}</h2><p class="mute">${hora(c.inicio)} a ${hora(c.fin)}, ${esc(c.servicios?.nombre)} con ${esc(c.barberos?.nombre)}. Para cambiar la hora, cancela esta cita y agenda otra.</p>
 <label for="e1">Estado</label><select id="e1" name="estado">${E.map(o=>`<option value="${o}"${o===c.estado?' selected':''}>${bonito(o)}</option>`).join('')}</select>
 <label for="e2">Observaciones</label><textarea id="e2" name="observaciones" rows="3">${esc(c.observaciones||'')}</textarea>
 ${wa(c,c.estado==='PENDIENTE')}<div class="acts"><button type="button" class="btn sec" id="cx">Cerrar</button><button class="btn">Guardar</button></div></form>`;
 dlg.showModal();$('#cx').onclick=()=>dlg.close();
 $('#df').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));
  const{error}=await sb.from('citas').update({estado:f.estado,observaciones:f.observaciones||null}).eq('id',c.id);
  if(error)return toast(traducir(error.message),true);dlg.close();toast('Cita actualizada');ir();
  if(f.estado==='ATENDIDA'&&c.estado!=='ATENDIDA')cobrarCita(c)};
 const cf=$('#cf');if(cf)cf.onclick=()=>{sb.from('citas').update({estado:'CONFIRMADA'}).eq('id',c.id).then(()=>{dlg.close();toast('Cita confirmada');ir()})};
}

/* ---------- Cobro de la cita y citas por confirmar ---------- */
async function cobrarCita(c){
 const{data:ya}=await sb.from('ventas').select('id').eq('cita_id',c.id).limit(1);
 if(ya&&ya.length)return;
 let fee=null;
 if(Number(S.negocio.valor_cita)>0){const{data:s}=await sb.from('servicios').select('id').eq('categoria','CITA').eq('estado','ACTIVO').limit(1);fee=s?.[0]?.id||null}
 nuevaVenta({cliente_id:c.cliente_id,barbero_id:c.barbero_id,servicio_id:c.servicio_id,cita_id:c.id,fee});
}
async function porConfirmar(){
 const{data}=await sb.from('citas').select('*,clientes(nombre,telefono),barberos(nombre),servicios(nombre)').eq('estado','PENDIENTE').gte('inicio',new Date().toISOString()).order('inicio').limit(10);
 if(!data||!data.length||!$('#pc'))return;
 $('#pc').innerHTML=`<label>Citas por confirmar (${data.length})</label>`+data.map(c=>`<button class="row" data-c="${c.id}"><span><strong>${new Date(c.inicio).toLocaleDateString('es-CO',{weekday:'short',day:'numeric',month:'short'})}, ${hora(c.inicio)}</strong><br>${esc(c.clientes?.nombre)}<br><small>${esc(c.servicios?.nombre)} con ${esc(c.barberos?.nombre)}</small></span><span class="chip">Pendiente</span></button>`).join('');
 document.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>editarCita(data.find(c=>c.id===b.dataset.c)));
}

 return { agenda, nuevaCita, editarCita, cobrarCita, porConfirmar };
}
