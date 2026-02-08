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

// --- REAL-TIME SYNC (BroadcastChannel) ---
// Canal para comunicar pestañas del mismo navegador (Ej. Pantalla Extendida)
const syncChannel = new BroadcastChannel('apprest_sync_channel');

syncChannel.onmessage = (event) => {
    if (event.data === 'REFRESH_DATA') {
        // Si otra pestaña dice que hubo cambios, recargamos silenciosamente
        dbService.cargarDatosGenerales();
    }
};

const notifyChange = () => {
    // 1. Avisar a otras pestañas
    syncChannel.postMessage('REFRESH_DATA');
    // 2. Avisar a la pestaña actual (React components)
    // Nota: cargarDatosGenerales ya dispara el evento 'apprest-config-updated', 
    // pero a veces queremos forzar el fetch inmediato antes.
    dbService.cargarDatosGenerales();
};

const safeDate = (dateStr: any) => {
    if (typeof dateStr === 'string' && dateStr.indexOf('T') === -1) {
        dateStr = dateStr.replace(' ', 'T');
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date() : d;
};

const formatMySQLDate = (date: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

// --- HELPER DE FETCH AUTORIZADO ---
const authorizedFetch = async (url: string, options: RequestInit = {}) => {
    const headers = { ...options.headers } as Record<string, string>;

    // Inyectar Token si existe
    if (usuarioActual?.token) {
        headers['Authorization'] = `Bearer ${usuarioActual.token}`;
    }

    // Asegurar Content-Type si enviamos JSON
    if (typeof options.body === 'string' && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    const config = {
        ...options,
        headers
    };

    const res = await fetch(url, config);

    // Si el token expiró o es inválido (401), cerrar sesión forzosamente
    if (res.status === 401) {
        console.warn("Sesión expirada o token inválido. Cerrando sesión...");
        dbService.logout();
        return null;
    }

    return res;
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

            // Usar authorizedFetch para que el backend valide el token
            const res = await authorizedFetch(`${API_URL}?action=get_all_data`);

            if (res && res.ok) {
                const text = await res.text();
                let data;
                try {
                    data = JSON.parse(text);
                } catch (err) {
                    console.error("ERROR CRÍTICO: El servidor no devolvió JSON válido.", err);
                    return;
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

                if (data.pedidos_temporales && Array.isArray(data.pedidos_temporales)) {
                    pedidos_temporales = data.pedidos_temporales.map((p: any) => {
                        const insumo = insumos.find(i => i.id === p.id_insumo);
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

                // Despachar evento para que React se actualice
                window.dispatchEvent(new Event('apprest-config-updated'));
            }
        } catch (e) {
            console.warn("Modo Offline o Error de Conexión.", e);
        }
    },

    uploadImage: async (file: File): Promise<string> => {
        const formData = new FormData();
        formData.append('image', file);

        try {
            const res = await authorizedFetch(`${API_URL}?action=upload`, { method: 'POST', body: formData });
            if (!res) throw new Error("Error de autorización");
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
                headers: { 'Content-Type': 'application/json' },
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
        if (usuarioActual?.token) {
            authorizedFetch(`${API_URL}?action=logout`).catch(() => { });
        }
        usuarioActual = null;
        localStorage.removeItem('apprest_user_session');
        window.dispatchEvent(new Event('apprest-logout'));
    },

    obtenerUsuarioActual: () => usuarioActual || { id: '0', nombre: 'Invitado', email: '', rol: 'admin' },
    estaAutenticado: () => !!usuarioActual && !!usuarioActual.token,

    registrarUsuario: async (nombre: string, email: string, pass: string, rol: string) => {
        try {
            const res = await fetch(`${API_URL}?action=register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, email, password: pass, rol })
            });
            const data = await res.json();
            if (data.status === 'success') return true;
            else throw new Error(data.message || "Error al registrar");
        } catch (e: any) {
            throw new Error(e.message || "Error de conexión");
        }
    },

    actualizarPerfilUsuario: async (id: string, nombre: string, email: string) => {
        const res = await authorizedFetch(`${API_URL}?action=update_profile`, {
            method: 'POST',
            body: JSON.stringify({ id, nombre, email })
        });
        if (!res) throw new Error("No autorizado");
        const data = await res.json();
        if (data.status === 'success') {
            if (usuarioActual && usuarioActual.id === id) {
                usuarioActual = { ...usuarioActual, nombre, email };
                localStorage.setItem('apprest_user_session', JSON.stringify(usuarioActual));
            }
            return usuarioActual!;
        } else throw new Error(data.message || "Error al actualizar perfil");
    },

    cambiarPasswordUsuario: async (id: string, actual: string, nueva: string) => {
        const res = await authorizedFetch(`${API_URL}?action=change_password`, {
            method: 'POST',
            body: JSON.stringify({ id, actual, nueva })
        });
        if (!res) throw new Error("No autorizado");
        const data = await res.json();
        if (data.status !== 'success') throw new Error(data.message || "Error al cambiar contraseña");
        return true;
    },

    obtenerNombreUsuario: (id: string) => usuarios.find(u => u.id === id)?.nombre || 'Desconocido',

    obtenerInfoNegocio: () => info_negocio,
    actualizarInfoNegocio: async (datos: InformacionNegocio) => {
        info_negocio = datos;
        await authorizedFetch(`${API_URL}?action=save_config`, { method: 'POST', body: JSON.stringify(datos) });
        notifyChange();
    },

    obtenerCategorias: () => categorias,
    guardarCategoria: async (cat: Categoria) => {
        const res = await authorizedFetch(`${API_URL}?action=save_category`, { method: 'POST', body: JSON.stringify(cat) });
        if (res && res.ok) notifyChange();
    },
    eliminarCategoria: async (id: string) => {
        if (insumos.some(i => i.categoria_id === id)) throw new Error("Tiene productos asociados");
        await authorizedFetch(`${API_URL}?action=delete_category&id=${id}`);
        notifyChange();
    },

    obtenerInsumos: () => insumos,
    obtenerInsumoPorId: (id: string) => insumos.find(i => i.id === id),
    guardarInsumo: async (insumo: Insumo) => {
        const res = await authorizedFetch(`${API_URL}?action=save_product`, { method: 'POST', body: JSON.stringify(insumo) });
        if (res && res.ok) notifyChange();
    },
    eliminarInsumo: async (id: string) => {
        await authorizedFetch(`${API_URL}?action=delete_product&id=${id}`);
        notifyChange();
    },

    obtenerPedidosMesa: (idMesa: string) => pedidos_temporales.filter(p => p.id_mesa === idMesa),

    // --- LÓGICA CORE: Agregar con Sync ---
    agregarPedidoTemporal: async (idMesa: string, idInsumo: string, cantidad: number, idUsuario: string) => {
        const insumo = insumos.find(i => i.id === idInsumo);
        if (!insumo) return;

        // Búsqueda en local para optimismo
        const existente = pedidos_temporales.find(p =>
            p.id_mesa === idMesa &&
            p.id_insumo === idInsumo &&
            p.estado === 'sin_enviar' &&
            (!p.notas || p.notas.trim() === '')
        );

        if (existente) {
            // Actualización optimista local
            existente.cantidad += cantidad;

            const payload = {
                ...existente,
                fecha_hora: formatMySQLDate(existente.fecha_hora)
            };
            await authorizedFetch(`${API_URL}?action=save_temp_order`, { method: 'POST', body: JSON.stringify(payload) });
        } else {
            const tipo = mesa_metadata[idMesa]?.tipoPedido || 'LOCAL';
            const cliente = mesa_metadata[idMesa]?.cliente || '';
            const tempId = 'temp_' + Date.now() + Math.random().toString(36).substr(2, 5);

            const nuevoPedido: PedidoTemporal = {
                id: tempId,
                id_mesa: idMesa,
                id_insumo: idInsumo,
                cantidad,
                id_usuario: idUsuario,
                insumo_snapshot: insumo,
                notas: '',
                fecha_hora: new Date(),
                estado: 'sin_enviar',
                tipo_pedido: tipo
            };

            // Inserción optimista
            pedidos_temporales.push(nuevoPedido);

            const payload = {
                ...nuevoPedido,
                id: '', // Backend generará ID real
                cliente,
                fecha_hora: formatMySQLDate(nuevoPedido.fecha_hora)
            };

            await authorizedFetch(`${API_URL}?action=save_temp_order`, { method: 'POST', body: JSON.stringify(payload) });
        }
        notifyChange();
    },

    // --- NUEVO: Actualizar cantidad de un pedido existente (para restar o sumar directamente) ---
    actualizarCantidadPedido: async (id: string, cantidad: number) => {
        const p = pedidos_temporales.find(x => x.id === id);
        if (p) {
            p.cantidad = cantidad;
            const cliente = mesa_metadata[p.id_mesa]?.cliente || '';
            const payload = {
                ...p,
                cliente,
                fecha_hora: formatMySQLDate(p.fecha_hora)
            };
            await authorizedFetch(`${API_URL}?action=save_temp_order`, { method: 'POST', body: JSON.stringify(payload) });
            notifyChange();
        }
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
            await authorizedFetch(`${API_URL}?action=save_temp_order`, { method: 'POST', body: JSON.stringify(payload) });
            notifyChange();
        }
    },

    eliminarPedidoTemporal: async (id: string) => {
        // Optimista
        pedidos_temporales = pedidos_temporales.filter(p => p.id !== id);
        await authorizedFetch(`${API_URL}?action=delete_temp_order&id=${id}`);
        notifyChange();
    },

    vaciarMesa: async (idMesa: string) => {
        // Optimista
        pedidos_temporales = pedidos_temporales.filter(p => p.id_mesa !== idMesa);
        delete mesa_metadata[idMesa];
        await authorizedFetch(`${API_URL}?action=clear_table&id_mesa=${idMesa}`);
        notifyChange();
    },

    enviarOrdenCocina: async (idMesa: string) => {
        const promises = pedidos_temporales
            .filter(p => p.id_mesa === idMesa && p.estado === 'sin_enviar')
            .map(async p => {
                p.estado = 'pendiente';
                p.fecha_hora = new Date();
                return authorizedFetch(`${API_URL}?action=update_order_status`, {
                    method: 'POST',
                    body: JSON.stringify({ id: p.id, estado: 'pendiente' })
                });
            });

        await Promise.all(promises);
        notifyChange();
    },

    obtenerPedidosCocina: () => pedidos_temporales.filter(p => p.estado && ['pendiente', 'preparando', 'listo'].includes(p.estado)),

    cambiarEstadoPedido: async (id: string, estado: any) => {
        const p = pedidos_temporales.find(x => x.id === id);
        if (p) {
            p.estado = estado;
            await authorizedFetch(`${API_URL}?action=update_order_status`, {
                method: 'POST',
                body: JSON.stringify({ id: p.id, estado })
            });
            notifyChange();
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
        await authorizedFetch(`${API_URL}?action=update_table_meta`, {
            method: 'POST',
            body: JSON.stringify({ id_mesa: id, cliente: val, tipo_pedido: mesa_metadata[id].tipoPedido })
        });
        // Aquí no siempre es necesario notifyChange masivo, pero ayuda a sincronizar
        notifyChange();
    },
    obtenerNombreCliente: (id: string) => mesa_metadata[id]?.cliente || '',

    actualizarTipoPedido: async (id: string, val: any) => {
        if (!mesa_metadata[id]) mesa_metadata[id] = { cliente: '', tipoPedido: 'LOCAL' };
        mesa_metadata[id].tipoPedido = val;
        pedidos_temporales.filter(p => p.id_mesa === id).forEach(p => p.tipo_pedido = val);
        await authorizedFetch(`${API_URL}?action=update_table_meta`, {
            method: 'POST',
            body: JSON.stringify({ id_mesa: id, cliente: mesa_metadata[id].cliente, tipo_pedido: val })
        });
        notifyChange();
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
            id: '',
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
                id: '',
                id_venta: '',
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
                id: '', id_venta: '', id_insumo: 'FEE',
                codigo_producto: 'SERV', nombre_producto: 'Servicio Domicilio', cantidad: 1, precio_unitario: 10, subtotal: 10, notas: ''
            });
        }

        const payload = {
            venta: { ...nuevaVenta, fecha: formatMySQLDate(nuevaVenta.fecha) },
            detalles: nuevosDetalles
        };

        // Background sync
        authorizedFetch(`${API_URL}?action=save_sale`, { method: 'POST', body: JSON.stringify(payload) })
            .then(async (res) => {
                if (res && res.ok) notifyChange();
            })
            .catch(console.error);

        // Optimistic cleanup
        pedidos_temporales = pedidos_temporales.filter(p => p.id_mesa !== idMesa);
        delete mesa_metadata[idMesa];
        authorizedFetch(`${API_URL}?action=clear_table&id_mesa=${idMesa}`).catch(console.error);

        return { ...nuevaVenta, detalles: nuevosDetalles };
    },

    obtenerTodasLasVentas: () => ventas.map(v => ({ ...v, detalles: detalles_venta.filter(d => d.id_venta === v.id) })).sort((a, b) => b.consecutivo - a.consecutivo),

    _getVentasRaw: () => ventas,
    _getDetallesRaw: () => detalles_venta
};

// Carga inicial
dbService.cargarDatosGenerales();