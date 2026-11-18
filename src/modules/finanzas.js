// Módulo de caja, gastos y liquidación de comisiones.
export function crearModuloFinanzas(deps) {
 const { $, dlg, sb, S, esc, dinero, hora, bonito, toast, METODOS, fila2, fm } = deps;
async function caja(){
 const main=$('#main'),{data:cj,error:errorCaja}=await sb.from('cajas').select('*').eq('negocio_id',S.perfil.negocio_id).eq('estado_caja','ABIERTA').maybeSingle();
 if(errorCaja)return toast(errorCaja.message,true);
 if(!cj){
  const{data:u,error:errorCierres}=await sb.from('cajas').select('*').eq('negocio_id',S.perfil.negocio_id).eq('estado_caja','CERRADA').order('fecha_cierre',{ascending:false}).limit(5);
  if(errorCierres)return toast(errorCierres.message,true);
  main.innerHTML=`<div class="head"><h2>Caja</h2><button class="btn sec" id="gs">Registrar gasto</button></div><p class="info">La caja está cerrada. Ábrela al empezar el día.</p>
  <label for="si">Efectivo inicial en caja</label><input id="si" type="number" min="0" value="0" inputmode="decimal"><button class="btn block" id="ab">Abrir caja</button>
  ${u?.length?'<label>Últimos cierres</label>'+u.map(c=>fila2(fm(c.fecha_cierre)+', contó '+dinero(c.efectivo_contado),(c.diferencia>=0?'+':'')+dinero(c.diferencia))).join(''):''}`;
  $('#gs').onclick=()=>gasto(null);
  $('#ab').onclick=async()=>{const b=$('#ab');if(b.disabled)return;b.disabled=true;const{error}=await sb.from('cajas').insert({negocio_id:S.perfil.negocio_id,usuario_apertura:S.perfil.id,saldo_inicial:Number($('#si').value)||0});if(error){b.disabled=false;return toast(error.message,true)}caja()};
  return}
 const[rp,rg]=await Promise.all([sb.from('pagos').select('valor_pago,metodo_pago,fecha_hora,cuentas(nombre,detalle),ventas(estado_venta,clientes(nombre))').eq('negocio_id',S.perfil.negocio_id).eq('estado_pago','REGISTRADO').gte('fecha_hora',cj.fecha_apertura),sb.from('gastos').select('*').eq('negocio_id',S.perfil.negocio_id).eq('estado_gasto','REGISTRADO').gte('fecha_hora',cj.fecha_apertura).order('fecha_hora',{ascending:false})]);
 if(rp.error)return toast(rp.error.message,true);if(rg.error)return toast(rg.error.message,true);
 const pg=rp.data,gs=rg.data;
 const por={};(pg||[]).filter(p=>p.ventas?.estado_venta!=='ANULADA').forEach(p=>por[p.metodo_pago]=(por[p.metodo_pago]||0)+Number(p.valor_pago));
 const gEf=(gs||[]).filter(g=>g.metodo_pago==='EFECTIVO').reduce((s,g)=>s+Number(g.valor),0),esp=Number(cj.saldo_inicial)+(por.EFECTIVO||0)-gEf;
 main.innerHTML=`<div class="head"><h2>Caja abierta</h2><button class="btn sec" id="gs">Registrar gasto</button></div>
 <p class="mute">Desde ${new Date(cj.fecha_apertura).toLocaleString('es-CO',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p>
 ${fila2('Efectivo inicial',dinero(cj.saldo_inicial))}
 ${Object.entries(por).map(([m,v])=>`<button type="button" class="row" data-m="${m}"><span>Cobrado en ${bonito(m).toLowerCase()}, ver detalle</span><strong>${dinero(v)}</strong></button>`).join('')||'<p class="empty">Aún no hay cobros desde que abriste la caja.</p>'}
 ${fila2('Gastos en efectivo','-'+dinero(gEf))}${fila2('Efectivo que debe haber',dinero(esp),'tot')}
 ${gs?.length?'<label>Gastos del turno</label>'+gs.map(g=>fila2(esc(g.descripcion||bonito(g.categoria_gasto))+', '+bonito(g.metodo_pago).toLowerCase(),dinero(g.valor))).join(''):''}
 <button class="btn block" id="ce">Cerrar caja</button>`;
 $('#gs').onclick=()=>gasto(cj);
 document.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>detallePagos(b.dataset.m,(pg||[]).filter(p=>p.ventas?.estado_venta!=='ANULADA'&&p.metodo_pago===b.dataset.m)));
 $('#ce').onclick=()=>{dlg.innerHTML=`<form id="df"><h2>Cerrar caja</h2><p>Debe haber <strong>${dinero(esp)}</strong> en efectivo.</p><label for="ct">Efectivo contado</label><input id="ct" type="number" min="0" inputmode="decimal" required><label for="co">Observaciones</label><textarea id="co" rows="2"></textarea><div class="acts"><button type="button" class="btn sec" id="cx">Cancelar</button><button class="btn">Cerrar caja</button></div></form>`;
  dlg.showModal();$('#cx').onclick=()=>dlg.close();
  let cerrando=false;$('#df').onsubmit=async e=>{e.preventDefault();if(cerrando)return;cerrando=true;const boton=e.target.querySelector('button[type=\"submit\"],button:not([type])');if(boton)boton.disabled=true;const n=Number($('#ct').value);
   const{error}=await sb.from('cajas').update({estado_caja:'CERRADA',fecha_cierre:new Date().toISOString(),usuario_cierre:S.perfil.id,efectivo_esperado:esp,efectivo_contado:n,diferencia:n-esp,observaciones:$('#co').value||null}).eq('id',cj.id).eq('negocio_id',S.perfil.negocio_id);
   if(error){cerrando=false;if(boton)boton.disabled=false;return toast(error.message,true)}dlg.close();toast('Caja cerrada');caja()}};
}
function gasto(cj){
 dlg.innerHTML=`<form id="df"><h2>Registrar gasto</h2><label for="g1">Categoría</label><select id="g1" name="categoria_gasto">${['OPERATIVO','PRODUCTOS','COMISIONES','SERVICIOS_PUBLICOS','ARRIENDO','NOMINA','OTRO'].map(o=>`<option value="${o}">${bonito(o)}</option>`).join('')}</select>
 <label for="g2">Descripción</label><input id="g2" name="descripcion" required><label for="g3">Valor</label><input id="g3" name="valor" type="number" min="1" inputmode="decimal" required>
 <label for="g4">Método de pago</label><select id="g4" name="metodo_pago">${METODOS}</select><label for="g5">Proveedor</label><input id="g5" name="proveedor">
 <div class="acts"><button type="button" class="btn sec" id="cx">Cancelar</button><button class="btn">Guardar gasto</button></div></form>`;
 dlg.showModal();$('#cx').onclick=()=>dlg.close();
 let guardando=false;
 $('#df').onsubmit=async e=>{e.preventDefault();if(guardando)return;guardando=true;const boton=e.target.querySelector('button[type="submit"],button:not([type])');if(boton)boton.disabled=true;const f=Object.fromEntries(new FormData(e.target));
  const{error}=await sb.from('gastos').insert({...f,valor:Number(f.valor),proveedor:f.proveedor||null,negocio_id:S.perfil.negocio_id,usuario_registro:S.perfil.id,caja_id:cj?.id||null});
  if(error){guardando=false;if(boton)boton.disabled=false;return toast(error.message,true)}dlg.close();toast('Gasto guardado');caja()};
}
async function comisiones(){
 const[rd,rl]=await Promise.all([sb.from('detalle_ventas').select('id,subtotal,comision_generada,ventas!inner(barbero_id,estado_venta,barberos(nombre))').eq('negocio_id',S.perfil.negocio_id).eq('ventas.estado_venta','PAGADA').gt('comision_generada',0).limit(1000),sb.from('comisiones').select('detalle_id').eq('negocio_id',S.perfil.negocio_id).limit(5000)]);
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
  const ahora=new Date().toISOString(),{error}=await sb.from('comisiones').insert(p.L.map(x=>({negocio_id:S.perfil.negocio_id,barbero_id:b.dataset.b,detalle_id:x.id,valor_base:x.subtotal,valor_comision:x.comision_generada,estado_liquidacion:'LIQUIDADA',fecha_pago:ahora})));
  if(error){b.disabled=false;return toast(error.message,true)}
  const r=await sb.from('gastos').insert({negocio_id:S.perfil.negocio_id,categoria_gasto:'COMISIONES',descripcion:'Liquidación de comisión a '+p.n,valor:p.t,metodo_pago:ef?'EFECTIVO':'TRANSFERENCIA',usuario_registro:S.perfil.id,caja_id:cj?.id||null});
  toast(r.error?'Se liquidó, pero no se registró en caja: '+r.error.message:'Comisión liquidada y registrada en caja',!!r.error);
  comisiones()
 });
}


