import { Insumo, PedidoTemporal, Venta, DetalleVenta, InformacionNegocio, Usuario, Categoria } from '../types';

// URL API
const API_URL = "/apprest_api/index.php";

// --- STATE CACHE ---
let info_negocio: InformacionNegocio = { nombre: "Cargando...", telefono: "", logo: "", numeroMesas: 0 };
let categorias: Categoria[] = [];
let insumos: Insumo[] = [];
let ventas: Venta[] = [];
let detalles_venta: DetalleVenta[] = [];
let usuarios: Usuario[] = [];
let pedidos_temporales: PedidoTemporal[] = [];
let mesa_metadata: Record<string, { cliente: string; tipoPedido: 'LOCAL' | 'LLEVAR' | 'DOMICILIO' }> = {};
let usuarioActual: Usuario | null = null;

const safeDate = (dateStr: any) => {
    if (typeof dateStr === 'string' && dateStr.indexOf('T') === -1) {
        // Fix para Safari/Firefox y consistencia: Reemplazar espacio por T para formato ISO local correcto
        // MySQL devuelve "YYYY-MM-DD HH:MM:SS", convertir a "YYYY-MM-DDTHH:MM:SS" asegura que JS lo tome como Local Time
        dateStr = dateStr.replace(' ', 'T');
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date() : d;
};

// Función auxiliar para formatear fecha a MySQL Local (YYYY-MM-DD HH:MM:SS)
const formatMySQLDate = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

export const dbService = {
    verificarConexionBackend: async () => {
        try {
            const res = await fetch(`${API_URL}?action=check`);
            if (!res.ok) return 'error';
            const data = await res.json();
            return data.status;
        } catch { return 'error'; }
    },

    inicializarBaseDeDatos: async () => {
        try {
            const res = await fetch(`${API_URL}?action=init`);
            const data = await res.json();
            return data.status === 'success';
        } catch { return false; }
    },

    cargarDatosGenerales: async () => {
        try {
            const savedUser = localStorage.getItem('apprest_user_session');
            if (savedUser) {
                try {
                    usuarioActual = JSON.parse(savedUser);
                } catch (e) { console.error("Error leyendo sesión local"); }
            }

            const res = await fetch(`${API_URL}?action=get_all_data`);

            if (res.ok) {
                const text = await res.text(); // Leer como texto primero
                let data;
                try {
                    data = JSON.parse(text);
                } catch (err) {
                    console.error("ERROR CRÍTICO: El servidor no devolvió JSON válido.", err);
                    console.log("Respuesta del servidor:", text);
                    return; // Detener si no es JSON
                }

                if (data.config) info_negocio = { ...data.config, numeroMesas: parseInt(data.config.numeroMesas) };
                if (data.usuarios) usuarios = data.usuarios;
                if (data.categorias) categorias = data.categorias;
                if (data.insumos) insumos = data.insumos.map((i: any) => ({ ...i, precio: parseFloat(i.precio) }));

                if (data.ventas && Array.isArray(data.ventas)) {
                    ventas = data.ventas.map((v: any) => ({
                        ...v,
                        total: parseFloat(v.total || 0),
                        monto_recibido: parseFloat(v.monto_recibido || v.total || 0),
                        monto_cambio: parseFloat(v.monto_cambio || 0),
                        fecha: safeDate(v.fecha),
                        consecutivo: parseInt(v.consecutivo)
                    }));
                }

                if (data.detalles && Array.isArray(data.detalles)) {
                    detalles_venta = data.detalles.map((d: any) => ({
                        ...d,
                        cantidad: parseInt(d.cantidad),
                        precio_unitario: parseFloat(d.precio_unitario),
                        subtotal: parseFloat(d.subtotal)
                    }));
                }

                // --- CARGAR PEDIDOS PERSISTENTES ---
                if (data.pedidos_temporales && Array.isArray(data.pedidos_temporales)) {
                    pedidos_temporales = data.pedidos_temporales.map((p: any) => {
                        const insumo = insumos.find(i => i.id === p.id_insumo);
                        // Reconstruir metadatos de mesa
                        if (p.id_mesa) {
                            mesa_metadata[p.id_mesa] = {
                                cliente: p.cliente || '',
                                tipoPedido: (p.tipo_pedido as any) || 'LOCAL'
                            };
                        }
                        return {
                            ...p,
                            cantidad: parseInt(p.cantidad),
                            fecha_hora: safeDate(p.fecha_hora),
                            insumo_snapshot: insumo
                        };
                    });
                } else {
                    pedidos_temporales = [];
                    mesa_metadata = {};
                }

                window.dispatchEvent(new Event('apprest-config-updated'));
            } else {
                console.warn("Error HTTP:", res.status);
            }
        } catch (e) {
            console.warn("Modo Offline o Error de Conexión.", e);
        }
    },

    uploadImage: async (file: File): Promise<string> => {
        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await fetch(`${API_URL}?action=upload`, { method: 'POST', body: formData });
            const data = await res.json();
            if (data.status === 'success') return data.url;
            else throw new Error(data.message);
        } catch (e) {
            console.error(e);
            throw new Error("Error subiendo imagen");
        }
    },

    login: async (email: string, password_hash: string): Promise<boolean> => {
        try {
            const res = await fetch(`${API_URL}?action=login`, {
                method: 'POST',
                body: JSON.stringify({ email, password: password_hash })
            });
            const data = await res.json();
            if (data.status === 'success') {
                usuarioActual = data.user;
                localStorage.setItem('apprest_user_session', JSON.stringify(usuarioActual));
                return true;
            }
            return false;
        } catch { return false; }
    },

    logout: () => {
        usuarioActual = null;
        localStorage.removeItem('apprest_user_session');
        window.dispatchEvent(new Event('apprest-logout'));
    },

    obtenerUsuarioActual: () => usuarioActual || { id: '0', nombre: 'Invitado', email: '', rol: 'admin' },
    estaAutenticado: () => !!usuarioActual,

    registrarUsuario: async (nombre: string, email: string, pass: string, rol: string) => {
        try {
            const res = await fetch(`${API_URL}?action=register`, {
                method: 'POST',
                body: JSON.stringify({ nombre, email, password: pass, rol })
            });
            const data = await res.json();
            if (data.status === 'success') {
                return true;
            } else {
                throw new Error(data.message || "Error al registrar");
            }
        } catch (e: any) {
            throw new Error(e.message || "Error de conexión");
        }
    },

    actualizarPerfilUsuario: async (id: string, nombre: string, email: string) => {
        const res = await fetch(`${API_URL}?action=update_profile`, {
            method: 'POST',
            body: JSON.stringify({ id, nombre, email })
        });
        const data = await res.json();
        if (data.status === 'success') {
            if (usuarioActual && usuarioActual.id === id) {
                usuarioActual = { ...usuarioActual, nombre, email };
                localStorage.setItem('apprest_user_session', JSON.stringify(usuarioActual));
            }
            return usuarioActual!;
        } else {
            throw new Error(data.message || "Error al actualizar perfil");
        }
    },

    cambiarPasswordUsuario: async (id: string, actual: string, nueva: string) => {
        const res = await fetch(`${API_URL}?action=change_password`, {
            method: 'POST',
            body: JSON.stringify({ id, actual, nueva })
        });
        const data = await res.json();
        if (data.status !== 'success') {
            throw new Error(data.message || "Error al cambiar contraseña");
        }
        return true;
    },

    obtenerNombreUsuario: (id: string) => usuarios.find(u => u.id === id)?.nombre || 'Desconocido',

    obtenerInfoNegocio: () => info_negocio,
    actualizarInfoNegocio: async (datos: InformacionNegocio) => {
        info_negocio = datos;
        await fetch(`${API_URL}?action=save_config`, { method: 'POST', body: JSON.stringify(datos) });
        window.dispatchEvent(new Event('apprest-config-updated'));
    },

    obtenerCategorias: () => categorias,
    guardarCategoria: async (cat: Categoria) => {
        if (!cat.id) cat.id = Math.random().toString(36).substr(2, 9);
        const idx = categorias.findIndex(c => c.id === cat.id);
        if (idx >= 0) categorias[idx] = cat; else categorias.push(cat);
        await fetch(`${API_URL}?action=save_category`, { method: 'POST', body: JSON.stringify(cat) });
    },
    eliminarCategoria: async (id: string) => {
        if (insumos.some(i => i.categoria_id === id)) throw new Error("Tiene productos asociados");
        categorias = categorias.filter(c => c.id !== id);
        await fetch(`${API_URL}?action=delete_category&id=${id}`);
    },

    obtenerInsumos: () => insumos,
    obtenerInsumoPorId: (id: string) => insumos.find(i => i.id === id),
    guardarInsumo: async (insumo: Insumo) => {
        if (!insumo.id) insumo.id = Math.random().toString(36).substr(2, 9);
        const idx = insumos.findIndex(i => i.id === insumo.id);
        if (idx >= 0) insumos[idx] = insumo; else insumos.push(insumo);
        await fetch(`${API_URL}?action=save_product`, { method: 'POST', body: JSON.stringify(insumo) });
    },
    eliminarInsumo: async (id: string) => {
        insumos = insumos.filter(i => i.id !== id);
        await fetch(`${API_URL}?action=delete_product&id=${id}`);
    },

    obtenerPedidosMesa: (idMesa: string) => pedidos_temporales.filter(p => p.id_mesa === idMesa),

    // GUARDAR PEDIDO (PERSISTENTE)
    agregarPedidoTemporal: async (idMesa: string, idInsumo: string, cantidad: number, idUsuario: string) => {
        const insumo = insumos.find(i => i.id === idInsumo);
        if (!insumo) return;
        const tipo = mesa_metadata[idMesa]?.tipoPedido || 'LOCAL';
        const cliente = mesa_metadata[idMesa]?.cliente || '';

        const existente = pedidos_temporales.find(p => p.id_mesa === idMesa && p.id_insumo === idInsumo && p.estado === 'sin_enviar');

        let pedidoObj: PedidoTemporal;

        if (existente) {
            existente.cantidad += cantidad;
            pedidoObj = existente;
        } else {
            pedidoObj = {
                id: Math.random().toString(36).substr(2, 9),
                id_mesa: idMesa, id_insumo: idInsumo, cantidad, id_usuario: idUsuario,
                insumo_snapshot: insumo, notas: '', fecha_hora: new Date(), estado: 'sin_enviar', tipo_pedido: tipo
            };
            pedidos_temporales.push(pedidoObj);
        }

        // Enviar al backend para persistencia usando formatMySQLDate para respetar hora local
        const payload = {
            ...pedidoObj,
            cliente,
            fecha_hora: formatMySQLDate(pedidoObj.fecha_hora)
        };
        await fetch(`${API_URL}?action=save_temp_order`, { method: 'POST', body: JSON.stringify(payload) });
    },

    actualizarNotasPedido: async (id: string, notas: string) => {
        const p = pedidos_temporales.find(x => x.id === id);
        if (p) {
            p.notas = notas;
            const cliente = mesa_metadata[p.id_mesa]?.cliente || '';
            const payload = {
                ...p,
                cliente,
                fecha_hora: formatMySQLDate(p.fecha_hora)
            };
            await fetch(`${API_URL}?action=save_temp_order`, { method: 'POST', body: JSON.stringify(payload) });
        }
    },

    eliminarPedidoTemporal: async (id: string) => {
        pedidos_temporales = pedidos_temporales.filter(p => p.id !== id);
        await fetch(`${API_URL}?action=delete_temp_order&id=${id}`);
    },

    vaciarMesa: async (idMesa: string) => {
        pedidos_temporales = pedidos_temporales.filter(p => p.id_mesa !== idMesa);
        delete mesa_metadata[idMesa];
        await fetch(`${API_URL}?action=clear_table&id_mesa=${idMesa}`);
    },

    enviarOrdenCocina: (idMesa: string) => {
        pedidos_temporales.filter(p => p.id_mesa === idMesa && p.estado === 'sin_enviar')
            .forEach(async p => {
                p.estado = 'pendiente';
                p.fecha_hora = new Date();
                // Actualizar estado en backend
                await fetch(`${API_URL}?action=update_order_status`, {
                    method: 'POST',
                    body: JSON.stringify({ id: p.id, estado: 'pendiente' })
                });
            });
    },

    obtenerPedidosCocina: () => pedidos_temporales.filter(p => p.estado && ['pendiente', 'preparando', 'listo'].includes(p.estado)),

    cambiarEstadoPedido: async (id: string, estado: any) => {
        const p = pedidos_temporales.find(x => x.id === id);
        if (p) {
            p.estado = estado;
            await fetch(`${API_URL}?action=update_order_status`, {
                method: 'POST',
                body: JSON.stringify({ id: p.id, estado })
            });
        }
    },

    obtenerEstadoMesa: (idMesa: string) => {
        const peds = pedidos_temporales.filter(p => p.id_mesa === idMesa);
        if (peds.length === 0) return { estado: 'libre', total: 0, items: 0 };
        const total = peds.reduce((acc, p) => acc + (p.cantidad * (p.insumo_snapshot?.precio || 0)), 0);
        return { estado: 'ocupada', total, items: peds.length, mesero: peds[0].id_usuario };
    },

    actualizarNombreCliente: async (id: string, val: string) => {
        if (!mesa_metadata[id]) mesa_metadata[id] = { cliente: '', tipoPedido: 'LOCAL' };
        mesa_metadata[id].cliente = val;
        // Actualizar metadatos en backend para la mesa
        await fetch(`${API_URL}?action=update_table_meta`, {
            method: 'POST',
            body: JSON.stringify({ id_mesa: id, cliente: val, tipo_pedido: mesa_metadata[id].tipoPedido })
        });
    },
    obtenerNombreCliente: (id: string) => mesa_metadata[id]?.cliente || '',

    actualizarTipoPedido: async (id: string, val: any) => {
        if (!mesa_metadata[id]) mesa_metadata[id] = { cliente: '', tipoPedido: 'LOCAL' };
        mesa_metadata[id].tipoPedido = val;
        pedidos_temporales.filter(p => p.id_mesa === id).forEach(p => p.tipo_pedido = val);
        // Actualizar metadatos en backend
        await fetch(`${API_URL}?action=update_table_meta`, {
            method: 'POST',
            body: JSON.stringify({ id_mesa: id, cliente: mesa_metadata[id].cliente, tipo_pedido: val })
        });
    },
    obtenerTipoPedido: (id: string) => mesa_metadata[id]?.tipoPedido || 'LOCAL',

    cerrarCuenta: (idMesa: string, idUsuario: string, cliente?: string, recibido: number = 0): Venta & { detalles: DetalleVenta[] } => {
        const peds = pedidos_temporales.filter(p => p.id_mesa === idMesa);
        if (peds.length === 0) throw new Error("Mesa vacía");

        let total = peds.reduce((acc, p) => acc + (p.cantidad * (p.insumo_snapshot?.precio || 0)), 0);
        const tipo = mesa_metadata[idMesa]?.tipoPedido || 'LOCAL';
        if (tipo === 'DOMICILIO') total += 10;

        const maxC = ventas.reduce((max, v) => (v.consecutivo > max ? v.consecutivo : max), 0);

        const nuevaVenta: Venta = {
            id: Math.random().toString(36).substr(2, 9),
            consecutivo: maxC + 1,
            id_mesa: idMesa,
            cliente: cliente || "Publico General",
            total,
            monto_recibido: recibido,
            monto_cambio: recibido - total,
            pagado: true,
            id_usuario: idUsuario,
            fecha: new Date(),
            tipo_pedido: tipo
        };

        const nuevosDetalles: DetalleVenta[] = [];
        peds.forEach(p => {
            nuevosDetalles.push({
                id: Math.random().toString(36).substr(2, 9),
                id_venta: nuevaVenta.id,
                id_insumo: p.id_insumo,
                codigo_producto: p.insumo_snapshot?.codigo || 'X',
                nombre_producto: p.insumo_snapshot?.nombre || 'X',
                cantidad: p.cantidad,
                precio_unitario: p.insumo_snapshot?.precio || 0,
                subtotal: p.cantidad * (p.insumo_snapshot?.precio || 0),
                notas: p.notas
            });
        });

        if (tipo === 'DOMICILIO') {
            nuevosDetalles.push({
                id: Math.random().toString(36).substr(2, 9), id_venta: nuevaVenta.id, id_insumo: 'FEE',
                codigo_producto: 'SERV', nombre_producto: 'Servicio Domicilio', cantidad: 1, precio_unitario: 10, subtotal: 10, notas: ''
            });
        }

        ventas.push(nuevaVenta);
        detalles_venta.push(...nuevosDetalles);
        pedidos_temporales = pedidos_temporales.filter(p => p.id_mesa !== idMesa);
        delete mesa_metadata[idMesa];

        // Usar formatMySQLDate para que MySQL reciba la hora local, no UTC
        const payload = {
            venta: { ...nuevaVenta, fecha: formatMySQLDate(nuevaVenta.fecha) },
            detalles: nuevosDetalles
        };
        fetch(`${API_URL}?action=save_sale`, { method: 'POST', body: JSON.stringify(payload) }).catch(console.error);

        // Limpiar pedidos temporales de la BD
        fetch(`${API_URL}?action=clear_table&id_mesa=${idMesa}`).catch(console.error);

        return { ...nuevaVenta, detalles: nuevosDetalles };
    },

    obtenerTodasLasVentas: () => ventas.map(v => ({ ...v, detalles: detalles_venta.filter(d => d.id_venta === v.id) })).sort((a, b) => b.consecutivo - a.consecutivo),

    _getVentasRaw: () => ventas,
    _getDetallesRaw: () => detalles_venta
};

dbService.cargarDatosGenerales();