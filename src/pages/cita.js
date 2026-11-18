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
 const{data}=await sb.rpc('cita_publica',{p_token:tk});
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
async function accion(a,msg){
 const{error}=await sb.rpc('responder_cita_publica',{p_token:tk,p_accion:a});
 if(error)return toast(error.message);toast(msg);cargar();
}
function cambio(){
 const hoy=f2(new Date());
 $('#cb').innerHTML=`<label for="dia">Elige otro día</label><input type="date" id="dia" min="${hoy}" value="${hoy}"><label>Horas disponibles</label><div class="hs" id="hs"></div>`;
 $('#dia').onchange=horas;horas();
}
async function horas(){
 if(!$('#dia').value)return;$('#hs').innerHTML='<span class="mute">Buscando horas…</span>';
 const{data,error}=await sb.rpc('horas_libres_publicas',{p_slug:C.slug,p_dia:$('#dia').value,p_barbero:C.barbero_id,p_servicio:C.servicio_id});
 if(error)return $('#hs').innerHTML=`<span class="mute">${esc(error.message)}</span>`;
 $('#hs').innerHTML=data.length?data.map(x=>`<button type="button" class="h" data-t="${x.inicio}">${hh(x.inicio)}</button>`).join(''):'<span class="mute">No hay horas libres ese día. Prueba otra fecha.</span>';
 document.querySelectorAll('.h').forEach(b=>b.onclick=async()=>{
  if(!confirm('¿Cambiar tu cita a '+cuando(b.dataset.t)+'?'))return;
  const{error}=await sb.rpc('reprogramar_cita_publica',{p_token:tk,p_inicio:b.dataset.t});
  if(error){toast(error.message);return horas()}toast('Tu cita cambió y quedó confirmada.');cargar()});
}
cargar();
