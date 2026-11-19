// Módulo de ventas, detalle y registro de pagos.
export function crearModuloVentas(deps) {
 const { $, dlg, sb, S, esc, dinero, hora, bonito, traducir, toast, ADM, METODOS, mio } = deps;
async function ventas(){
 const{data,error}=await mio(sb.from('ventas').select('*,clientes(nombre),barberos(nombre)')).order('fecha_hora',{ascending:false}).limit(40);
 if(error)return toast(error.message,true);
 $('#main').innerHTML=`<div class="head"><h2>Ventas</h2><button class="btn" id="nv">Nueva venta</button></div>
 ${data.length?data.map(v=>`<button class="row" data-id="${v.id}"><span><strong>${esc(v.clientes?.nombre||'Cliente de paso')}</strong><br><small>${new Date(v.fecha_hora).toLocaleString('es-CO',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}, ${dinero(v.total_venta)}${v.saldo_pendiente>0&&v.estado_venta!=='ANULADA'?', debe '+dinero(v.saldo_pendiente):''}</small></span><span class="chip ${v.estado_venta}">${bonito(v.estado_venta)}</span></button>`).join(''):'<p class="empty">Aún no hay ventas. Toca “Nueva venta” para cobrar la primera.</p>'}`;
 $('#nv').onclick=nuevaVenta;
 document.querySelectorAll('.row').forEach(b=>b.onclick=()=>detalleVenta(data.find(v=>v.id===b.dataset.id)));
}
async function nuevaVenta(pre){
 const{data:cajaInicial,error:errorCajaInicial}=await sb.from('cajas').select('id').eq('negocio_id',S.perfil.negocio_id).eq('estado_caja','ABIERTA').maybeSingle();
 if(errorCajaInicial)return toast(traducir(errorCajaInicial.message),true);
 if(!cajaInicial?.id)return toast('Para registrar una venta, primero abre la caja.',true);
 const respuestas=await Promise.all([['clientes','id,nombre'],['barberos','id,nombre,modelo_pago,porcentaje_comision'],['servicios','id,nombre,precio,categoria'],['productos','id,nombre,precio_venta,costo_unitario'],['cuentas','id,nombre,detalle']].map(([t,campos])=>sb.from(t).select(campos).eq('negocio_id',S.perfil.negocio_id).eq('estado','ACTIVO').order('nombre')));
 const fallo=respuestas.find(r=>r.error);if(fallo)return toast(traducir(fallo.error.message),true);
 const[cl,ba,se,pr,cu]=respuestas.map(r=>r.data||[]);
 if(!se.length&&!pr.length)return toast('Primero crea un servicio o un producto.',true);
 const items=[...se.map(x=>({k:'s:'+x.id,n:x.nombre,p:Number(x.precio)})),...pr.map(x=>({k:'p:'+x.id,n:x.nombre,p:Number(x.precio_venta)}))];
 const op=a=>a.map(o=>`<option value="${o.id}">${esc(o.nombre)}</option>`).join('');
 const lin=()=>`<div class="ln"><select aria-label="Ítem">${items.map(i=>`<option value="${i.k}">${esc(i.n)}, ${dinero(i.p)}</option>`).join('')}</select><input type="number" min="1" value="1" inputmode="numeric" aria-label="Cantidad"></div>`;
 const pl=()=>`<div class="ln"><select aria-label="Método de pago">${METODOS}</select><input type="number" min="0" inputmode="decimal" aria-label="Valor recibido"><select class="cu" hidden style="grid-column:1/-1" aria-label="Cuenta donde entró el pago"><option value="">Elige la cuenta donde entró</option>${cu.map(x=>`<option value="${x.id}">${esc(x.nombre)}${x.detalle?' ('+esc(x.detalle)+')':''}</option>`).join('')}</select></div>`;
 dlg.innerHTML=`<form id="df"><h2>Nueva venta</h2>
 <label for="v1">Cliente</label><select id="v1" name="cliente_id"><option value="">Cliente de paso</option>${op(cl)}</select>
 <label for="v2">Barbero</label><select id="v2" name="barbero_id"><option value="">Sin barbero</option>${op(ba)}</select>
 <label>Servicios y productos</label><div id="lns">${lin()}</div><button type="button" class="link" id="ad">Agregar otro ítem</button>
 <label for="v3">Descuento</label><input id="v3" name="descuento" type="number" min="0" value="0" inputmode="decimal">
 <p class="tot" id="tt"></p>
 <label>Pagos recibidos</label><div id="pgs">${pl()}</div><button type="button" class="link" id="ap">Agregar otro método de pago</button><p class="mute" id="fl"></p>
 <div class="acts"><button type="button" class="btn sec" id="cx">Cancelar</button><button class="btn">Cobrar</button></div></form>`;
 dlg.showModal();$('#cx').onclick=()=>dlg.close();
 const calc=()=>{const L=[...document.querySelectorAll('#lns .ln')].map(l=>({i:items.find(x=>x.k===l.querySelector('select').value),q:Number(l.querySelector('input').value)}));const br=L.reduce((s,l)=>s+(l.i?l.i.p*l.q:NaN),0),ds=Number($('#v3').value);return{L,br,ds,t:br-ds}};
 const pagos=()=>[...document.querySelectorAll('#pgs .ln')].map(l=>({m:l.querySelector('select').value,v:Number(l.querySelector('input').value)||0,c:l.querySelector('.cu').value||null})).filter(x=>x.v>0);
 $('#pgs').onchange=e=>{if(e.target.tagName==='SELECT'&&!e.target.classList.contains('cu'))e.target.closest('.ln').querySelector('.cu').hidden=e.target.value==='EFECTIVO'||!cu.length};
 const ref=()=>{const c=calc(),f=$('#pgs .ln input');$('#tt').textContent='Total: '+dinero(c.t);
  if(!f.dataset.m&&document.querySelectorAll('#pgs .ln').length===1)f.value=Math.max(0,c.t);
  const rec=pagos().reduce((s,x)=>s+x.v,0);$('#fl').textContent=rec<c.t?'Falta por cobrar: '+dinero(c.t-rec):rec>c.t?'Sobran '+dinero(rec-c.t):'Pago completo'};
 $('#pgs').oninput=e=>{if(e.target.tagName==='INPUT')e.target.dataset.m=1};
 $('#df').oninput=ref;$('#df').onchange=ref;
 $('#ad').onclick=()=>{$('#lns').insertAdjacentHTML('beforeend',lin());ref()};
 $('#ap').onclick=()=>{const rec=pagos().reduce((s,x)=>s+x.v,0);$('#pgs').insertAdjacentHTML('beforeend',pl());$('#pgs .ln:last-child input').value=Math.max(0,calc().t-rec)||'';ref()};ref();
 if(pre){$('#v1').value=pre.cliente_id||'';$('#v2').value=pre.barbero_id||'';const ls=()=>document.querySelectorAll('#lns .ln select');ls()[0].value='s:'+pre.servicio_id;if(pre.fee){$('#ad').click();ls()[1].value='s:'+pre.fee}ref()}
 let guardando=false;
 $('#df').onsubmit=async e=>{e.preventDefault();if(guardando)return;const boton=e.target.querySelector('button[type="submit"],button:not([type])');if(boton)boton.disabled=true;guardando=true;const f=Object.fromEntries(new FormData(e.target)),c=calc(),PG=pagos(),pago=PG.reduce((s,x)=>s+x.v,0),valoresPago=[...document.querySelectorAll('#pgs .ln input')].map(x=>Number(x.value));
  if(!c.L.length||c.L.some(l=>!l.i||!Number.isFinite(l.q)||l.q<=0||!Number.isFinite(l.i.p)||l.i.p<0)||!Number.isFinite(c.t)||!Number.isFinite(c.ds)||valoresPago.some(x=>!Number.isFinite(x)||x<0)||!Number.isFinite(pago)){guardando=false;if(boton)boton.disabled=false;return toast('Revisa las cantidades, precios y valores de pago. Deben ser números válidos y no negativos.',true)}
  if(c.ds<0||c.ds>c.L.reduce((s,l)=>s+l.i.p*l.q,0)){guardando=false;if(boton)boton.disabled=false;return toast('El descuento debe estar entre cero y el subtotal.',true)}
  if(pago>c.t){guardando=false;if(boton)boton.disabled=false;return toast('El pago no puede superar el total.',true)}
  if(pago<c.t&&!S.negocio.permitir_saldos){guardando=false;if(boton)boton.disabled=false;return toast('Esta barbería no permite saldos pendientes. Recibe el pago completo.',true)}
  if(cu.length&&PG.some(x=>x.m!=='EFECTIVO'&&!x.c)){guardando=false;if(boton)boton.disabled=false;return toast('Elige la cuenta donde entró cada pago que no es en efectivo.',true)}
  const{data:cajaActual,error:errorCajaActual}=await sb.from('cajas').select('id').eq('negocio_id',S.perfil.negocio_id).eq('estado_caja','ABIERTA').maybeSingle();
  if(errorCajaActual){guardando=false;if(boton)boton.disabled=false;return toast(traducir(errorCajaActual.message),true)}
  if(!cajaActual?.id){guardando=false;if(boton)boton.disabled=false;return toast('La caja se cerró. Abre una caja para registrar la venta.',true)}
  const bar=ba.find(x=>x.id===f.barbero_id),nid=S.perfil.negocio_id;
  const{data:v,error}=await sb.from('ventas').insert({negocio_id:nid,cliente_id:f.cliente_id||null,barbero_id:f.barbero_id||null,descuento:c.ds,metodo_pago_principal:(PG.slice().sort((a,b)=>b.v-a.v)[0]?.m)||'EFECTIVO',creado_por:S.perfil.id,cita_id:pre?.cita_id||null}).select('id').single();
  if(error){guardando=false;if(boton)boton.disabled=false;return toast(traducir(error.message),true)}
  const redondear=n=>Math.round((n+Number.EPSILON)*100)/100;
  const det=c.L.map(l=>{const s=l.i.k[0]==='s',id=l.i.k.slice(2),sv=s&&se.find(x=>x.id===id),pd=!s&&pr.find(x=>x.id===id);
   const elegible=!!(sv&&sv.categoria!=='CITA'&&bar&&bar.modelo_pago!=='ALQUILER'),porcentaje=s?(elegible?Number(bar.porcentaje_comision)||0:0):null;
   const brutoLinea=l.i.p*l.q,base=elegible?Math.max(0,redondear(brutoLinea-(c.br>0?c.ds*brutoLinea/c.br:0))):0;
   const com=elegible?redondear(base*porcentaje/100):0;
   return{negocio_id:nid,venta_id:v.id,tipo_item:s?'SERVICIO':'PRODUCTO',servicio_id:s?id:null,producto_id:s?null:id,descripcion:l.i.n,cantidad:l.q,precio_unitario:l.i.p,costo_unitario:pd?pd.costo_unitario:0,comision_generada:com,porcentaje_comision_aplicado:porcentaje,base_comision:base}});
  let r=await sb.from('detalle_ventas').insert(det);
  if(!r.error&&PG.length)r=await sb.from('pagos').insert(PG.map(x=>({negocio_id:nid,venta_id:v.id,valor_pago:x.v,metodo_pago:x.m,cuenta_id:x.c,recibido_por:S.perfil.id})));
  if(r.error){const rollback=await sb.from('ventas').delete().eq('negocio_id',nid).eq('id',v.id);guardando=false;if(boton)boton.disabled=false;return toast(rollback.error?'No se completó la venta y tampoco pudo revertirse automáticamente: '+r.error.message+' / '+rollback.error.message:'No se completó la venta; se revirtió el registro inicial. '+r.error.message,true)}
  dlg.close();toast('Venta registrada');ventas()};
}
async function editarVenta(v, actuales){
 if(!ADM.includes(S.perfil.rol))return toast('Solo administración puede editar ventas.',true);
 if(v.estado_venta==='ANULADA')return toast('No se puede editar una venta anulada.',true);
 const respuestas=await Promise.all([
  sb.from('clientes').select('id,nombre').eq('negocio_id',S.perfil.negocio_id).order('nombre'),
  sb.from('barberos').select('id,nombre,modelo_pago,porcentaje_comision').eq('negocio_id',S.perfil.negocio_id).order('nombre'),
  sb.from('servicios').select('id,nombre,precio,categoria').eq('negocio_id',S.perfil.negocio_id).order('nombre'),
  sb.from('productos').select('id,nombre,precio_venta,costo_unitario').eq('negocio_id',S.perfil.negocio_id).order('nombre')
 ]);
 const fallo=respuestas.find(r=>r.error);if(fallo)return toast(traducir(fallo.error.message),true);
 const[cl,ba,se,pr]=respuestas.map(r=>r.data||[]);
 const items=[...se.map(x=>({k:'s:'+x.id,n:x.nombre,p:Number(x.precio)})),...pr.map(x=>({k:'p:'+x.id,n:x.nombre,p:Number(x.precio_venta)}))];
 (actuales||[]).forEach(x=>{
  const k=x.tipo_item==='SERVICIO'?'s:'+x.servicio_id:'p:'+x.producto_id;
  if(!items.some(i=>i.k===k))items.push({k,n:x.descripcion||'Ítem anterior',p:Number(x.precio_unitario)||0});
 });
 if(!items.length)return toast('No hay servicios ni productos disponibles para editar.',true);
 const op=(a,id)=>a.map(o=>'<option value="'+o.id+'"'+(o.id===id?' selected':'')+'>'+esc(o.nombre)+'</option>').join('');
 const lin=x=>{
  const k=x?(x.tipo_item==='SERVICIO'?'s:'+x.servicio_id:'p:'+x.producto_id):items[0].k;
  const item=items.find(i=>i.k===k)||items[0];
  return '<div class="ln edit-ln" style="grid-template-columns:minmax(0,1fr) 68px 100px 34px;align-items:center">'+
   '<select aria-label="Servicio o producto">'+items.map(i=>'<option value="'+esc(i.k)+'"'+(i.k===item.k?' selected':'')+'>'+esc(i.n)+'</option>').join('')+'</select>'+
   '<input type="number" min="0.01" step="0.01" value="'+(x?x.cantidad:1)+'" aria-label="Cantidad">'+
   '<input type="number" min="0" step="0.01" value="'+(x?x.precio_unitario:item.p)+'" aria-label="Precio unitario">'+
   '<button type="button" class="btn sec rm" aria-label="Quitar ítem">×</button></div>';
 };
 dlg.innerHTML='<form id="df"><h2>Editar venta</h2>'+
  '<label for="ev1">Cliente</label><select id="ev1"><option value="">Cliente de paso</option>'+op(cl,v.cliente_id)+'</select>'+
  '<label for="ev2">Barbero</label><select id="ev2"><option value="">Sin barbero</option>'+op(ba,v.barbero_id)+'</select>'+
  '<label>Servicios y productos</label><div id="evln">'+(actuales||[]).map(lin).join('')+'</div>'+
  '<button type="button" class="link" id="evadd">Agregar otro ítem</button>'+
  '<label for="evds">Descuento</label><input id="evds" type="number" min="0" step="0.01" value="'+Number(v.descuento||0)+'">'+
  '<p class="tot" id="evtotal"></p><p class="mute">Pagos ya recibidos: '+dinero(v.total_pagado)+' (se conservarán).</p><p class="mute" id="evsaldo"></p>'+
  '<div class="acts"><button type="button" class="btn sec" id="cx">Cancelar</button><button class="btn">Guardar cambios</button></div></form>';
 dlg.showModal();$('#cx').onclick=()=>dlg.close();
 const leer=()=>[...document.querySelectorAll('#evln .edit-ln')].map(l=>{
  const i=items.find(x=>x.k===l.querySelector('select').value);
  return{i,q:Number(l.querySelectorAll('input')[0].value),p:Number(l.querySelectorAll('input')[1].value)};
 });
 const calc=()=>{const L=leer(),br=L.reduce((s,x)=>s+(x.i?x.q*x.p:NaN),0),ds=Number($('#evds').value);return{L,br,ds,total:br-ds}};
 const ref=()=>{const c=calc();$('#evtotal').textContent='Nuevo total: '+dinero(c.total);$('#evsaldo').textContent='Saldo después de los cambios: '+dinero(c.total-Number(v.total_pagado||0))};
 $('#evln').onclick=e=>{if(e.target.classList.contains('rm')){e.target.closest('.edit-ln').remove();ref()}};
 $('#evln').onchange=e=>{if(e.target.tagName==='SELECT'){const i=items.find(x=>x.k===e.target.value);if(i)e.target.closest('.edit-ln').querySelectorAll('input')[1].value=i.p;ref()}};
 $('#evln').oninput=ref;$('#evds').oninput=ref;
 $('#evadd').onclick=()=>{$('#evln').insertAdjacentHTML('beforeend',lin(null));ref()};
 let guardando=false;
 $('#df').onsubmit=async e=>{
  e.preventDefault();if(guardando)return;
  const c=calc(),b=e.target.querySelector('button[type="submit"],button:not([type])');
  if(!c.L.length||c.L.some(x=>!x.i||!Number.isFinite(x.q)||x.q<=0||!Number.isFinite(x.p)||x.p<0)||!Number.isFinite(c.br)||!Number.isFinite(c.ds)||c.ds<0||c.ds>c.br){
   return toast('Revisa los ítems, cantidades, precios y descuento. Todos deben ser válidos y no negativos.',true);
  }
  if(c.total<Number(v.total_pagado||0))return toast('El nuevo total no puede ser inferior a los pagos ya recibidos.',true);
  const detalles=c.L.map(x=>({tipo_item:x.i.k.startsWith('s:')?'SERVICIO':'PRODUCTO',servicio_id:x.i.k.startsWith('s:')?x.i.k.slice(2):null,producto_id:x.i.k.startsWith('p:')?x.i.k.slice(2):null,cantidad:x.q,precio_unitario:x.p}));
  guardando=true;if(b)b.disabled=true;
  const{error}=await sb.rpc('editar_venta',{p_venta_id:v.id,p_cliente_id:$('#ev1').value||null,p_barbero_id:$('#ev2').value||null,p_descuento:c.ds,p_detalles:detalles});
  if(error){guardando=false;if(b)b.disabled=false;return toast(traducir(error.message),true)}
  dlg.close();toast('Venta actualizada');ventas();
 };
 ref();
}

async function detalleVenta(v){
 const[rd,rp]=await Promise.all([sb.from('detalle_ventas').select('*').eq('negocio_id',S.perfil.negocio_id).eq('venta_id',v.id),sb.from('pagos').select('*').eq('negocio_id',S.perfil.negocio_id).eq('venta_id',v.id).order('fecha_hora')]);
 if(rd.error)return toast(traducir(rd.error.message),true);if(rp.error)return toast(traducir(rp.error.message),true);
 const d=rd.data||[],p=rp.data||[];
 const admin=ADM.includes(S.perfil.rol),abierta=v.estado_venta==='PENDIENTE'&&admin,fila=(a,b,c='')=>`<div class="ln2 ${c}"><span>${a}</span><span>${b}</span></div>`;
 dlg.innerHTML=`<form id="df"><h2>${esc(v.clientes?.nombre||'Cliente de paso')}</h2><p class="mute">${new Date(v.fecha_hora).toLocaleString('es-CO',{dateStyle:'medium',timeStyle:'short'})}${v.barberos?', '+esc(v.barberos.nombre):''}</p>
 ${d.map(x=>fila(x.cantidad+' × '+esc(x.descripcion),dinero(x.subtotal))).join('')}
 ${v.descuento>0?fila('Descuento','-'+dinero(v.descuento)):''}
 ${fila('Total',dinero(v.total_venta),'tot')}${fila('Pagado',dinero(v.total_pagado))}${fila('Saldo',dinero(v.saldo_pendiente))}
 ${p.length?'<label>Pagos</label>'+p.map(x=>fila(bonito(x.metodo_pago)+', '+hora(x.fecha_hora),dinero(x.valor_pago))).join(''):''}
 ${abierta?`<label for="pg">Registrar otro pago</label><div class="ln"><input id="pg" type="number" min="1" inputmode="decimal" value="${v.saldo_pendiente}"><select id="mp" aria-label="Método">${METODOS}</select></div><button type="button" class="btn block" id="rp">Registrar pago</button>`:''}
 ${admin&&v.estado_venta!=='ANULADA'?'<button type="button" class="btn block" id="ed">Editar venta</button><button type="button" class="btn sec block" id="an">Anular venta</button>':''}
 <div class="acts"><button type="button" class="btn sec" id="cx">Cerrar</button></div></form>`;
 dlg.showModal();$('#cx').onclick=()=>dlg.close();
 if(abierta)$('#rp').onclick=async()=>{const b=$('#rp');if(b.disabled)return;const n=Number($('#pg').value);
  if(!(n>0)||n>v.saldo_pendiente)return toast('El pago debe ser mayor a cero y no superar el saldo.',true);
  b.disabled=true;
  const{error}=await sb.from('pagos').insert({negocio_id:S.perfil.negocio_id,venta_id:v.id,valor_pago:n,metodo_pago:$('#mp').value,recibido_por:S.perfil.id});
  if(error){b.disabled=false;return toast(error.message,true)}dlg.close();toast('Pago registrado');ventas()};
 const ed=$('#ed');if(ed)ed.onclick=()=>{dlg.close();editarVenta(v,d)};
 const an=$('#an');if(an)an.onclick=async()=>{const b=$('#an');if(b.disabled)return;if(!confirm('¿Anular esta venta? No se puede deshacer.'))return;b.disabled=true;
  const{error}=await sb.rpc('anular_venta',{p_venta_id:v.id});
  if(error){b.disabled=false;return toast(traducir(error.message),true)}dlg.close();toast('Venta anulada');ventas()};
}


 return { ventas, nuevaVenta, editarVenta };
}
