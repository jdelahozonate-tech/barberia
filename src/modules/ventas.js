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
  const detalles=c.L.map(l=>({
   tipo_item:l.i.k[0]==='s'?'SERVICIO':'PRODUCTO',
   servicio_id:l.i.k[0]==='s'?l.i.k.slice(2):null,
   producto_id:l.i.k[0]==='p'?l.i.k.slice(2):null,
   cantidad:l.q
  }));
  const{error}=await sb.rpc('registrar_venta_transaccional',{
   p_cliente_id:f.cliente_id||null,
   p_barbero_id:f.barbero_id||null,
   p_descuento:c.ds,
   p_cita_id:pre?.cita_id||null,
   p_detalles:detalles,
   p_pagos:PG.map(x=>({metodo_pago:x.m,valor_pago:x.v,cuenta_id:x.c}))
  });
  if(error){guardando=false;if(boton)boton.disabled=false;return toast(traducir(error.message),true)}
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

function htmlComprobanteVenta(v,detalles,pagos){
 const negocio=S.negocio||{},cliente=v.clientes||{},barbero=v.barberos||{};
 const moneda=n=>dinero(Number(n)||0);
 const fecha=valor=>{
  if(!valor)return 'No registrado';
  const d=new Date(valor);if(Number.isNaN(d.getTime()))return 'No registrado';
  return new Intl.DateTimeFormat('es-CO',{dateStyle:'medium',timeStyle:'short',timeZone:negocio.zona_horaria||'America/Bogota'}).format(d);
 };
 const numero='V-'+String(v.id||'').replace(/-/g,'').slice(0,12).toUpperCase();
 const saldo=Math.max(0,Number(v.saldo_pendiente)||0),pagado=Math.max(0,Number(v.total_pagado)||0),total=Math.max(0,Number(v.total_venta)||0);
 const subtotal=Number(v.total_bruto??(detalles||[]).reduce((s,x)=>s+(Number(x.subtotal??(Number(x.cantidad)*Number(x.precio_unitario)))||0),0));
 const descuento=Math.max(0,Number(v.descuento)||0);
 let estado='PENDIENTE',claseEstado='pendiente';
 if(v.estado_venta==='ANULADA'){estado='ANULADA';claseEstado='anulada'}
 else if(saldo<=0||v.estado_venta==='PAGADA'){estado='PAGADO';claseEstado='pagado'}
 else if(pagado>0){estado='ABONADO';claseEstado='abonado'}
 const logo=esc(negocio.logo_url||'./logo-dhbarber.png');
 const items=(detalles||[]).map(item=>{
  const cantidad=Number(item.cantidad)||0,unitario=Number(item.precio_unitario)||0,parcial=Number(item.subtotal??(cantidad*unitario))||0;
  return '<tr><td>'+esc(item.descripcion||'Servicio o producto')+'</td><td class="centro">'+cantidad.toLocaleString('es-CO')+'</td><td class="importe">'+moneda(unitario)+'</td><td class="importe fuerte">'+moneda(parcial)+'</td></tr>';
 }).join('')||'<tr><td colspan="4" class="vacio">No hay productos ni servicios registrados.</td></tr>';
 const filasPagos=(pagos||[]).map(p=>{
  const metodo=bonito(p.metodo_pago||'No registrado'),estadoPago=p.estado_pago&&p.estado_pago!=='REGISTRADO'?' · '+bonito(p.estado_pago):'';
  return '<tr><td>'+esc(fecha(p.fecha_hora))+'</td><td>'+esc(metodo+estadoPago)+'</td><td class="importe fuerte">'+moneda(p.valor_pago)+'</td></tr>';
 }).join('')||'<tr><td colspan="3" class="vacio">No se registran pagos asociados.</td></tr>';
 const css='@page{size:letter;margin:12mm}*{box-sizing:border-box}body{margin:0;background:#f2f4f7;color:#18263d;font:12px/1.45 Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}.hoja{max-width:900px;margin:24px auto;background:#fff;padding:28px 32px;border-top:7px solid #c99b35;box-shadow:0 4px 24px #10223f18}.encabezado{display:flex;align-items:center;justify-content:space-between;gap:22px;padding:8px 0 22px}.marca{display:flex;align-items:center;gap:15px;min-width:0}.logo{width:142px;height:72px;object-fit:contain;object-position:left center}.nombre{font-size:25px;font-weight:800;letter-spacing:1px;color:#14243d}.submarca{font-size:10px;color:#667085;letter-spacing:1px;text-transform:uppercase}.titulo{min-width:230px;padding:16px 18px;background:#14243d;color:#fff;text-align:center;font-size:21px;font-weight:800;line-height:1.2}.metadatos{display:grid;grid-template-columns:1fr 2fr .8fr;background:#f1f3f6;border:1px solid #e1e5eb;margin-bottom:22px}.meta{padding:11px 14px;border-right:1px solid #dfe3e9}.meta:last-child{border:0}.etiqueta{display:block;margin-bottom:3px;color:#596579;font-size:9px;font-weight:700;letter-spacing:.7px;text-transform:uppercase}.valor-meta{font-size:12px;font-weight:700;overflow-wrap:anywhere}.estado{font-weight:800}.pagado{color:#23734d}.abonado,.pendiente{color:#9a6b16}.anulada{color:#b42318}.seccion{margin:0 0 9px;color:#17263e;font-size:12px;font-weight:800;letter-spacing:.6px;text-transform:uppercase}.cliente{display:grid;grid-template-columns:1.5fr .8fr .9fr;border:1px solid #e1e5eb;margin-bottom:22px}.dato{padding:12px 14px;border-right:1px solid #e1e5eb;min-width:0}.dato:last-child{border:0}.dato strong{display:block;font-size:12px;overflow-wrap:anywhere}.tabla{width:100%;border-collapse:collapse;table-layout:fixed;margin-bottom:18px}.tabla thead{display:table-header-group}.tabla th{padding:10px 12px;background:#f1f3f6;color:#667085;text-align:left;font-size:9px;letter-spacing:.5px;text-transform:uppercase;border-bottom:2px solid #c99b35}.tabla td{padding:10px 12px;border-bottom:1px solid #e7e9ee;vertical-align:top;overflow-wrap:anywhere}.tabla th:nth-child(1){width:46%}.tabla th:nth-child(2){width:12%}.tabla th:nth-child(3),.tabla th:nth-child(4){width:21%}.centro{text-align:center}.importe{text-align:right;white-space:nowrap}.fuerte{font-weight:700}.resumen{display:grid;grid-template-columns:1.1fr .9fr;gap:14px;align-items:start;margin:10px 0 20px;break-inside:avoid}.bloque{border:1px solid #e1e5eb;min-width:0}.bloque-titulo{padding:10px 13px;background:#f1f3f6;font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;border-bottom:1px solid #e1e5eb}.pagos{width:100%;border-collapse:collapse}.pagos th{padding:8px 10px;background:#fafbfc;color:#667085;text-align:left;font-size:9px}.pagos td{padding:8px 10px;border-top:1px solid #eceef2;font-size:10px;overflow-wrap:anywhere}.finanzas{padding:8px 13px}.linea{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid #e7e9ee;font-size:11px}.linea:last-child{border:0}.linea strong{white-space:nowrap}.linea.total{font-size:13px;font-weight:800}.linea.saldo{margin:5px -8px 0;padding:9px 8px;background:#edf6f0;color:#225b3d;font-weight:700}.total-barra{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:18px 0 24px;padding:15px 20px;background:#14243d;color:#fff;border-left:6px solid #c99b35;break-inside:avoid}.total-barra span{font-size:14px;font-weight:800;letter-spacing:1px}.total-barra strong{font-size:25px;white-space:nowrap}.gracias{text-align:center;margin:0 0 18px}.gracias strong{display:block;margin-bottom:3px;color:#14243d;font-size:17px}.gracias span{color:#667085;font-size:11px}.pie{padding-top:12px;border-top:1px solid #e4e7ec;color:#667085;text-align:center;font-size:9px}.pie strong{display:block;margin-top:3px;color:#344054}.vacio{padding:14px!important;color:#667085;text-align:center}@media(max-width:650px){.hoja{margin:0;padding:18px 14px}.encabezado{align-items:flex-start;flex-direction:column}.titulo{width:100%}.metadatos,.cliente,.resumen{grid-template-columns:1fr}.meta,.dato{border-right:0;border-bottom:1px solid #e1e5eb}.logo{width:112px;height:58px}.nombre{font-size:21px}.tabla th,.tabla td{padding:7px 5px;font-size:10px}.total-barra strong{font-size:20px}}@media print{body{background:#fff;font-size:10px}.hoja{max-width:none;margin:0;padding:0;box-shadow:none;border-top:5px solid #c99b35}.encabezado{padding-top:4px}.tabla tr,.pagos tr,.bloque,.total-barra,.gracias,.pie{break-inside:avoid}}';
 return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc('Comprobante-'+numero)+'</title><style>'+css+'</style></head><body><main class="hoja"><header class="encabezado"><div class="marca"><img class="logo" id="logo" src="'+logo+'" alt="DH BARBER"><div><div class="nombre">'+esc(negocio.nombre||'DH BARBER')+'</div><div class="submarca">Barbería · Estilo · Cuidado personal</div></div></div><div class="titulo">COMPROBANTE<br>DE VENTA</div></header><section class="metadatos"><div class="meta"><span class="etiqueta">Comprobante</span><span class="valor-meta">'+esc(numero)+'</span></div><div class="meta"><span class="etiqueta">Fecha de emisión</span><span class="valor-meta">'+esc(fecha(v.fecha_hora))+'</span></div><div class="meta"><span class="etiqueta">Estado</span><span class="valor-meta estado '+claseEstado+'">'+esc(estado)+'</span></div></section><h2 class="seccion">Datos del cliente</h2><section class="cliente"><div class="dato"><span class="etiqueta">Cliente</span><strong>'+esc(cliente.nombre||'Cliente de paso')+'</strong></div><div class="dato"><span class="etiqueta">Teléfono</span><strong>'+esc(cliente.telefono||'No registrado')+'</strong></div><div class="dato"><span class="etiqueta">Atendido por</span><strong>'+esc(barbero.nombre||'No asignado')+'</strong></div></section><h2 class="seccion">Detalle de productos y servicios</h2><table class="tabla"><thead><tr><th>Descripción</th><th class="centro">Cant.</th><th class="importe">Valor unitario</th><th class="importe">Subtotal</th></tr></thead><tbody>'+items+'</tbody></table><section class="resumen"><div class="bloque"><div class="bloque-titulo">Detalle de pagos</div><table class="pagos"><thead><tr><th>Fecha del pago</th><th>Medio de pago</th><th class="importe">Valor recibido</th></tr></thead><tbody>'+filasPagos+'</tbody></table></div><div class="bloque"><div class="bloque-titulo">Resumen financiero</div><div class="finanzas"><div class="linea"><span>Subtotal</span><strong>'+moneda(subtotal)+'</strong></div>'+(descuento>0?'<div class="linea"><span>Descuentos</span><strong>− '+moneda(descuento)+'</strong></div>':'')+'<div class="linea total"><span>Total de la venta</span><strong>'+moneda(total)+'</strong></div><div class="linea"><span>Total pagado</span><strong>'+moneda(pagado)+'</strong></div><div class="linea saldo"><span>Saldo pendiente</span><strong>'+moneda(saldo)+'</strong></div></div></div></section><div class="total-barra"><span>TOTAL DE LA VENTA</span><strong>'+moneda(total)+'</strong></div><section class="gracias"><strong>¡Gracias por preferirnos!</strong><span>Agradecemos tu confianza. Te esperamos pronto.</span></section><footer class="pie">Comprobante comercial. No sustituye una factura electrónica de venta autorizada por la DIAN.<strong>'+esc(negocio.nombre||'DH BARBER')+' · Comprobante generado desde el sistema de gestión de la barbería.</strong></footer></main><script>(function(){var img=document.getElementById("logo");var imprimir=function(){setTimeout(function(){window.focus();window.print();},350);};if(img&&!img.complete){img.addEventListener("load",imprimir,{once:true});img.addEventListener("error",imprimir,{once:true});}else{imprimir();}window.addEventListener("afterprint",function(){window.close();});})();</script></body></html>';
}
async function cargarJsPDFComprobante(){
 if(window.jspdf?.jsPDF)return window.jspdf;
 let existente=document.querySelector('script[data-jspdf-comprobante]');
 if(existente?.dataset.failed==='1'){existente.remove();existente=null}
 await new Promise((resolve,reject)=>{
  if(existente){
   existente.addEventListener('load',resolve,{once:true});
   existente.addEventListener('error',()=>reject(new Error('No se pudo cargar el generador PDF. Verifica tu conexión.')),{once:true});
   return;
  }
  const script=document.createElement('script');script.src='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js';script.async=true;script.dataset.jspdfComprobante='1';
  script.onload=()=>{script.dataset.loaded='1';resolve()};
  script.onerror=()=>{script.dataset.failed='1';reject(new Error('No se pudo cargar el generador PDF. Verifica tu conexión.'))};
  document.head.appendChild(script);
 });
 if(!window.jspdf?.jsPDF)throw new Error('La biblioteca PDF no está disponible.');
 return window.jspdf;
}
async function logoComprobanteDataURL(url){
 const cargar=src=>new Promise(resolve=>{
  const img=new Image();img.crossOrigin='anonymous';
  img.onload=()=>{try{const canvas=document.createElement('canvas');canvas.width=img.naturalWidth||img.width;canvas.height=img.naturalHeight||img.height;canvas.getContext('2d').drawImage(img,0,0);resolve(canvas.toDataURL('image/png'))}catch(_){resolve(null)}};
  img.onerror=()=>resolve(null);img.src=src;
 });
 let data=await cargar(url);
 if(!data&&url!=='./logo-dhbarber.png')data=await cargar('./logo-dhbarber.png');
 return data;
}
async function cargarHtml2CanvasComprobante(){
 if(window.html2canvas)return window.html2canvas;
 let existente=document.querySelector('script[data-html2canvas-comprobante]');
 if(existente?.dataset.failed==='1'){existente.remove();existente=null}
 await new Promise((resolve,reject)=>{
  if(existente){
   if(existente.dataset.loaded==='1')return resolve();
   existente.addEventListener('load',resolve,{once:true});
   existente.addEventListener('error',()=>reject(new Error('No se pudo cargar el motor visual del PDF.')),{once:true});
   return;
  }
  const script=document.createElement('script');
  script.src='https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  script.async=true;script.dataset.html2canvasComprobante='1';
  script.onload=()=>{script.dataset.loaded='1';resolve()};
  script.onerror=()=>{script.dataset.failed='1';reject(new Error('No se pudo cargar el motor visual del PDF. Verifica tu conexión.'))};
  document.head.appendChild(script);
 });
 if(typeof window.html2canvas!=='function')throw new Error('El motor visual del PDF no está disponible.');
 return window.html2canvas;
}
async function generarFacturaPDFVisual(v,detalles,pagos){
 const lib=await cargarJsPDFComprobante();
 await cargarHtml2CanvasComprobante();
 const PDF=lib.jsPDF,W=612,m=12,cw=186;
 const doc=new PDF({orientation:'portrait',unit:'mm',format:'letter',compress:true});
 const frame=document.createElement('iframe');
 frame.setAttribute('aria-hidden','true');
 frame.style.cssText='position:fixed;left:-10000px;top:0;width:900px;height:1600px;border:0;visibility:hidden;';
 document.body.appendChild(frame);
 try{
  const html=htmlComprobanteVenta(v,detalles,pagos).replace(/<script[\s\S]*?<\/script>/gi,'');
  await new Promise((resolve,reject)=>{
   frame.onload=resolve;
   frame.onerror=()=>reject(new Error('No se pudo preparar la plantilla visual del comprobante.'));
   frame.srcdoc=html;
  });
  const win=frame.contentWindow,root=frame.contentDocument?.querySelector('.hoja');
  if(!root)throw new Error('No se encontró la plantilla del comprobante.');
  if(win.document.fonts?.ready)await win.document.fonts.ready;
  await Promise.all(Array.from(root.querySelectorAll('img')).map(img=>{
   if(img.complete)return Promise.resolve();
   return new Promise(resolve=>{img.onload=resolve;img.onerror=resolve});
  }));
  await doc.html(root,{
   x:m,y:8,width:cw,windowWidth:900,autoPaging:'text',
   html2canvas:{scale:1.5,useCORS:true,allowTaint:false,backgroundColor:'#ffffff',logging:false,windowWidth:900},
  });
  return doc;
 }finally{
  frame.remove();
 }
}
async function generarFacturaPDF(v,detalles,pagos,accion='descargar'){
 try{
  const negocio=S.negocio||{},cliente=v.clientes||{};
  const numero='V-'+String(v.id||'').replace(/-/g,'').slice(0,12).toUpperCase();
  const nombreArchivo='Comprobante-'+numero+'.pdf';
  const doc=await generarFacturaPDFVisual(v,detalles,pagos);
  const blob=doc.output('blob');
  const telefono=String(cliente.telefono||'').replace(/\D/g,''),numeroWa=telefono.length===10?'57'+telefono:telefono;
  const mensaje='Hola '+String(cliente.nombre||'')+', te compartimos el comprobante de tu compra en '+String(negocio.nombre||'la barbería')+'. ¡Gracias por preferirnos!';
  if(accion==='compartir'&&typeof File!=='undefined'&&navigator.share){
   const archivo=new File([blob],nombreArchivo,{type:'application/pdf'});
   if(navigator.canShare?.({files:[archivo]})){
    try{await navigator.share({files:[archivo],title:'Comprobante de venta',text:mensaje});return}
    catch(error){if(error?.name==='AbortError')return}
   }
  }
  doc.save(nombreArchivo);
  if(accion==='compartir'&&numeroWa.length>=7)window.open('https://wa.me/'+numeroWa+'?text='+encodeURIComponent(mensaje),'_blank','noopener');
  toast(accion==='compartir'&&numeroWa.length>=7?'PDF descargado. Adjunta el archivo en WhatsApp para enviarlo al cliente.':'PDF descargado correctamente.',false);
 }catch(error){
  abrirComprobanteVenta(v,detalles,pagos,'imprimir');
  toast('No se pudo generar el PDF visual. Se abrió la plantilla para guardarla como PDF: '+(error?.message||'Error inesperado'),true);
 }
}
function abrirComprobanteVenta(v,detalles,pagos,accion){
 const ventana=window.open('','_blank');
 if(!ventana)return toast('El navegador bloqueó la ventana del comprobante. Permite las ventanas emergentes e inténtalo de nuevo.',true);
 ventana.document.open();ventana.document.write(htmlComprobanteVenta(v,detalles,pagos));ventana.document.close();
 if(accion==='pdf')toast('En el diálogo de impresión selecciona “Guardar como PDF” para descargar el comprobante.',false);
}
// El PDF se genera con jsPDF; la vista HTML queda reservada para impresión.

