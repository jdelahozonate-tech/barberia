import { sb } from "../lib/supabase.js";
const $=s=>document.querySelector(s),app=$('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dinero=n=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n||0);
const TZ='America/Bogota',slug=new URLSearchParams(location.search).get('n')||'';
const f2=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const hh=t=>new Date(t).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',timeZone:TZ});
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.className='show';clearTimeout(tt);tt=setTimeout(()=>t.className='',4500)}
let C,T=null;
(async()=>{
 const{data}=await sb.rpc('catalogo_publico',{p_slug:slug});
 if(!data||!data.negocio)return app.innerHTML='<h1>Reservas no disponibles</h1><p class="mute">Este enlace no es válido o la barbería no recibe reservas en línea.</p>';
 C=data;
 if(!C.servicios.length||!C.barberos.length)return app.innerHTML=`<h1>${esc(C.negocio.nombre)}</h1><p class="mute">Todavía no hay servicios u horarios disponibles. Intenta más tarde.</p>`;
 const hoy=f2(new Date());
 app.innerHTML=`${C.negocio.logo_url?`<div style="background:#10223F;border-radius:12px;padding:14px;text-align:center"><img src="${esc(C.negocio.logo_url)}" alt="${esc(C.negocio.nombre)}" style="max-width:100%;height:84px"></div>`:''}<h1>${esc(C.negocio.nombre)}</h1><p class="mute">Reserva tu cita en un minuto.${C.negocio.direccion?' '+esc(C.negocio.direccion):''}</p>${C.negocio.valor_cita>0?`<p class="mute">La cita tiene un valor de ${dinero(C.negocio.valor_cita)}.</p>`:''}
 <label for="sv">Servicio</label><select id="sv">${C.servicios.map(s=>`<option value="${s.id}">${esc(s.nombre)}, ${dinero(s.precio)}, ${s.duracion_minutos} min</option>`).join('')}</select>
 <label for="br">Barbero</label><select id="br">${C.barberos.map(b=>`<option value="${b.id}">${esc(b.nombre)}</option>`).join('')}</select>
 <label for="dia">Fecha</label><input type="date" id="dia" min="${hoy}" value="${hoy}">
 <label>Hora</label><div class="hs" id="hs"></div>
 <form id="f" hidden><label for="nm">Tu nombre</label><input id="nm" autocomplete="name" required>
 <label for="tl">Tu teléfono</label><input id="tl" type="tel" autocomplete="tel" inputmode="tel" required>
 <button class="btn" id="go">Reservar cita</button></form>`;
 ['sv','br','dia'].forEach(i=>$('#'+i).onchange=horas);
 $('#f').onsubmit=reservar;horas();
})();
async function horas(){
 T=null;$('#f').hidden=true;$('#hs').innerHTML='<span class="mute">Buscando horas…</span>';
 if(!$('#dia').value)return;
 const{data,error}=await sb.rpc('horas_libres_publicas',{p_slug:slug,p_dia:$('#dia').value,p_barbero:$('#br').value,p_servicio:$('#sv').value});
 if(error)return $('#hs').innerHTML=`<span class="mute">${esc(error.message)}</span>`;
 $('#hs').innerHTML=data.length?data.map(x=>`<button type="button" class="h" data-t="${x.inicio}">${hh(x.inicio)}</button>`).join(''):'<span class="mute">No hay horas libres ese día. Prueba otra fecha u otro barbero.</span>';
 document.querySelectorAll('.h').forEach(b=>b.onclick=()=>{T=b.dataset.t;document.querySelectorAll('.h').forEach(x=>x.classList.toggle('on',x===b));$('#f').hidden=false});
}
async function reservar(e){
 e.preventDefault();if(!T)return toast('Elige una hora.');
 const b=$('#go');b.disabled=true;
 const{error}=await sb.rpc('reservar_cita_publica',{p_slug:slug,p_nombre:$('#nm').value,p_telefono:$('#tl').value,p_barbero:$('#br').value,p_servicio:$('#sv').value,p_inicio:T});
 if(error){b.disabled=false;toast(error.message);return horas()}
 const dia=new Date(T).toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long',timeZone:TZ});
 const tel=String(C.negocio.telefono||'').replace(/\D/g,''),num=tel.length===10?'57'+tel:tel,sv=$('#sv').selectedOptions[0]?.text||'',br=$('#br').selectedOptions[0]?.text||'';
 const wa=num?`<a class="btn" style="display:block;text-align:center;text-decoration:none;background:#1F7A4D;margin-top:14px" target="_blank" rel="noopener" href="https://wa.me/${num}?text=${encodeURIComponent('Hola, acabo de reservar una cita en '+C.negocio.nombre+': '+dia+' a las '+hh(T)+', '+sv+' con '+br+'. Soy '+$('#nm').value+', mi teléfono es '+$('#tl').value+'. ¿Me la confirman, por favor?')}">Avisar a la barbería por WhatsApp</a>`:'';
 app.innerHTML=`<h1>¡Cita reservada!</h1><div class="ok"><strong>${esc(C.negocio.nombre)}</strong><br>${esc(dia)} a las ${hh(T)}<br>${esc($('#sv').selectedOptions[0]?.text||'')}<br>con ${esc($('#br').selectedOptions[0]?.text||'')}</div>${wa}<p class="mute">Tu cita queda pendiente hasta que la barbería la confirme. Si no puedes asistir, avísale a la barbería${C.negocio.telefono?' al '+esc(C.negocio.telefono):''}.</p>`;
}
