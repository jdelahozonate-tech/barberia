// Módulo de configuración del negocio y administración del equipo.
export function crearModuloAjustes(deps) {
 const { $, sb, S, esc, toast, equipo, ir } = deps;
function ajustes(){
 const n=S.negocio,url=location.origin+location.pathname.replace(/[^/]*$/,'')+'reservar.html?n='+n.slug;
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
 <h2 style="margin-top:32px">Equipo</h2><div id="eq">Cargando…</div><button type="button" class="btn sec block" id="iv">Invitar a alguien</button>`;
 $('#ct').onclick=()=>{S.vista='cuentas';ir()};
 $('#cp').onclick=()=>navigator.clipboard.writeText(url).then(()=>toast('Enlace copiado')).catch(()=>{$('#ur').select();toast('Mantén presionado el enlace y copia')});
 $('#af').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),o={nombre:f.get('nombre').trim(),telefono:f.get('telefono')||null,direccion:f.get('direccion')||null,correo:f.get('correo')||null,reserva_publica:!!f.get('reserva_publica'),permitir_saldos:!!f.get('permitir_saldos'),valor_cita:Number(f.get('valor_cita'))||0};
  const{error}=await sb.from('negocios').update(o).eq('id',n.id);if(error)return toast(error.message,true);Object.assign(S.negocio,o);
  const{data:sc}=await sb.from('servicios').select('id').eq('categoria','CITA').limit(1);
  if(sc&&sc[0])await sb.from('servicios').update({precio:o.valor_cita,estado:o.valor_cita>0?'ACTIVO':'INACTIVO'}).eq('id',sc[0].id);
  else if(o.valor_cita>0)await sb.from('servicios').insert({negocio_id:S.perfil.negocio_id,nombre:'Cita (reserva)',categoria:'CITA',precio:o.valor_cita,duracion_minutos:1});
  toast('Ajustes guardados')};
 equipo();
}

/* ---------- Equipo e invitaciones ---------- */

 return { ajustes };
}