function imprimirComprobante(v,detalles,pagos){abrirComprobanteVenta(v,detalles,pagos,'imprimir')}
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
 ${v.estado_venta!=='ANULADA'?'<div class="acts" style="flex-wrap:wrap"><button type="button" class="btn block" id="pdf">Descargar PDF</button><button type="button" class="btn sec block" id="print">Imprimir comprobante</button><button type="button" class="btn sec block" id="share">Compartir PDF</button></div>':''}${admin&&v.estado_venta!=='ANULADA'?'<button type="button" class="btn block" id="ed">Editar venta</button>'+(puedeAnular?'<button type="button" class="btn sec block" id="an">Anular venta</button>':'<p class="info">Esta venta pertenece a una caja cerrada, a otro turno o no tiene una caja histórica verificable. No se puede anular desde la caja actual.</p>'):''}
 <div class="acts"><button type="button" class="btn sec" id="cx">Cerrar</button></div></form>`;
 dlg.showModal();$('#cx').onclick=()=>dlg.close();
 const pdf=$('#pdf');if(pdf)pdf.onclick=async()=>{if(pdf.disabled)return;pdf.disabled=true;try{await generarFacturaPDF(v,d,p,'descargar')}finally{pdf.disabled=false}};const imprimir=$('#print');if(imprimir)imprimir.onclick=()=>imprimirComprobante(v,d,p);const compartir=$('#share');if(compartir)compartir.onclick=async()=>{if(compartir.disabled)return;compartir.disabled=true;try{await generarFacturaPDF(v,d,p,'compartir')}finally{compartir.disabled=false}};
 if(abierta)$('#rp').onclick=async()=>{const b=$('#rp');if(b.disabled)return;const n=Number($('#pg').value);
  if(!(n>0)||n>v.saldo_pendiente)return toast('El pago debe ser mayor a cero y no superar el saldo.',true);
  b.disabled=true;
  const{error}=await sb.rpc('registrar_abono_venta_transaccional',{
   p_venta_id:v.id,p_valor:n,p_metodo_pago:$('#mp').value,p_cuenta_id:null
  });
  if(error){b.disabled=false;return toast(traducir(error.message),true)}dlg.close();toast('Pago registrado');ventas()};
 const ed=$('#ed');if(ed)ed.onclick=()=>{dlg.close();editarVenta(v,d)};
 const an=$('#an');if(an)an.onclick=async()=>{const b=$('#an');if(b.disabled)return;if(!confirm('¿Anular esta venta? No se puede deshacer.'))return;b.disabled=true;
  const{error}=await sb.rpc('anular_venta',{p_venta_id:v.id});
  if(error){b.disabled=false;return toast(traducir(error.message),true)}dlg.close();toast('Venta anulada');ventas()};
}


 return { ventas, nuevaVenta, editarVenta };
}
