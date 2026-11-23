// Módulo de ventas, detalle y registro de pagos.
export function crearModuloVentas(deps) {
 const { $, dlg, sb, S, esc, dinero, hora, bonito, traducir, toast, ADM, METODOS, mio } = deps;
function fechaEnZona(d=new Date()){
 const zona=S.negocio?.zona_horaria||'America/Bogota';
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zona,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d).map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day;
}
function sumarFecha(fecha,dias){
 const [y,m,d]=fecha.split('-').map(Number),x=new Date(Date.UTC(y,m-1,d+dias));
 return x.getUTCFullYear()+'-'+String(x.getUTCMonth()+1).padStart(2,'0')+'-'+String(x.getUTCDate()).padStart(2,'0');
}
function instanteZona(local){
 const [y,m,d,h,mi]=local.match(/\d+/g).map(Number),zona=S.negocio?.zona_horaria||'America/Bogota';
 let ms=Date.UTC(y,m-1,d,h,mi);
 for(let n=0;n<3;n++){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zona,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms)).map(x=>[x.type,x.value]));
  const real=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute),diff=Date.UTC(y,m-1,d,h,mi)-real;
  if(!diff)break;ms+=diff;
 }
 return new Date(ms).toISOString();
}
function rangoVentas(filtro,desde,hasta){
 const hoy=fechaEnZona(),mes=hoy.slice(0,7);
 let a=hoy,b=sumarFecha(hoy,1);
 if(filtro==='SEMANA'){
  const dia=new Date(hoy+'T12:00:00Z').getUTCDay();
  a=sumarFecha(hoy,-((dia+6)%7));b=sumarFecha(a,7);
 }else if(filtro==='MES'){
  a=mes+'-01';const [y,m]=mes.split('-').map(Number);b=new Date(Date.UTC(y,m,1)).toISOString().slice(0,10);
 }else if(filtro==='PERSONALIZADO'){
  a=desde||hoy;b=sumarFecha(hasta||desde||hoy,1);
 }
 return {desde:instanteZona(a+'T00:00'),hasta:instanteZona(b+'T00:00'),a,b};
}
async function ventas(){
 const filtro=S.filtroVentas||'HOY',desde=S.ventasDesde||fechaEnZona(),hasta=S.ventasHasta||desde;
 const rango=rangoVentas(filtro,desde,hasta);
 const[{data,error},{data:citas,error:errorCitas}]=await Promise.all([
  mio(sb.from('ventas').select('*,clientes(nombre,telefono),barberos(nombre)').eq('negocio_id',S.perfil.negocio_id).gte('fecha_hora',rango.desde).lt('fecha_hora',rango.hasta).order('fecha_hora',{ascending:false}).limit(500)),
  mio(sb.from('citas').select('id,cliente_id,barbero_id,servicio_id,inicio,fin,estado,clientes(nombre),barberos(nombre),servicios(nombre,precio)').eq('negocio_id',S.perfil.negocio_id).in('estado',['PENDIENTE','CONFIRMADA','ATENDIDA']).order('inicio',{ascending:false}).limit(100))
 ]);
 if(error)return toast(traducir(error.message),true);
 if(errorCitas)return toast(traducir(errorCitas.message),true);
 const ids=(citas||[]).map(c=>c.id),cobradas=new Set();
 if(ids.length){
  const{data:rel,error:errorRel}=await sb.from('ventas').select('cita_id,estado_venta').eq('negocio_id',S.perfil.negocio_id).neq('estado_venta','ANULADA').in('cita_id',ids);
  if(errorRel)return toast(traducir(errorRel.message),true);
  (rel||[]).forEach(x=>cobradas.add(x.cita_id));
 }
 const pendientes=(citas||[]).filter(c=>!cobradas.has(c.id)&&(c.estado==='ATENDIDA'||new Date(c.fin)<=new Date()));
 const ventaIds=(data||[]).map(v=>v.id),detallesPorVenta={};
 if(ventaIds.length){
  const{data:detalles,error:errorDetalles}=await sb.from('detalle_ventas').select('venta_id,descripcion,cantidad,tipo_item').eq('negocio_id',S.perfil.negocio_id).in('venta_id',ventaIds);
  if(errorDetalles)return toast(traducir(errorDetalles.message),true);
  (detalles||[]).forEach(x=>(detallesPorVenta[x.venta_id]??=[]).push(x));
 }
 const tipoVenta=v=>{
  const tipos=new Set((detallesPorVenta[v.id]||[]).map(x=>String(x.tipo_item||'').toUpperCase()));
  const p=tipos.has('PRODUCTO'),s=tipos.has('SERVICIO')||tipos.has('SERVICIOS');
  return p&&s?'MIXTA':p?'PRODUCTOS':s?'SERVICIOS':'OTRA';
 };
 const tipoFiltro=S.filtroTipoVenta||'TODOS';
 const ventasFiltradas=(data||[]).filter(v=>tipoFiltro==='TODOS'||tipoVenta(v)===tipoFiltro);
 const etiquetasTipo={PRODUCTOS:'Productos',SERVICIOS:'Servicios',MIXTA:'Mixta',OTRA:'Sin clasificar'};
 const coloresTipo={PRODUCTOS:'background:#e8f5ec;color:#176b36;border:1px solid #b9e1c5',SERVICIOS:'background:#eaf1ff;color:#2454a6;border:1px solid #c5d6fb',MIXTA:'background:#fff3df;color:#8a5200;border:1px solid #f0d4a3',OTRA:'background:#f1f2f4;color:#555;border:1px solid #ddd'};
 const activa=k=>filtro===k?'':'sec';
 $('#main').innerHTML=`<div class="head"><h2>Ventas</h2><button class="btn" id="nv">Nueva venta</button></div>
 <div class="product-tabs"><button class="btn sec" id="vp">Venta de productos</button><button class="btn sec" id="vs">Venta de servicios</button><button class="btn sec" id="vm">Venta mixta</button></div>
 <section><h3>Filtros</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;align-items:end;max-width:680px">
 <label for="filtro-periodo" style="display:grid;gap:5px">Período
 <select id="filtro-periodo" style="width:100%;min-width:0;padding:10px;border:1px solid var(--borde,#ccc);border-radius:8px;background:var(--panel,#fff);color:inherit">
 <option value="HOY" data-filtro-ventas="HOY" ${filtro==='HOY'?'selected':''}>Hoy</option><option value="SEMANA" data-filtro-ventas="SEMANA" ${filtro==='SEMANA'?'selected':''}>Esta semana</option><option value="MES" data-filtro-ventas="MES" ${filtro==='MES'?'selected':''}>Este mes</option><option value="PERSONALIZADO" data-filtro-ventas="PERSONALIZADO" ${filtro==='PERSONALIZADO'?'selected':''}>Personalizado</option></select></label>
 <label for="filtro-tipo-venta" style="display:grid;gap:5px">Tipo de venta
 <select id="filtro-tipo-venta" aria-label="Filtrar por tipo de venta" style="width:100%;min-width:0;padding:10px;border:1px solid var(--borde,#ccc);border-radius:8px;background:var(--panel,#fff);color:inherit">
 <option value="TODOS" data-tipo-venta="TODOS" ${tipoFiltro==='TODOS'?'selected':''}>Todas</option><option value="PRODUCTOS" data-tipo-venta="PRODUCTOS" ${tipoFiltro==='PRODUCTOS'?'selected':''}>Productos</option><option value="SERVICIOS" data-tipo-venta="SERVICIOS" ${tipoFiltro==='SERVICIOS'?'selected':''}>Servicios</option><option value="MIXTA" data-tipo-venta="MIXTA" ${tipoFiltro==='MIXTA'?'selected':''}>Mixtas</option></select></label>
 </div>
 <div class="dia" id="rango-personalizado" style="${filtro==='PERSONALIZADO'?'':'display:none'};margin-top:10px"><label>Desde <input type="date" id="ventas-desde" value="${esc(desde)}"></label><label>Hasta <input type="date" id="ventas-hasta" value="${esc(hasta)}"></label><button class="btn" id="aplicar-rango">Aplicar</button></div>
 </section>
 <section><h3>Citas pendientes de cobro (${pendientes.length})</h3>
 ${pendientes.length?pendientes.map(c=>`<div class="row"><span><strong>${esc(c.clientes?.nombre||'Cliente')}</strong><br><small>${esc(c.servicios?.nombre||'Servicio')} · ${esc(c.barberos?.nombre||'Sin barbero')} · ${new Date(c.inicio).toLocaleString('es-CO',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</small><br><strong>${dinero(c.servicios?.precio||0)}</strong></span><button class="btn" data-cobrar-cita="${c.id}">Cobrar cita</button></div>`).join(''):'<p class="empty">No hay citas pendientes de cobro.</p>'}
 </section><section><h3>Ventas del período (${ventasFiltradas.length})</h3>
 ${ventasFiltradas.length?ventasFiltradas.map(v=>{
  const items=detallesPorVenta[v.id]||[],conceptos=items.map(x=>esc(x.descripcion)+(Number(x.cantidad)!==1?' × '+x.cantidad:'')).join(' · ');
  const saldo=Number(v.saldo_pendiente)>0&&v.estado_venta!=='ANULADA';
  const tipo=tipoVenta(v),estilo=coloresTipo[tipo]||coloresTipo.OTRA;
  return `<button class="row" data-id="${v.id}" style="border-left:4px solid ${tipo==='PRODUCTOS'?'#299653':tipo==='SERVICIOS'?'#4779d1':tipo==='MIXTA'?'#d99a35':'#999'};padding-left:12px"><span><strong>${esc(v.clientes?.nombre||'Cliente de paso')}</strong> <span style="display:inline-block;margin:3px 0;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;${estilo}">${etiquetasTipo[tipo]||'Sin clasificar'}</span><br><small>${new Date(v.fecha_hora).toLocaleString('es-CO',{dateStyle:'medium',timeStyle:'short'})} · Cobrado: ${dinero(v.total_pagado)}</small><br><small>${conceptos||'Sin detalle'}</small>${Number(v.descuento)>0?'<br><small>Descuento: '+dinero(v.descuento)+'</small>':''}${saldo?'<br><small>Saldo pendiente: '+dinero(v.saldo_pendiente)+' · Deudor: '+esc(v.clientes?.nombre||'Cliente de paso')+'</small>':''}</span><strong>${dinero(v.total_venta)}</strong></button>`;
 }).join(''):'<p class="empty">No hay ventas en el período seleccionado.</p>'}</section>`;
 $('#nv').onclick=()=>nuevaVenta();
 $('#vp').onclick=()=>nuevaVenta(null,'PRODUCTOS');
 $('#vs').onclick=()=>nuevaVenta(null,'SERVICIOS');
 $('#vm').onclick=()=>nuevaVenta(null,'MIXTA');
 const selectorTipo=$('#filtro-tipo-venta');if(selectorTipo)selectorTipo.onchange=()=>{S.filtroTipoVenta=selectorTipo.value;ventas()};
 const selectorPeriodo=$('#filtro-periodo');if(selectorPeriodo)selectorPeriodo.onchange=()=>{S.filtroVentas=selectorPeriodo.value;ventas()};
 const aplicar=$('#aplicar-rango');if(aplicar)aplicar.onclick=()=>{const a=$('#ventas-desde').value,b=$('#ventas-hasta').value;if(!a||!b||a>b)return toast('Selecciona un rango de fechas válido.',true);S.ventasDesde=a;S.ventasHasta=b;S.filtroVentas='PERSONALIZADO';ventas()};
 document.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>detalleVenta(data.find(v=>v.id===b.dataset.id)));
 document.querySelectorAll('[data-cobrar-cita]').forEach(b=>b.onclick=()=>cobrarCitaPendiente(pendientes.find(c=>c.id===b.dataset.cobrarCita)));
}
async function cobrarCitaPendiente(c){
 if(!c)return;
 const{data:ya,error:errorVenta}=await sb.from('ventas').select('id').eq('negocio_id',S.perfil.negocio_id).eq('cita_id',c.id).neq('estado_venta','ANULADA').limit(1);
 if(errorVenta)return toast(traducir(errorVenta.message),true);
 if(ya?.length)return toast('Esta cita ya tiene una venta asociada.',true);
 let fee=null;
 if(Number(S.negocio.valor_cita)>0){
  const{data:s,error:errorServicio}=await sb.from('servicios').select('id').eq('negocio_id',S.perfil.negocio_id).eq('categoria','CITA').eq('estado','ACTIVO').limit(1);
  if(errorServicio)return toast(traducir(errorServicio.message),true);
  fee=s?.[0]?.id||null;
 }
 nuevaVenta({cliente_id:c.cliente_id,barbero_id:c.barbero_id,servicio_id:c.servicio_id,cita_id:c.id,fee},'AGENDA');
}
async function nuevaVenta(pre,tipo='MIXTA'){
 if(pre?.cita_id){
  const{data:cita,error:errorCita}=await sb.from('citas').select('estado').eq('negocio_id',S.perfil.negocio_id).eq('id',pre.cita_id).maybeSingle();
  if(errorCita)return toast(traducir(errorCita.message),true);
  if(!['PENDIENTE','CONFIRMADA','ATENDIDA'].includes(cita?.estado))return toast('Esta cita no está disponible para cobro.',true);
  const{data:existente,error:errorExistente}=await sb.from('ventas').select('id').eq('negocio_id',S.perfil.negocio_id).eq('cita_id',pre.cita_id).neq('estado_venta','ANULADA').limit(1);
  if(errorExistente)return toast(traducir(errorExistente.message),true);
  if(existente?.length)return toast('Esta cita ya tiene una venta asociada.',true);
 }
 const{data:cajaInicial,error:errorCajaInicial}=await sb.from('cajas').select('id').eq('negocio_id',S.perfil.negocio_id).eq('estado_caja','ABIERTA').maybeSingle();
 if(errorCajaInicial)return toast(traducir(errorCajaInicial.message),true);
 if(!cajaInicial?.id)return toast('Para registrar una venta, primero abre la caja.',true);
 const respuestas=await Promise.all([['clientes','id,nombre'],['barberos','id,nombre,modelo_pago,porcentaje_comision'],['servicios','id,nombre,precio'],['productos','id,nombre,precio_venta,costo_unitario,vendible'],['cuentas','id,nombre,detalle']].map(([t,campos])=>{let q=sb.from(t).select(campos).eq('negocio_id',S.perfil.negocio_id).eq('estado','ACTIVO');if(t==='productos')q=q.eq('vendible',true);return q.order('nombre')}));
 const fallo=respuestas.find(r=>r.error);if(fallo)return toast(traducir(fallo.error.message),true);
 const[cl,ba,se,pr,cu]=respuestas.map(r=>r.data||[]);
 if(!se.length&&!pr.length)return toast('Primero crea un servicio o un producto.',true);
 const todos=[...se.map(x=>({k:'s:'+x.id,n:x.nombre,p:Number(x.precio)})),...pr.map(x=>({k:'p:'+x.id,n:x.nombre,p:Number(x.precio_venta)}))];
 const items=todos.filter(x=>tipo==='PRODUCTOS'?x.k.startsWith('p:'):tipo==='SERVICIOS'?x.k.startsWith('s:'):true);
 if(!items.length)return toast(tipo==='PRODUCTOS'?'No hay productos activos para vender.':'No hay servicios activos para vender.',true);
 if(pre?.servicio_id&&!items.some(x=>x.k==='s:'+pre.servicio_id))return toast('El servicio de esta cita ya no está activo. Revisa el catálogo antes de cobrar.',true);
 const op=a=>a.map(o=>`<option value="${o.id}">${esc(o.nombre)}</option>`).join('');
 const lin=()=>`<div class="ln edit-ln" style="grid-template-columns:minmax(0,1fr) 68px 34px;align-items:center"><select aria-label="Ítem">${items.map(i=>`<option value="${i.k}">${esc(i.n)}, ${dinero(i.p)}</option>`).join('')}</select><input type="number" min="1" value="1" inputmode="numeric" aria-label="Cantidad"><button type="button" class="btn sec rm" aria-label="Quitar ítem">×</button></div>`;
 const pl=()=>`<div class="ln"><select aria-label="Método de pago">${METODOS}</select><input type="number" min="0" inputmode="decimal" aria-label="Valor recibido"><select class="cu" hidden style="grid-column:1/-1" aria-label="Cuenta donde entró el pago"><option value="">Elige la cuenta donde entró</option>${cu.map(x=>`<option value="${x.id}">${esc(x.nombre)}${x.detalle?' ('+esc(x.detalle)+')':''}</option>`).join('')}</select></div>`;
 dlg.innerHTML=`<form id="df"><h2>${pre?.cita_id?'Cobrar cita':tipo==='PRODUCTOS'?'Venta de productos':tipo==='SERVICIOS'?'Venta de servicios':'Nueva venta'}</h2>
 <label for="v1">Cliente</label><select id="v1" name="cliente_id"><option value="">Cliente de paso</option>${op(cl)}</select>
 <label for="v2">Barbero</label><select id="v2" name="barbero_id"><option value="">Sin barbero</option>${op(ba)}</select>
 <label>Servicios y productos</label><div id="lns">${lin()}</div><button type="button" class="link" id="ad">Agregar otro ítem</button>
 <label for="v3">Descuento</label><input id="v3" name="descuento" type="number" min="0" value="0" inputmode="decimal">
 <p class="tot" id="tt"></p>
 <label>Pagos recibidos</label><div id="pgs">${pl()}</div><button type="button" class="link" id="ap">Agregar otro método de pago</button>${S.negocio.permitir_saldos?'<label class="chk" style="margin-top:10px"><input type="checkbox" id="vfiado"> Registrar saldo pendiente (fiado)</label>':''}<p class="mute" id="fl"></p>
 <div class="acts"><button type="button" class="btn sec" id="cx">Cancelar</button><button class="btn">Cobrar</button></div></form>`;
 dlg.showModal();$('#cx').onclick=()=>dlg.close();
 const calc=()=>{const L=[...document.querySelectorAll('#lns .ln')].map(l=>({i:items.find(x=>x.k===l.querySelector('select').value),q:Number(l.querySelector('input').value)}));const br=L.reduce((s,l)=>s+(l.i?l.i.p*l.q:NaN),0),ds=Number($('#v3').value);return{L,br,ds,t:br-ds}};
 const pagos=()=>[...document.querySelectorAll('#pgs .ln')].map(l=>({m:l.querySelector('select').value,v:Number(l.querySelector('input').value)||0,c:l.querySelector('.cu').value||null})).filter(x=>x.v>0);
 $('#pgs').onchange=e=>{if(e.target.tagName==='SELECT'&&!e.target.classList.contains('cu'))e.target.closest('.ln').querySelector('.cu').hidden=e.target.value==='EFECTIVO'||!cu.length};
 const ref=()=>{const c=calc(),f=$('#pgs .ln input');$('#tt').textContent='Total: '+dinero(c.t);
  if(!f.dataset.m&&document.querySelectorAll('#pgs .ln').length===1)f.value=Math.max(0,c.t);
  const rec=pagos().reduce((s,x)=>s+x.v,0),fiado=!!$('#vfiado')?.checked;$('#fl').textContent=rec<c.t?(fiado?'Saldo a crédito: ':'Falta por cobrar: ')+dinero(c.t-rec):rec>c.t?'Sobran '+dinero(rec-c.t):'Pago completo'};
 $('#pgs').oninput=e=>{if(e.target.tagName==='INPUT')e.target.dataset.m=1};
 $('#df').oninput=ref;$('#df').onchange=ref;const fiado=$('#vfiado');if(fiado)fiado.onchange=ref;
 $('#ad').onclick=()=>{$('#lns').insertAdjacentHTML('beforeend',lin());ref()};
 $('#lns').onclick=e=>{if(e.target.classList.contains('rm')){if(document.querySelectorAll('#lns .ln').length===1)return toast('La venta debe tener al menos un ítem.',true);e.target.closest('.ln').remove();ref()}};
 $('#ap').onclick=()=>{const rec=pagos().reduce((s,x)=>s+x.v,0);$('#pgs').insertAdjacentHTML('beforeend',pl());$('#pgs .ln:last-child input').value=Math.max(0,calc().t-rec)||'';ref()};ref();
 if(pre){$('#v1').value=pre.cliente_id||'';$('#v2').value=pre.barbero_id||'';const ls=()=>document.querySelectorAll('#lns .ln select');if(pre.servicio_id)ls()[0].value='s:'+pre.servicio_id;if(pre.fee&&items.some(x=>x.k==='s:'+pre.fee)){$('#ad').click();ls()[1].value='s:'+pre.fee}ref()}
 let guardando=false;
 $('#df').onsubmit=async e=>{e.preventDefault();if(guardando)return;const boton=e.target.querySelector('button[type="submit"],button:not([type])');if(boton)boton.disabled=true;guardando=true;const f=Object.fromEntries(new FormData(e.target)),c=calc(),PG=pagos(),pago=PG.reduce((s,x)=>s+x.v,0),valoresPago=[...document.querySelectorAll('#pgs .ln input')].map(x=>Number(x.value));
  if(!c.L.length||c.L.some(l=>!l.i||!Number.isFinite(l.q)||l.q<=0||!Number.isFinite(l.i.p)||l.i.p<0)||!Number.isFinite(c.t)||!Number.isFinite(c.ds)||valoresPago.some(x=>!Number.isFinite(x)||x<0)||!Number.isFinite(pago)){guardando=false;if(boton)boton.disabled=false;return toast('Revisa las cantidades, precios y valores de pago. Deben ser números válidos y no negativos.',true)}
  if(c.ds<0||c.ds>c.L.reduce((s,l)=>s+l.i.p*l.q,0)){guardando=false;if(boton)boton.disabled=false;return toast('El descuento debe estar entre cero y el subtotal.',true)}
  if(pago>c.t){guardando=false;if(boton)boton.disabled=false;return toast('El pago no puede superar el total.',true)}
  if(pago<c.t&&(!S.negocio.permitir_saldos||!$('#vfiado')?.checked)){guardando=false;if(boton)boton.disabled=false;return toast(S.negocio.permitir_saldos?'Para dejar saldo pendiente, activa la opción de fiado.':'Esta barbería no permite saldos pendientes. Recibe el pago completo.',true)}
  if(pago<c.t&&!f.cliente_id){guardando=false;if(boton)boton.disabled=false;return toast('Para registrar una venta fiada debes seleccionar el cliente responsable de la deuda.',true)}
  if(cu.length&&PG.some(x=>x.m!=='EFECTIVO'&&!x.c)){guardando=false;if(boton)boton.disabled=false;return toast('Elige la cuenta donde entró cada pago que no es en efectivo.',true)}
  const{data:cajaActual,error:errorCajaActual}=await sb.from('cajas').select('id').eq('negocio_id',S.perfil.negocio_id).eq('estado_caja','ABIERTA').maybeSingle();
  if(errorCajaActual){guardando=false;if(boton)boton.disabled=false;return toast(traducir(errorCajaActual.message),true)}
  if(!cajaActual?.id){guardando=false;if(boton)boton.disabled=false;return toast('La caja se cerró. Abre una caja para registrar la venta.',true)}
  if(pre?.cita_id){const{data:citaActual,error:errorCitaActual}=await sb.from('citas').select('estado').eq('negocio_id',S.perfil.negocio_id).eq('id',pre.cita_id).maybeSingle();if(errorCitaActual){guardando=false;if(boton)boton.disabled=false;return toast(traducir(errorCitaActual.message),true)}if(!['PENDIENTE','CONFIRMADA','ATENDIDA'].includes(citaActual?.estado)){guardando=false;if(boton)boton.disabled=false;return toast('La cita ya no está disponible para cobro.',true)}const{data:duplicada,error:errorDuplicada}=await sb.from('ventas').select('id').eq('negocio_id',S.perfil.negocio_id).eq('cita_id',pre.cita_id).neq('estado_venta','ANULADA').limit(1);if(errorDuplicada){guardando=false;if(boton)boton.disabled=false;return toast(traducir(errorDuplicada.message),true)}if(duplicada?.length){guardando=false;if(boton)boton.disabled=false;return toast('Esta cita ya fue cobrada.',true)}}
  const bar=ba.find(x=>x.id===f.barbero_id),nid=S.perfil.negocio_id;
  const{data:v,error}=await sb.from('ventas').insert({negocio_id:nid,cliente_id:f.cliente_id||null,barbero_id:f.barbero_id||null,descuento:c.ds,metodo_pago_principal:(PG.slice().sort((a,b)=>b.v-a.v)[0]?.m)||'EFECTIVO',creado_por:S.perfil.id,cita_id:pre?.cita_id||null}).select('id').single();
  if(error){guardando=false;if(boton)boton.disabled=false;return toast(pre?.cita_id&&error.code==='23505'?'Esta cita ya tiene una venta registrada. Actualiza la pantalla de Ventas.':traducir(error.message),true)}
  const redondear=n=>Math.round((n+Number.EPSILON)*100)/100;
  const det=c.L.map(l=>{const s=l.i.k[0]==='s',id=l.i.k.slice(2),sv=s&&se.find(x=>x.id===id),pd=!s&&pr.find(x=>x.id===id);
   const elegible=!!(sv&&bar&&bar.modelo_pago!=='ALQUILER'),porcentaje=s?(elegible?Number(bar.porcentaje_comision)||0:0):null;
   const brutoLinea=l.i.p*l.q,base=elegible?Math.max(0,redondear(brutoLinea-(c.br>0?c.ds*brutoLinea/c.br:0))):0;
   const com=elegible?redondear(base*porcentaje/100):0;
   return{negocio_id:nid,venta_id:v.id,tipo_item:s?'SERVICIO':'PRODUCTO',servicio_id:s?id:null,producto_id:s?null:id,descripcion:l.i.n,cantidad:l.q,precio_unitario:l.i.p,costo_unitario:pd?pd.costo_unitario:0,comision_generada:com,porcentaje_comision_aplicado:porcentaje,base_comision:base}});
  let r=await sb.from('detalle_ventas').insert(det);
  if(!r.error&&PG.length)r=await sb.from('pagos').insert(PG.map(x=>({negocio_id:nid,venta_id:v.id,valor_pago:x.v,metodo_pago:x.m,cuenta_id:x.c,recibido_por:S.perfil.id})));
  if(r.error){const rollback=await sb.from('ventas').delete().eq('negocio_id',nid).eq('id',v.id);guardando=false;if(boton)boton.disabled=false;return toast(rollback.error?'No se completó la venta y tampoco pudo revertirse automáticamente: '+r.error.message+' / '+rollback.error.message:'No se completó la venta; se revirtió el registro inicial. '+r.error.message,true)}
  if(pre?.cita_id){const{data:citaMarcada,error:errorCitaMarcada}=await sb.from('citas').update({estado:'ATENDIDA'}).eq('negocio_id',nid).eq('id',pre.cita_id).in('estado',['PENDIENTE','CONFIRMADA','ATENDIDA']).select('id').maybeSingle();if(errorCitaMarcada||!citaMarcada){dlg.close();toast('La venta quedó registrada, pero no se pudo actualizar la cita a ATENDIDA. Revisa la Agenda.',true);return}}
  dlg.close();toast('Venta registrada');ventas()};
}
async function editarVenta(v, actuales){
 if(!ADM.includes(S.perfil.rol))return toast('Solo administración puede editar ventas.',true);
 if(v.estado_venta==='ANULADA')return toast('No se puede editar una venta anulada.',true);
 const respuestas=await Promise.all([
  sb.from('clientes').select('id,nombre').eq('negocio_id',S.perfil.negocio_id).order('nombre'),
  sb.from('barberos').select('id,nombre,modelo_pago,porcentaje_comision').eq('negocio_id',S.perfil.negocio_id).order('nombre'),
  sb.from('servicios').select('id,nombre,precio').eq('negocio_id',S.perfil.negocio_id).order('nombre'),
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

async function cargarLogoComprobante(url){
 if(!url)return null;
 try{
  const respuesta=await fetch(url,{mode:'cors',credentials:'omit'});
  if(!respuesta.ok)return null;
  const blob=await respuesta.blob();
  let imagen;
  if(typeof createImageBitmap==='function')imagen=await createImageBitmap(blob);
  else{
   const temporal=URL.createObjectURL(blob);
   try{imagen=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=temporal})}
   finally{URL.revokeObjectURL(temporal)}
  }
  const escala=Math.min(1,600/Math.max(imagen.width,imagen.height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(imagen.width*escala));
  canvas.height=Math.max(1,Math.round(imagen.height*escala));
  const contexto=canvas.getContext('2d');
  if(!contexto)return null;
  contexto.fillStyle='#ffffff';contexto.fillRect(0,0,canvas.width,canvas.height);
  contexto.drawImage(imagen,0,0,canvas.width,canvas.height);
  const base64=canvas.toDataURL('image/jpeg',0.9).split(',')[1];
  const binario=atob(base64);
  return {width:canvas.width,height:canvas.height,data:binario};
 }catch(error){return null}
}
function imagenComprobante(datosVenta,logo){
 const W=720,pad=40,azul='#132541',dorado='#c79c48',gris='#f2f4f6',texto='#212e40',suave='#66717f',verde='#21704a',rojo='#a62e29';
 const detalles=datosVenta.detalles||[],pagos=datosVenta.pagos||[],resumen=datosVenta.resumen||{};
 const moneda=n=>dinero(Number(n)||0);
 const envolver=(valor,max=43)=>{const palabras=String(valor??'').split(/\s+/),lineas=[];let actual='';palabras.forEach(p=>{if(!p)return;if(actual&&actual.length+p.length>max){lineas.push(actual);actual=p}else actual+=(actual?' ':'')+p});if(actual)lineas.push(actual);return lineas.length?lineas:['']};
 const filas=detalles.map(item=>({item,lineas:envolver(item.descripcion||'Servicio o producto',43).slice(0,2)}));
 const altoFilas=filas.reduce((s,f)=>s+68+(f.lineas.length>1?18:0),0);
 const H=Math.max(1120,900+altoFilas+pagos.length*58);
 const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
 const c=canvas.getContext('2d');if(!c)throw new Error('No fue posible preparar la imagen del comprobante.');
 c.fillStyle='#fff';c.fillRect(0,0,W,H);
 const txt=(s,x,y,size=20,color=texto,bold=false,align='left')=>{c.fillStyle=color;c.font=(bold?'700 ':'500 ')+size+'px Arial, sans-serif';c.textAlign=align;c.fillText(String(s??''),x,y)};
 const rect=(x,y,w,h,color,r=12)=>{c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill()};
 const line=(y,color='#e0e4e8')=>{c.strokeStyle=color;c.lineWidth=2;c.beginPath();c.moveTo(pad,y);c.lineTo(W-pad,y);c.stroke()};
 c.fillStyle=dorado;c.fillRect(0,0,W,14);
 let logoY=42;
 if(logo?.data){try{const img=new Image();img.src='data:image/jpeg;base64,'+btoa(logo.data);if(img.complete&&img.naturalWidth){const sc=Math.min(112/img.width,100/img.height);c.drawImage(img,42,38,img.width*sc,img.height*sc);logoY=160}}catch{}}
 txt(S.negocio?.nombre||'DH BARBER',logoY===160?176:42,88,34,azul,true);
 txt('BARBERÍA · ESTILO · CUIDADO PERSONAL',logoY===160?176:42,120,14,suave);
 line(174,dorado);
 txt('COMPROBANTE DE VENTA',pad,224,25,azul,true);
 const estado=String(datosVenta.estado||'PENDIENTE').toUpperCase(),estadoColor=estado==='PAGADO'?verde:estado==='ANULADA'?rojo:dorado;
 rect(490,188,190,48,gris,20);txt(estado,585,219,17,estadoColor,true,'center');
 txt('No. '+(datosVenta.numero||'—'),pad,266,18,texto,true);
 txt(datosVenta.fecha||'',pad,298,16,suave);
 let y=338;
 rect(pad,y,W-pad*2,132,gris,14);
 txt('CLIENTE',62,y+35,14,suave,true);txt(String(datosVenta.cliente?.nombre||'Cliente de paso').slice(0,46),62,y+70,22,texto,true);
 txt('TELÉFONO',62,y+108,13,suave,true);txt(String(datosVenta.cliente?.telefono||'No registrado').slice(0,22),180,y+108,16,texto);
 txt('ATENDIDO POR',430,y+108,13,suave,true);txt(String(datosVenta.barbero?.nombre||'No asignado').slice(0,20),658,y+108,16,texto,true,'right');
 y+=184;txt('DETALLE',pad,y,20,azul,true);y+=26;
 rect(pad,y,W-pad*2,44,azul,8);txt('PRODUCTO / SERVICIO',58,y+29,15,'#fff',true);txt('VALOR',662,y+29,15,'#fff',true,'right');y+=44;
 if(!filas.length){txt('No hay productos ni servicios registrados.',58,y+36,16,suave);y+=60}
 filas.forEach((f,i)=>{const item=f.item,h=68+(f.lineas.length>1?18:0);if(i%2===0)rect(pad,y,W-pad*2,h,'#f7f8fa',6);
  f.lineas.forEach((s,j)=>txt(s,58,y+25+j*21,16,texto,j===0));
  txt((Number(item.cantidad)||0).toLocaleString('es-CO')+' × '+moneda(item.precio_unitario),58,y+h-10,13,suave);
  txt(moneda(item.subtotal??(Number(item.cantidad)*Number(item.precio_unitario))),662,y+31,17,texto,true,'right');y+=h;line(y);});
 y+=34;txt('RESUMEN DE PAGO',pad,y,20,azul,true);y+=32;
 const resumenLineas=[['Subtotal',moneda(resumen.subtotal)],...(Number(resumen.descuento)>0?[['Descuento','- '+moneda(resumen.descuento)]]:[]),['Total de la venta',moneda(resumen.total)],['Total pagado',moneda(resumen.pagado)]];
 resumenLineas.forEach((r,i)=>{if(i===2)line(y-12,dorado);txt(r[0],58,y,17,i===2?azul:texto,i===2);txt(r[1],662,y,17,i===2?azul:texto,true,'right');y+=39});
 rect(pad,y-8,W-pad*2,76,resumen.saldo>0?gris:'#edf5ef',12);
 txt(resumen.saldo>0?'SALDO PENDIENTE':'ESTADO DE CUENTA',60,y+23,15,resumen.saldo>0?dorado:verde,true);
 txt(resumen.saldo>0?moneda(resumen.saldo):'PAGADO',660,y+49,25,resumen.saldo>0?dorado:verde,true,'right');y+=104;
 txt('PAGOS REGISTRADOS',pad,y,20,azul,true);y+=28;
 if(!pagos.length){txt('No se registran pagos asociados.',58,y+20,15,suave);y+=46}
 else pagos.forEach((p,i)=>{if(i%2===0)rect(pad,y,W-pad*2,48,gris,6);const fecha=new Date(p.fecha_hora).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'});txt(fecha+' · '+bonito(p.metodo_pago||'No registrado'),58,y+30,15,texto);txt(moneda(p.valor_pago),662,y+30,16,texto,true,'right');y+=54});
 y+=24;line(y,dorado);y+=48;txt('¡GRACIAS POR PREFERIRNOS!',pad,y,23,azul,true);y+=34;
 txt('Agradecemos tu confianza. Te esperamos pronto.',pad,y,16,suave);y+=34;
 txt('Comprobante comercial. No sustituye una factura electrónica',pad,y,13,suave);y+=20;txt('de venta autorizada por la DIAN.',pad,y,13,suave);y+=36;txt('DH BARBER',pad,y,15,dorado,true);
 const final= document.createElement('canvas');final.width=W;final.height=y+36;final.getContext('2d').drawImage(canvas,0,0);return final;
}
async function generarImagenComprobante(v,detalles,pagos,accion='compartir'){
 const negocio=S.negocio||{},cliente=v.clientes||{},barbero=v.barberos||{};
 const total=Number(v.total_venta)||0,pagado=Number(v.total_pagado)||0,saldo=Math.max(0,Number(v.saldo_pendiente??(total-pagado))||0);
 let estado='PENDIENTE';if(v.estado_venta==='ANULADA')estado='ANULADA';else if(saldo<=0||v.estado_venta==='PAGADA')estado='PAGADO';else if(pagado>0)estado='ABONADO';
 const numero='V-'+String(v.id||'').replace(/-/g,'').slice(0,12).toUpperCase();
 const subtotal=Number(v.total_bruto??(detalles||[]).reduce((s,x)=>s+(Number(x.subtotal??(Number(x.cantidad)*Number(x.precio_unitario)))||0),0));
 const descuento=Math.max(0,Number(v.descuento)||0),logo=await cargarLogoComprobante(negocio.logo_url||'./logo-dhbarber.png');
 const datos={fecha:new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeStyle:'short',timeZone:negocio.zona_horaria||'America/Bogota'}).format(new Date(v.fecha_hora)),numero,estado,cliente,barbero,detalles:detalles||[],pagos:pagos||[],resumen:{subtotal,descuento,total,pagado,saldo}};
 const canvas=imagenComprobante(datos,logo),blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('El navegador no pudo crear la imagen.')),'image/jpeg',0.94));
 const nombreArchivo='Comprobante-'+String(v.id).slice(0,8).toUpperCase()+'.jpg',archivo=new File([blob],nombreArchivo,{type:'image/jpeg'});
 const telefono=String(cliente.telefono||'').replace(/\D/g,''),numeroTelefono=telefono.length===10?'57'+telefono:telefono;
 const mensaje='Hola '+String(cliente.nombre||'')+', te compartimos el comprobante de tu compra en '+String(negocio.nombre||'DH BARBER')+'. ¡Gracias por preferirnos!';
 if(accion==='compartir'&&navigator.share&&navigator.canShare?.({files:[archivo]})){try{await navigator.share({files:[archivo],title:'Comprobante de venta',text:mensaje});return}catch(error){if(error?.name==='AbortError')return}}
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=nombreArchivo;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 if(accion==='compartir'&&numeroTelefono.length>=7){window.open('https://wa.me/'+numeroTelefono+'?text='+encodeURIComponent(mensaje),'_blank','noopener');toast('Imagen descargada. Adjunta el comprobante en WhatsApp para enviarlo al cliente.',false)}
 else toast('Imagen del comprobante descargada correctamente.',false);
}

