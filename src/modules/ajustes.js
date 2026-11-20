// Módulo de configuración del negocio y administración del equipo.
export function crearModuloAjustes(deps) {
 const { $, sb, S, esc, toast, equipo, ir, notificaciones } = deps;
async function ajustes(){
 const n=S.negocio,url=location.origin+location.pathname.replace(/[^/]*$/,'')+'reservar.html?n='+n.slug;
 const{data:cfg,error:cfgError}=await sb.from('preferencias_notificaciones').select('preferencias').eq('negocio_id',S.perfil.negocio_id).maybeSingle();
 const nf={citas_30m:true,citas_15m:false,stock_bajo:true,stock_agotado:true,pedidos_clientes:true,cuentas_vencer:true,...(cfg?.preferencias||{})};
 $('#main').innerHTML=`<div class="head"><h2>Ajustes</h2></div><p class="mute">Plan ${esc(S.sus?.plan||'')}, vence el ${esc(S.sus?.vence_en||'')}.</p>
 <label for="ur">Enlace de reservas para tus clientes</label><input id="ur" value="${esc(url)}" readonly><button type="button" class="btn sec block" id="cp">Copiar enlace</button><button type="button" class="btn sec block" id="ct">Cuentas de recaudo (Nequi, bancos)</button>
 <form id="af"><label for="a1">Nombre de la barbería</label><input id="a1" name="nombre" value="${esc(n.nombre)}" required>
 <label for="a2">Teléfono</label><input id="a2" name="telefono" type="tel" value="${esc(n.telefono)}">
 <label for="a3">Dirección</label><input id="a3" name="direccion" value="${esc(n.direccion)}">
 <label for="a5">Valor de la cita (reserva)</label><input id="a5" name="valor_cita" type="number" min="0" inputmode="decimal" value="${esc(n.valor_cita||0)}">
 <label for="a4">Correo</label><input id="a4" name="correo" type="email" value="${esc(n.correo)}">
 <label class="chk"><input type="checkbox" name="reserva_publica"${n.reserva_publica?' checked':''}> Recibir reservas en línea</label>
 <label class="chk"><input type="checkbox" name="permitir_saldos"${n.permitir_saldos?' checked':''}> Permitir ventas con saldo pendiente (fiado)</label>
 <button class="btn block">Guardar ajustes</button></form>
 <h2 style="margin-top:32px">Notificaciones inteligentes</h2><p class="mute">Elige qué avisos quieres recibir mientras la aplicación esté abierta. Las alertas se revisan automáticamente cada minuto.</p><form id="nf"><label class="chk"><input type="checkbox" name="citas_30m"${nf.citas_30m?' checked':''}> Recordar citas 30 minutos antes</label><label class="chk"><input type="checkbox" name="citas_15m"${nf.citas_15m?' checked':''}> Recordar citas 15 minutos antes</label><label class="chk"><input type="checkbox" name="stock_bajo"${nf.stock_bajo?' checked':''}> Avisar cuando un producto tenga stock bajo</label><label class="chk"><input type="checkbox" name="stock_agotado"${nf.stock_agotado?' checked':''}> Avisar cuando un producto se agote</label><label class="chk"><input type="checkbox" name="pedidos_clientes"${nf.pedidos_clientes?' checked':''}> Avisar de nuevos pedidos de clientes</label><label class="chk"><input type="checkbox" name="cuentas_vencer"${nf.cuentas_vencer?' checked':''}> Avisar de cuentas a proveedores próximas a vencer</label><button class="btn block">Guardar notificaciones</button></form>${cfgError?'<p class="info">Para guardar estas preferencias debes ejecutar la nueva migración de notificaciones en Supabase.</p>':''}<h2 style="margin-top:32px">Equipo</h2><div id="eq">Cargando…</div><button type="button" class="btn sec block" id="iv">Invitar a alguien</button>`;
 $('#ct').onclick=()=>{S.vista='cuentas';ir()};
 $('#nf').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),preferencias={};for(const k of ['citas_30m','citas_15m','stock_bajo','stock_agotado','pedidos_clientes','cuentas_vencer'])preferencias[k]=!!f.get(k);const guardadas=notificaciones?.guardarPreferencias?await notificaciones.guardarPreferencias(preferencias):false;if(!notificaciones?.guardarPreferencias){const{error}=await sb.from('preferencias_notificaciones').upsert({negocio_id:S.perfil.negocio_id,preferencias,actualizado_en:new Date().toISOString()},{onConflict:'negocio_id'});if(error)return toast('No se pudieron guardar las notificaciones: '+error.message,true);toast('Preferencias de notificaciones guardadas')}};
 $('#cp').onclick=()=>navigator.clipboard.writeText(url).then(()=>toast('Enlace copiado')).catch(()=>{$('#ur').select();toast('Mantén presionado el enlace y copia')});
 let guardando=false;
  $('#af').onsubmit=async e=>{e.preventDefault();if(guardando)return;guardando=true;const boton=e.target.querySelector('button[type="submit"],button:not([type])');if(boton)boton.disabled=true;const f=new FormData(e.target),o={nombre:f.get('nombre').trim(),telefono:f.get('telefono')||null,direccion:f.get('direccion')||null,correo:f.get('correo')||null,reserva_publica:!!f.get('reserva_publica'),permitir_saldos:!!f.get('permitir_saldos'),valor_cita:Number(f.get('valor_cita'))||0};
  const{error}=await sb.rpc('guardar_ajustes_negocio',{
   p_nombre:o.nombre,p_telefono:o.telefono,p_direccion:o.direccion,p_correo:o.correo,
   p_reserva_publica:o.reserva_publica,p_permitir_saldos:o.permitir_saldos,p_valor_cita:o.valor_cita
  });
  if(error){guardando=false;if(boton)boton.disabled=false;return toast(error.message,true)}
  Object.assign(S.negocio,o);
  toast('Ajustes guardados')};
 equipo();
}

/* ---------- Equipo e invitaciones ---------- */

 return { ajustes };
}
