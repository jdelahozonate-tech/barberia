import { sb } from "../lib/supabase.js";
const $=s=>document.querySelector(s),app=$('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dinero=n=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n||0);
const TZ='America/Bogota',slug=new URLSearchParams(location.search).get('n')||'';
const f2=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const hh=t=>new Date(t).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit',timeZone:TZ});
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.className='show';clearTimeout(tt);tt=setTimeout(()=>t.className='',4500)}
let C,T=null,consultaHoras=0,productosPublicos=[],carritoProductos=new Map();
(async()=>{
 let{data,error}=await sb.rpc('catalogo_publico',{p_slug:slug});
 if(error||!data||!data.negocio){const alterno=await sb.rpc('negocio_productos_publico',{p_slug:slug});if(alterno.error||!alterno.data?.negocio)return app.innerHTML='<h1>Enlace no disponible</h1><p class="mute">No encontramos esta barbería o su catálogo público no está disponible.</p>';data=alterno.data;}
 C=data;
 C.servicios=Array.isArray(C.servicios)?C.servicios:[];C.barberos=Array.isArray(C.barberos)?C.barberos:[];
 const hoy=f2(new Date());
 app.innerHTML=`${C.negocio.logo_url?`<div style="background:#10223F;border-radius:12px;padding:14px;text-align:center"><img src="${esc(C.negocio.logo_url)}" alt="${esc(C.negocio.nombre)}" style="max-width:100%;height:84px"></div>`:''}<h1>${esc(C.negocio.nombre)}</h1><p class="mute">Reserva tu cita o solicita productos.${C.negocio.direccion?' '+esc(C.negocio.direccion):''}</p>${C.negocio.valor_cita>0?`<p class="mute">La cita tiene un valor de ${dinero(C.negocio.valor_cita)}.</p>`:''}
 ${C.servicios.length&&C.barberos.length?`<section class="booking-section"><h2>Reservar una cita</h2>
 <label for="sv">Servicio</label><select id="sv">${C.servicios.map(s=>`<option value="${s.id}">${esc(s.nombre)}, ${dinero(s.precio)}, ${s.duracion_minutos} min</option>`).join('')}</select>
 <label for="br">Barbero</label><select id="br">${C.barberos.map(b=>`<option value="${b.id}">${esc(b.nombre)}</option>`).join('')}</select>
 <label for="dia">Fecha</label><input type="date" id="dia" min="${hoy}" value="${hoy}">
 <label>Hora</label><div class="hs" id="hs"></div>
 <form id="f" hidden><label for="nm">Tu nombre</label><input id="nm" autocomplete="name" required>
 <label for="tl">Tu teléfono</label><input id="tl" type="tel" autocomplete="tel" inputmode="tel" required>
 <button class="btn" id="go">Reservar cita</button></form></section>`:''}
 <section id="catalogo-productos-publico" class="public-products"><h2>Productos disponibles</h2><p class="mute">Cargando catálogo…</p></section>`;
 if(C.servicios.length&&C.barberos.length){['sv','br','dia'].forEach(i=>$('#'+i).onchange=horas);$('#f').onsubmit=reservar;horas()}
 cargarProductosPublicos();
})();
async function cargarProductosPublicos(){
 const zona=$('#catalogo-productos-publico');if(!zona)return;
 const{data,error}=await sb.rpc('catalogo_productos_publico',{p_slug:slug});
 if(error){zona.innerHTML='<h2>Productos</h2><p class="mute">El catálogo no está disponible en este momento.</p>';return}
 productosPublicos=Array.isArray(data)?data:[];
 if(!productosPublicos.length){zona.innerHTML='<h2>Productos disponibles</h2><p class="mute">Por ahora no hay productos disponibles para pedir.</p>';return}
 zona.innerHTML='<h2>Productos disponibles</h2><p class="mute">Selecciona los productos y cantidades que deseas solicitar.</p><div class="public-product-grid">'+productosPublicos.map(p=>'<article class="public-product-card">'+(p.imagen_url?'<img loading="lazy" src="'+esc(p.imagen_url)+'" alt="'+esc(p.nombre)+'">':'<div class="public-product-placeholder">Sin fotografía</div>')+'<div class="public-product-info"><small>'+esc(p.categoria||'Producto')+'</small><strong>'+esc(p.nombre)+'</strong><span>'+dinero(p.precio_venta)+'</span>'+(p.descripcion?'<p>'+esc(p.descripcion)+'</p>':'')+'<button type="button" class="btn" data-add-product="'+p.id+'">Agregar al pedido</button></div></article>').join('')+'</div><div id="resumen-pedido-productos"></div>';
 document.querySelectorAll('[data-add-product]').forEach(b=>b.onclick=()=>{const p=productosPublicos.find(x=>x.id===b.dataset.addProduct);if(!p)return;carritoProductos.set(p.id,(carritoProductos.get(p.id)||0)+1);pintarPedidoPublico()});
}
function pintarPedidoPublico(){
 const zona=$('#resumen-pedido-productos');if(!zona)return;
 const lineas=[...carritoProductos.entries()].map(([id,cantidad])=>{const p=productosPublicos.find(x=>x.id===id);return p?{p,cantidad}:null}).filter(Boolean);
 if(!lineas.length){zona.innerHTML='';return}
 const total=lineas.reduce((s,x)=>s+Number(x.p.precio_venta)*x.cantidad,0);
 zona.innerHTML='<div class="public-order-summary"><h3>Tu pedido</h3>'+lineas.map(x=>'<div class="public-order-line"><span>'+esc(x.p.nombre)+' × '+x.cantidad+'</span><strong>'+dinero(Number(x.p.precio_venta)*x.cantidad)+'</strong><button type="button" data-remove-product="'+x.p.id+'" aria-label="Quitar uno">−</button></div>').join('')+'<p class="public-order-total">Total estimado: '+dinero(total)+'</p><form id="pedido-productos-form"><label for="pedido-nombre">Tu nombre</label><input id="pedido-nombre" required maxlength="120" autocomplete="name"><label for="pedido-telefono">Tu teléfono</label><input id="pedido-telefono" required type="tel" maxlength="30" autocomplete="tel"><label for="pedido-notas">Notas (opcional)</label><textarea id="pedido-notas" rows="2" maxlength="500"></textarea><button class="btn" id="enviar-pedido">Enviar pedido</button></form><p class="mute">Este pedido es una solicitud; la barbería confirmará disponibilidad y entrega. No se realiza ningún cobro en línea.</p></div>';
 document.querySelectorAll('[data-remove-product]').forEach(b=>b.onclick=()=>{const id=b.dataset.removeProduct,n=(carritoProductos.get(id)||0)-1;if(n<=0)carritoProductos.delete(id);else carritoProductos.set(id,n);pintarPedidoPublico()});
 $('#pedido-productos-form').onsubmit=async e=>{e.preventDefault();const b=$('#enviar-pedido');if(b.disabled)return;b.disabled=true;const items=lineas.map(x=>({producto_id:x.p.id,cantidad:x.cantidad}));const{data,error}=await sb.rpc('crear_pedido_producto_publico',{p_slug:slug,p_nombre:$('#pedido-nombre').value,p_telefono:$('#pedido-telefono').value,p_items:items,p_notas:$('#pedido-notas').value||null});if(error){b.disabled=false;return toast(error.message)}carritoProductos.clear();zona.innerHTML='<div class="ok"><strong>¡Pedido enviado!</strong><br>La barbería recibió tu solicitud. Se comunicará contigo para confirmar disponibilidad y entrega.</div>'};
}
async function horas(){
 T=null;const consulta=++consultaHoras;$('#f').hidden=true;$('#hs').innerHTML='<span class="mute">Buscando horas…</span>';
 if(!$('#dia').value)return;
 const{data,error}=await sb.rpc('horas_libres_publicas',{p_slug:slug,p_dia:$('#dia').value,p_barbero:$('#br').value,p_servicio:$('#sv').value});
 if(consulta!==consultaHoras)return;
 if(error)return $('#hs').innerHTML=`<span class="mute">${esc(error.message)}</span>`;
 const disponibles=Array.isArray(data)?data.filter(x=>x&&typeof x.inicio==='string'&&Number.isFinite(Date.parse(x.inicio))):[];
 $('#hs').innerHTML=disponibles.length?disponibles.map(x=>`<button type="button" class="h" data-t="${esc(x.inicio)}">${hh(x.inicio)}</button>`).join(''):'<span class="mute">No hay horas libres ese día. Prueba otra fecha u otro barbero.</span>';
 document.querySelectorAll('.h').forEach(b=>b.onclick=()=>{T=b.dataset.t;document.querySelectorAll('.h').forEach(x=>x.classList.toggle('on',x===b));$('#f').hidden=false});
}
async function reservar(e){
 e.preventDefault();if(!T)return toast('Elige una hora.');
 const b=$('#go');if(b.disabled)return;
 const nombre=$('#nm').value,telefono=$('#tl').value,barbero=$('#br').value,servicio=$('#sv').value,inicio=T;
 const servicioTexto=$('#sv').selectedOptions[0]?.text||'',barberoTexto=$('#br').selectedOptions[0]?.text||'';
 b.disabled=true;document.querySelectorAll('#sv,#br,#dia,#f input,#f select,#hs button').forEach(x=>x.disabled=true);
 const{data,error}=await sb.rpc('reservar_cita_publica',{p_slug:slug,p_nombre:nombre,p_telefono:telefono,p_barbero:barbero,p_servicio:servicio,p_inicio:inicio});
 if(error){b.disabled=false;document.querySelectorAll('#sv,#br,#dia,#f input,#f select,#hs button').forEach(x=>x.disabled=false);toast(error.message);return horas()}
 if(!data?.token){app.innerHTML='<h1>Reserva registrada</h1><p class="mute">La cita se registró, pero no pudimos generar el enlace privado. Comunícate con la barbería para gestionar la cita.</p>';return}
 const gestion=new URL('cita.html',location.href);gestion.searchParams.set('t',data.token);const enlace=gestion.href;
 const dia=new Date(inicio).toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long',timeZone:TZ});
 const tel=String(C.negocio.telefono||'').replace(/\D/g,''),num=tel.length===10?'57'+tel:tel,sv=servicioTexto,br=barberoTexto;
 const wa=num?`<a class="btn" style="display:block;text-align:center;text-decoration:none;background:#1F7A4D;margin-top:14px" target="_blank" rel="noopener" href="https://wa.me/${num}?text=${encodeURIComponent('Hola, acabo de reservar una cita en '+C.negocio.nombre+': '+dia+' a las '+hh(inicio)+', '+sv+' con '+br+'. Soy '+nombre+', mi teléfono es '+telefono+'. ¿Me la confirman, por favor?')}">Avisar a la barbería por WhatsApp</a>`:'';
 app.innerHTML=`<h1>¡Cita reservada!</h1><div class="ok"><strong>${esc(C.negocio.nombre)}</strong><br>${esc(dia)} a las ${hh(inicio)}<br>${esc(servicioTexto)}<br>con ${esc(barberoTexto)}</div><a class="btn block" style="display:block;text-align:center;text-decoration:none;margin-top:14px" href="${esc(enlace)}">Ver, cancelar o cambiar mi cita</a><p class="mute">Guarda este enlace privado. Desde allí podrás confirmar, cancelar o reprogramar tu cita, incluso el mismo día antes de la hora reservada.</p>${wa}<p class="mute">Tu cita queda pendiente hasta que la barbería la confirme.${C.negocio.telefono?' Si necesitas ayuda, llama al '+esc(C.negocio.telefono):''}</p>`;
}
