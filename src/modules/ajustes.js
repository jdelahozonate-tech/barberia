// Módulo de configuración del negocio y administración del equipo.
export function crearModuloAjustes(deps) {
 const { $, sb, S, esc, toast, equipo, ir, notificaciones } = deps;
async function ajustes(){
 const n=S.negocio,url=location.origin+location.pathname.replace(/[^/]*$/,'')+'reservar.html?n='+n.slug;
 const{data:cfg,error:cfgError}=await sb.from('preferencias_notificaciones').select('preferencias').eq('negocio_id',S.perfil.negocio_id).maybeSingle();
 const nf={cumpleanos:true,citas_30m:true,citas_15m:false,stock_bajo:true,stock_agotado:true,pedidos_clientes:true,cuentas_vencer:true,...(cfg?.preferencias||{})};
 $('#main').innerHTML=`<div class="head"><h2>Ajustes</h2></div><p class="mute">Plan ${esc(S.sus?.plan||'')}, vence el ${esc(S.sus?.vence_en||'')}.</p>
 <label for="ur">Enlace de reservas para tus clientes</label><input id="ur" value="${esc(url)}" readonly><button type="button" class="btn sec block" id="cp">Copiar enlace</button><button type="button" class="btn sec block" id="bk">Descargar copia de mis datos (Excel)</button><button type="button" class="btn sec block" id="ct">Cuentas de recaudo (Nequi, bancos)</button>
 <form id="af"><label for="a1">Nombre de la barbería</label><input id="a1" name="nombre" value="${esc(n.nombre)}" required>
 <label for="a2">Teléfono</label><input id="a2" name="telefono" type="tel" value="${esc(n.telefono)}">
 <label for="a3">Dirección</label><input id="a3" name="direccion" value="${esc(n.direccion)}">
 <label for="a5">Valor de la cita (reserva)</label><input id="a5" name="valor_cita" type="number" min="0" inputmode="decimal" value="${esc(n.valor_cita||0)}">
 <label for="a4">Correo</label><input id="a4" name="correo" type="email" value="${esc(n.correo)}">
 <label class="chk"><input type="checkbox" name="reserva_publica"${n.reserva_publica?' checked':''}> Recibir reservas en línea</label>
 <label class="chk"><input type="checkbox" name="permitir_saldos"${n.permitir_saldos?' checked':''}> Permitir ventas con saldo pendiente (fiado)</label>
 <button class="btn block">Guardar ajustes</button></form>
 <h2 style="margin-top:32px">Notificaciones inteligentes</h2><p class="mute">Elige qué avisos quieres recibir mientras la aplicación esté abierta. Las alertas se revisan automáticamente cada minuto.</p><form id="nf"><label class="chk"><input type="checkbox" name="citas_30m"${nf.citas_30m?' checked':''}> Recordar citas 30 minutos antes</label><label class="chk"><input type="checkbox" name="citas_15m"${nf.citas_15m?' checked':''}> Recordar citas 15 minutos antes</label><label class="chk"><input type="checkbox" name="stock_bajo"${nf.stock_bajo?' checked':''}> Avisar cuando un producto tenga stock bajo</label><label class="chk"><input type="checkbox" name="stock_agotado"${nf.stock_agotado?' checked':''}> Avisar cuando un producto se agote</label><label class="chk"><input type="checkbox" name="pedidos_clientes"${nf.pedidos_clientes?' checked':''}> Avisar de nuevos pedidos de clientes</label><label class="chk"><input type="checkbox" name="cuentas_vencer"${nf.cuentas_vencer?' checked':''}> Avisar de cuentas a proveedores próximas a vencer</label><label class="chk"><input type="checkbox" name="cumpleanos"${nf.cumpleanos?' checked':''}> Avisar un día antes de los cumpleaños de clientes</label><button class="btn block">Guardar notificaciones</button></form>${cfgError?'<p class="info">Para guardar estas preferencias debes ejecutar la nueva migración de notificaciones en Supabase.</p>':''}<h2 style="margin-top:32px">Equipo</h2><div id="eq">Cargando…</div><button type="button" class="btn sec block" id="iv">Invitar a alguien</button>`;
 $('#ct').onclick=()=>{S.vista='cuentas';ir()};
 const TABLAS_COPIA=['clientes','barberos','servicios','productos','proveedores_inventario','ventas','detalle_ventas','pagos','citas','cajas','movimientos_caja','gastos','comisiones','liquidaciones_barbero','movimientos_liquidacion_barbero','compras_inventario','detalle_compras_inventario','pagos_compras_inventario','movimientos_inventario','pedidos_proveedores','detalle_pedidos_proveedores','pedidos_productos','detalle_pedidos_productos','horarios_barbero','ausencias_barbero'];
 let copiando=false;
 const bk=$('#bk');if(bk)bk.onclick=async()=>{
  if(copiando)return;
  if(!['ADMINISTRADOR','SUPERVISOR'].includes(S.perfil.rol))return toast('Solo administración puede descargar la copia de datos.',true);
  copiando=true;bk.disabled=true;const texto=bk.textContent;
  try{
   bk.textContent='Preparando copia…';
   if(!window.XLSX)await new Promise((ok,fail)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=ok;s.onerror=()=>fail(new Error('No se pudo cargar el generador de Excel. Revisa tu conexión.'));document.head.append(s)});
   const wb=window.XLSX.utils.book_new(),fallos=[];
   for(const t of TABLAS_COPIA){
    bk.textContent='Copiando '+t+'…';
    const filas=[];let desde=0,error=null;
    for(;;){
     const r=await sb.from(t).select('*').eq('negocio_id',S.perfil.negocio_id).range(desde,desde+999);
     if(r.error){error=r.error;break}
     filas.push(...(r.data||[]));if(!r.data||r.data.length<1000)break;desde+=1000;
    }
    if(error){fallos.push(t);continue}
    const plano=filas.map(f=>Object.fromEntries(Object.entries(f).map(([k,v])=>[k,v&&typeof v==='object'?JSON.stringify(v):v])));
    window.XLSX.utils.book_append_sheet(wb,window.XLSX.utils.json_to_sheet(plano.length?plano:[{}]),t.slice(0,31));
   }
   const hoy=new Date().toISOString().slice(0,10);
   window.XLSX.writeFile(wb,'copia-datos-'+String(S.negocio.slug||'barberia')+'-'+hoy+'.xlsx');
   toast(fallos.length?'Copia descargada, pero no se pudieron leer: '+fallos.join(', '):'Copia de datos descargada',!!fallos.length);
  }catch(e){toast(e.message||'No se pudo generar la copia.',true)}
  finally{copiando=false;bk.disabled=false;bk.textContent=texto}
 };
 $('#nf').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),preferencias={};for(const k of ['cumpleanos','citas_30m','citas_15m','stock_bajo','stock_agotado','pedidos_clientes','cuentas_vencer'])preferencias[k]=!!f.get(k);const guardadas=notificaciones?.guardarPreferencias?await notificaciones.guardarPreferencias(preferencias):false;if(!notificaciones?.guardarPreferencias){const{error}=await sb.from('preferencias_notificaciones').upsert({negocio_id:S.perfil.negocio_id,preferencias,actualizado_en:new Date().toISOString()},{onConflict:'negocio_id'});if(error)return toast('No se pudieron guardar las notificaciones: '+error.message,true);toast('Preferencias de notificaciones guardadas')}};
 $('#cp').onclick=()=>navigator.clipboard.writeText(url).then(()=>toast('Enlace copiado')).catch(()=>{$('#ur').select();toast('Mantén presionado el enlace y copia')});
 let guardando=false;
  $('#af').onsubmit=async e=>{e.preventDefault();if(guardando)return;guardando=true;const boton=e.target.querySelector('button[type="submit"],button:not([type])');if(boton)boton.disabled=true;const f=new FormData(e.target),o={nombre:f.get('nombre').trim(),telefono:f.get('telefono')||null,direccion:f.get('direccion')||null,correo:f.get('correo')||null,reserva_publica:!!f.get('reserva_publica'),permitir_saldos:!!f.get('permitir_saldos'),valor_cita:Number(f.get('valor_cita'))||0};
  const{error}=await sb.from('negocios').update(o).eq('id',n.id);if(error){guardando=false;if(boton)boton.disabled=false;return toast(error.message,true)}Object.assign(S.negocio,o);
  const{data:sc,error:consultaError}=await sb.from('servicios').select('id').eq('negocio_id',S.perfil.negocio_id).eq('categoria','CITA').limit(1);
  if(consultaError){guardando=false;if(boton)boton.disabled=false;return toast('Los datos del negocio se guardaron, pero no se pudo consultar el servicio de reserva: '+consultaError.message,true)}
  let errorServicio=null;
  if(sc&&sc[0])({error:errorServicio}=await sb.from('servicios').update({precio:o.valor_cita,estado:o.valor_cita>0?'ACTIVO':'INACTIVO'}).eq('negocio_id',S.perfil.negocio_id).eq('id',sc[0].id));
  else if(o.valor_cita>0)({error:errorServicio}=await sb.from('servicios').insert({negocio_id:S.perfil.negocio_id,nombre:'Cita (reserva)',categoria:'CITA',precio:o.valor_cita,duracion_minutos:1}));
  if(errorServicio){guardando=false;if(boton)boton.disabled=false;return toast('Los datos del negocio se guardaron, pero no se pudo actualizar el servicio de reserva: '+errorServicio.message,true)}
  toast('Ajustes guardados')};
 equipo();
}

/* ---------- Equipo e invitaciones ---------- */

 return { ajustes };
}
