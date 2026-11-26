// Operaciones CRUD de catálogos y formularios asociados.
export function crearModuloCatalogos(deps) {
 const { $, app, dlg, sb, S, CFG, esc, bonito, traducir, toast, horarios } = deps;
 async function crud(k){
 const c=CFG[k],main=$('#main'),soloCrearCliente=k==='clientes'&&S.perfil.rol==='BARBERO',puede=c.w.includes(S.perfil.rol)||soloCrearCliente;let ver=false,q='',categoria='',rows=[];
 const esServicios=k==='servicios';
 main.innerHTML=soloCrearCliente?'<section class="services-shell"><header class="services-header"><div><span class="services-eyebrow">ESPACIO DEL BARBERO</span><h2>Crear cliente</h2><p>Registra a la persona que llega contigo para poder agendarle una cita.</p></div><button class="btn services-new" id="nv">＋ Nuevo cliente</button></header><div class="services-empty"><strong>Registro de clientes</strong><p>El barbero puede crear clientes nuevos. La administración conserva la gestión completa de los registros.</p></div></section>':esServicios?'<section class="services-shell"><header class="services-header"><div><span class="services-eyebrow">CATÁLOGO DEL NEGOCIO</span><h2>Servicios</h2><p>Organiza tu oferta, precios y tiempos de atención en un solo lugar.</p></div>'+(puede?'<button class="btn services-new" id="nv"><span aria-hidden="true">＋</span> Nuevo servicio</button>':'')+'</header><div class="services-stats" id="service-stats"></div><section class="services-tools"><label class="services-search" for="q"><span aria-hidden="true">⌕</span><input id="q" type="search" placeholder="Buscar servicio, categoría o descripción" aria-label="Buscar servicios"></label><label class="services-category" for="service-category">Categoría<select id="service-category"><option value="">Todas las categorías</option></select></label><label class="chk services-inactive"><input type="checkbox" id="inac"> Mostrar inactivos</label></section><div class="services-results-head"><strong id="services-count">Servicios</strong><span>Selecciona una tarjeta para ver o editar</span></div><div class="services-grid" id="ls"><p class="empty">Cargando servicios…</p></div></section>':`<div class="head"><h2>${c.t}</h2>${puede?`<button class="btn" id="nv">Nuevo ${c.uno}</button>`:''}</div>
 <input id="q" type="search" placeholder="Buscar por nombre" aria-label="Buscar por nombre"><label class="chk"><input type="checkbox" id="inac"> Mostrar inactivos</label><div id="ls">Cargando…</div>`;
 const pintar=()=>{
  if(esServicios){
   const categorias=[...new Set(rows.map(r=>(r.categoria||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
   const selector=$('#service-category'),valor=selector.value;
   if(selector.dataset.ready!=='1'){selector.innerHTML='<option value="">Todas las categorías</option>'+categorias.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');selector.dataset.ready='1';}
   else if(valor!==categoria){selector.innerHTML='<option value="">Todas las categorías</option>'+categorias.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');selector.value=categoria;}
   const activos=rows.filter(r=>r.estado==='ACTIVO'),visibles=rows.filter(r=>(ver||r.estado==='ACTIVO')&&(!q||(r.nombre+' '+(r.categoria||'')+' '+(r.descripcion||'')).toLowerCase().includes(q))&&(!categoria||(r.categoria||'')===categoria));
   $('#service-stats').innerHTML='<article class="services-stat"><span class="services-stat-icon">✂</span><div><small>Servicios registrados</small><strong>'+rows.length+'</strong></div></article><article class="services-stat"><span class="services-stat-icon active">✓</span><div><small>Servicios activos</small><strong>'+activos.length+'</strong></div></article><article class="services-stat"><span class="services-stat-icon category">▦</span><div><small>Categorías</small><strong>'+categorias.length+'</strong></div></article>';
   $('#services-count').textContent=visibles.length+' '+(visibles.length===1?'servicio':'servicios');
   $('#ls').innerHTML=visibles.length?visibles.map(r=>'<button class="service-card'+(r.estado==='ACTIVO'?'':' is-inactive')+'" data-id="'+r.id+'"><span class="service-card-top"><span class="service-category">'+esc(r.categoria||'General')+'</span>'+(r.estado==='ACTIVO'?'<span class="service-status"><i></i>Activo</span>':'<span class="service-status inactive">Inactivo</span>')+'</span><strong class="service-card-name">'+esc(r.nombre)+'</strong><span class="service-card-description">'+esc(r.descripcion||'Sin descripción')+'</span><span class="service-card-bottom"><span class="service-price">'+esc(dineroSeguro(r.precio))+'</span><span class="service-duration"><span aria-hidden="true">◷</span> '+esc(String(r.duracion_minutos??'—'))+' min</span></span><span class="service-card-action">Ver detalles <span aria-hidden="true">→</span></span></button>').join(''):'<div class="services-empty"><span aria-hidden="true">✂</span><strong>'+ (rows.length?'No encontramos servicios con esos filtros.':'Tu catálogo está listo para comenzar.')+'</strong><p>'+(rows.length?'Prueba otra búsqueda o cambia la categoría seleccionada.':(puede?'Crea tu primer servicio para que esté disponible al registrar ventas y citas.':'Aún no hay servicios registrados.'))+'</p>'+(puede&&!rows.length?'<button class="btn" id="empty-new">Crear primer servicio</button>':'')+'</div>';
   const nuevo=$('#empty-new');if(nuevo)nuevo.onclick=()=>formulario(k,null,cargarLista);
  }else{
   const l=rows.filter(r=>(ver||r.estado==='ACTIVO')&&r.nombre.toLowerCase().includes(q));
   $('#ls').innerHTML=l.length?l.map(r=>{const[a,b]=c.l(r);return `<button class="row${r.estado==='ACTIVO'?'':' off'}" data-id="${r.id}" style="${['barberos','clientes'].includes(k)?'display:flex;align-items:center;gap:12px;text-align:left;':''}">${['barberos','clientes'].includes(k)?'<span style="position:relative;flex:0 0 52px;width:52px;height:52px;border-radius:50%;overflow:hidden;background:var(--soft,#eee);display:grid;place-items:center"><span aria-hidden="true" style="font-size:23px">'+(k==='clientes'?'🙂':'👤')+'</span>'+(r.foto_url?'<img src="'+esc(r.foto_url)+'" alt="Fotografía de '+esc(r.nombre)+'" loading="lazy" onerror="this.remove()" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">':'')+'</span>':''}<span style="flex:1;min-width:0"><strong>${esc(a)}</strong><br><small>${esc(b)}</small></span>${r.estado==='ACTIVO'?'':'<span class="chip">Inactivo</span>'}</button>`}).join(''):`<p class="empty">${rows.length?'Sin resultados.':`Aún no hay ${c.t.toLowerCase()}. ${puede?`Toca “Nuevo ${c.uno}” para crear el primero.`:''}`}</p>`;
  }
  document.querySelectorAll(esServicios?'.service-card':'.row').forEach(b=>b.onclick=()=>puede&&formulario(k,rows.find(r=>r.id===b.dataset.id),cargarLista));
 };
 const dineroSeguro=n=>{try{return dinero(Number(n)||0)}catch{return String(n??'') }};
 const cargarLista=async()=>{if(soloCrearCliente)return;const{data,error}=await sb.from(k).select('*').eq('negocio_id',S.perfil.negocio_id).order('nombre');if(error)return toast(traducir(error.message),true);rows=data||[];if(k==='productos'){const{data:s,error:errorStock}=await sb.from('stock_actual').select('producto_id,existencias').eq('negocio_id',S.perfil.negocio_id);if(errorStock)return toast('No fue posible consultar las existencias: '+traducir(errorStock.message),true);const m=Object.fromEntries((s||[]).map(x=>[x.producto_id,x.existencias]));rows.forEach(r=>r.existencias=m[r.id]??0)}pintar()};
 const buscar=$('#q');if(buscar)buscar.oninput=e=>{q=e.target.value.toLowerCase().trim();pintar()};
 const inactivos=$('#inac');if(inactivos)inactivos.onchange=e=>{ver=e.target.checked;pintar()};
 if(esServicios)$('#service-category').onchange=e=>{categoria=e.target.value;pintar()};
 if(puede)$('#nv').onclick=()=>formulario(k,null,cargarLista);
 cargarLista();
}
async function formulario(k,r,despues){
 const c=CFG[k],refs={},esServicios=k==='servicios',soloCrearCliente=k==='clientes'&&S.perfil.rol==='BARBERO';
 for(const[,,t]of c.f)if(t.startsWith('ref:')){const tb=t.slice(4),{data,error}=await sb.from(tb).select('id,nombre').eq('negocio_id',S.perfil.negocio_id).eq('estado','ACTIVO').order('nombre');if(error)return toast('No fue posible cargar las opciones de '+tb+': '+traducir(error.message),true);refs[tb]=data||[]}
 const campo=([n,l,t,req])=>{const v=r?r[n]??'':(n==='duracion_minutos'?30:n==='porcentaje_comision'?65:n==='modelo_pago'?'COMISION':'');const id='c_'+n;let el;
  if(t==='bool')return `<label class="chk"><input type="checkbox" name="${n}"${(r?r[n]:true)?' checked':''}> ${l}</label>`;
  if(t==='area')el=`<textarea id="${id}" name="${n}" rows="3">${esc(v)}</textarea>`;
  else if(t.startsWith('sel:'))el=`<select id="${id}" name="${n}">${t.slice(4).split(',').map(o=>`<option value="${o}"${o===v?' selected':''}>${bonito(o)}</option>`).join('')}</select>`;
  else if(t.startsWith('ref:'))el=`<select id="${id}" name="${n}"><option value="">Sin asignar</option>${refs[t.slice(4)].map(o=>`<option value="${o.id}"${o.id===v?' selected':''}>${esc(o.nombre)}</option>`).join('')}</select>`;
  else el=`<input id="${id}" name="${n}" type="${t}"${t==='number'?' step="any" min="0"'+(n==='porcentaje_comision'?' max="100"':'')+' inputmode="decimal"':''} value="${esc(v)}"${req?' required':''}>`;
  return `<label for="${id}">${l}</label>${el}`};
 const campos=(soloCrearCliente?c.f.filter(f=>f[0]!=='barbero_preferido'):c.f).map(campo).join('');
 dlg.innerHTML=esServicios?`<form id="df" class="service-form"><header class="service-form-header"><span class="services-eyebrow">CATÁLOGO DE SERVICIOS</span><h2>${r?'Editar servicio':'Crear servicio'}</h2><p>Define cómo se presenta, cuánto cuesta y cuánto tiempo requiere.</p></header><div class="service-form-grid">${c.f.map((f,i)=>'<div class="service-form-field'+(f[0]==='descripcion'?' wide':'')+'">'+campo(f)+'</div>').join('')}</div><div class="service-form-note"><span aria-hidden="true">ⓘ</span><span>El precio y la duración se mostrarán al seleccionar este servicio en las ventas y citas.</span></div><div class="acts"><button type="button" class="btn sec" id="cx">Cancelar</button><button class="btn">${r?'Guardar cambios':'Crear servicio'}</button></div>${r?'<button type="button" class="btn sec block" id="tg">'+(r.estado==='ACTIVO'?'Desactivar servicio':'Reactivar servicio')+'</button>':''}</form>`:`<form id="df"><h2>${r?'Editar':'Nuevo'} ${c.uno}</h2>${campos}${(!soloCrearCliente&&['barberos','clientes'].includes(k))?`<label for="foto_${k}">Fotografía ${k==='clientes'?'del cliente':'del barbero'} <span class="mute">(opcional)</span></label><div class="product-photo-preview" id="foto_preview">${r?.foto_url?`<img src="${esc(r.foto_url)}" alt="Fotografía de ${esc(r.nombre)}">`:'<span>Sin fotografía</span>'}</div><input id="foto_${k}" name="foto_${k}" type="file" accept="image/jpeg,image/png,image/webp"><small class="mute">Opcional · JPG, PNG o WEBP · máximo 5 MB. Puedes guardar el registro sin adjuntar ninguna foto.</small>`:''}<div class="acts"><button type="button" class="btn sec" id="cx">Cancelar</button><button class="btn">Guardar</button></div>${r&&k==='barberos'?'<button type="button" class="btn sec block" id="hr">Horario de atención</button>':''}${r&&k==='productos'?'<button type="button" class="btn sec block" id="st">Registrar entrada de stock</button>':''}${r?`<button type="button" class="btn sec block" id="tg">${r.estado==='ACTIVO'?'Desactivar':'Reactivar'} ${c.uno}</button>`:''}</form>`;
 dlg.showModal();
 if(['barberos','clientes'].includes(k)){
  const foto=$('#foto_'+k);if(foto)foto.onchange=()=>{const f=foto.files?.[0];if(!f)return;if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>5242880){foto.value='';return toast('La fotografía debe ser JPG, PNG o WEBP y pesar máximo 5 MB.',true)}const url=URL.createObjectURL(f);$('#foto_preview').innerHTML='<img src="'+url+'" alt="Vista previa de la fotografía">'};
 }
 $('#cx').onclick=()=>dlg.close();
 let guardando=false;
 $('#df').onsubmit=async e=>{e.preventDefault();if(guardando)return;guardando=true;const boton=e.target.querySelector('button[type="submit"],button:not([type])');if(boton)boton.disabled=true;const fd=new FormData(e.target),o={};
  for(const[n,,t]of (soloCrearCliente?c.f.filter(f=>f[0]!=='barbero_preferido'):c.f)){const v=fd.get(n);o[n]=t==='bool'?!!v:t==='number'?(v===''?0:Number(v)):(v===''?(r?null:undefined):v)}
  if(soloCrearCliente)o.barbero_preferido=S.perfil.barbero_id||null;
  if(k==='barberos'&&(!Number.isFinite(o.porcentaje_comision)||o.porcentaje_comision<0||o.porcentaje_comision>100)){guardando=false;if(boton)boton.disabled=false;return toast('El porcentaje de comisión debe estar entre 0 y 100.',true)}
  const fotoSeleccionada=!soloCrearCliente&&['barberos','clientes'].includes(k)?fd.get('foto_'+k):null;
  if(fotoSeleccionada?.size&&(!['image/jpeg','image/png','image/webp'].includes(fotoSeleccionada.type)||fotoSeleccionada.size>5242880)){guardando=false;if(boton)boton.disabled=false;return toast('La fotografía debe ser JPG, PNG o WEBP y pesar máximo 5 MB.',true)}
  let barberoId=r?.id;
  if(soloCrearCliente&&o.telefono){const digitos=String(o.telefono).replace(/\D/g,'');const{data:existentes,error:errorClientes}=await sb.from('clientes').select('id,nombre,telefono').eq('negocio_id',S.perfil.negocio_id);if(errorClientes){guardando=false;if(boton)boton.disabled=false;return toast(traducir(errorClientes.message),true)}const duplicado=(existentes||[]).find(x=>String(x.telefono||'').replace(/\D/g,'')===digitos);if(duplicado){guardando=false;if(boton)boton.disabled=false;return toast('Ya existe un cliente con ese teléfono: '+duplicado.nombre,true)}}
  const op=r?sb.from(k).update(o).eq('negocio_id',S.perfil.negocio_id).eq('id',r.id):sb.from(k).insert({...o,negocio_id:S.perfil.negocio_id}).select('id').single();
  const{data,error}=await op;if(error){guardando=false;if(boton)boton.disabled=false;return toast(traducir(error.message),true)}
  if(['barberos','clientes'].includes(k)){
   const registroId=r?.id||data?.id;
   const foto=fotoSeleccionada;
   if(foto?.size){
    const ext=foto.type==='image/png'?'png':foto.type==='image/webp'?'webp':'jpg',ruta=S.perfil.negocio_id+'/'+registroId+'/'+crypto.randomUUID()+'.'+ext;
    const{error:subida}=await sb.storage.from(k==='clientes'?'clientes':'barberos').upload(ruta,foto,{contentType:foto.type,upsert:false});
    if(subida){guardando=false;dlg.close();toast((k==='clientes'?'El cliente':'Los datos')+' se guardaron, pero no se pudo subir la fotografía: '+subida.message,true);despues();return}
    const{data:publica}=sb.storage.from(k==='clientes'?'clientes':'barberos').getPublicUrl(ruta);
    const{error:fotoError}=await sb.from(k).update({foto_url:publica.publicUrl}).eq('negocio_id',S.perfil.negocio_id).eq('id',registroId);
    if(fotoError){guardando=false;if(boton)boton.disabled=false;return toast('Los datos se guardaron, pero no se pudo asociar la fotografía: '+fotoError.message,true)}
   }
  }
  dlg.close();toast('Guardado');despues()};
 if(r&&k==='barberos')$('#hr').onclick=()=>horarios(r);
 if(r&&k==='productos')$('#st').onclick=async()=>{const n=Number(prompt('¿Cuántas unidades entraron?'));if(!Number.isFinite(n)||n<=0)return toast('La cantidad debe ser un número válido mayor que cero.',true);const b=$('#st');if(b.disabled)return;b.disabled=true;
  const{error}=await sb.from('movimientos_inventario').insert({negocio_id:S.perfil.negocio_id,producto_id:r.id,tipo_movimiento:'ENTRADA',cantidad:n,costo_unitario:r.costo_unitario,motivo:'Compra',usuario_responsable:S.perfil.id});
  if(error){b.disabled=false;return toast(traducir(error.message),true)}dlg.close();toast('Stock actualizado');despues()};
 if(r)$('#tg').onclick=async()=>{const b=$('#tg');if(b.disabled)return;b.disabled=true;const{error}=await sb.from(k).update({estado:r.estado==='ACTIVO'?'INACTIVO':'ACTIVO'}).eq('negocio_id',S.perfil.negocio_id).eq('id',r.id);if(error){b.disabled=false;return toast(traducir(error.message),true)}dlg.close();despues()};
}


 return { crud };
}
