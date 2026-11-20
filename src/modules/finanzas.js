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
  await historialCaja();
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
 await historialCaja();
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
async function historialCaja(){
 const shell=document.querySelector('#main .cash-shell');if(!shell)return;
 const fechaLocal=d=>{const x=new Date(d.getTime()-d.getTimezoneOffset()*60000);return x.toISOString().slice(0,10)};
 const hoy=new Date(),fin=fechaLocal(hoy),inicioDate=new Date(hoy);inicioDate.setDate(inicioDate.getDate()-6);const inicio=fechaLocal(inicioDate);
 const section=document.createElement('section');section.className='cash-history cash-report';
 section.innerHTML='<div class="cash-section-heading"><div><span class="cash-eyebrow">CONSULTAS E INFORMES</span><h3>Historial de caja y movimientos</h3><p class="cash-report-subtitle">Consulta ingresos, egresos y cierres anteriores sin modificar los registros.</p></div><span class="cash-count">Por período</span></div>'+
 '<form class="cash-report-filters" id="cash-report-form"><label>Desde<input type="date" name="desde" value="'+inicio+'" required></label><label>Hasta<input type="date" name="hasta" value="'+fin+'" required></label>'+
 '<div class="cash-report-presets"><button type="button" class="btn sec" data-cash-period="hoy">Hoy</button><button type="button" class="btn sec" data-cash-period="7">7 días</button><button type="button" class="btn sec" data-cash-period="30">30 días</button><button type="button" class="btn sec" data-cash-period="mes">Este mes</button></div><button class="btn" type="submit">Consultar</button></form>'+
 '<div id="cash-report-results"><div class="cash-empty compact">Preparando consulta…</div></div>';
 shell.append(section);
 const form=section.querySelector('#cash-report-form'),results=section.querySelector('#cash-report-results');
 const fechaISO=d=>{const x=new Date(d.getTime()-d.getTimezoneOffset()*60000);return x.toISOString().slice(0,10)};
 const fechaMostrar=d=>new Date(d).toLocaleString('es-CO',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
 const csvCell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';let ultimaConsulta=[];
 async function consultar(){
  const desde=form.elements.desde.value,hasta=form.elements.hasta.value;
  if(!desde||!hasta||desde>hasta)return toast('Verifica el rango de fechas: la fecha inicial no puede ser posterior a la final.',true);
  const inicioUTC=new Date(desde+'T00:00:00').toISOString(),finDate=new Date(hasta+'T00:00:00');finDate.setDate(finDate.getDate()+1);const finUTC=finDate.toISOString(),nid=S.perfil.negocio_id;
  results.innerHTML='<div class="cash-empty compact">Consultando movimientos del período…</div>';
  const traerTodo=async crear=>{
   const acumulado=[];let desde=0,lote=[];
   do{const{data,error}=await crear().range(desde,desde+999);if(error)throw error;lote=data||[];acumulado.push(...lote);desde+=lote.length}while(lote.length===1000);
   return acumulado;
  };
  let cajas=[],pagos=[],gastos=[],compras=[];
  try{
   const [abiertasPorInicio,cerradasPorCierre,p,g,pc]=await Promise.all([
    traerTodo(()=>sb.from('cajas').select('*').eq('negocio_id',nid).gte('fecha_apertura',inicioUTC).lt('fecha_apertura',finUTC).order('fecha_apertura',{ascending:false})),
    traerTodo(()=>sb.from('cajas').select('*').eq('negocio_id',nid).eq('estado_caja','CERRADA').gte('fecha_cierre',inicioUTC).lt('fecha_cierre',finUTC).order('fecha_cierre',{ascending:false})),
    traerTodo(()=>sb.from('pagos').select('valor_pago,metodo_pago,fecha_hora,estado_pago,ventas(estado_venta,clientes(nombre))').eq('negocio_id',nid).eq('estado_pago','REGISTRADO').gte('fecha_hora',inicioUTC).lt('fecha_hora',finUTC).order('fecha_hora',{ascending:false})),
    traerTodo(()=>sb.from('gastos').select('valor,metodo_pago,fecha_hora,descripcion,categoria_gasto,proveedor,estado_gasto,caja_id').eq('negocio_id',nid).eq('estado_gasto','REGISTRADO').gte('fecha_hora',inicioUTC).lt('fecha_hora',finUTC).order('fecha_hora',{ascending:false})),
    traerTodo(()=>sb.from('pagos_compras_inventario').select('valor_pago,metodo_pago,fecha_pago,compra_id,caja_id').eq('negocio_id',nid).gte('fecha_pago',inicioUTC).lt('fecha_pago',finUTC).order('fecha_pago',{ascending:false}))
   ]);
   const unicas=new Map();[...abiertasPorInicio,...cerradasPorCierre].forEach(c=>unicas.set(c.id,c));cajas=[...unicas.values()].sort((a,b)=>new Date(b.fecha_apertura)-new Date(a.fecha_apertura));
   pagos=p;gastos=g;compras=pc;
  }catch(error){results.innerHTML='<div class="cash-empty"><strong>No fue posible consultar el historial</strong><p>'+esc(error.message||'Error de consulta')+'</p></div>';return}
  pagos=pagos.filter(p=>p.ventas?.estado_venta!=='ANULADA');
  const movimientos=[
   ...pagos.map(p=>({fecha:p.fecha_hora,tipo:'Ingreso',concepto:p.ventas?.clientes?.nombre||'Cliente de paso',metodo:p.metodo_pago,valor:Number(p.valor_pago),caja:'No asignada'})),
   ...gastos.map(g=>({fecha:g.fecha_hora,tipo:'Gasto',concepto:g.descripcion||bonito(g.categoria_gasto),metodo:g.metodo_pago,valor:-Number(g.valor),caja:g.caja_id||'No asignada'})),
   ...compras.map(p=>({fecha:p.fecha_pago,tipo:'Pago a proveedor',concepto:'Compra '+String(p.compra_id||'').slice(0,8),metodo:p.metodo_pago,valor:-Number(p.valor_pago),caja:p.caja_id||'No asignada'}))
  ].sort((a,b)=>new Date(b.fecha)-new Date(a.fecha));
  const totalIngresos=pagos.reduce((s,p)=>s+Number(p.valor_pago||0),0),totalGastos=gastos.reduce((s,g)=>s+Number(g.valor||0),0),totalCompras=compras.reduce((s,p)=>s+Number(p.valor_pago||0),0),totalEgresos=totalGastos+totalCompras;
  const porMetodo={};pagos.forEach(p=>porMetodo[p.metodo_pago]=(porMetodo[p.metodo_pago]||0)+Number(p.valor_pago||0));ultimaConsulta=movimientos;
  const tarjetas=cajas.length?cajas.map(c=>{const d=Number(c.diferencia||0);return '<article class="cash-history-card"><div class="cash-history-top"><strong>'+fechaMostrar(c.fecha_apertura)+'</strong><span class="cash-difference '+(c.estado_caja==='ABIERTA'?'balanced':d===0?'balanced':d>0?'surplus':'shortage')+'">'+(c.estado_caja==='ABIERTA'?'Abierta':(d>0?'+':'')+dinero(d))+'</span></div><div class="cash-history-values"><span><small>Saldo inicial</small><strong>'+dinero(c.saldo_inicial)+'</strong></span><span><small>Efectivo esperado</small><strong>'+dinero(c.efectivo_esperado??0)+'</strong></span><span><small>Efectivo contado</small><strong>'+dinero(c.efectivo_contado??0)+'</strong></span><span><small>Cierre</small><strong>'+(c.fecha_cierre?fechaMostrar(c.fecha_cierre):'En curso')+'</strong></span></div><small class="cash-history-note">'+esc(c.observaciones||'Sin observaciones')+'</small></article>'}).join(''):'<div class="cash-empty compact">No hay aperturas de caja en este período.</div>';
  const detalle=movimientos.length?movimientos.map(m=>'<article class="cash-movement"><span class="cash-movement-icon '+(m.valor>=0?'ingreso':'gasto')+'">'+(m.valor>=0?'↙':'↗')+'</span><span class="cash-movement-info"><strong>'+esc(m.concepto)+'</strong><small>'+esc(m.tipo)+' · '+esc(bonito(m.metodo||''))+'</small><small>'+fechaMostrar(m.fecha)+'</small></span><strong class="cash-movement-value '+(m.valor>=0?'positive':'negative')+'">'+(m.valor>=0?'+':'−')+dinero(Math.abs(m.valor))+'</strong></article>').join(''):'<div class="cash-empty compact">No hay movimientos en el período seleccionado.</div>';
  results.innerHTML='<div class="cash-report-metrics"><article><small>Ingresos</small><strong>'+dinero(totalIngresos)+'</strong><span>'+pagos.length+' pagos válidos</span></article><article><small>Egresos</small><strong>'+dinero(totalEgresos)+'</strong><span>Gastos y pagos a proveedores</span></article><article><small>Balance neto</small><strong class="'+(totalIngresos-totalEgresos>=0?'positive':'negative')+'">'+dinero(totalIngresos-totalEgresos)+'</strong><span>Ingresos menos egresos</span></article><article><small>Cierres / aperturas</small><strong>'+cajas.length+'</strong><span>'+cajas.filter(c=>c.estado_caja==='CERRADA').length+' cerradas · '+cajas.filter(c=>c.estado_caja==='ABIERTA').length+' abiertas</span></article></div>'+
   '<div class="cash-report-methods"><strong>Ingresos por medio de pago</strong>'+(Object.entries(porMetodo).length?Object.entries(porMetodo).map(([m,v])=>'<span>'+esc(bonito(m))+' <b>'+dinero(v)+'</b></span>').join(''):'<small>Sin ingresos registrados</small>')+'</div>'+
   '<div class="cash-report-subsection"><div class="cash-section-heading"><div><span class="cash-eyebrow">TURNOS</span><h4>Aperturas y cierres</h4></div><span class="cash-count">'+cajas.length+' registros</span></div><div class="cash-history-grid">'+tarjetas+'</div></div>'+
   '<div class="cash-report-subsection"><div class="cash-section-heading"><div><span class="cash-eyebrow">DETALLE</span><h4>Movimientos del período</h4></div><button type="button" class="btn sec" id="cash-export">Exportar CSV</button></div><div class="cash-movement-list">'+detalle+'</div></div>';
  const exportar=results.querySelector('#cash-export');if(exportar)exportar.onclick=()=>{
   const filas=[['Fecha','Tipo','Concepto','Método de pago','Valor','Caja'],...ultimaConsulta.map(m=>[fechaMostrar(m.fecha),m.tipo,m.concepto,m.metodo,m.valor,m.caja])];
   const contenido='\uFEFF'+filas.map(f=>f.map(csvCell).join(';')).join('\r\n'),url=URL.createObjectURL(new Blob([contenido],{type:'text/csv;charset=utf-8;'})),a=document.createElement('a');a.href=url;a.download='caja_'+desde+'_a_'+hasta+'.csv';a.click();URL.revokeObjectURL(url);
  };
 }
 form.onsubmit=async e=>{e.preventDefault();await consultar()};
 section.querySelectorAll('[data-cash-period]').forEach(b=>b.onclick=()=>{
  const ahora=new Date(),modo=b.dataset.cashPeriod;let desde=new Date(ahora);
  if(modo==='mes')desde=new Date(ahora.getFullYear(),ahora.getMonth(),1);else if(modo!=='hoy')desde.setDate(desde.getDate()-Number(modo)+1);
  form.elements.desde.value=fechaISO(desde);form.elements.hasta.value=fechaISO(ahora);consultar();
 });
 await consultar();
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
function fechaLiquidacion(){
 const z=S.negocio?.zona_horaria||'America/Bogota';
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:z,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day;
}
function movimientosAnticipo(movimientos){
 const aplicados={};
 movimientos.filter(m=>m.tipo_movimiento==='APLICACION_ANTICIPO').forEach(m=>{
  aplicados[m.movimiento_origen_id]=(aplicados[m.movimiento_origen_id]||0)+Number(m.valor||0);
 });
 const saldos={};
 movimientos.filter(m=>m.tipo_movimiento==='ANTICIPO').forEach(m=>{
  const saldo=Math.max(0,Number(m.valor||0)-(aplicados[m.id]||0));
  saldos[m.barbero_id]=(saldos[m.barbero_id]||0)+saldo;
 });
 return saldos;
}
async function comisiones(){
 const nid=S.perfil.negocio_id,main=$('#main');
 main.innerHTML='<div class="liquidation-shell"><div class="liquidation-loading">Preparando liquidaciones…</div></div>';
 const [rd,rl,rm,rh,rb,rc]=await Promise.all([
  sb.from('detalle_ventas').select('id,descripcion,cantidad,subtotal,base_comision,porcentaje_comision_aplicado,comision_generada,ventas!inner(id,fecha_hora,barbero_id,estado_venta,barberos(nombre))').eq('negocio_id',nid).eq('ventas.estado_venta','PAGADA').gt('comision_generada',0).order('id').limit(3000),
  sb.from('comisiones').select('detalle_id').eq('negocio_id',nid).not('detalle_id','is',null).limit(10000),
  sb.from('movimientos_liquidacion_barbero').select('id,barbero_id,tipo_movimiento,valor,movimiento_origen_id').eq('negocio_id',nid).in('tipo_movimiento',['ANTICIPO','APLICACION_ANTICIPO']).limit(10000),
  sb.from('liquidaciones_barbero').select('id,barbero_id,fecha_liquidacion,total_neto,total_pagado,saldo_pendiente,estado_liquidacion,barberos(nombre)').eq('negocio_id',nid).order('creado_en',{ascending:false}).limit(30),
  sb.from('barberos').select('id,nombre,modelo_pago').eq('negocio_id',nid).eq('estado','ACTIVO').order('nombre'),
  sb.from('cajas').select('id').eq('negocio_id',nid).eq('estado_caja','ABIERTA').maybeSingle()
 ]);
 const error=[rd,rl,rm,rh,rb,rc].find(x=>x.error);
 if(error)return toast('No fue posible preparar las liquidaciones: '+error.error.message,true);
 const hechos=new Set((rl.data||[]).map(x=>x.detalle_id));
 const avances=movimientosAnticipo(rm.data||[]);
 const P={};
 (rd.data||[]).filter(x=>!hechos.has(x.id)&&x.ventas?.barbero_id).forEach(x=>{
  const id=x.ventas.barbero_id;
  P[id]=P[id]||{n:x.ventas.barberos?.nombre||'Barbero',t:0,anticipos:avances[id]||0,L:[]};
  P[id].t+=Number(x.comision_generada||0);P[id].L.push(x);
 });
 const B=Object.entries(P);
 const totalComisiones=B.reduce((s,[,p])=>s+p.t,0);
 const totalAnticipos=Object.values(avances).reduce((s,n)=>s+n,0);
 const neto=B.reduce((s,[,p])=>s+Math.max(0,p.t-p.anticipos),0);
 const fecha=fechaLiquidacion();
 main.innerHTML='<div class="liquidation-shell">'+
  '<header class="liquidation-header"><div><span class="liquidation-eyebrow">CONTROL DE PAGOS DEL EQUIPO</span><h2>Liquidaciones de barberos</h2><p>Comisiones disponibles únicamente de servicios pagados por completo.</p></div><div class="liquidation-actions"><button type="button" class="btn sec" id="liq-historial">Historial</button><button type="button" class="btn" id="liq-anticipo">Registrar anticipo</button></div></header>'+
  '<section class="liquidation-kpis"><article><small>Comisiones por liquidar</small><strong>'+dinero(totalComisiones)+'</strong><span>Servicios cobrados completos</span></article><article><small>Anticipos pendientes</small><strong>'+dinero(totalAnticipos)+'</strong><span>Por descontar de futuras liquidaciones</span></article><article class="liquidation-kpi-primary"><small>Neto estimado del equipo</small><strong>'+dinero(neto)+'</strong><span>Después de anticipos registrados</span></article></section>'+
  '<section class="liquidation-section-head"><div><h3>Liquidaciones pendientes</h3><p>Selecciona un barbero para revisar servicios, descuentos y pagos.</p></div><span>'+B.length+' barbero'+(B.length===1?'':'s')+'</span></section>'+
  '<div class="liquidation-grid">'+(B.length?B.map(([id,p])=>{
   const fechas=p.L.map(x=>new Date(x.ventas.fecha_hora).getTime()).filter(Number.isFinite);
   const desde=fechas.length?new Date(Math.min(...fechas)).toLocaleDateString('es-CO',{day:'numeric',month:'short'}):'';
   const hasta=fechas.length?new Date(Math.max(...fechas)).toLocaleDateString('es-CO',{day:'numeric',month:'short'}):'';
   return '<article class="liquidation-card"><div class="liquidation-card-head"><div><span class="liquidation-eyebrow">BARBERO</span><h3>'+esc(p.n)+'</h3><small>'+p.L.length+' servicio'+(p.L.length===1?'':'s')+' · '+desde+(desde!==hasta?' – '+hasta:'')+'</small></div><span class="liquidation-status">Pendiente</span></div><div class="liquidation-card-values"><div><small>Comisiones</small><strong>'+dinero(p.t)+'</strong></div><div><small>Anticipos</small><strong class="liquidation-deduction">-'+dinero(p.anticipos)+'</strong></div></div><div class="liquidation-card-total"><span>Neto estimado</span><strong>'+dinero(Math.max(0,p.t-p.anticipos))+'</strong></div><button type="button" class="btn block" data-liquidar="'+id+'">Preparar liquidación</button></article>';
  }).join(''):'<div class="liquidation-empty"><strong>Todo al día</strong><span>No hay comisiones pendientes de liquidar. Los servicios que aún tengan saldo no generan comisión.</span></div>')+'</div>'+
  '<p class="liquidation-footnote">'+(rc.data?.id?'Caja abierta: los anticipos y pagos se registrarán en el turno activo.':'No hay caja abierta. Puedes preparar liquidaciones sin pago, pero para entregar dinero debes abrir Caja.')+'</p>'+
  '</div>';
 $('#liq-anticipo').onclick=()=>registrarAnticipo(rb.data||[]);
 $('#liq-historial').onclick=()=>historialLiquidaciones();
 document.querySelectorAll('[data-liquidar]').forEach(b=>b.onclick=()=>prepararLiquidacion(b.dataset.liquidar,P[b.dataset.liquidar],!!rc.data?.id));
}
function prepararLiquidacion(id,p,cajaAbierta){
 const anticipoDisponible=p.anticipos,neto=Math.max(0,p.t-anticipoDisponible);
 const filas=p.L.slice().sort((a,b)=>new Date(a.ventas.fecha_hora)-new Date(b.ventas.fecha_hora)).map(x=>'<div class="liquidation-detail-row"><span><strong>'+esc(x.descripcion||'Servicio')+'</strong><small>'+new Date(x.ventas.fecha_hora).toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'numeric'})+' · '+(x.porcentaje_comision_aplicado||0)+'% · '+Number(x.cantidad||1)+' unidad(es)</small></span><strong>'+dinero(x.comision_generada)+'</strong></div>').join('');
 dlg.innerHTML='<form id="liq-form" class="liquidation-form"><header><span class="liquidation-eyebrow">CIERRE DIARIO</span><h2>Liquidar a '+esc(p.n)+'</h2><p>Revisa los servicios cobrados antes de confirmar.</p></header>'+
  '<div class="liquidation-breakdown">'+filas+'</div>'+
  '<label>Fecha de liquidación<input type="date" id="liq-fecha" value="'+fechaLiquidacion()+'" required></label>'+
  '<div class="liquidation-summary-line"><span>Comisiones generadas</span><strong>'+dinero(p.t)+'</strong></div>'+
  '<div class="liquidation-summary-line"><span>Anticipos disponibles para aplicar</span><strong class="liquidation-deduction">-'+dinero(anticipoDisponible)+'</strong></div>'+
  '<label>Descuento adicional<input type="number" id="liq-descuento" min="0" max="'+p.t+'" step="0.01" value="0" inputmode="decimal"></label>'+
  '<label>Motivo del descuento<input id="liq-motivo" maxlength="180" placeholder="Ej. Herramienta perdida, ajuste acordado"></label>'+
  '<div class="liquidation-net"><span>Neto después de descuentos y anticipos</span><strong id="liq-neto">'+dinero(neto)+'</strong></div>'+
  '<label>Dinero que se entrega hoy<input type="number" id="liq-pago" min="0" step="0.01" value="'+(cajaAbierta?neto:0)+'" inputmode="decimal"></label>'+
  '<label>Método de pago<select id="liq-metodo">'+METODOS+'</select></label>'+
  '<label>Observaciones<textarea id="liq-observaciones" rows="2" placeholder="Observaciones de la liquidación"></textarea></label>'+
  '<p class="liquidation-hint" id="liq-saldo"></p>'+
  '<div class="acts"><button type="button" class="btn sec" id="liq-cerrar">Cancelar</button><button class="btn" id="liq-guardar">Confirmar liquidación</button></div></form>';
 dlg.showModal();$('#liq-cerrar').onclick=()=>dlg.close();
 const calc=()=>{
  const descuento=Number($('#liq-descuento').value)||0,pago=Number($('#liq-pago').value)||0;
  const anticipoAplicado=Math.min(anticipoDisponible,Math.max(0,p.t-descuento)),total=Math.max(0,p.t-descuento-anticipoAplicado),saldo=Math.max(0,total-pago);
  $('#liq-neto').textContent=dinero(total);
  $('#liq-saldo').textContent='Saldo que quedará pendiente: '+dinero(saldo);
  return{descuento,pago,total,saldo};
 };
 $('#liq-descuento').oninput=calc;$('#liq-pago').oninput=calc;calc();
 $('#liq-form').onsubmit=async e=>{
  e.preventDefault();const b=$('#liq-guardar');if(b.disabled)return;
  const c=calc(),motivo=$('#liq-motivo').value.trim();
  if(!$('#liq-fecha').value)return toast('Selecciona la fecha de liquidación.',true);
  if(!Number.isFinite(c.descuento)||c.descuento<0||c.descuento>p.t)return toast('El descuento supera el valor disponible.',true);
  if(c.descuento>0&&motivo.length<3)return toast('Indica el motivo del descuento.',true);
  if(!Number.isFinite(c.pago)||c.pago<0||c.pago>c.total)return toast('El pago de hoy no puede superar el neto.',true);
  if(c.pago>0&&!cajaAbierta)return toast('Abre Caja para registrar el pago. También puedes dejar el pago en cero y liquidar el saldo después.',true);
  b.disabled=true;
  const descuentos=c.descuento>0?[{valor:c.descuento,motivo}]:[];
  const{data,error}=await sb.rpc('liquidar_barbero',{p_barbero_id:id,p_fecha:$('#liq-fecha').value,p_descuentos:descuentos,p_pago_inicial:c.pago,p_metodo_pago:$('#liq-metodo').value,p_observaciones:$('#liq-observaciones').value.trim()||null});
  if(error){b.disabled=false;return toast(traducir(error.message),true)}
  dlg.close();toast('Liquidación registrada. Saldo pendiente: '+dinero(Number(data?.saldo_pendiente||0)));comisiones();
 };
}
async function registrarAnticipo(barberos){
 dlg.innerHTML='<form id="anticipo-form" class="liquidation-form"><header><span class="liquidation-eyebrow">ADELANTO DE DINERO</span><h2>Registrar anticipo</h2><p>El valor se registra como egreso de Caja y se descontará de próximas liquidaciones.</p></header>'+
  '<label>Barbero<select id="ant-barbero" required>'+barberos.map(b=>'<option value="'+b.id+'">'+esc(b.nombre)+'</option>').join('')+'</select></label>'+
  '<label>Valor del anticipo<input id="ant-valor" type="number" min="1" step="0.01" inputmode="decimal" required></label>'+
  '<label>Método de entrega<select id="ant-metodo">'+METODOS+'</select></label>'+
  '<label>Motivo<input id="ant-motivo" maxlength="180" placeholder="Ej. Anticipo de la semana" required></label>'+
  '<div class="acts"><button type="button" class="btn sec" id="ant-cerrar">Cancelar</button><button class="btn" id="ant-guardar">Registrar anticipo</button></div></form>';
 dlg.showModal();$('#ant-cerrar').onclick=()=>dlg.close();
 $('#anticipo-form').onsubmit=async e=>{
  e.preventDefault();const b=$('#ant-guardar');if(b.disabled)return;
  const valor=Number($('#ant-valor').value),motivo=$('#ant-motivo').value.trim();
  if(!(valor>0)||motivo.length<3)return toast('Revisa el valor y el motivo del anticipo.',true);
  b.disabled=true;
  const{error}=await sb.rpc('registrar_anticipo_barbero',{p_barbero_id:$('#ant-barbero').value,p_valor:valor,p_motivo:motivo,p_metodo_pago:$('#ant-metodo').value});
  if(error){b.disabled=false;return toast(traducir(error.message),true)}
  dlg.close();toast('Anticipo registrado en Caja y en la cuenta del barbero.');comisiones();
 };
}
async function historialLiquidaciones(){
 const nid=S.perfil.negocio_id;
 const[r,l]=await Promise.all([
  sb.from('liquidaciones_barbero').select('*,barberos(nombre)').eq('negocio_id',nid).order('creado_en',{ascending:false}).limit(40),
  sb.from('comisiones').select('barbero_id,fecha_pago,valor_comision,barberos(nombre)').eq('negocio_id',nid).eq('estado_liquidacion','LIQUIDADA').is('liquidacion_id',null).order('fecha_pago',{ascending:false}).limit(200)
 ]);
 if(r.error)return toast(r.error.message,true);if(l.error)return toast(l.error.message,true);
 const grupos={};
 (l.data||[]).forEach(x=>{const fecha=String(x.fecha_pago||'').slice(0,10),key=x.barbero_id+'|'+fecha;grupos[key]=grupos[key]||{nombre:x.barberos?.nombre||'Barbero',fecha,total:0,cantidad:0};grupos[key].total+=Number(x.valor_comision||0);grupos[key].cantidad++});
 dlg.innerHTML='<div class="liquidation-history"><header><span class="liquidation-eyebrow">CONSULTA DE PAGOS</span><h2>Historial de liquidaciones</h2><p>Pagos diarios, abonos y saldos pendientes.</p></header>'+
  ((r.data||[]).length?(r.data||[]).map(x=>'<button type="button" class="liquidation-history-row" data-historial="'+x.id+'"><span><strong>'+esc(x.barberos?.nombre||'Barbero')+'</strong><small>'+new Date(x.fecha_liquidacion+'T12:00:00').toLocaleDateString('es-CO',{dateStyle:'medium'})+' · '+bonito(x.estado_liquidacion)+'</small></span><span><strong>'+dinero(x.total_neto)+'</strong><small>Pagado '+dinero(x.total_pagado)+' · Saldo '+dinero(x.saldo_pendiente)+'</small></span></button>').join(''):'<p class="empty">Todavía no hay liquidaciones registradas.</p>')+
  (Object.keys(grupos).length?'<h3>Liquidaciones anteriores</h3>'+Object.values(grupos).map(x=>'<div class="liquidation-history-row"><span><strong>'+esc(x.nombre)+'</strong><small>'+x.fecha+' · '+x.cantidad+' comisión(es)</small></span><strong>'+dinero(x.total)+'</strong></div>').join(''):'')+
  '<div class="acts"><button type="button" class="btn sec" id="hist-cerrar">Cerrar</button></div></div>';
 if(!dlg.open)dlg.showModal();$('#hist-cerrar').onclick=()=>dlg.close();
 document.querySelectorAll('[data-historial]').forEach(b=>b.onclick=()=>verLiquidacion((r.data||[]).find(x=>x.id===b.dataset.historial)));
}
async function verLiquidacion(l){
 const{data:m,error}=await sb.from('movimientos_liquidacion_barbero').select('*').eq('negocio_id',S.perfil.negocio_id).eq('liquidacion_id',l.id).order('fecha_hora');
 if(error)return toast(error.message,true);
 const filas=(m||[]).map(x=>'<div class="liquidation-history-row"><span><strong>'+bonito(x.tipo_movimiento)+'</strong><small>'+esc(x.motivo||'')+' · '+new Date(x.fecha_hora).toLocaleDateString('es-CO')+'</small></span><strong>'+dinero(x.valor)+'</strong></div>').join('');
 dlg.innerHTML='<div class="liquidation-history"><header><span class="liquidation-eyebrow">DETALLE DE LIQUIDACIÓN</span><h2>'+esc(l.barberos?.nombre||'Barbero')+'</h2><p>'+l.fecha_liquidacion+' · '+bonito(l.estado_liquidacion)+'</p></header>'+
  '<div class="liquidation-summary-line"><span>Comisiones</span><strong>'+dinero(l.total_comisiones)+'</strong></div><div class="liquidation-summary-line"><span>Descuentos</span><strong class="liquidation-deduction">-'+dinero(l.total_descuentos)+'</strong></div><div class="liquidation-summary-line"><span>Anticipos aplicados</span><strong class="liquidation-deduction">-'+dinero(l.total_anticipos)+'</strong></div><div class="liquidation-summary-line"><span>Neto</span><strong>'+dinero(l.total_neto)+'</strong></div><div class="liquidation-summary-line"><span>Pagado</span><strong>'+dinero(l.total_pagado)+'</strong></div><div class="liquidation-net"><span>Saldo pendiente</span><strong>'+dinero(l.saldo_pendiente)+'</strong></div>'+
  (filas?'<h3>Movimientos</h3>'+filas:'')+
  (Number(l.saldo_pendiente)>0&&l.estado_liquidacion!=='ANULADA'?'<form id="abono-form"><label>Registrar abono<input id="abono-valor" type="number" min="0.01" max="'+Number(l.saldo_pendiente)+'" step="0.01" value="'+Number(l.saldo_pendiente)+'" required></label><label>Método<select id="abono-metodo">'+METODOS+'</select></label><label>Observación<input id="abono-motivo" value="Abono a liquidación"></label><button class="btn block" id="abono-guardar">Registrar abono</button></form>':'')+
  '<div class="acts"><button type="button" class="btn sec" id="ver-cerrar">Volver</button></div></div>';
 $('#ver-cerrar').onclick=()=>historialLiquidaciones();
 const form=$('#abono-form');if(form)form.onsubmit=async e=>{
  e.preventDefault();const b=$('#abono-guardar');if(b.disabled)return;
  const valor=Number($('#abono-valor').value);
  if(!(valor>0)||valor>Number(l.saldo_pendiente))return toast('El abono debe ser positivo y no superar el saldo.',true);
  b.disabled=true;
  const{error}=await sb.rpc('registrar_abono_liquidacion_barbero',{p_liquidacion_id:l.id,p_valor:valor,p_metodo_pago:$('#abono-metodo').value,p_motivo:$('#abono-motivo').value.trim()});
  if(error){b.disabled=false;return toast(traducir(error.message),true)}
  toast('Abono registrado en Caja');historialLiquidaciones();
 };
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
