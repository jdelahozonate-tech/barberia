// Módulo de equipo, invitaciones y horarios de barberos.
export function crearModuloEquipo(deps) {
 const { $, dlg, sb, S, esc, bonito, toast, ADM=['ADMINISTRADOR','SUPERVISOR'] } = deps;
async function horarios(b){
 if(!ADM.includes(S.perfil.rol))return toast('Solo administración puede modificar horarios.',true);
 const{data,error}=await sb.from('horarios_barbero').select('*').eq('negocio_id',S.perfil.negocio_id).eq('barbero_id',b.id).order('hora_inicio');
 if(error)return toast(error.message,true);
 const D=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],O=[1,2,3,4,5,6,0],hm=t=>String(t).slice(0,5),nuevo=!(data||[]).length;
 const T=(n,v,l)=>`<input type="time" name="${n}" value="${v}" aria-label="${l}">`;
 const dia=d=>{const R=(data||[]).filter(y=>y.dia_semana===d),m=R[0],t=R[1],on=R.length>0||(nuevo&&d>=1&&d<=6),
  mv=m?[hm(m.hora_inicio),hm(m.hora_fin)]:['08:40','12:00'],tv=t?[hm(t.hora_inicio),hm(t.hora_fin)]:(R.length?['','']:['14:00','19:00']);
  return `<div class="hd"><label class="chk"><input type="checkbox" name="o${d}"${on?' checked':''}>${D[d]}</label><div class="hr2"><small>Mañana</small>${T('a'+d,mv[0],'Mañana entrada '+D[d])}${T('b'+d,mv[1],'Mañana salida '+D[d])}<small>Tarde</small>${T('c'+d,tv[0],'Tarde entrada '+D[d])}${T('d'+d,tv[1],'Tarde salida '+D[d])}</div></div>`};
 dlg.innerHTML=`<form id="df"><h2>Horario de ${esc(b.nombre)}</h2><p class="mute">Marca los días que atiende. Si no trabaja en la tarde, deja esa fila vacía.</p>${O.map(dia).join('')}<button type="button" class="link" id="cl">Copiar el horario del lunes a todos los días</button><div class="acts"><button type="button" class="btn sec" id="cx">Cancelar</button><button class="btn">Guardar horario</button></div></form>`;
 $('#cx').onclick=()=>dlg.close();
 $('#cl').onclick=()=>{const el=$('#df').elements;for(const d of O)if(d!==1){for(const p of 'abcd')el[p+d].value=el[p+'1'].value;el['o'+d].checked=el.o1.checked}};
 let guardando=false;
 $('#df').onsubmit=async e=>{e.preventDefault();if(guardando)return;guardando=true;const boton=e.target.querySelector('button[type=\"submit\"],button:not([type])');if(boton)boton.disabled=true;const f=new FormData(e.target),L=[];
  for(const d of O)if(f.get('o'+d)){
   let tramos=0;
   for(const[i,j]of[['a','b'],['c','d']]){
    const x=f.get(i+d),y=f.get(j+d);
    if(Boolean(x)!==Boolean(y)){guardando=false;if(boton)boton.disabled=false;return toast('Completa la hora de entrada y salida de cada tramo.',true)}
    if(x&&y){if(x>=y){guardando=false;if(boton)boton.disabled=false;return toast('La hora de salida debe ser después de la entrada.',true)}L.push({negocio_id:S.perfil.negocio_id,barbero_id:b.id,dia_semana:d,hora_inicio:x,hora_fin:y});tramos++}
   }
   if(!tramos){guardando=false;if(boton)boton.disabled=false;return toast('Cada día marcado debe tener al menos un horario.',true)}
  }
  const{error}=await sb.rpc('guardar_horarios_barbero',{
   p_barbero_id:b.id,
   p_horarios:L.map(x=>({dia_semana:x.dia_semana,hora_inicio:x.hora_inicio,hora_fin:x.hora_fin}))
  });
  if(error){guardando=false;if(boton)boton.disabled=false;return toast(error.message.includes('posterior')?'La hora de salida debe ser después de la entrada.':error.message,true)}
  dlg.close();toast('Horario guardado')};
}


