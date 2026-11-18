// Módulo de ventas, detalle y registro de pagos.
export function crearModuloVentas(deps) {
 const { $, dlg, sb, S, esc, dinero, hora, bonito, traducir, toast, ADM, METODOS } = deps;
async function ventas(){
 const{data,error}=await mio(sb.from('ventas').select('*,clientes(nombre),barberos(nombre)')).order('fecha_hora',{ascending:false}).limit(40);
 if(error)return toast(error.message,true);
 $('#main').innerHTML=`<div class="head"><h2>Ventas</h2><button class="btn" id="nv">Nueva venta</button></div>
 ${data.length?data.map(v=>`<button class="row" data-id="${v.id}"><span><strong>${esc(v.clientes?.nombre||'Cliente de paso')}</strong><br><small>${new Date(v.fecha_hora).toLocaleString('es-CO',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}, ${dinero(v.total_venta)}${v.saldo_pendiente>0&&v.estado_venta!=='ANULADA'?', debe '+dinero(v.saldo_pendiente):''}</small></span><span class="chip ${v.estado_venta}">${bonito(v.estado_venta)}</span></button>`).join(''):'<p class="empty">Aún no hay ventas. Toca “Nueva venta” para cobrar la primera.</p>'}`;
 $('#nv').onclick=nuevaVenta;
 document.querySelectorAll('.row').forEach(b=>b.onclick=()=>detalleVenta(data.find(v=>v.id===b.dataset.id)));
}
async function nuevaVenta(pre){
 const[cl,ba,se,pr,cu]=await Promise.all([['clientes','id,nombre'],['barberos','id,nombre,modelo_pago,porcentaje_comision'],['servicios','id,nombre,precio'],['productos','id,nombre,precio_venta,costo_unitario'],['cuentas','id,nombre,detalle']].map(([t,s])=>sb.from(t).select(s).eq('estado','ACTIVO').order('nombre').then(r=>r.data||[])));
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
 const calc=()=>{const L=[...document.querySelectorAll('#lns .ln')].map(l=>({i:items.find(x=>x.k===l.querySelector('select').value),q:Math.max(1,Number(l.querySelector('input').value)||1)}));const br=L.reduce((s,l)=>s+l.i.p*l.q,0),ds=Number($('#v3').value)||0;return{L,ds,t:br-ds}};
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
 $('#df').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target)),c=calc(),PG=pagos(),pago=PG.reduce((s,x)=>s+x.v,0);
  if(c.t<0)return toast('El descuento no puede superar el total.',true);
  if(pago>c.t)return toast('El pago no puede superar el total.',true);
  if(pago<c.t&&!S.negocio.permitir_saldos)return toast('Esta barbería no permite saldos pendientes. Recibe el pago completo.',true);
  if(cu.length&&PG.some(x=>x.m!=='EFECTIVO'&&!x.c))return toast('Elige la cuenta donde entró cada pago que no es en efectivo.',true);
  const bar=ba.find(x=>x.id===f.barbero_id),nid=S.perfil.negocio_id;
  const{data:v,error}=await sb.from('ventas').insert({negocio_id:nid,cliente_id:f.cliente_id||null,barbero_id:f.barbero_id||null,descuento:c.ds,metodo_pago_principal:(PG.slice().sort((a,b)=>b.v-a.v)[0]?.m)||'EFECTIVO',creado_por:S.perfil.id,cita_id:pre?.cita_id||null}).select('id').single();
  if(error)return toast(traducir(error.message),true);
  const det=c.L.map(l=>{const s=l.i.k[0]==='s',id=l.i.k.slice(2),sv=s&&se.find(x=>x.id===id),pd=!s&&pr.find(x=>x.id===id);
   const com=sv&&bar&&bar.modelo_pago!=='ALQUILER'?sv.precio*l.q*Number(bar.porcentaje_comision)/100:0;
   return{negocio_id:nid,venta_id:v.id,tipo_item:s?'SERVICIO':'PRODUCTO',servicio_id:s?id:null,producto_id:s?null:id,descripcion:l.i.n,cantidad:l.q,precio_unitario:l.i.p,costo_unitario:pd?pd.costo_unitario:0,comision_generada:com}});
  let r=await sb.from('detalle_ventas').insert(det);
  if(!r.error&&PG.length)r=await sb.from('pagos').insert(PG.map(x=>({negocio_id:nid,venta_id:v.id,valor_pago:x.v,metodo_pago:x.m,cuenta_id:x.c,recibido_por:S.perfil.id})));
  if(r.error){await sb.from('ventas').delete().eq('id',v.id);return toast(r.error.message,true)}
  dlg.close();toast('Venta registrada');ventas()};
}
async function detalleVenta(v){
 const[{data:d},{data:p}]=await Promise.all([sb.from('detalle_ventas').select('*').eq('venta_id',v.id),sb.from('pagos').select('*').eq('venta_id',v.id).order('fecha_hora')]);
 const abierta=v.estado_venta==='PENDIENTE',fila=(a,b,c='')=>`<div class="ln2 ${c}"><span>${a}</span><span>${b}</span></div>`;
 dlg.innerHTML=`<form id="df"><h2>${esc(v.clientes?.nombre||'Cliente de paso')}</h2><p class="mute">${new Date(v.fecha_hora).toLocaleString('es-CO',{dateStyle:'medium',timeStyle:'short'})}${v.barberos?', '+esc(v.barberos.nombre):''}</p>
 ${d.map(x=>fila(x.cantidad+' × '+esc(x.descripcion),dinero(x.subtotal))).join('')}
 ${v.descuento>0?fila('Descuento','-'+dinero(v.descuento)):''}
 ${fila('Total',dinero(v.total_venta),'tot')}${fila('Pagado',dinero(v.total_pagado))}${fila('Saldo',dinero(v.saldo_pendiente))}
 ${p.length?'<label>Pagos</label>'+p.map(x=>fila(bonito(x.metodo_pago)+', '+hora(x.fecha_hora),dinero(x.valor_pago))).join(''):''}
 ${abierta?`<label for="pg">Registrar otro pago</label><div class="ln"><input id="pg" type="number" min="1" inputmode="decimal" value="${v.saldo_pendiente}"><select id="mp" aria-label="Método">${METODOS}</select></div><button type="button" class="btn block" id="rp">Registrar pago</button>`:''}
 ${ADM.includes(S.perfil.rol)&&v.estado_venta!=='ANULADA'?'<button type="button" class="btn sec block" id="an">Anular venta</button>':''}
 <div class="acts"><button type="button" class="btn sec" id="cx">Cerrar</button></div></form>`;
 dlg.showModal();$('#cx').onclick=()=>dlg.close();
 if(abierta)$('#rp').onclick=async()=>{const n=Number($('#pg').value);
  if(!(n>0)||n>v.saldo_pendiente)return toast('El pago debe ser mayor a cero y no superar el saldo.',true);
  const{error}=await sb.from('pagos').insert({negocio_id:S.perfil.negocio_id,venta_id:v.id,valor_pago:n,metodo_pago:$('#mp').value,recibido_por:S.perfil.id});
  if(error)return toast(error.message,true);dlg.close();toast('Pago registrado');ventas()};
 const an=$('#an');if(an)an.onclick=async()=>{if(!confirm('¿Anular esta venta? No se puede deshacer.'))return;
  const{error}=await sb.from('ventas').update({estado_venta:'ANULADA'}).eq('id',v.id);
  if(error)return toast(error.message,true);dlg.close();toast('Venta anulada');ventas()};
}


 return { ventas, nuevaVenta };
}
