// Módulo de caja, gastos y liquidación de comisiones.
export function crearModuloFinanzas(deps) {
 const { $, dlg, sb, S, esc, dinero, hora, bonito, toast, METODOS, fila2, fm } = deps;
async function caja(){
 const main=$('#main'),nid=S.perfil.negocio_id;
 const {data:cj,error:errorCaja}=await sb.from('cajas').select('*').eq('negocio_id',nid).eq('estado_caja','ABIERTA').maybeSingle();
 if(errorCaja)return toast(errorCaja.message,true);
 if(!cj){
  const{data:historial,error:errorHistorial}=await sb.from('cajas').select('*').eq('negocio_id',nid).eq('estado_caja','CERRADA').order('fecha_cierre',{ascending:false}).limit(8);
  if(errorHistorial)return toast(errorHistorial.message,true);
  main.innerHTML=`<section class="cash-shell">
   <header class="cash-header"><div><span class="cash-eyebrow">CONTROL FINANCIERO</span><h2>Caja</h2><p>Abre un turno para registrar y controlar el dinero de la barbería.</p></div><span class="cash-state closed"><i></i>Caja cerrada</span></header>
   <section class="cash-open-panel"><div class="cash-open-copy"><span class="cash-panel-icon">▣</span><div><h3>Iniciar una nueva caja</h3><p>Registra cuánto efectivo tienes físicamente al comenzar. Este valor será la base para calcular el efectivo esperado al cierre.</p></div></div>
    <form id="cash-open-form" class="cash-open-form"><label for="si">Efectivo inicial</label><div class="cash-money-input"><span>$</span><input id="si" type="number" min="0" step="1" value="0" inputmode="decimal" required></div><button class="btn" id="ab">Abrir caja</button></form>
   </section>
   <section class="cash-history"><div class="cash-section-heading"><div><span class="cash-eyebrow">SEGUIMIENTO</span><h3>Últimos cierres</h3></div><span class="cash-count">${historial?.length||0} registros</span></div>
    ${historial?.length?'<div class="cash-history-grid">'+historial.map(c=>{const dif=Number(c.diferencia||0);return '<article class="cash-history-card"><div class="cash-history-top"><strong>'+new Date(c.fecha_cierre||c.fecha_apertura).toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'numeric'})+'</strong><span class="cash-difference '+(dif===0?'balanced':dif>0?'surplus':'shortage')+'">'+(dif>0?'+':'')+dinero(dif)+'</span></div><div class="cash-history-values"><span><small>Efectivo esperado</small><strong>'+dinero(c.efectivo_esperado??0)+'</strong></span><span><small>Efectivo contado</small><strong>'+dinero(c.efectivo_contado??0)+'</strong></span></div><small class="cash-history-note">'+(c.observaciones?esc(c.observaciones):'Sin observaciones')+'</small></article>'}).join('')+'</div>':'<div class="cash-empty"><span>▣</span><strong>Aún no hay cierres registrados</strong><p>Cuando cierres tu primer turno, aquí podrás consultar el resultado y las diferencias.</p></div>'}
   </section></section>`;
  $('#cash-open-form').onsubmit=async e=>{e.preventDefault();const b=$('#ab');if(b.disabled)return;const inicial=Number($('#si').value);if(!Number.isFinite(inicial)||inicial<0)return toast('El saldo inicial debe ser un valor válido y no negativo.',true);b.disabled=true;const{error}=await sb.from('cajas').insert({negocio_id:nid,usuario_apertura:S.perfil.id,saldo_inicial:inicial});if(error){b.disabled=false;return toast(error.message,true)}toast('Caja abierta correctamente');caja()};
  return;
 }
 const[rp,rg,rc]=await Promise.all([
  sb.from('pagos').select('valor_pago,metodo_pago,fecha_hora,cuentas(nombre,detalle),ventas(estado_venta,clientes(nombre))').eq('negocio_id',nid).eq('estado_pago','REGISTRADO').gte('fecha_hora',cj.fecha_apertura).order('fecha_hora',{ascending:false}),
  sb.from('gastos').select('*').eq('negocio_id',nid).eq('caja_id',cj.id).eq('estado_gasto','REGISTRADO').order('fecha_hora',{ascending:false}),
  sb.from('pagos_compras_inventario').select('valor_pago,metodo_pago,fecha_pago,compra_id').eq('negocio_id',nid).eq('caja_id',cj.id).order('fecha_pago',{ascending:false})
 ]);
 if(rp.error)return toast('No fue posible cargar los ingresos de caja: '+rp.error.message,true);
 if(rg.error)return toast('No fue posible cargar los gastos de caja: '+rg.error.message,true);
 if(rc.error)return toast('No fue posible consultar los pagos de compras: '+rc.error.message,true);
 const pg=rp.data||[],gs=rg.data||[],pc=rc.data||[];
 const ingresos=pg.filter(p=>p.ventas?.estado_venta!=='ANULADA');
 const por={};ingresos.forEach(p=>por[p.metodo_pago]=(por[p.metodo_pago]||0)+Number(p.valor_pago));
 const suma=(arr,key)=>arr.reduce((s,x)=>s+Number(x[key]||0),0);
 const totalIngresos=suma(ingresos,'valor_pago'),totalGastos=suma(gs,'valor'),totalCompras=suma(pc,'valor_pago');
 const gEf=gs.filter(g=>g.metodo_pago==='EFECTIVO').reduce((s,g)=>s+Number(g.valor),0);
 const cEf=pc.filter(p=>p.metodo_pago==='EFECTIVO').reduce((s,p)=>s+Number(p.valor_pago),0);
 const esp=Number(cj.saldo_inicial)+(por.EFECTIVO||0)-gEf-cEf;
 const totalEgresos=totalGastos+totalCompras;
 const fechaApertura=new Date(cj.fecha_apertura);
 const fmtFecha=d=>new Date(d).toLocaleString('es-CO',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
 const movimientos=[
  ...ingresos.map(p=>({tipo:'ingreso',fecha:p.fecha_hora,metodo:p.metodo_pago,valor:Number(p.valor_pago),titulo:p.ventas?.clientes?.nombre||'Cliente de paso',detalle:'Venta · '+bonito(p.metodo_pago),cuenta:p.cuentas?.nombre||''})),
  ...gs.map(g=>({tipo:'gasto',fecha:g.fecha_hora,metodo:g.metodo_pago,valor:Number(g.valor),titulo:g.descripcion||bonito(g.categoria_gasto),detalle:'Gasto · '+bonito(g.categoria_gasto),cuenta:g.proveedor||''})),
  ...pc.map(p=>({tipo:'compra',fecha:p.fecha_pago,metodo:p.metodo_pago,valor:Number(p.valor_pago),titulo:'Pago a proveedor',detalle:'Compra · '+String(p.compra_id||'').slice(0,8),cuenta:''}))
 ].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
 const totalMovimientos=movimientos.length;
 const htmlMovimientos=lista=>lista.length?lista.map(m=>'<article class="cash-movement"><span class="cash-movement-icon '+m.tipo+'">'+(m.tipo==='ingreso'?'↙':m.tipo==='gasto'?'↗':'▤')+'</span><span class="cash-movement-info"><strong>'+esc(m.titulo)+'</strong><small>'+esc(m.detalle)+(m.cuenta?' · '+esc(m.cuenta):'')+'</small><small>'+fmtFecha(m.fecha)+'</small></span><strong class="cash-movement-value '+(m.tipo==='ingreso'?'positive':'negative')+'">'+(m.tipo==='ingreso'?'+':'−')+dinero(m.valor)+'</strong></article>').join(''):'<div class="cash-empty"><span>↔</span><strong>No hay movimientos para mostrar</strong><p>Los ingresos, gastos y pagos a proveedores aparecerán aquí durante el turno.</p></div>';
 main.innerHTML=`<section class="cash-shell">
  <header class="cash-header"><div><span class="cash-eyebrow">CONTROL FINANCIERO</span><h2>Caja del turno</h2><p>Abierta el ${fmtFecha(cj.fecha_apertura)} · Controla ingresos, egresos y efectivo disponible.</p></div><span class="cash-state open"><i></i>En operación</span></header>
  <section class="cash-metrics">
   <article class="cash-metric cash-metric-primary"><span class="cash-metric-label">Efectivo esperado en caja</span><strong>${dinero(esp)}</strong><small>Saldo inicial + ingresos en efectivo − egresos en efectivo</small></article>
   <article class="cash-metric"><span class="cash-metric-label">Total recaudado</span><strong>${dinero(totalIngresos)}</strong><small>${ingresos.length} pagos registrados</small></article>
   <article class="cash-metric"><span class="cash-metric-label">Total de egresos</span><strong>${dinero(totalEgresos)}</strong><small>Gastos y pagos a proveedores</small></article>
   <article class="cash-metric"><span class="cash-metric-label">Movimientos</span><strong>${totalMovimientos}</strong><small>Durante este turno</small></article>
  </section>
  <section class="cash-balance-panel"><div class="cash-section-heading"><div><span class="cash-eyebrow">ARQUEO DE EFECTIVO</span><h3>¿Cómo se calcula el efectivo?</h3></div><span class="cash-balance-badge">Solo efectivo</span></div>
   <div class="cash-balance-lines">
    <div><span>Efectivo inicial</span><strong>${dinero(cj.saldo_inicial)}</strong></div>
    <div><span>Ingresos en efectivo</span><strong class="positive">+${dinero(por.EFECTIVO||0)}</strong></div>
    <div><span>Gastos pagados en efectivo</span><strong class="negative">−${dinero(gEf)}</strong></div>
    <div><span>Compras pagadas en efectivo</span><strong class="negative">−${dinero(cEf)}</strong></div>
    <div class="cash-balance-total"><span>Efectivo que debe haber</span><strong>${dinero(esp)}</strong></div>
   </div>
  </section>
  <section class="cash-income-section"><div class="cash-section-heading"><div><span class="cash-eyebrow">RECAUDO</span><h3>Ingresos por método de pago</h3></div><span class="cash-count">${dinero(totalIngresos)}</span></div>
   <div class="cash-method-grid">${Object.entries(por).length?Object.entries(por).map(([m,v])=>'<button type="button" class="cash-method-card" data-m="'+esc(m)+'"><span>'+esc(bonito(m))+'</span><strong>'+dinero(v)+'</strong><small>Ver movimientos →</small></button>').join(''):'<div class="cash-empty compact">Todavía no hay ingresos registrados.</div>'}</div>
  </section>
  <section class="cash-movements-section"><div class="cash-section-heading"><div><span class="cash-eyebrow">DETALLE DEL TURNO</span><h3>Movimientos de caja</h3></div><span class="cash-count" id="cash-movement-count">${totalMovimientos} movimientos</span></div>
   <div class="cash-movement-toolbar"><label for="cash-filter">Mostrar<select id="cash-filter"><option value="todos">Todos los movimientos</option><option value="ingreso">Ingresos</option><option value="gasto">Gastos</option><option value="compra">Pagos a proveedores</option></select></label><span>Ordenados del más reciente al más antiguo</span></div>
   <div class="cash-movement-list" id="cash-movement-list">${htmlMovimientos(movimientos)}</div>
  </section>
  <footer class="cash-actions"><div><strong>¿Terminaste el turno?</strong><small>Cuenta el efectivo físico y compáralo con el valor esperado antes de cerrar.</small></div><div><button class="btn sec" id="gs">＋ Registrar gasto</button><button class="btn cash-close-button" id="ce">Realizar cierre de caja</button></div></footer>
 </section>`;
 $('#gs').onclick=()=>gasto(cj);
 const filtrar=()=>{const filtro=$('#cash-filter').value,lista=movimientos.filter(m=>filtro==='todos'||m.tipo===filtro);$('#cash-movement-list').innerHTML=htmlMovimientos(lista);$('#cash-movement-count').textContent=lista.length+' movimientos'};
 $('#cash-filter').onchange=filtrar;
 document.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>detallePagos(b.dataset.m,ingresos.filter(p=>p.metodo_pago===b.dataset.m)));
 $('#ce').onclick=()=>{
  dlg.innerHTML=`<form id="df" class="cash-close-form"><header><span class="cash-eyebrow">CIERRE DE TURNO</span><h2>Arqueo y cierre de caja</h2><p>Cuenta únicamente el efectivo físico que tienes en el cajón.</p></header>
   <div class="cash-close-summary"><span>Efectivo esperado</span><strong>${dinero(esp)}</strong></div>
   <label for="ct">Efectivo contado físicamente</label><input id="ct" type="number" min="0" step="1" inputmode="decimal" placeholder="Escribe el valor contado" required>
   <div class="cash-close-difference" id="cash-difference"><span>Diferencia</span><strong>Ingresa el efectivo contado</strong></div>
   <label for="co">Observaciones del cierre <small>(opcional)</small></label><textarea id="co" rows="3" placeholder="Anota novedades, faltantes o sobrantes..."></textarea>
   <div class="cash-close-hint">Si el efectivo contado no coincide con el esperado, la diferencia quedará registrada para consulta posterior.</div>
   <div class="acts"><button type="button" class="btn sec" id="cx">Volver</button><button class="btn" id="cash-confirm-close">Confirmar cierre</button></div></form>`;
  dlg.showModal();$('#cx').onclick=()=>dlg.close();
  const diferencia=()=>{const valor=$('#ct').value,box=$('#cash-difference');if(valor===''){box.innerHTML='<span>Diferencia</span><strong>Ingresa el efectivo contado</strong>';return}const n=Number(valor),d=n-esp;if(!Number.isFinite(n)||n<0){box.innerHTML='<span>Diferencia</span><strong>Valor no válido</strong>';return}box.innerHTML='<span>'+(d===0?'Caja cuadrada':d>0?'Sobrante':'Faltante')+'</span><strong class="'+(d===0?'balanced':d>0?'positive':'negative')+'">'+(d>0?'+':'')+dinero(d)+'</strong>'};
  $('#ct').oninput=diferencia;
  let cerrando=false;$('#df').onsubmit=async e=>{e.preventDefault();if(cerrando)return;cerrando=true;const boton=$('#cash-confirm-close');if(boton)boton.disabled=true;const n=Number($('#ct').value);if($('#ct').value===''||!Number.isFinite(n)||n<0){cerrando=false;if(boton)boton.disabled=false;return toast('El efectivo contado debe ser un valor válido y no negativo.',true)}
   const{error}=await sb.from('cajas').update({estado_caja:'CERRADA',fecha_cierre:new Date().toISOString(),usuario_cierre:S.perfil.id,efectivo_esperado:esp,efectivo_contado:n,diferencia:n-esp,observaciones:$('#co').value.trim()||null}).eq('id',cj.id).eq('negocio_id',nid).eq('estado_caja','ABIERTA');
   if(error){cerrando=false;if(boton)boton.disabled=false;return toast(error.message,true)}dlg.close();toast('Caja cerrada correctamente');caja()};
 };
}
async function gasto(cj){
 const{data:cajaActiva,error:errorCaja}=await sb.from('cajas').select('id').eq('negocio_id',S.perfil.negocio_id).eq('estado_caja','ABIERTA').maybeSingle();
 if(errorCaja)return toast(errorCaja.message,true);
 if(!cajaActiva?.id)return toast('Para registrar un gasto, primero abre la caja.',true);
 cj=cajaActiva;
 dlg.innerHTML=`<form id="df"><h2>Registrar gasto</h2><label for="g1">Categoría</label><select id="g1" name="categoria_gasto">${['OPERATIVO','PRODUCTOS','COMISIONES','SERVICIOS_PUBLICOS','ARRIENDO','NOMINA','OTRO'].map(o=>`<option value="${o}">${bonito(o)}</option>`).join('')}</select>
 <label for="g2">Descripción</label><input id="g2" name="descripcion" required><label for="g3">Valor</label><input id="g3" name="valor" type="number" min="1" inputmode="decimal" required>
 <label for="g4">Método de pago</label><select id="g4" name="metodo_pago">${METODOS}</select><label for="g5">Proveedor</label><input id="g5" name="proveedor">
 <div class="acts"><button type="button" class="btn sec" id="cx">Cancelar</button><button class="btn">Guardar gasto</button></div></form>`;
 dlg.showModal();$('#cx').onclick=()=>dlg.close();
 let guardando=false;
 $('#df').onsubmit=async e=>{e.preventDefault();if(guardando)return;guardando=true;const boton=e.target.querySelector('button[type="submit"],button:not([type])');if(boton)boton.disabled=true;const f=Object.fromEntries(new FormData(e.target)),valor=Number(f.valor);if(!Number.isFinite(valor)||valor<=0){guardando=false;if(boton)boton.disabled=false;return toast('El valor del gasto debe ser un número válido mayor que cero.',true)}
  const{data:cajaActual,error:errorCajaActual}=await sb.from('cajas').select('id').eq('negocio_id',S.perfil.negocio_id).eq('estado_caja','ABIERTA').maybeSingle();
  if(errorCajaActual){guardando=false;if(boton)boton.disabled=false;return toast(errorCajaActual.message,true)}
  if(!cajaActual?.id){guardando=false;if(boton)boton.disabled=false;return toast('La caja se cerró. Abre una caja para registrar el gasto.',true)}
  const{error}=await sb.from('gastos').insert({...f,valor,proveedor:f.proveedor||null,negocio_id:S.perfil.negocio_id,usuario_registro:S.perfil.id,caja_id:cajaActual.id});
  if(error){guardando=false;if(boton)boton.disabled=false;return toast(error.message,true)}dlg.close();toast('Gasto guardado');caja()};
}
async function comisiones(){
 const[rd,rl]=await Promise.all([sb.from('detalle_ventas').select('id,subtotal,base_comision,porcentaje_comision_aplicado,comision_generada,ventas!inner(barbero_id,estado_venta,barberos(nombre))').eq('negocio_id',S.perfil.negocio_id).eq('ventas.estado_venta','PAGADA').gt('comision_generada',0).limit(1000),sb.from('comisiones').select('detalle_id').eq('negocio_id',S.perfil.negocio_id).limit(5000)]);
 if(rd.error)return toast(rd.error.message,true);if(rl.error)return toast(rl.error.message,true);
 const d=rd.data||[],l=rl.data||[];
 const hechos=new Set((l||[]).map(x=>x.detalle_id)),P={};
 d.filter(x=>!hechos.has(x.id)&&x.ventas.barbero_id).forEach(x=>{const b=x.ventas.barbero_id;P[b]=P[b]||{n:x.ventas.barberos?.nombre,t:0,L:[]};P[b].t+=Number(x.comision_generada);P[b].L.push(x)});
 const B=Object.entries(P);
 $('#main').innerHTML=`<div class="head"><h2>Comisiones</h2></div><p class="mute">Comisiones por pagar de ventas ya cobradas por completo.</p>
 ${B.length?B.map(([id,p])=>`<div class="row"><span><strong>${esc(p.n)}</strong><br><small>${p.L.length} servicio${p.L.length>1?'s':''}</small></span><span><strong>${dinero(p.t)}</strong><br><button class="btn" data-b="${id}">Liquidar</button></span></div>`).join(''):'<p class="empty">No hay comisiones pendientes.</p>'}`;
 document.querySelectorAll('[data-b]').forEach(b=>b.onclick=async()=>{
  if(b.disabled)return;
  const p=P[b.dataset.b];
  if(!confirm('¿Liquidar '+dinero(p.t)+' a '+p.n+'?'))return;
  b.disabled=true;
  const ef=confirm('¿Se pagó en efectivo desde la caja?\nAceptar = efectivo. Cancelar = transferencia.');
  const{data:cj,error:errorCaja}=await sb.from('cajas').select('id').eq('negocio_id',S.perfil.negocio_id).eq('estado_caja','ABIERTA').maybeSingle();
  if(errorCaja){b.disabled=false;return toast('No fue posible verificar la caja: '+errorCaja.message,true)}
  if(!cj?.id){b.disabled=false;return toast('Para liquidar comisiones, primero abre la caja.',true)}
  const ahora=new Date().toISOString(),{error}=await sb.from('comisiones').insert(p.L.map(x=>({negocio_id:S.perfil.negocio_id,barbero_id:b.dataset.b,detalle_id:x.id,valor_base:x.base_comision??x.subtotal,valor_comision:x.comision_generada,estado_liquidacion:'LIQUIDADA',fecha_pago:ahora})));
  if(error){b.disabled=false;return toast(error.message,true)}
  const r=await sb.from('gastos').insert({negocio_id:S.perfil.negocio_id,categoria_gasto:'COMISIONES',descripcion:'Liquidación de comisión a '+p.n,valor:p.t,metodo_pago:ef?'EFECTIVO':'TRANSFERENCIA',usuario_registro:S.perfil.id,caja_id:cj?.id||null});
  toast(r.error?'Se liquidó, pero no se registró en caja: '+r.error.message:'Comisión liquidada y registrada en caja',!!r.error);
  comisiones()
 });
}


async function misComisiones(){
 const b=S.perfil.barbero_id,main=$('#main');
 if(!b)return main.innerHTML='<div class="head"><h2>Mis comisiones</h2></div><p class="empty">Tu usuario no está ligado a un barbero. Pide a la administración que lo configure.</p>';
 const[rd,rl]=await Promise.all([sb.from('detalle_ventas').select('id,descripcion,cantidad,subtotal,base_comision,porcentaje_comision_aplicado,comision_generada,ventas!inner(fecha_hora,barbero_id,estado_venta)').eq('negocio_id',S.perfil.negocio_id).eq('ventas.barbero_id',b).eq('ventas.estado_venta','PAGADA').gt('comision_generada',0).limit(500),sb.from('comisiones').select('detalle_id').eq('negocio_id',S.perfil.negocio_id).eq('barbero_id',b).limit(2000)]);
 if(rd.error)return toast(rd.error.message,true);if(rl.error)return toast(rl.error.message,true);
 const d=rd.data||[],l=rl.data||[];
 const pagado=new Set((l||[]).map(x=>x.detalle_id)),L=(d||[]).sort((p,q)=>new Date(q.ventas.fecha_hora)-new Date(p.ventas.fecha_hora)),pend=L.filter(x=>!pagado.has(x.id)),hist=L.filter(x=>pagado.has(x.id)),sum=a=>a.reduce((t,x)=>t+Number(x.comision_generada),0);
 const fl=x=>fila2(esc(x.descripcion)+'<br><small>'+new Date(x.ventas.fecha_hora).toLocaleDateString('es-CO',{day:'numeric',month:'short'})+(x.porcentaje_comision_aplicado!==null&&x.porcentaje_comision_aplicado!==undefined?' · '+x.porcentaje_comision_aplicado+'%':'')+'</small>',dinero(x.comision_generada));
 main.innerHTML=`<div class="head"><h2>Mis comisiones</h2></div><div class="kp"><div><small>Por cobrar</small><strong>${dinero(sum(pend))}</strong></div><div><small>Ya liquidado</small><strong>${dinero(sum(hist))}</strong></div></div>
 ${pend.length?'<label>Pendientes</label>'+pend.slice(0,30).map(fl).join(''):'<p class="empty">No tienes comisiones pendientes.</p>'}${hist.length?'<label>Últimas liquidadas</label>'+hist.slice(0,15).map(fl).join(''):''}`;
}


function detallePagos(m,L){
 const por={};L.forEach(p=>{const n=p.cuentas?p.cuentas.nombre+(p.cuentas.detalle?' ('+p.cuentas.detalle+')':''):'Sin cuenta registrada';por[n]=(por[n]||0)+Number(p.valor_pago)});
 dlg.innerHTML=`<h2>Cobrado en ${bonito(m).toLowerCase()}</h2><p class="tot">${dinero(L.reduce((t,p)=>t+Number(p.valor_pago),0))}</p>
 ${m==='EFECTIVO'?'':'<label>Por cuenta</label>'+Object.entries(por).map(([n,v])=>fila2(esc(n),dinero(v))).join('')}
 <label>Movimientos</label>${L.map(p=>fila2(hora(p.fecha_hora)+', '+esc(p.ventas?.clientes?.nombre||'Cliente de paso')+(p.cuentas&&m!=='EFECTIVO'?'<br><small>'+esc(p.cuentas.nombre)+'</small>':''),dinero(p.valor_pago))).join('')}
 <div class="acts"><button type="button" class="btn sec" id="cx">Cerrar</button></div>`;
 dlg.showModal();$('#cx').onclick=()=>dlg.close();
}

 return { caja, comisiones, misComisiones };
}