async function misComisiones(){
 const b=S.perfil.barbero_id,main=$('#main');
 if(!b)return main.innerHTML='<div class="head"><h2>Mis comisiones</h2></div><p class="empty">Tu usuario no está ligado a un barbero. Pide a la administración que lo configure.</p>';
 const[rd,rl]=await Promise.all([sb.from('detalle_ventas').select('id,descripcion,cantidad,subtotal,comision_generada,ventas!inner(fecha_hora,barbero_id,estado_venta)').eq('negocio_id',S.perfil.negocio_id).eq('ventas.barbero_id',b).eq('ventas.estado_venta','PAGADA').gt('comision_generada',0).limit(500),sb.from('comisiones').select('detalle_id').eq('negocio_id',S.perfil.negocio_id).eq('barbero_id',b).limit(2000)]);
 if(rd.error)return toast(rd.error.message,true);if(rl.error)return toast(rl.error.message,true);
 const d=rd.data||[],l=rl.data||[];
 const pagado=new Set((l||[]).map(x=>x.detalle_id)),L=(d||[]).sort((p,q)=>new Date(q.ventas.fecha_hora)-new Date(p.ventas.fecha_hora)),pend=L.filter(x=>!pagado.has(x.id)),hist=L.filter(x=>pagado.has(x.id)),sum=a=>a.reduce((t,x)=>t+Number(x.comision_generada),0);
 const fl=x=>fila2(esc(x.descripcion)+'<br><small>'+new Date(x.ventas.fecha_hora).toLocaleDateString('es-CO',{day:'numeric',month:'short'})+'</small>',dinero(x.comision_generada));
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
