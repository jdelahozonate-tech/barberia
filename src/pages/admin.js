import { sb } from "../lib/supabase.js";
const $=s=>document.querySelector(s),app=$('#app'),dlg=$('#dlg');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dinero=n=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n||0);
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.className='show';clearTimeout(tt);tt=setTimeout(()=>t.className='',4500)}
const salir=async()=>{await sb.auth.signOut();login()};
function login(){
 app.innerHTML=`<h1>Panel del propietario</h1><p class="mute">Solo para quien administra la plataforma.</p>
 <form id="f"><label for="em">Correo</label><input id="em" type="email" autocomplete="email" required>
 <label for="pw">Contraseña</label><input id="pw" type="password" autocomplete="current-password" required><button class="btn block">Entrar</button></form>
 <button class="btn sec block" type="button" id="forgot">Olvidé mi contraseña</button>`;
 $('#f').onsubmit=async e=>{e.preventDefault();const{error}=await sb.auth.signInWithPassword({email:$('#em').value.trim(),password:$('#pw').value});
  if(error)return toast('Correo o contraseña incorrectos.');lista()};
 $('#forgot').onclick=async()=>{
  const email=$('#em').value.trim();
  if(!email||!$('#em').checkValidity())return toast('Escribe primero el correo de tu cuenta.');
  const redirectTo=location.origin+location.pathname;
  const{error}=await sb.auth.resetPasswordForEmail(email,{redirectTo});
  if(error)return toast('No se pudo enviar el correo: '+error.message);
  toast('Si el correo está registrado, recibirás un enlace para crear una contraseña nueva.');
 };
}
function recuperarContrasena(){
 app.innerHTML=`<h1>Crear contraseña nueva</h1><p class="mute">Elige una contraseña definitiva para tu cuenta de propietario.</p>
 <form id="rp"><label for="np">Nueva contraseña</label><input id="np" type="password" minlength="10" autocomplete="new-password" required>
 <label for="cp">Confirmar contraseña</label><input id="cp" type="password" minlength="10" autocomplete="new-password" required>
 <button class="btn block">Guardar contraseña</button></form>`;
 $('#rp').onsubmit=async e=>{
  e.preventDefault();const password=$('#np').value;
  if(password!==$('#cp').value)return toast('Las contraseñas no coinciden.');
  const{error}=await sb.auth.updateUser({password});
  if(error)return toast('No se pudo actualizar la contraseña: '+error.message);
  toast('Contraseña actualizada. Ya puedes entrar.');
  history.replaceState({},document.title,location.pathname);
  lista();
 };
}
sb.auth.onAuthStateChange((event)=>{
 if(event==='PASSWORD_RECOVERY')recuperarContrasena();
});
async function lista(){
 const{data,error}=await sb.rpc('admin_negocios');
 if(error){app.innerHTML=`<h1>Sin acceso</h1><p class="mute">Esta cuenta no es de propietario.</p><button class="btn sec" id="out">Salir</button>`;$('#out').onclick=salir;return}
 const vig=data.filter(n=>n.estado==='ACTIVO'&&n.dias!==null&&n.dias>=0).length,tot=data.reduce((t,n)=>t+Number(n.pagado),0);
 app.innerHTML=`<div class="head"><h1>Barberías</h1><span><button class="btn" id="nb">Nueva barbería</button> <button class="btn sec" id="out">Salir</button></span></div>
 <div class="kp"><div><small>Barberías</small><strong>${data.length}</strong></div><div><small>Con plan vigente</small><strong>${vig}</strong></div><div><small>Total cobrado</small><strong>${dinero(tot)}</strong></div></div>
 ${data.map(n=>{const susp=n.estado!=='ACTIVO',v=n.dias===null?'Sin plan':n.dias<0?`Vencida hace ${-n.dias} día${n.dias<-1?'s':''}`:n.dias===0?'Vence hoy':`Vence en ${n.dias} día${n.dias>1?'s':''}`,cl=susp||n.dias===null||n.dias<0?'mal':n.dias<=5?'ojo':'bien';
  return `<div class="card"><strong>${esc(n.nombre)}</strong><span class="chip ${cl}">${susp?'Suspendida':v}</span><br><small class="mute">${esc(n.slug)}, plan ${esc(n.plan||'ninguno')}, vence ${n.vence_en||'sin fecha'}, ${n.usuarios} usuario${n.usuarios==1?'':'s'}, pagado ${dinero(n.pagado)}</small>
  <div class="ac"><button class="btn" data-r="${n.id}" data-n="${esc(n.nombre)}">Registrar pago y renovar</button><button class="btn sec" data-c="${n.id}" data-n="${esc(n.nombre)}">Código de acceso</button><button class="btn sec" data-s="${n.id}" data-e="${n.estado}">${susp?'Reactivar':'Suspender'}</button></div></div>`}).join('')||'<p class="mute">Aún no hay barberías.</p>'}`;
 $('#out').onclick=salir;
 $('#nb').onclick=nueva;
 document.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>renovar(b.dataset.r,b.dataset.n));
 document.querySelectorAll('[data-c]').forEach(b=>b.onclick=async()=>{
  const{data:cod,error:er}=await sb.rpc('admin_codigo_admin',{p_negocio:b.dataset.c});
  if(er)return toast(er.message);entrega(b.dataset.n,cod)});
 document.querySelectorAll('[data-s]').forEach(b=>b.onclick=async()=>{
  if(b.dataset.e==='ACTIVO'&&!confirm('¿Suspender esta barbería? Nadie podrá entrar hasta que la reactives.'))return;
  const{error}=await sb.rpc('admin_suspender',{p_negocio:b.dataset.s,p_suspender:b.dataset.e==='ACTIVO'});
  if(error)return toast(error.message);toast('Listo');lista()});
}
function nueva(){
 dlg.innerHTML=`<form id="df"><h2>Nueva barbería</h2>
 <label for="n1">Nombre de la barbería</label><input id="n1" required>
 <label for="n2">Enlace de reservas</label><input id="n2" pattern="[a-z0-9-]{3,40}" title="3 a 40 letras minúsculas, números o guiones" required>
 <div class="acts"><button type="button" class="btn sec" id="cx">Cancelar</button><button class="btn">Crear</button></div></form>`;
 dlg.showModal();$('#cx').onclick=()=>dlg.close();
 $('#n1').oninput=e=>{if(!$('#n2').dataset.m)$('#n2').value=e.target.value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)};
 $('#n2').oninput=e=>{e.target.dataset.m=1};
 $('#df').onsubmit=async e=>{e.preventDefault();const nombre=$('#n1').value;
  const{data,error}=await sb.rpc('admin_crear_negocio',{p_nombre:nombre,p_slug:$('#n2').value});
  if(error)return toast(error.message.includes('duplicate')?'Ese enlace ya está en uso, prueba otro.':error.message);
  entrega(nombre,data);lista()};
}
function entrega(nombre,codigo){
 const url=location.origin+location.pathname.replace(/[^/]*$/,''),
  msg=`Te invitaron a ${nombre}. 1) Entra a ${url} 2) Toca “Soy nuevo, crear cuenta” 3) Cuando te lo pida, escribe este código: ${codigo} (vence en 7 días)`;
 dlg.innerHTML=`<h2>${esc(nombre)}</h2><p>Código: <strong>${esc(codigo)}</strong></p><p class="mute">Vence en 7 días y sirve una sola vez.</p>
 <a class="btn block" style="display:block;text-align:center;text-decoration:none;background:#1F7A4D" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">Enviar por WhatsApp</a>
 <div class="acts"><button type="button" class="btn sec" id="cx">Cerrar</button></div>`;
 dlg.showModal();$('#cx').onclick=()=>dlg.close();
}
function renovar(id,nombre){
 dlg.innerHTML=`<form id="df"><h2>Renovar ${esc(nombre)}</h2><p class="mute">El plan se extiende desde la fecha de vencimiento (o desde hoy si ya venció).</p>
 <label for="m1">Meses que pagó</label><input id="m1" type="number" min="1" max="24" value="1" required>
 <label for="m2">Valor pagado</label><input id="m2" type="number" min="0" inputmode="decimal" required>
 <label for="m3">Plan</label><select id="m3"><option value="MENSUAL">Mensual</option><option value="ANUAL">Anual</option><option value="PRUEBA">Prueba</option></select>
 <label for="m4">Método de pago</label><select id="m4"><option>EFECTIVO</option><option>TRANSFERENCIA</option><option>NEQUI</option><option>DAVIPLATA</option></select>
 <label for="m5">Nota (opcional)</label><input id="m5">
 <div class="acts"><button type="button" class="btn sec" id="cx">Cancelar</button><button class="btn">Registrar y renovar</button></div></form>`;
 dlg.showModal();$('#cx').onclick=()=>dlg.close();
 $('#df').onsubmit=async e=>{e.preventDefault();
  const{data,error}=await sb.rpc('admin_renovar',{p_negocio:id,p_meses:Number($('#m1').value),p_valor:Number($('#m2').value),p_plan:$('#m3').value,p_metodo:$('#m4').value,p_nota:$('#m5').value||null});
  if(error)return toast(error.message);dlg.close();toast('Renovada hasta el '+data);lista()};
}
(async()=>{const{data:{session}}=await sb.auth.getSession();session?lista():login()})();
