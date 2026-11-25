// Módulo de autenticación, onboarding y carga del contexto del negocio.
export function crearModuloAcceso(deps) {
 const { $, app, sb, S, esc, traducir, toast, waNum, shell } = deps;
function pantallaAuth(modo='login',msg=''){
 const reg=modo==='registro';
 app.innerHTML=`<div class="pole"></div><div class="auth"><h1>${reg?'Crea tu cuenta':'Entra a tu barbería'}</h1>
 <p class="mute">${reg?'Registra tu correo para empezar. Después escribes el código de invitación que te enviaron.':'Agenda, clientes y equipo en un solo lugar.'}</p>
 ${msg?`<p class="info">${esc(msg)}</p>`:''}
 <form id="f"><label for="em">Correo</label><input id="em" type="email" autocomplete="email" required>
 <label for="pw">Contraseña</label><input id="pw" type="password" minlength="6" autocomplete="${reg?'new-password':'current-password'}" required>
 <button class="btn block">${reg?'Crear cuenta':'Entrar'}</button></form>
 <p style="text-align:center;margin-top:20px"><button class="link" id="sw">${reg?'Ya tengo cuenta':'Soy nuevo, crear cuenta'}</button></p></div>`;
 $('#sw').onclick=()=>pantallaAuth(reg?'login':'registro');
 $('#f').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('button');b.disabled=true;
  const c={email:$('#em').value.trim(),password:$('#pw').value};
  const{data,error}=reg?await sb.auth.signUp(c):await sb.auth.signInWithPassword(c);
  b.disabled=false;
  if(error)return toast(traducir(error.message),true);
  if(data.session)cargar();else pantallaAuth('login','Te enviamos un correo para confirmar tu cuenta. Confírmalo y luego entra.')};
}
function onboarding(){
 app.innerHTML=`<div class="pole"></div><div class="auth"><h1>Entra con tu código</h1><p class="mute">Escribe el código de invitación que te envió quien te presta el servicio.</p>
 <form id="jf"><label for="jc">Código de invitación</label><input id="jc" autocomplete="off" required><label for="jn">Tu nombre</label><input id="jn" required><button class="btn block">Unirme con el código</button></form>
 <p style="text-align:center;margin-top:20px"><button class="link" id="out">Salir</button></p></div>`;
 $('#out').onclick=()=>sb.auth.signOut();
 $('#jf').onsubmit=async e=>{e.preventDefault();const b=e.target.querySelector('.btn');b.disabled=true;
  const{error}=await sb.rpc('unirse_con_codigo',{p_codigo:$('#jc').value.trim(),p_nombre:$('#jn').value.trim()});
  b.disabled=false;if(error)return toast(traducir(error.message),true);cargar()};
}
async function cargar(){
 // getSession lee la sesión local (sin ida y vuelta a la red); la seguridad real la aplica RLS en cada consulta.
 const{data:ses,error:errorAuth}=await sb.auth.getSession();
 if(errorAuth)return toast(traducir(errorAuth.message),true);
 const user=ses?.session?.user;
 if(!user)return pantallaAuth();
 const{data:p,error}=await sb.from('perfiles').select('*,negocios(*)').eq('id',user.id).maybeSingle();
 if(error)return toast(error.message,true);
 if(!p)return onboarding();
 // Suscripción y foto del perfil en paralelo.
 const consultaFoto=p.foto_url||p.avatar_url?Promise.resolve({data:null})
  :p.barbero_id?sb.from('barberos').select('foto_url').eq('negocio_id',p.negocio_id).eq('id',p.barbero_id).maybeSingle()
  :user.email?sb.from('barberos').select('foto_url').eq('negocio_id',p.negocio_id).ilike('correo',user.email).maybeSingle()
  :Promise.resolve({data:null});
 const[{data:su,error:errorSus},{data:barberoFoto}]=await Promise.all([sb.rpc('mi_suscripcion'),consultaFoto]);
 if(errorSus)return toast('No fue posible verificar el estado de la suscripción: '+traducir(errorSus.message),true);
 S.sus=su;
 if(!su||su.dias<0||su.estado!=='ACTIVA'||!p.negocios)return bloqueada(su);
 const fotoPerfil=p.foto_url||p.avatar_url||barberoFoto?.foto_url||null;
 S.perfil={...p,foto_url:fotoPerfil};S.negocio=p.negocios;shell();
}

/* ---------- Plan y suscripción ---------- */
function bloqueada(su){
 const venc=su&&su.dias<0,wa=waNum(su?.contacto);
 app.innerHTML=`<div class="pole"></div><div class="auth"><h1>${venc?'Tu plan venció':'Acceso no disponible'}</h1>
 <p class="mute">${venc?`El plan de ${esc(su.negocio)} venció el ${esc(su.vence_en)}. Renuévalo para volver a entrar. Tus datos están guardados.`:'Tu acceso no está activo. Habla con el administrador de tu barbería o con soporte.'}</p>
 ${wa?`<a class="btn block" style="display:block;text-align:center;text-decoration:none;background:#1F7A4D" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent('Hola, quiero renovar mi plan'+(su?' de '+su.negocio:''))}">Escribir por WhatsApp</a>`:''}
 <p style="text-align:center;margin-top:20px"><button class="link" id="out">Salir</button></p></div>`;
 $('#out').onclick=()=>sb.auth.signOut();
}
function aviso(){const s=S.sus;if(!s||s.dias>5)return '';const wa=waNum(s.contacto);
 return `<p class="info" style="margin:0;text-align:center">Tu plan vence ${s.dias===0?'hoy':'en '+s.dias+' día'+(s.dias>1?'s':'')}. ${wa?`<a href="https://wa.me/${wa}?text=${encodeURIComponent('Hola, quiero renovar mi plan de '+s.negocio)}" target="_blank" rel="noopener">Renovar</a>`:''}</p>`}


 return { pantallaAuth, cargar, aviso };
}