async function detalleVenta(v){
 const admin=ADM.includes(S.perfil.rol);
 const[rd,rp,rc]=await Promise.all([sb.from('detalle_ventas').select('*').eq('negocio_id',S.perfil.negocio_id).eq('venta_id',v.id),sb.from('pagos').select('*').eq('negocio_id',S.perfil.negocio_id).eq('venta_id',v.id).order('fecha_hora'),admin?sb.from('cajas').select('id,fecha_apertura').eq('negocio_id',S.perfil.negocio_id).eq('estado_caja','ABIERTA').maybeSingle():Promise.resolve({data:null,error:null})]);
 if(rd.error)return toast(traducir(rd.error.message),true);if(rp.error)return toast(traducir(rp.error.message),true);if(rc.error)return toast(traducir(rc.error.message),true);
 const d=rd.data||[],p=rp.data||[];
 const cajaActiva=rc.data,puedeAnular=!!(admin&&cajaActiva?.id&&v.caja_id===cajaActiva.id&&new Date(v.fecha_hora)>=new Date(cajaActiva.fecha_apertura));
 const abierta=v.estado_venta==='PENDIENTE'&&admin,fila=(a,b,c='')=>`<div class="ln2 ${c}"><span>${a}</span><span>${b}</span></div>`;
 dlg.innerHTML=`<form id="df"><h2>${esc(v.clientes?.nombre||'Cliente de paso')}</h2><p class="mute">${new Date(v.fecha_hora).toLocaleString('es-CO',{dateStyle:'medium',timeStyle:'short'})}${v.barberos?', '+esc(v.barberos.nombre):''}</p>
 ${d.map(x=>fila(x.cantidad+' × '+esc(x.descripcion),dinero(x.subtotal))).join('')}
 ${v.descuento>0?fila('Descuento','-'+dinero(v.descuento)):''}
 ${fila('Total',dinero(v.total_venta),'tot')}${fila('Pagado',dinero(v.total_pagado))}${fila('Saldo',dinero(v.saldo_pendiente))}
 ${p.length?'<label>Pagos</label>'+p.map(x=>fila(bonito(x.metodo_pago)+', '+hora(x.fecha_hora),dinero(x.valor_pago))).join(''):''}
 ${abierta?`<label for="pg">Registrar otro pago</label><div class="ln"><input id="pg" type="number" min="1" inputmode="decimal" value="${v.saldo_pendiente}"><select id="mp" aria-label="Método">${METODOS}</select></div><button type="button" class="btn block" id="rp">Registrar pago</button>`:''}
 ${v.estado_venta!=='ANULADA'?'<div class="acts" style="flex-wrap:wrap"><button type="button" class="btn" id="image">Descargar imagen</button><button type="button" class="btn sec" id="shareimage">Compartir imagen</button></div>':''}${admin&&v.estado_venta!=='ANULADA'?'<button type="button" class="btn block" id="ed">Editar venta</button>'+(puedeAnular?'<button type="button" class="btn sec block" id="an">Anular venta</button>':'<p class="info">Esta venta pertenece a una caja cerrada, a otro turno o no tiene una caja histórica verificable. No se puede anular desde la caja actual.</p>'):''}
 <div class="acts"><button type="button" class="btn sec" id="cx">Cerrar</button></div></form>`;
 dlg.showModal();$('#cx').onclick=()=>dlg.close();
 const ejecutarImagen=(id,accion)=>{const b=$(id);if(!b)return;b.onclick=async()=>{if(b.disabled)return;b.disabled=true;try{await generarImagenComprobante(v,d,p,accion)}catch(error){if(error?.name!=='AbortError')toast('No se pudo generar la imagen: '+(error.message||'Error inesperado'),true)}finally{b.disabled=false}}};
 ejecutarImagen('#image','descargar');ejecutarImagen('#shareimage','compartir');
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
