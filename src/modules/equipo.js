// Módulo de equipo, invitaciones y horarios de barberos.
export function crearModuloEquipo(deps) {
 const { $, dlg, sb, S, esc, bonito, toast } = deps;
async function horarios(b){
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
 let guardando=false;\n $('#df').onsubmit=async e=>{e.preventDefault();if(guardando)return;guardando=true;const boton=e.target.querySelector('button[type=\"submit\"],button:not([type])');if(boton)boton.disabled=true;const f=new FormData(e.target),L=[];
  for(const d of O)if(f.get('o'+d))for(const[i,j]of[['a','b'],['c','d']]){const x=f.get(i+d),y=f.get(j+d);if(x&&y)L.push({negocio_id:S.perfil.negocio_id,barbero_id:b.id,dia_semana:d,hora_inicio:x,hora_fin:y})}
  let{error}=await sb.from('horarios_barbero').delete().eq('negocio_id',S.perfil.negocio_id).eq('barbero_id',b.id);
  if(!error&&L.length)({error}=await sb.from('horarios_barbero').insert(L));
  if(error){guardando=false;if(boton)boton.disabled=false;return toast(error.message.includes('check')?'La hora de salida debe ser después de la entrada.':error.message,true)}
  dlg.close();toast('Horario guardado')};
}


async function equipo(){
 const{data,error}=await sb.from('perfiles').select('id,nombre,rol,estado').eq('negocio_id',S.perfil.negocio_id).order('creado_en');
 if(error)return toast(error.message,true);
 $('#eq').innerHTML=(data||[]).map(p=>`<div class="row"><span><strong>${esc(p.nombre)}</strong><br><small>${bonito(p.rol)}${p.id===S.perfil.id?', tú':''}${p.estado==='ACTIVO'?'':', inactivo'}</small></span>${p.id===S.perfil.id?'':`<button type="button" class="btn sec" data-p="${p.id}" data-e="${p.estado}">${p.estado==='ACTIVO'?'Desactivar':'Reactivar'}</button>`}</div>`).join('');
 document.querySelectorAll('[data-p]').forEach(b=>b.onclick=async()=>{const{error}=await sb.from('perfiles').update({estado:b.dataset.e==='ACTIVO'?'INACTIVO':'ACTIVO'}).eq('negocio_id',S.perfil.negocio_id).eq('id',b.dataset.p);if(error)return toast(error.message,true);equipo()});
 $('#iv').onclick=invitar;
}
async function invitar(){
 const{data:ba,error:errorBarberos}=await sb.from('barberos').select('id,nombre').eq('negocio_id',S.perfil.negocio_id).eq('estado','ACTIVO').order('nombre');
 if(errorBarberos)return toast(errorBarberos.message,true);
 dlg.innerHTML=`<form id="df"><h2>Invitar a alguien</h2><label for="i1">Rol</label><select id="i1"><option value="BARBERO">Barbero</option><option value="SUPERVISOR">Supervisor</option><option value="ADMINISTRADOR">Administrador</option></select>
 <label for="i2">Corresponde al barbero</label><select id="i2"><option value="">Ninguno</option>${(ba||[]).map(b=>`<option value="${b.id}">${esc(b.nombre)}</option>`).join('')}</select>
 <div class="acts"><button type="button" class="btn sec" id="cx">Cancelar</button><button class="btn">Crear invitación</button></div></form>`;
 dlg.showModal();$('#cx').onclick=()=>dlg.close();
 $('#df').onsubmit=async e=>{e.preventDefault();
  const{data,error}=await sb.from('invitaciones').insert({negocio_id:S.perfil.negocio_id,rol:$('#i1').value,barbero_id:$('#i2').value||null}).select('codigo').single();
  if(error)return toast(error.message,true);
  const url=location.origin+location.pathname.replace(/[^/]*$/,''),msg=`Te invitaron a ${S.negocio.nombre}. 1) Entra a ${url} 2) Toca “Soy nuevo, crear cuenta” 3) Cuando te lo pida, escribe este código: ${data.codigo} (vence en 7 días)`;
  dlg.innerHTML=`<h2>Invitación lista</h2><p>Código: <strong>${data.codigo}</strong></p><p class="mute">Vence en 7 días y solo sirve una vez.</p><a class="btn block" style="display:block;text-align:center;text-decoration:none;background:#1F7A4D" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">Enviar por WhatsApp</a><div class="acts"><button type="button" class="btn sec" id="cx">Cerrar</button></div>`;
  $('#cx').onclick=()=>dlg.close()};
}


 return { horarios, equipo };
}