async function miPerfil(){
 const main=$('#main'),barberoId=S.perfil.barbero_id;
 if(S.perfil.rol!=='BARBERO'||!barberoId)return main.innerHTML='<div class="head"><h2>Mi perfil</h2></div><p class="empty">Tu usuario no está vinculado a un registro de barbero. Solicita a la administración que lo configure.</p>';
 const{data:b,error}=await sb.from('barberos').select('id,nombre,telefono,correo,fecha_ingreso,modelo_pago,porcentaje_comision,foto_url,observaciones').eq('negocio_id',S.perfil.negocio_id).eq('id',barberoId).maybeSingle();
 if(error)return toast('No fue posible cargar tu perfil: '+error.message,true);
 if(!b)return main.innerHTML='<div class="head"><h2>Mi perfil</h2></div><p class="empty">No encontramos tu ficha de barbero. Contacta a la administración.</p>';
 main.innerHTML=`<div class="head"><h2>Mi perfil</h2></div><section class="card" style="text-align:center;padding:24px"><div style="width:132px;height:132px;border-radius:50%;overflow:hidden;margin:0 auto 16px;background:var(--soft,#eee);display:grid;place-items:center">${b.foto_url?`<img src="${esc(b.foto_url)}" alt="Fotografía de ${esc(b.nombre)}" style="width:100%;height:100%;object-fit:cover">`:'<span style="font-size:48px">👤</span>'}</div><h2>${esc(b.nombre)}</h2><p class="mute">Perfil de barbero</p></section><section class="card" style="margin-top:14px">${[['Teléfono',b.telefono],['Correo',b.correo],['Fecha de ingreso',b.fecha_ingreso],['Modelo de pago',bonito(b.modelo_pago)],['Comisión por servicio',b.modelo_pago==='ALQUILER'?'No aplica':Number(b.porcentaje_comision||0)+'%'],['Observaciones',b.observaciones]].filter(x=>x[1]).map(x=>`<div class="row"><span>${esc(x[0])}</span><strong>${esc(String(x[1]))}</strong></div>`).join('')}</section>`;
}

async function equipo(){
 if(!ADM.includes(S.perfil.rol))return toast('Solo administración puede gestionar el equipo.',true);
 const{data,error}=await sb.from('perfiles').select('id,nombre,rol,estado').eq('negocio_id',S.perfil.negocio_id).order('creado_en');
 if(error)return toast(error.message,true);
 $('#eq').innerHTML=(data||[]).map(p=>`<div class="row"><span><strong>${esc(p.nombre)}</strong><br><small>${bonito(p.rol)}${p.id===S.perfil.id?', tú':''}${p.estado==='ACTIVO'?'':', inactivo'}</small></span>${p.id===S.perfil.id?'':`<button type="button" class="btn sec" data-p="${p.id}" data-e="${p.estado}">${p.estado==='ACTIVO'?'Desactivar':'Reactivar'}</button>`}</div>`).join('');
 document.querySelectorAll('[data-p]').forEach(b=>b.onclick=async()=>{if(b.disabled)return;b.disabled=true;const{error}=await sb.from('perfiles').update({estado:b.dataset.e==='ACTIVO'?'INACTIVO':'ACTIVO'}).eq('negocio_id',S.perfil.negocio_id).eq('id',b.dataset.p);if(error){b.disabled=false;return toast(error.message,true)}equipo()});
 $('#iv').onclick=invitar;
}
async function invitar(){
 if(!ADM.includes(S.perfil.rol))return toast('Solo administración puede invitar usuarios.',true);
 const{data:ba,error:errorBarberos}=await sb.from('barberos').select('id,nombre').eq('negocio_id',S.perfil.negocio_id).eq('estado','ACTIVO').order('nombre');
 if(errorBarberos)return toast(errorBarberos.message,true);
 dlg.innerHTML=`<form id="df"><h2>Invitar a alguien</h2><label for="i1">Rol</label><select id="i1"><option value="BARBERO">Barbero</option><option value="SUPERVISOR">Supervisor</option><option value="ADMINISTRADOR">Administrador</option></select>
 <label for="i2">Corresponde al barbero</label><select id="i2"><option value="">Ninguno</option>${(ba||[]).map(b=>`<option value="${b.id}">${esc(b.nombre)}</option>`).join('')}</select>
 <div class="acts"><button type="button" class="btn sec" id="cx">Cancelar</button><button class="btn">Crear invitación</button></div></form>`;
 dlg.showModal();$('#cx').onclick=()=>dlg.close();
 let creando=false;
 $('#df').onsubmit=async e=>{e.preventDefault();if(creando)return;creando=true;const boton=e.target.querySelector('button[type="submit"],button:not([type])');if(boton)boton.disabled=true;
  const{data,error}=await sb.from('invitaciones').insert({negocio_id:S.perfil.negocio_id,rol:$('#i1').value,barbero_id:$('#i2').value||null}).select('codigo').single();
  if(error){creando=false;if(boton)boton.disabled=false;return toast(error.message,true)}
  const url=location.origin+location.pathname.replace(/[^/]*$/,''),msg=`Te invitaron a ${S.negocio.nombre}. 1) Entra a ${url} 2) Toca “Soy nuevo, crear cuenta” 3) Cuando te lo pida, escribe este código: ${data.codigo} (vence en 7 días)`;
  dlg.innerHTML=`<h2>Invitación lista</h2><p>Código: <strong>${data.codigo}</strong></p><p class="mute">Vence en 7 días y solo sirve una vez.</p><a class="btn block" style="display:block;text-align:center;text-decoration:none;background:#1F7A4D" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">Enviar por WhatsApp</a><div class="acts"><button type="button" class="btn sec" id="cx">Cerrar</button></div>`;
  $('#cx').onclick=()=>dlg.close()};
}


 return { horarios, equipo, miPerfil };
}
