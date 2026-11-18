import { sb } from "../lib/supabase.js";
const $=s=>document.querySelector(s),app=$('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const TZ='America/Bogota',tk=new URLSearchParams(location.search).get('t')||'';
const hh=t=>new Date(t).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',timeZone:TZ});
const cuando=t=>new Date(t).toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long',timeZone:TZ})+' a las '+hh(t);
const f2=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.className='show';clearTimeout(tt);tt=setTimeout(()=>t.className='',4500)}
let C;
async function cargar(){
 if(!tk)return app.innerHTML='<h1>Enlace no válido</h1><p class="mute">El enlace no contiene un identificador de cita.</p>';
 const{data,error}=await sb.rpc('cita_publica',{p_token:tk});
 if(error)return app.innerHTML='<h1>No pudimos consultar tu cita</h1><p class="mute">'+esc(error.message)+'</p>';
 if(!data)return app.innerHTML='<h1>Enlace no válido</h1><p class="mute">No encontramos esta cita. Pide a la barbería que te envíe el enlace de nuevo.</p>';
 C=data;const activa=['PENDIENTE','CONFIRMADA'].includes(C.estado)&&new Date(C.inicio)>new Date();
 const est={PENDIENTE:'Pendiente de confirmar',CONFIRMADA:'Confirmada',CANCELADA:'Cancelada',ATENDIDA:'Atendida',NO_ASISTIO:'No asististe'}[C.estado]||C.estado;
 app.innerHTML=`<h1>Hola, ${esc(C.cliente)}</h1><p class="mute">Esta es tu cita en ${esc(C.negocio)}.</p>
 <div class="card"><strong>${esc(cuando(C.inicio))}</strong><br>${esc(C.servicio)} con ${esc(C.barbero)}${C.direccion?'<br><span class="mute">'+esc(C.direccion)+'</span>':''}<br><span class="chip ${C.estado}">${esc(est)}</span></div>
 ${activa?`<button class="btn" id="ok"${C.estado==='CONFIRMADA'?' hidden':''}>Confirmar que asistiré</button><button class="btn sec" id="ch">Cambiar la hora</button><button class="btn no" id="no">Cancelar la cita</button><div id="cb"></div>`
 :`<p class="mute">Esta cita ya no se puede modificar${C.telefono?'. Para agendar otra, llama al '+esc(C.telefono):''}.</p>`}`;
 if(!activa)return;
 $('#ok').onclick=()=>accion('confirmar','¡Listo! Tu cita quedó confirmada.');
 $('#no').onclick=()=>{if(confirm('¿Seguro que quieres cancelar tu cita?'))accion('cancelar','Tu cita fue cancelada.')};
 $('#ch').onclick=cambio;
}
let accionEnCurso=false,consultaHoras=0;
async function accion(a,msg){
 if(accionEnCurso)return;accionEnCurso=true;
 const botones=['#ok','#no','#ch'].map(x=>$(x)).filter(Boolean);botones.forEach(b=>b.disabled=true);
 const{error}=await sb.rpc('responder_cita_publica',{p_token:tk,p_accion:a});
 if(error){accionEnCurso=false;botones.forEach(b=>b.disabled=false);return toast(error.message)}
 toast(msg);await cargar();accionEnCurso=false;
}
function cambio(){
 const hoy=f2(new Date());
 $('#cb').innerHTML=`<label for="dia">Elige otro día</label><input type="date" id="dia" min="${hoy}" value="${hoy}"><label>Horas disponibles</label><div class="hs" id="hs"></div>`;
 $('#dia').onchange=horas;horas();
}
async function horas(){
 if(!$('#dia').value)return;const consulta=++consultaHoras,dia=$('#dia').value;$('#hs').innerHTML='<span class="mute">Buscando horas…</span>';
 const{data,error}=await sb.rpc('horas_libres_publicas',{p_slug:C.slug,p_dia:dia,p_barbero:C.barbero_id,p_servicio:C.servicio_id});
 if(consulta!==consultaHoras)return;
 if(error)return $('#hs').innerHTML=`<span class="mute">${esc(error.message)}</span>`;
 const disponibles=Array.isArray(data)?data:[];
 $('#hs').innerHTML=disponibles.length?disponibles.map(x=>`<button type="button" class="h" data-t="${x.inicio}">${hh(x.inicio)}</button>`).join(''):'<span class="mute">No hay horas libres ese día. Prueba otra fecha.</span>';
 document.querySelectorAll('.h').forEach(b=>b.onclick=async()=>{
  if(accionEnCurso||!confirm('¿Cambiar tu cita a '+cuando(b.dataset.t)+'?'))return;
  accionEnCurso=true;document.querySelectorAll('.h').forEach(x=>x.disabled=true);
  const{error}=await sb.rpc('reprogramar_cita_publica',{p_token:tk,p_inicio:b.dataset.t});
  if(error){accionEnCurso=false;toast(error.message);return horas()}toast('Tu cita cambió y quedó confirmada.');await cargar();accionEnCurso=false});
}
cargar();
