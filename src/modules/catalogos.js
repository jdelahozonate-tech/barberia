// Operaciones CRUD de catálogos y formularios asociados.
export function crearModuloCatalogos(deps) {
 const { $, app, dlg, sb, S, CFG, esc, bonito, traducir, toast, horarios } = deps;
 async function crud(k){
 const c=CFG[k],main=$('#main'),puede=c.w.includes(S.perfil.rol);let ver=false,q='',rows=[];
 main.innerHTML=`<div class="head"><h2>${c.t}</h2>${puede?`<button class="btn" id="nv">Nuevo ${c.uno}</button>`:''}</div>
 <input id="q" type="search" placeholder="Buscar por nombre" aria-label="Buscar por nombre"><label class="chk"><input type="checkbox" id="inac"> Mostrar inactivos</label><div id="ls">Cargando…</div>`;
 const pintar=()=>{const l=rows.filter(r=>(ver||r.estado==='ACTIVO')&&r.nombre.toLowerCase().includes(q));
  $('#ls').innerHTML=l.length?l.map(r=>{const[a,b]=c.l(r);return `<button class="row${r.estado==='ACTIVO'?'':' off'}" data-id="${r.id}"><span><strong>${esc(a)}</strong><br><small>${esc(b)}</small></span>${r.estado==='ACTIVO'?'':'<span class="chip">Inactivo</span>'}</button>`}).join(''):`<p class="empty">${rows.length?'Sin resultados.':`Aún no hay ${c.t.toLowerCase()}. ${puede?`Toca “Nuevo ${c.uno}” para crear el primero.`:''}`}</p>`;
  document.querySelectorAll('.row').forEach(b=>b.onclick=()=>puede&&formulario(k,rows.find(r=>r.id===b.dataset.id),cargarLista))};
 const cargarLista=async()=>{const{data,error}=await sb.from(k).select('*').eq('negocio_id',S.perfil.negocio_id).order('nombre');if(error)return toast(traducir(error.message),true);rows=data||[];if(k==='productos'){const{data:s,error:errorStock}=await sb.from('stock_actual').select('producto_id,existencias').eq('negocio_id',S.perfil.negocio_id);if(errorStock)return toast('No fue posible consultar las existencias: '+traducir(errorStock.message),true);const m=Object.fromEntries((s||[]).map(x=>[x.producto_id,x.existencias]));rows.forEach(r=>r.existencias=m[r.id]??0)}pintar()};
 $('#q').oninput=e=>{q=e.target.value.toLowerCase();pintar()};
 $('#inac').onchange=e=>{ver=e.target.checked;pintar()};
 if(puede)$('#nv').onclick=()=>formulario(k,null,cargarLista);
 cargarLista();
}
async function formulario(k,r,despues){
 const c=CFG[k],refs={};
 for(const[,,t]of c.f)if(t.startsWith('ref:')){const tb=t.slice(4),{data,error}=await sb.from(tb).select('id,nombre').eq('negocio_id',S.perfil.negocio_id).eq('estado','ACTIVO').order('nombre');if(error)return toast('No fue posible cargar las opciones de '+tb+': '+traducir(error.message),true);refs[tb]=data||[]}
 const campo=([n,l,t,req])=>{const v=r?r[n]??'':(n==='duracion_minutos'?30:'');const id='c_'+n;let el;
  if(t==='bool')return `<label class="chk"><input type="checkbox" name="${n}"${(r?r[n]:true)?' checked':''}> ${l}</label>`;
  if(t==='area')el=`<textarea id="${id}" name="${n}" rows="3">${esc(v)}</textarea>`;
  else if(t.startsWith('sel:'))el=`<select id="${id}" name="${n}">${t.slice(4).split(',').map(o=>`<option value="${o}"${o===v?' selected':''}>${bonito(o)}</option>`).join('')}</select>`;
  else if(t.startsWith('ref:'))el=`<select id="${id}" name="${n}"><option value="">Sin asignar</option>${refs[t.slice(4)].map(o=>`<option value="${o.id}"${o.id===v?' selected':''}>${esc(o.nombre)}</option>`).join('')}</select>`;
  else el=`<input id="${id}" name="${n}" type="${t}"${t==='number'?' step="any" min="0" inputmode="decimal"':''} value="${esc(v)}"${req?' required':''}>`;
  return `<label for="${id}">${l}</label>${el}`};
 dlg.innerHTML=`<form id="df"><h2>${r?'Editar':'Nuevo'} ${c.uno}</h2>${c.f.map(campo).join('')}<div class="acts"><button type="button" class="btn sec" id="cx">Cancelar</button><button class="btn">Guardar</button></div>${r&&k==='barberos'?'<button type="button" class="btn sec block" id="hr">Horario de atención</button>':''}${r&&k==='productos'?'<button type="button" class="btn sec block" id="st">Registrar entrada de stock</button>':''}${r?`<button type="button" class="btn sec block" id="tg">${r.estado==='ACTIVO'?'Desactivar':'Reactivar'} ${c.uno}</button>`:''}</form>`;
 dlg.showModal();
 $('#cx').onclick=()=>dlg.close();
 let guardando=false;
 $('#df').onsubmit=async e=>{e.preventDefault();if(guardando)return;guardando=true;const boton=e.target.querySelector('button[type="submit"],button:not([type])');if(boton)boton.disabled=true;const fd=new FormData(e.target),o={};
  for(const[n,,t]of c.f){const v=fd.get(n);o[n]=t==='bool'?!!v:t==='number'?(v===''?0:Number(v)):(v===''?(r?null:undefined):v)}
  const op=r?sb.from(k).update(o).eq('negocio_id',S.perfil.negocio_id).eq('id',r.id):sb.from(k).insert({...o,negocio_id:S.perfil.negocio_id});
  const{error}=await op;if(error){guardando=false;if(boton)boton.disabled=false;return toast(traducir(error.message),true)}dlg.close();toast('Guardado');despues()};
 if(r&&k==='barberos')$('#hr').onclick=()=>horarios(r);
 if(r&&k==='productos')$('#st').onclick=async()=>{const n=Number(prompt('¿Cuántas unidades entraron?'));if(!Number.isFinite(n)||n<=0)return toast('La cantidad debe ser un número válido mayor que cero.',true);const b=$('#st');if(b.disabled)return;b.disabled=true;
  const{error}=await sb.from('movimientos_inventario').insert({negocio_id:S.perfil.negocio_id,producto_id:r.id,tipo_movimiento:'ENTRADA',cantidad:n,costo_unitario:r.costo_unitario,motivo:'Compra',usuario_responsable:S.perfil.id});
  if(error){b.disabled=false;return toast(traducir(error.message),true)}dlg.close();toast('Stock actualizado');despues()};
 if(r)$('#tg').onclick=async()=>{const b=$('#tg');if(b.disabled)return;b.disabled=true;const{error}=await sb.from(k).update({estado:r.estado==='ACTIVO'?'INACTIVO':'ACTIVO'}).eq('negocio_id',S.perfil.negocio_id).eq('id',r.id);if(error){b.disabled=false;return toast(traducir(error.message),true)}dlg.close();despues()};
}


 return { crud };
}
