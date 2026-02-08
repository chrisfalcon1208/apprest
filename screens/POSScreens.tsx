import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { SidebarLink, StatusBadge, ConfirmModal, Input, Button, ThemeToggle } from '../components/Components';
import { dbService } from '../services/dbService';
import { reportService } from '../services/reportService';
import { printerService } from '../services/printerService';
import { MesaEstado, Insumo, PedidoTemporal, Categoria, Venta, DetalleVenta } from '../types';

export const ScreenFloorPlan = () => {
    const negocio = dbService.obtenerInfoNegocio();
    const [mesas, setMesas] = useState<MesaEstado[]>([]);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [printerConnected, setPrinterConnected] = useState(printerService.isConnected());
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Función para refrescar datos desde DB local cacheada
    const actualizarDatosLocales = () => {
        const nuevasMesas: MesaEstado[] = [];
        for (let i = 1; i <= negocio.numeroMesas; i++) {
            const estadoDB = dbService.obtenerEstadoMesa(i.toString());
            nuevasMesas.push({
                id: i.toString(),
                numero: i,
                estado: estadoDB.estado as any,
                total_actual: estadoDB.total,
                mesero_asignado: estadoDB.mesero
            });
        }
        setMesas(nuevasMesas);
    };

    useEffect(() => {
        actualizarDatosLocales();

        // 1. Escuchar actualizaciones en tiempo real (BroadcastChannel o acciones locales)
        window.addEventListener('apprest-config-updated', actualizarDatosLocales);

        // 2. Polling al servidor (para sincronizar entre dispositivos distintos no conectados por Broadcast)
        const serverPolling = setInterval(() => {
            dbService.cargarDatosGenerales(); // Esto disparará 'apprest-config-updated' al terminar
        }, 3000); // 3 segundos para respuesta rápida

        // 3. Reloj local
        const clockTimer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => {
            window.removeEventListener('apprest-config-updated', actualizarDatosLocales);
            clearInterval(serverPolling);
            clearInterval(clockTimer);
        };
    }, []);

    const handleConnectPrinter = async () => {
        if (printerConnected) {
            await printerService.disconnect();
            setPrinterConnected(false);
        } else {
            const success = await printerService.connect();
            if (success) {
                setPrinterConnected(true);
            } else {
                alert("No se pudo conectar a la impresora. Asegúrate de tener permisos o usar Chrome/Edge.");
            }
        }
    };

    const obtenerColorMesa = (m: MesaEstado) => {
        if (m.estado === 'ocupada') return 'bg-white dark:bg-surface-dark border-orange-500/50 shadow-orange-500/10';
        return 'bg-white dark:bg-surface-dark border-slate-200 dark:border-[#1f3a2a]';
    };

    return (
        <div className="flex h-screen w-full relative">
            {/* Overlay para móvil */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 md:hidden backdrop-blur-sm"
                    onClick={() => setMobileMenuOpen(false)}
                ></div>
            )}

            {/* Side Navigation Responsiva */}
            <div className={`fixed md:static inset-y-0 left-0 z-30 w-64 flex-shrink-0 flex flex-col border-r border-slate-200 dark:border-[#1f3a2a] bg-slate-50 dark:bg-background-dark h-full transition-transform duration-300 transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
                <div className="flex flex-col h-full justify-between p-4">
                    <div className="flex flex-col gap-6">
                        <div className="flex gap-3 items-center pb-4 border-b border-slate-200 dark:border-[#1f3a2a] relative">
                            <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-12 border-2 border-primary/20" style={{ backgroundImage: `url("${negocio.logo}")` }}></div>
                            <div className="flex flex-col">
                                <h1 className="text-slate-900 dark:text-white text-base font-bold leading-normal">{negocio.nombre}</h1>
                                <p className="text-primary text-xs font-medium uppercase tracking-wider">TPV Local</p>
                            </div>
                            <button
                                onClick={() => setMobileMenuOpen(false)}
                                className="absolute top-0 right-0 md:hidden text-slate-500 dark:text-white"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <div className="flex flex-col gap-2 overflow-y-auto">
                            <SidebarLink to="/" icon="map" label="Plano de Mesa" />
                            <SidebarLink to="/sales" icon="point_of_sale" label="Reporte Ventas" />
                            <SidebarLink to="/kds" icon="skillet" label="Cocina (KDS)" />
                            <SidebarLink to="/admin" icon="dashboard" label="Panel Admin" />
                            <SidebarLink to="/admin/products" icon="inventory_2" label="Inventario" />

                            <button
                                onClick={handleConnectPrinter}
                                className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors cursor-pointer group w-full text-left mt-2 border ${printerConnected ? 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400' : 'bg-transparent border-slate-200 dark:border-[#23482f] text-slate-500 dark:text-[#92c9a4] hover:bg-slate-200 dark:hover:bg-[#1f3a2a]'}`}
                            >
                                <span className={`material-symbols-outlined ${printerConnected ? 'text-blue-500' : 'text-slate-400'}`}>print_connect</span>
                                <div className="flex flex-col">
                                    <p className="text-sm font-medium leading-none">Impresora</p>
                                    <p className="text-[10px] opacity-70">{printerConnected ? 'Conectada (USB)' : 'Desconectada'}</p>
                                </div>
                            </button>
                        </div>
                    </div>
                    <div className="mt-auto pt-4 border-t border-slate-200 dark:border-[#1f3a2a]">
                        <StatusBadge />
                        <button
                            onClick={() => dbService.logout()}
                            className="mt-4 flex items-center gap-2 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium pl-2 w-full text-left"
                        >
                            <span className="material-symbols-outlined">logout</span> Cerrar Sesión
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100 dark:bg-background-dark relative">
                <div className="flex flex-col border-b border-slate-200 dark:border-[#1f3a2a] bg-white dark:bg-background-dark z-10 transition-colors">
                    <div className="px-4 md:px-6 py-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <button
                                className="md:hidden p-2 -ml-2 text-slate-600 dark:text-white"
                                onClick={() => setMobileMenuOpen(true)}
                            >
                                <span className="material-symbols-outlined">menu</span>
                            </button>
                            <h2 className="text-slate-800 dark:text-white font-bold text-lg md:text-xl">Mapa de Mesas</h2>
                        </div>
                        <div className="flex items-center gap-4">
                            <ThemeToggle />
                            <div className="hidden md:block h-8 w-px bg-slate-200 dark:bg-[#1f3a2a]"></div>
                            <div className="text-right hidden md:block">
                                <p className="text-slate-800 dark:text-white text-lg font-bold leading-none font-mono">
                                    {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </p>
                                <p className="text-slate-500 dark:text-[#92c9a4] text-xs font-medium">{currentTime.toLocaleDateString()}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-4 md:p-8 relative">
                    <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#92c9a4 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 max-w-6xl mx-auto">
                        {mesas.map((mesa) => (
                            <Link to={`/order?mesa=${mesa.id}`} key={mesa.id} className="relative group cursor-pointer block">
                                <div className={`h-32 md:h-40 rounded-xl border p-4 flex flex-col justify-between transition-all shadow-lg hover:shadow-xl hover:shadow-primary/5 ${obtenerColorMesa(mesa)}`}>
                                    <div className="flex justify-between items-start">
                                        <span className="text-2xl font-bold text-slate-800 dark:text-white">{mesa.numero.toString().padStart(2, '0')}</span>
                                        {mesa.estado === 'ocupada' ? (
                                            <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-400/10 px-2 py-1 rounded animate-pulse">
                                                <span className="material-symbols-outlined text-[16px]">restaurant</span>
                                                <span className="text-xs font-bold">Ocupada</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1 text-slate-600 dark:text-[#92c9a4] bg-slate-200 dark:bg-[#92c9a4]/10 px-2 py-1 rounded">
                                                <span className="text-xs font-bold">Libre</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-end">
                                        <div className="flex flex-col">
                                            {mesa.estado === 'ocupada' && <span className="text-slate-500 dark:text-[#92c9a4] text-xs">Total Parcial</span>}
                                            <span className="text-slate-700 dark:text-white font-medium text-sm">
                                                {mesa.estado === 'ocupada' ? `$${mesa.total_actual.toFixed(2)}` : 'Disponible'}
                                            </span>
                                        </div>
                                        <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-[#1f3a2a] flex items-center justify-center text-slate-700 dark:text-white group-hover:bg-primary group-hover:text-background-dark transition-colors">
                                            <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export const ScreenOrder = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const mesaId = searchParams.get('mesa');
    const negocio = dbService.obtenerInfoNegocio();

    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [insumos, setInsumos] = useState<Insumo[]>([]);
    const [pedidos, setPedidos] = useState<PedidoTemporal[]>([]);

    const [catSeleccionada, setCatSeleccionada] = useState<string>('');
    const [busqueda, setBusqueda] = useState('');

    const [cliente, setCliente] = useState('');
    const [tipoPedido, setTipoPedido] = useState<'LOCAL' | 'LLEVAR' | 'DOMICILIO'>('LOCAL');

    // Modals & States
    const [showPayModal, setShowPayModal] = useState(false);
    const [showPrecuentaModal, setShowPrecuentaModal] = useState(false);
    const [montoRecibido, setMontoRecibido] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [ticketFinal, setTicketFinal] = useState<(Venta & { detalles: DetalleVenta[] }) | null>(null);
    const [procesando, setProcesando] = useState(false);

    // Responsive Cart Drawer State
    const [showMobileCart, setShowMobileCart] = useState(false);

    useEffect(() => {
        if (!mesaId) {
            navigate('/');
            return;
        }
        setCategorias(dbService.obtenerCategorias());
        setInsumos(dbService.obtenerInsumos());

        cargarDatosMesa();

        // Escuchar actualizaciones (Real-time y Polling)
        const handleUpdate = () => cargarDatosMesa();
        window.addEventListener('apprest-config-updated', handleUpdate);

        // Polling de respaldo (3s)
        const polling = setInterval(() => dbService.cargarDatosGenerales(), 3000);

        return () => {
            window.removeEventListener('apprest-config-updated', handleUpdate);
            clearInterval(polling);
        };
    }, [mesaId]);

    const cargarDatosMesa = () => {
        if (!mesaId) return;
        setPedidos(dbService.obtenerPedidosMesa(mesaId));
        const cli = dbService.obtenerNombreCliente(mesaId);
        const tipo = dbService.obtenerTipoPedido(mesaId);
        setCliente(prev => prev !== cli && cli !== '' ? cli : prev);
        setTipoPedido(tipo);
    };

    const handleAgregar = async (insumo: Insumo) => {
        if (!mesaId) return;
        await dbService.agregarPedidoTemporal(mesaId, insumo.id, 1, 'u1');
    };

    const handleNotaChange = async (idPedido: string, nuevaNota: string) => {
        setPedidos(prev => prev.map(p => p.id === idPedido ? { ...p, notas: nuevaNota } : p));
        await dbService.actualizarNotasPedido(idPedido, nuevaNota);
    };

    // Nueva función para decrementar cantidad
    const handleDecrement = async (pedido: PedidoTemporal) => {
        if (pedido.cantidad > 1) {
            setPedidos(prev => prev.map(p => p.id === pedido.id ? { ...p, cantidad: p.cantidad - 1 } : p));
            await dbService.actualizarCantidadPedido(pedido.id, pedido.cantidad - 1);
        }
    };

    const handleEliminar = async (idPedido: string) => {
        setPedidos(prev => prev.filter(p => p.id !== idPedido));
        setProcesando(true);
        await dbService.eliminarPedidoTemporal(idPedido);
        setProcesando(false);
    };

    const handleEnviarCocina = async () => {
        if (!mesaId) return;
        setProcesando(true);
        await dbService.enviarOrdenCocina(mesaId);
        setProcesando(false);
    };

    const handlePrecuenta = () => setShowPrecuentaModal(true);

    const handleVaciarMesa = async () => {
        if (!mesaId) return;
        setProcesando(true);
        await dbService.vaciarMesa(mesaId);
        setProcesando(false);
        navigate('/');
    };

    const handleCerrarCuenta = () => {
        setShowPayModal(true);
        setMontoRecibido('');
    };

    const totalCuenta = pedidos.reduce((acc, p) => acc + (p.cantidad * (p.insumo_snapshot?.precio || 0)), 0) + (tipoPedido === 'DOMICILIO' ? 10 : 0);

    const confirmarPago = () => {
        if (!mesaId) return;
        const monto = parseFloat(montoRecibido);
        if (!montoRecibido || isNaN(monto)) {
            alert("Error: Debes ingresar un monto válido para cerrar la venta.");
            return;
        }
        if (monto < totalCuenta) {
            alert(`Error: El pago recibido ($${monto.toFixed(2)}) no cubre el total de la cuenta ($${totalCuenta.toFixed(2)}).`);
            return;
        }
        try {
            const currentUser = dbService.obtenerUsuarioActual();
            const ventaGenerada = dbService.cerrarCuenta(mesaId, currentUser.id, cliente, monto);
            setShowPayModal(false);
            setTicketFinal(ventaGenerada);
        } catch (e) {
            alert("Error al cerrar cuenta: " + e);
        }
    };

    const finalizarProceso = () => {
        setTicketFinal(null);
        navigate('/');
    };

    const handleUpdateCliente = (val: string) => {
        setCliente(val);
        if (mesaId) dbService.actualizarNombreCliente(mesaId, val);
    };

    const handleUpdateTipo = (val: any) => {
        setTipoPedido(val);
        if (mesaId) dbService.actualizarTipoPedido(mesaId, val);
    };

    const imprimirPrecuenta = async () => {
        if (printerService.isConnected() && mesaId) {
            const exito = await printerService.printPreCuenta(pedidos, negocio, mesaId, totalCuenta);
            if (!exito) window.print();
        } else {
            window.print();
        }
        setShowPrecuentaModal(false);
    };

    const imprimirTicketFinal = async () => {
        if (printerService.isConnected() && ticketFinal) {
            const exito = await printerService.printTicket(ticketFinal, negocio);
            if (!exito) window.print();
        } else {
            window.print();
        }
        finalizarProceso();
    };

    const itemsFiltrados = insumos.filter(i => {
        const matchCat = catSeleccionada ? i.categoria_id === catSeleccionada : true;
        const matchText = i.nombre.toLowerCase().includes(busqueda.toLowerCase());
        return matchCat && matchText;
    });

    const hayPedidosSinEnviar = pedidos.some(p => p.estado === 'sin_enviar');

    return (
        <div className="flex h-screen w-full bg-slate-100 dark:bg-background-dark overflow-hidden relative">
            <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleVaciarMesa}
                title="Vaciar Mesa"
                message="¿Estás seguro que deseas eliminar todos los pedidos de esta mesa? Esta acción no se puede deshacer."
            />

            {/* Modal de Pre-cuenta */}
            {showPrecuentaModal && (
                <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white text-black p-8 rounded shadow-2xl w-80 font-mono text-sm relative animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                        <div className="text-center mb-6 shrink-0">
                            {negocio.logo && <img src={negocio.logo} alt="Logo" className="w-16 h-16 mx-auto mb-2 object-contain" />}
                            <h2 className="font-bold text-xl uppercase tracking-widest">{negocio.nombre}</h2>
                            <p className="text-xs mt-1">{negocio.telefono}</p>
                            <p className="text-xs mt-1 font-bold">ESTADO DE CUENTA</p>
                            <p className="text-[10px] uppercase">(PRE-CUENTA)</p>
                            <div className="border-b-2 border-dashed border-black my-4"></div>
                            <div className="flex justify-between text-xs">
                                <span>Mesa: {mesaId}</span>
                                <span>{new Date().toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span>Cliente: {cliente || 'General'}</span>
                                <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        </div>

                        {/* LISTA DE PRODUCTOS Y TOTALES SCROLLABLE */}
                        <div className="flex-1 overflow-y-auto mb-4 custom-scrollbar pr-1">
                            <div className="mb-4">
                                <div className="flex justify-between text-xs font-bold border-b border-black mb-2 pb-1">
                                    <span>CANT. ARTICULO</span>
                                    <span>IMPORTE</span>
                                </div>
                                {pedidos.map((p) => (
                                    <div key={p.id} className="mb-2">
                                        <div className="flex justify-between items-start">
                                            <span className="flex-1 pr-4">{p.cantidad} x {p.insumo_snapshot?.nombre}</span>
                                            <span>${(p.cantidad * (p.insumo_snapshot?.precio || 0)).toFixed(2)}</span>
                                        </div>
                                        {/* Mostrar notas también en precuenta */}
                                        {p.notas && <div className="text-[10px] italic text-gray-600 pl-2">** {p.notas}</div>}
                                    </div>
                                ))}
                                {tipoPedido === 'DOMICILIO' && (
                                    <div className="mb-2 flex justify-between items-start">
                                        <span>1 x Servicio Domicilio</span>
                                        <span>$10.00</span>
                                    </div>
                                )}
                            </div>

                            <div className="border-t-2 border-dashed border-black pt-2 mb-6">
                                <div className="flex justify-between font-bold text-xl">
                                    <span>TOTAL:</span>
                                    <span>${totalCuenta.toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="text-center text-[10px] mb-6 font-bold">
                                <p>*** NO VÁLIDO COMO FACTURA ***</p>
                                <p>Por favor revise su cuenta antes de pagar.</p>
                            </div>
                        </div>

                        <div className="mt-auto flex gap-2 no-print shrink-0">
                            <button
                                onClick={imprimirPrecuenta}
                                className="w-full bg-black hover:bg-gray-800 text-white py-3 rounded font-bold flex items-center justify-center gap-2 transition-colors"
                            >
                                <span className="material-symbols-outlined text-sm">print</span>
                                {printerService.isConnected() ? 'IMPRIMIR (TÉRMICA)' : 'IMPRIMIR'}
                            </button>
                            <button onClick={() => setShowPrecuentaModal(false)} className="px-3 bg-gray-200 hover:bg-gray-300 rounded font-bold">X</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Pago */}
            {showPayModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-[#23482f] rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in duration-200">
                        <h3 className="text-slate-900 dark:text-white text-xl font-bold mb-4">Cerrar Cuenta</h3>
                        <div className="flex justify-between items-end mb-4 border-b border-slate-200 dark:border-[#23482f] pb-4">
                            <span className="text-slate-500 dark:text-[#92c9a4]">Total a Pagar</span>
                            <span className="text-3xl font-bold text-slate-900 dark:text-white">${totalCuenta.toFixed(2)}</span>
                        </div>
                        <Input
                            label="Monto Recibido"
                            type="number"
                            value={montoRecibido}
                            onChange={(e: any) => setMontoRecibido(e.target.value)}
                            autoFocus
                            placeholder="Ingrese monto..."
                        />
                        <div className="flex justify-between mt-2 text-sm mb-6">
                            <span className="text-slate-500 dark:text-[#92c9a4]">Cambio</span>
                            <span className={`font-bold ${(parseFloat(montoRecibido || '0') - totalCuenta) < 0 ? 'text-red-500' : 'text-primary-dark dark:text-primary'}`}>
                                ${(parseFloat(montoRecibido || '0') - totalCuenta).toFixed(2)}
                            </span>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="secondary" onClick={() => setShowPayModal(false)} className="flex-1">Cancelar</Button>
                            <Button onClick={confirmarPago} className="flex-1">Cobrar</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Ticket Final */}
            {ticketFinal && (
                <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md">
                    <div className="bg-white text-black p-8 rounded shadow-2xl w-80 font-mono text-sm relative animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                        <div className="text-center mb-6 shrink-0">
                            {negocio.logo && <img src={negocio.logo} alt="Logo" className="w-16 h-16 mx-auto mb-2 object-contain" />}
                            <h2 className="font-bold text-xl uppercase tracking-widest">{negocio.nombre}</h2>
                            <p className="text-xs mt-1">{negocio.telefono}</p>
                            <p className="text-xs mt-1">Ticket de Venta #{ticketFinal.consecutivo}</p>
                            <div className="border-b-2 border-dashed border-black my-4"></div>
                            <p className="text-left text-xs mt-1">Fecha: {new Date().toLocaleString()}</p>
                            <p className="text-left text-xs mt-1">Cliente: {ticketFinal.cliente}</p>
                        </div>

                        {/* LISTA DE PRODUCTOS SCROLLABLE */}
                        <div className="flex-1 overflow-y-auto mb-4 custom-scrollbar pr-1">
                            <div className="mb-4">
                                <div className="flex justify-between text-xs font-bold border-b border-black mb-2 pb-1">
                                    <span>CANT. ARTICULO</span>
                                    <span>IMPORTE</span>
                                </div>
                                {ticketFinal.detalles.map((d) => (
                                    <div key={d.id} className="mb-2">
                                        <div className="flex justify-between items-start">
                                            <span className="flex-1 pr-4">{d.cantidad} x {d.nombre_producto}</span>
                                            <span>${d.subtotal.toFixed(2)}</span>
                                        </div>
                                        {d.notas && <div className="text-[10px] italic text-gray-600 pl-2">** {d.notas}</div>}
                                    </div>
                                ))}
                            </div>

                            <div className="border-t-2 border-dashed border-black pt-2 mb-6">
                                <div className="flex justify-between font-bold text-xl mb-2">
                                    <span>TOTAL:</span>
                                    <span>${ticketFinal.total.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>RECIBIDO:</span>
                                    <span>${ticketFinal.monto_recibido?.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm font-bold mt-1">
                                    <span>CAMBIO:</span>
                                    <span>${ticketFinal.monto_cambio?.toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="text-center text-xs mb-6">
                                <p>¡Gracias por su visita!</p>
                            </div>
                        </div>

                        <div className="mt-auto flex gap-2 no-print shrink-0">
                            <button
                                onClick={imprimirTicketFinal}
                                className="w-full bg-black hover:bg-gray-800 text-white py-3 rounded font-bold flex items-center justify-center gap-2 transition-colors"
                            >
                                <span className="material-symbols-outlined text-sm">print</span>
                                {printerService.isConnected() ? 'IMPRIMIR (TÉRMICA)' : 'IMPRIMIR'}
                            </button>
                            <button onClick={finalizarProceso} className="px-4 bg-gray-200 hover:bg-gray-300 rounded font-bold">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Columna Izquierda: Categorías */}
            <div className="w-24 md:w-32 flex-shrink-0 bg-white dark:bg-surface-dark border-r border-slate-200 dark:border-[#1f3a2a] flex-col items-center py-4 gap-2 overflow-y-auto hidden md:flex">
                <button
                    onClick={() => setCatSeleccionada('')}
                    className={`w-20 h-20 rounded-xl flex flex-col items-center justify-center gap-2 p-2 transition-all ${catSeleccionada === '' ? 'bg-primary text-background-dark' : 'bg-slate-100 dark:bg-[#162b1e] text-slate-600 dark:text-[#92c9a4] hover:bg-slate-200 dark:hover:bg-[#1f3a2a] hover:text-slate-900 dark:hover:text-white'}`}
                >
                    <span className="material-symbols-outlined text-2xl">apps</span>
                    <span className="text-[10px] font-bold text-center leading-tight">TODO</span>
                </button>
                {categorias.map(c => (
                    <button
                        key={c.id}
                        onClick={() => setCatSeleccionada(c.id)}
                        className={`w-20 h-20 rounded-xl flex flex-col items-center justify-center gap-2 p-2 transition-all ${catSeleccionada === c.id ? 'bg-primary text-background-dark' : 'bg-slate-100 dark:bg-[#162b1e] text-slate-600 dark:text-[#92c9a4] hover:bg-slate-200 dark:hover:bg-[#1f3a2a] hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        <span className="material-symbols-outlined text-2xl">{c.tipo === 'BEBIDA' ? 'local_bar' : 'restaurant'}</span>
                        <span className="text-[10px] font-bold text-center leading-tight break-words w-full">{c.nombre}</span>
                    </button>
                ))}
            </div>

            {/* Columna Central: Productos */}
            <div className="flex-1 flex flex-col h-full bg-slate-100 dark:bg-background-dark relative min-w-0">
                {/* Header */}
                <div className="h-auto md:h-16 py-3 border-b border-slate-200 dark:border-[#1f3a2a] flex flex-col md:flex-row items-center px-4 justify-between bg-white dark:bg-surface-dark shrink-0 gap-3">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <Link to="/" className="text-slate-800 dark:text-white hover:text-primary"><span className="material-symbols-outlined">arrow_back</span></Link>
                        <div className="flex flex-col">
                            <h2 className="text-slate-800 dark:text-white font-bold text-lg leading-none">Mesa {mesaId}</h2>
                            <p className="text-slate-500 dark:text-[#92c9a4] text-xs">{pedidos.length} items</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar pb-1 md:pb-0">
                        <button
                            onClick={() => handleUpdateTipo('LOCAL')}
                            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${tipoPedido === 'LOCAL' ? 'bg-primary text-black' : 'bg-slate-100 dark:bg-[#162b1e] text-gray-500 dark:text-white hover:bg-slate-200 dark:hover:bg-[#1f3a2a]'}`}
                        >
                            <span className="material-symbols-outlined text-lg">restaurant</span>
                            LOCAL
                        </button>
                        <button
                            onClick={() => handleUpdateTipo('LLEVAR')}
                            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${tipoPedido === 'LLEVAR' ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-[#162b1e] text-gray-500 dark:text-white hover:bg-slate-200 dark:hover:bg-[#1f3a2a]'}`}
                        >
                            <span className="material-symbols-outlined text-lg">shopping_bag</span>
                            LLEVAR
                        </button>
                        <button
                            onClick={() => handleUpdateTipo('DOMICILIO')}
                            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${tipoPedido === 'DOMICILIO' ? 'bg-orange-500 text-white' : 'bg-slate-100 dark:bg-[#162b1e] text-gray-500 dark:text-white hover:bg-slate-200 dark:hover:bg-[#1f3a2a]'}`}
                        >
                            <span className="material-symbols-outlined text-lg">delivery_dining</span>
                            ENVÍO
                        </button>
                    </div>
                </div>

                {/* Buscador + Categorías Móvil */}
                <div className="flex flex-col bg-slate-50 dark:bg-[#102216]">
                    <div className="p-3 border-b border-slate-200 dark:border-[#1f3a2a]">
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 dark:text-gray-500 text-sm">search</span>
                            <input
                                type="text"
                                placeholder="Buscar productos..."
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                className="w-full bg-white dark:bg-[#162b1e] border border-slate-300 dark:border-[#23482f] rounded-full py-2 pl-9 pr-4 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-primary"
                            />
                        </div>
                    </div>

                    <div className="md:hidden overflow-x-auto whitespace-nowrap p-2 border-b border-slate-200 dark:border-[#23482f] no-scrollbar">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCatSeleccionada('')}
                                className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors ${catSeleccionada === '' ? 'bg-primary border-primary text-black' : 'bg-white dark:bg-[#162b1e] border-slate-300 dark:border-[#23482f] text-slate-700 dark:text-white'}`}
                            >
                                TODO
                            </button>
                            {categorias.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => setCatSeleccionada(c.id)}
                                    className={`px-3 py-2 rounded-lg text-xs font-bold border transition-colors flex items-center gap-1 ${catSeleccionada === c.id ? 'bg-primary border-primary text-black' : 'bg-white dark:bg-[#162b1e] border-slate-300 dark:border-[#23482f] text-slate-700 dark:text-white'}`}
                                >
                                    <span className="material-symbols-outlined text-[14px]">{c.tipo === 'BEBIDA' ? 'local_bar' : 'restaurant'}</span>
                                    {c.nombre}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Grid Productos */}
                <div className="flex-1 overflow-y-auto p-4 relative" id="product-grid-container">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 pb-24 md:pb-4">
                        {itemsFiltrados.map(item => (
                            <button
                                key={item.id}
                                onClick={() => handleAgregar(item)}
                                className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-[#23482f] hover:border-primary/50 hover:shadow-lg dark:hover:shadow-none rounded-xl p-3 flex flex-col gap-2 text-left transition-all active:scale-95 group relative overflow-hidden h-auto w-full"
                            >
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-background-dark rounded-full p-1 shadow-lg z-10">
                                    <span className="material-symbols-outlined text-sm">add</span>
                                </div>
                                <div className="aspect-[4/3] w-full bg-slate-200 dark:bg-[#162b1e] rounded-lg mb-1 overflow-hidden shrink-0">
                                    {item.imagen ? (
                                        <img src={item.imagen} alt={item.nombre} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-[#23482f]">
                                            <span className="material-symbols-outlined text-4xl">{item.tipo === 'BEBIDA' ? 'local_bar' : 'restaurant'}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="min-h-0 flex-1 flex flex-col justify-between w-full">
                                    <p className="text-slate-800 dark:text-white font-bold text-sm leading-tight line-clamp-2 w-full">{item.nombre}</p>
                                    <p className="text-primary-dark dark:text-primary font-bold mt-1">${item.precio.toFixed(2)}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Botón Flotante Móvil */}
                <div className="md:hidden absolute bottom-4 left-4 right-4 z-20">
                    <button
                        onClick={() => setShowMobileCart(true)}
                        className="w-full bg-black dark:bg-primary text-white dark:text-black font-bold py-4 px-6 rounded-full shadow-2xl flex items-center justify-between animate-bounce-subtle"
                    >
                        <div className="flex items-center gap-2">
                            <span className="bg-white dark:bg-black/20 text-black dark:text-white px-2 py-0.5 rounded text-xs font-bold">{pedidos.reduce((a, b) => a + b.cantidad, 0)}</span>
                            <span>Ver Orden</span>
                        </div>
                        <span>${totalCuenta.toFixed(2)}</span>
                    </button>
                </div>
            </div>

            {/* Columna Derecha: Carrito */}
            <div className={`
                fixed inset-0 z-50 md:static md:z-auto bg-black/50 md:bg-transparent transition-opacity duration-300
                ${showMobileCart ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none md:opacity-100 md:pointer-events-auto'}
                md:flex md:w-96 md:flex-col md:shrink-0
            `}>
                <div className={`
                    absolute right-0 top-0 bottom-0 w-full sm:w-96 bg-white dark:bg-surface-dark md:border-l border-slate-200 dark:border-[#1f3a2a] flex flex-col shadow-xl transition-transform duration-300
                    ${showMobileCart ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
                    md:static md:w-full md:h-full md:shadow-none md:transform-none
                `}>
                    {/* Botón cerrar para móvil */}
                    <div className="md:hidden p-2 absolute top-2 right-2 z-20">
                        <button onClick={() => setShowMobileCart(false)} className="bg-slate-200 dark:bg-[#1f3a2a] rounded-full p-2 text-slate-600 dark:text-white">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    <div className="p-4 border-b border-slate-200 dark:border-[#1f3a2a] bg-slate-50 dark:bg-[#162b1e] flex flex-col gap-3 relative mt-10 md:mt-0">
                        <div className="flex justify-between items-center mb-1 pr-10 md:pr-0">
                            <span className="text-xs text-slate-500 dark:text-[#92c9a4] font-bold uppercase tracking-wider">Detalle de Orden</span>
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-1 rounded hover:bg-red-100 dark:hover:bg-red-400/10 transition-colors"
                                title="Vaciar Mesa"
                            >
                                <span className="material-symbols-outlined">delete</span>
                            </button>
                        </div>

                        <input
                            className="w-full bg-white dark:bg-background-dark border border-slate-300 dark:border-[#23482f] rounded px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-primary placeholder-slate-400 dark:placeholder-white/30"
                            placeholder="Nombre del Cliente..."
                            value={cliente}
                            onChange={(e) => handleUpdateCliente(e.target.value)}
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2 relative">
                        {pedidos.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-gray-500 opacity-50">
                                <span className="material-symbols-outlined text-5xl mb-2">shopping_cart</span>
                                <p>Orden vacía</p>
                            </div>
                        ) : (
                            pedidos.map(p => (
                                <div key={p.id} className="bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-[#23482f] rounded-lg p-3 flex justify-between items-start group relative">
                                    <div className="flex flex-col w-full">
                                        <div className="flex items-center gap-2 justify-between">
                                            <div className="flex items-center gap-2">
                                                {p.cantidad > 1 && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDecrement(p); }}
                                                        className="bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded p-0.5 hover:bg-red-200 dark:hover:bg-red-500/30 transition-colors"
                                                        title="Restar 1"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px] font-bold">remove</span>
                                                    </button>
                                                )}
                                                <span className="text-primary-dark dark:text-primary font-bold">{p.cantidad}x</span>
                                                <span className="text-slate-800 dark:text-white font-medium text-sm">{p.insumo_snapshot?.nombre}</span>
                                            </div>
                                            <span className="text-slate-500 dark:text-gray-500 text-xs">${(p.cantidad * (p.insumo_snapshot?.precio || 0)).toFixed(2)}</span>
                                        </div>
                                        {p.estado === 'sin_enviar' ? (
                                            <div className="mt-2 flex items-center gap-2">
                                                <span className="material-symbols-outlined text-gray-600 text-[14px]">edit_note</span>
                                                <input
                                                    type="text"
                                                    value={p.notas || ''}
                                                    onChange={(e) => handleNotaChange(p.id, e.target.value)}
                                                    className="bg-white dark:bg-[#102216] border border-slate-300 dark:border-[#23482f] rounded px-2 py-0.5 text-[10px] text-slate-800 dark:text-white w-full focus:outline-none focus:border-primary placeholder-slate-400 dark:placeholder-gray-600"
                                                    placeholder="Nota..."
                                                />
                                            </div>
                                        ) : (
                                            p.notas && <div className="mt-1 text-[10px] text-gray-500 italic flex items-center gap-1"><span className="material-symbols-outlined text-[10px]">sticky_note_2</span> {p.notas}</div>
                                        )}
                                        <span className={`text-[10px] font-bold mt-1 text-right ${p.estado === 'sin_enviar' ? 'text-yellow-600 dark:text-yellow-500' : 'text-blue-500'}`}>
                                            {p.estado === 'sin_enviar' ? 'En Carrito' : p.estado}
                                        </span>
                                    </div>
                                    <button onClick={() => handleEliminar(p.id)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="material-symbols-outlined text-[14px]">close</span>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-[#162b1e] border-t border-slate-200 dark:border-[#1f3a2a]">
                        {hayPedidosSinEnviar && (
                            <button
                                onClick={handleEnviarCocina}
                                disabled={procesando}
                                className="w-full mb-3 bg-orange-500/10 border border-orange-500 text-orange-600 dark:text-orange-500 font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-all animate-pulse"
                            >
                                {procesando ? <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div> : <span className="material-symbols-outlined text-[20px]">skillet</span>}
                                <span className="text-sm">ENVIAR A COCINA</span>
                            </button>
                        )}
                        <div className="space-y-1 mb-4 text-sm">
                            <div className="flex justify-between text-slate-500 dark:text-gray-400"><span>Subtotal</span><span>${(pedidos.reduce((acc, p) => acc + (p.cantidad * (p.insumo_snapshot?.precio || 0)), 0)).toFixed(2)}</span></div>
                            {tipoPedido === 'DOMICILIO' && <div className="flex justify-between text-orange-600 dark:text-orange-400"><span>Envío</span><span>$10.00</span></div>}
                            <div className="flex justify-between text-slate-900 dark:text-white font-bold text-xl pt-2 border-t border-slate-300 dark:border-[#23482f] mt-2"><span>Total</span><span>${totalCuenta.toFixed(2)}</span></div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handlePrecuenta} disabled={pedidos.length === 0} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-3 rounded-lg flex items-center justify-center gap-2 flex-1"><span className="material-symbols-outlined">receipt_long</span> Pre-Cuenta</button>
                            <button onClick={handleCerrarCuenta} disabled={pedidos.length === 0} className="bg-primary hover:bg-primary-dark text-white font-bold py-3 px-2 rounded-lg flex items-center justify-center gap-2 flex-1"><span className="material-symbols-outlined">payments</span> PAGAR</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const ScreenKDS = () => {
    const [pedidos, setPedidos] = useState<PedidoTemporal[]>([]);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        cargarPedidos();

        // Listener de eventos para actualización en tiempo real
        const handleUpdate = () => cargarPedidos();
        window.addEventListener('apprest-config-updated', handleUpdate);

        // Polling de respaldo para asegurar consistencia
        const polling = setInterval(() => dbService.cargarDatosGenerales(), 3000);
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);

        return () => {
            window.removeEventListener('apprest-config-updated', handleUpdate);
            clearInterval(polling);
            clearInterval(timer);
        };
    }, []);

    const cargarPedidos = () => setPedidos(dbService.obtenerPedidosCocina());

    const avanzarEstado = async (p: PedidoTemporal) => {
        let nuevoEstado: any = 'pendiente';
        if (p.estado === 'pendiente') nuevoEstado = 'preparando';
        else if (p.estado === 'preparando') nuevoEstado = 'listo';
        else if (p.estado === 'listo') nuevoEstado = 'finalizado';
        await dbService.cambiarEstadoPedido(p.id, nuevoEstado);
    };

    const avanzarMesaCompleta = async (idMesa: string, estadoActual: string) => {
        const target = pedidos.filter(p => p.id_mesa === idMesa && p.estado === estadoActual);
        await Promise.all(target.map(p => avanzarEstado(p)));
    };

    const mesasActivas = Array.from(new Set(pedidos.map(p => p.id_mesa))) as string[];

    const getBorderColor = (estado: string) => {
        if (estado === 'pendiente') return 'border-l-4 border-alert-yellow';
        if (estado === 'preparando') return 'border-l-4 border-blue-400';
        if (estado === 'listo') return 'border-l-4 border-primary';
        return '';
    };

    const getModeBadge = (tipo: 'LOCAL' | 'LLEVAR' | 'DOMICILIO' | undefined) => {
        switch (tipo) {
            case 'LLEVAR': return <div className="bg-blue-500 text-white px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">shopping_bag</span> P. LLEVAR</div>;
            case 'DOMICILIO': return <div className="bg-orange-500 text-white px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">delivery_dining</span> ENVÍO</div>;
            default: return <div className="bg-primary text-black px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">restaurant</span> LOCAL</div>;
        }
    };

    return (
        <div className="bg-slate-100 dark:bg-background-dark text-slate-900 dark:text-white h-screen flex flex-col overflow-hidden transition-colors">
            <header className="flex flex-col border-b border-slate-200 dark:border-border-dark bg-white dark:bg-[#112217] shrink-0 z-20">
                <div className="flex items-center justify-between px-4 md:px-6 py-3">
                    <div className="flex items-center gap-4">
                        <Link to="/" className="p-2 bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 rounded-lg text-slate-900 dark:text-white"><span className="material-symbols-outlined">arrow_back</span></Link>
                        <div><h1 className="text-xl font-bold leading-tight text-slate-900 dark:text-white">Cocina (KDS)</h1><p className="text-xs text-slate-500 dark:text-[#92c9a4]">{pedidos.length} items pendientes</p></div>
                    </div>
                    <div className="flex items-center gap-4"><ThemeToggle /><div className="hidden md:block h-8 w-px bg-slate-200 dark:bg-[#1f3a2a]"></div><div className="text-right hidden md:block"><p className="text-slate-900 dark:text-white text-lg font-bold leading-none font-mono">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p><p className="text-slate-500 dark:text-[#92c9a4] text-xs font-medium">{currentTime.toLocaleDateString()}</p></div></div>
                </div>
            </header>
            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-100 dark:bg-background-dark">
                {mesasActivas.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center flex-col text-slate-400 dark:text-gray-500"><span className="material-symbols-outlined text-6xl mb-2 opacity-20">skillet</span><p>No hay órdenes pendientes</p></div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 pb-20">
                        {mesasActivas.map(idMesa => {
                            const itemsMesa = pedidos.filter(p => p.id_mesa === idMesa);
                            const tienePendientes = itemsMesa.some(p => p.estado === 'pendiente');
                            const tienePreparando = itemsMesa.some(p => p.estado === 'preparando');
                            const tipoPedido = itemsMesa[0]?.tipo_pedido || 'LOCAL';
                            let headerClass = "bg-white dark:bg-[#23482f]";
                            if (tienePendientes) headerClass = "bg-yellow-50 dark:bg-[#423311] border-alert-yellow";
                            else if (tienePreparando) headerClass = "bg-blue-50 dark:bg-[#11283a] border-blue-500";

                            return (
                                <div key={idMesa} className="flex flex-col bg-white dark:bg-surface-dark border border-slate-300 dark:border-white/10 rounded-xl overflow-hidden shadow-xl h-fit animate-in zoom-in duration-300">
                                    <div className={`p-3 border-t-4 flex justify-between items-center ${headerClass.includes('border') ? headerClass : headerClass + ' border-primary'}`}>
                                        <div><h3 className="font-bold text-xl text-slate-900 dark:text-white">Mesa {idMesa}</h3><span className="text-xs font-mono opacity-70 text-slate-600 dark:text-white">{itemsMesa[0]?.fecha_hora.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
                                        {getModeBadge(tipoPedido)}
                                    </div>
                                    <div className="p-2 flex-1 space-y-2">
                                        {itemsMesa.map(p => (
                                            <div key={p.id} className={`bg-slate-100 dark:bg-black/20 p-2 rounded flex justify-between items-start cursor-pointer hover:bg-slate-200 dark:hover:bg-white/5 transition-colors relative group/item ${getBorderColor(p.estado || '')}`} onClick={() => avanzarEstado(p)}>
                                                <div className="flex-1"><div className="flex items-center gap-2"><span className="font-bold text-lg text-slate-900 dark:text-white">{p.cantidad}</span><span className="text-sm font-medium leading-tight text-slate-800 dark:text-white">{p.insumo_snapshot?.nombre}</span></div>{p.notas && <p className="text-xs text-yellow-700 dark:text-alert-yellow italic mt-1 bg-yellow-100 dark:bg-alert-yellow/10 p-1 rounded inline-block">{p.notas}</p>}</div>
                                                <div className="ml-2">{p.estado === 'pendiente' && <span className="material-symbols-outlined text-alert-yellow animate-pulse">hourglass_top</span>}{p.estado === 'preparando' && <span className="material-symbols-outlined text-blue-400">skillet</span>}{p.estado === 'listo' && <span className="material-symbols-outlined text-primary">check_circle</span>}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-[#102216] border-t border-slate-200 dark:border-white/10 flex gap-2">
                                        {tienePendientes && <button onClick={() => avanzarMesaCompleta(idMesa, 'pendiente')} className="flex-1 bg-yellow-100 dark:bg-alert-yellow/20 hover:bg-yellow-200 dark:hover:bg-alert-yellow/30 text-yellow-700 dark:text-alert-yellow text-xs font-bold py-2 rounded">COCINAR TODO</button>}
                                        {!tienePendientes && tienePreparando && <button onClick={() => avanzarMesaCompleta(idMesa, 'preparando')} className="flex-1 bg-blue-100 dark:bg-blue-500/20 hover:bg-blue-200 dark:hover:bg-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-bold py-2 rounded">TERMINAR TODO</button>}
                                        {!tienePendientes && !tienePreparando && <div className="w-full text-center text-primary-dark dark:text-primary text-xs font-bold py-2">{tipoPedido === 'LOCAL' ? 'LISTO PARA EMPLATAR' : 'LISTO PARA ENVOLSAR'}</div>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export const ScreenDailyReport = () => {
    const [allVentas, setAllVentas] = useState<(Venta & { detalles: DetalleVenta[] })[]>([]);
    const getTodayStr = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
    const [fechaInicio, setFechaInicio] = useState(getTodayStr());
    const [fechaFin, setFechaFin] = useState(getTodayStr());
    const [filtroTexto, setFiltroTexto] = useState("");
    const [paginaActual, setPaginaActual] = useState(1);
    const [itemsPorPagina, setItemsPorPagina] = useState(20);
    const [negocio] = useState(dbService.obtenerInfoNegocio());
    const [ticketParaImprimir, setTicketParaImprimir] = useState<any>(null);
    const [ventaSeleccionada, setVentaSeleccionada] = useState<(Venta & { detalles: DetalleVenta[] }) | null>(null);

    useEffect(() => { cargarVentas(); }, []);
    useEffect(() => { setPaginaActual(1); }, [fechaInicio, fechaFin, filtroTexto]);

    const cargarVentas = () => setAllVentas(dbService.obtenerTodasLasVentas());
    const resetearFechas = () => { const hoy = getTodayStr(); setFechaInicio(hoy); setFechaFin(hoy); setFiltroTexto(""); };

    const ventasFiltradas = allVentas.filter(v => {
        const d = new Date(v.fecha);
        const vFechaStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (fechaInicio && vFechaStr < fechaInicio) return false;
        if (fechaFin && vFechaStr > fechaFin) return false;
        if (filtroTexto) {
            const lower = filtroTexto.toLowerCase().trim();
            if (lower.startsWith('#')) return v.consecutivo.toString().includes(lower.substring(1).trim());
            if (lower.startsWith('m')) { const resto = lower.substring(1).trim(); if (resto.length > 0 && /^\d/.test(resto)) return v.id_mesa === resto || v.id_mesa.includes(resto); }
            return (v.consecutivo.toString().includes(lower) || v.id_mesa.toLowerCase().includes(lower) || v.cliente.toLowerCase().includes(lower) || (v.tipo_pedido && v.tipo_pedido.toLowerCase().includes(lower)));
        }
        return true;
    });

    const indiceUltimoItem = paginaActual * itemsPorPagina;
    const indicePrimerItem = indiceUltimoItem - itemsPorPagina;
    const ventasVisualizadas = ventasFiltradas.slice(indicePrimerItem, indiceUltimoItem);
    const totalPaginas = Math.ceil(ventasFiltradas.length / itemsPorPagina);
    const cambiarPagina = (numero: number) => setPaginaActual(numero);
    const totalFiltrado = ventasFiltradas.reduce((acc, v) => acc + v.total, 0);

    const prepararReimpresion = (venta: Venta & { detalles: DetalleVenta[] }) => {
        setVentaSeleccionada(venta);
        const itemsParaTicket = venta.detalles.map(d => ({ id: d.id, cantidad: d.cantidad, insumo_snapshot: { nombre: d.nombre_producto, precio: d.precio_unitario }, notas: d.notas, subtotal: d.subtotal }));
        setTicketParaImprimir({ cliente: venta.cliente, items: itemsParaTicket, total: venta.total, recibido: venta.monto_recibido || venta.total, cambio: venta.monto_cambio || 0, fecha: venta.fecha, tipo: 'REIMPRESIÓN #' + venta.consecutivo });
    };

    const getTipoBadge = (tipo?: string) => {
        switch (tipo) {
            case 'DOMICILIO': return <span className="bg-orange-500/20 text-orange-600 dark:text-orange-400 text-[10px] font-bold px-2 py-0.5 rounded border border-orange-500/30 flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">delivery_dining</span> DOMICILIO</span>;
            case 'LLEVAR': return <span className="bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-500/30 flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">shopping_bag</span> LLEVAR</span>;
            default: return <span className="bg-primary/20 text-primary-dark dark:text-primary text-[10px] font-bold px-2 py-0.5 rounded border border-primary/30 flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">restaurant</span> LOCAL</span>;
        }
    };

    return (
        <div className="flex h-screen w-full">
            {ticketParaImprimir && (
                <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white text-black p-8 rounded shadow-2xl w-80 font-mono text-sm relative animate-in zoom-in duration-200 flex flex-col max-h-[90vh]">
                        <div className="text-center mb-6 shrink-0">
                            {negocio.logo && <img src={negocio.logo} alt="Logo" className="w-16 h-16 mx-auto mb-2 object-contain" />}
                            <h2 className="font-bold text-xl uppercase tracking-widest">{negocio.nombre}</h2>
                            <p className="text-xs mt-1">{negocio.telefono}</p>
                            <div className="border-b-2 border-dashed border-black my-4"></div>
                            <div className="flex justify-between text-xs"><span>{ticketParaImprimir.tipo}</span><span>{new Date(ticketParaImprimir.fecha).toLocaleDateString()}</span></div>
                            <p className="text-left text-xs mt-1">Cliente: {ticketParaImprimir.cliente}</p>
                        </div>
                        <div className="flex-1 overflow-y-auto mb-4 custom-scrollbar pr-1">
                            <div className="mb-4">
                                <div className="flex justify-between text-xs font-bold border-b border-black mb-2 pb-1"><span>CANT. ARTICULO</span><span>TOTAL</span></div>
                                {ticketParaImprimir.items.map((p: any) => (<div key={p.id} className="mb-2"><div className="flex justify-between items-start"><span className="flex-1 pr-4">{p.cantidad} x {p.insumo_snapshot?.nombre}</span><span>${(p.subtotal || 0).toFixed(2)}</span></div>{p.notas && <div className="text-[10px] italic text-gray-600 pl-2">** {p.notas}</div>}</div>))}
                            </div>
                            <div className="border-t-2 border-dashed border-black pt-2 mb-6">
                                <div className="flex justify-between font-bold text-xl mb-2"><span>TOTAL:</span><span>${ticketParaImprimir.total.toFixed(2)}</span></div>
                                <div className="flex justify-between text-sm"><span>PAGADO:</span><span>${ticketParaImprimir.recibido.toFixed(2)}</span></div>
                                <div className="flex justify-between text-sm font-bold mt-1"><span>CAMBIO:</span><span>${ticketParaImprimir.cambio.toFixed(2)}</span></div>
                            </div>
                            <div className="text-center text-xs mb-6"><p>*** COPIA REIMPRESA ***</p></div>
                        </div>
                        <div className="mt-auto flex gap-2 no-print shrink-0">
                            <button onClick={async () => { if (printerService.isConnected() && ventaSeleccionada) { const exito = await printerService.printTicket(ventaSeleccionada, negocio); if (!exito) window.print(); } else { window.print(); } setTicketParaImprimir(null); }} className="w-full bg-black hover:bg-gray-800 text-white py-3 rounded font-bold flex items-center justify-center gap-2 transition-colors"><span className="material-symbols-outlined text-sm">print</span>{printerService.isConnected() ? 'IMPRIMIR (TÉRMICA)' : 'IMPRIMIR'}</button>
                            <button onClick={() => setTicketParaImprimir(null)} className="px-3 bg-gray-200 hover:bg-gray-300 rounded font-bold">X</button>
                        </div>
                    </div>
                </div>
            )}
            <div className="w-64 flex-shrink-0 flex flex-col border-r border-slate-200 dark:border-[#1f3a2a] bg-slate-50 dark:bg-background-dark h-full hidden md:flex">
                <div className="flex flex-col h-full justify-between p-4">
                    <div className="flex flex-col gap-6">
                        <div className="flex gap-3 items-center pb-4 border-b border-slate-200 dark:border-[#1f3a2a]">
                            <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-12 border-2 border-primary/20" style={{ backgroundImage: `url("${negocio.logo}")` }}></div>
                            <div className="flex flex-col"><h1 className="text-slate-900 dark:text-white text-base font-bold leading-normal">{negocio.nombre}</h1><p className="text-primary text-xs font-medium uppercase tracking-wider">TPV Local</p></div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <SidebarLink to="/" icon="map" label="Plano de Mesa" />
                            <SidebarLink to="/sales" icon="point_of_sale" label="Reporte Ventas" />
                            <SidebarLink to="/kds" icon="skillet" label="Cocina (KDS)" />
                            <SidebarLink to="/admin" icon="dashboard" label="Panel Admin" />
                            <SidebarLink to="/admin/products" icon="inventory_2" label="Inventario" />
                        </div>
                    </div>
                    <div className="mt-auto pt-4 border-t border-slate-200 dark:border-[#1f3a2a]">
                        <StatusBadge />
                        <button onClick={() => dbService.logout()} className="mt-4 flex items-center gap-2 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 text-sm font-medium pl-2 w-full text-left"><span className="material-symbols-outlined">logout</span> Cerrar Sesión</button>
                    </div>
                </div>
            </div>
            <div className="flex-1 flex flex-col bg-slate-100 dark:bg-background-dark overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-200 dark:border-[#1f3a2a] bg-white dark:bg-surface-dark flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    <div className="flex items-center gap-3"><Link to="/" className="md:hidden text-slate-500 dark:text-white"><span className="material-symbols-outlined">arrow_back</span></Link><div><h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Reporte de Ventas</h2><p className="text-slate-500 dark:text-[#92c9a4] text-sm">Consulta histórica de transacciones</p></div></div>
                    <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
                        <button onClick={resetearFechas} className="h-[46px] w-[46px] flex items-center justify-center bg-slate-100 dark:bg-[#162b1e] border border-slate-300 dark:border-[#23482f] rounded-lg text-slate-500 dark:text-[#92c9a4] hover:text-slate-900 dark:hover:text-white hover:border-primary/50 hover:bg-slate-200 dark:hover:bg-[#1f3a2a] transition-all" title="Restablecer a Hoy y Limpiar Filtros"><span className="material-symbols-outlined">restart_alt</span></button>
                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#162b1e] border border-slate-300 dark:border-[#23482f] rounded-lg p-1">
                            <div className="flex flex-col px-2"><label className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Desde</label><input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="bg-transparent text-slate-900 dark:text-white text-sm focus:outline-none p-0 border-none w-28" /></div>
                            <div className="h-6 w-px bg-slate-300 dark:bg-[#23482f]"></div>
                            <div className="flex flex-col px-2"><label className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Hasta</label><input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="bg-transparent text-slate-900 dark:text-white text-sm focus:outline-none p-0 border-none w-28" /></div>
                        </div>
                        <div className="flex flex-col gap-1 flex-1 xl:w-64"><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 dark:text-gray-500 text-sm">search</span><input type="text" placeholder="#Venta, M+Mesa, Cliente..." value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)} className="w-full bg-slate-100 dark:bg-[#162b1e] border border-slate-300 dark:border-[#23482f] text-slate-900 dark:text-white rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-primary placeholder-slate-400 dark:placeholder-white/20 h-[46px]" /></div></div>
                        <div className="bg-slate-100 dark:bg-[#102216] border border-slate-300 dark:border-[#23482f] px-6 py-2 rounded-xl text-right ml-auto h-[46px] flex flex-col justify-center"><p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold leading-none mb-0.5">Total (Rango)</p><p className="text-xl font-mono font-bold text-primary-dark dark:text-primary leading-none">${totalFiltrado.toFixed(2)}</p></div>
                    </div>
                </div>
                <div className="flex-1 flex flex-col overflow-hidden relative">
                    {ventasFiltradas.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-gray-500 opacity-50 p-8"><span className="material-symbols-outlined text-6xl mb-4">date_range</span><p className="text-xl">No hay ventas en el rango seleccionado.</p><p className="text-sm">Intenta ampliar las fechas o limpiar la búsqueda.</p></div>
                    ) : (
                        <>
                            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                                <div className="space-y-4">
                                    {ventasVisualizadas.map((v) => (
                                        <div key={v.id} className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-[#23482f] rounded-xl overflow-hidden hover:border-primary/30 transition-colors shadow-sm">
                                            <div className="bg-slate-50 dark:bg-[#102216] p-3 md:p-4 flex flex-col md:flex-row gap-3 items-start md:items-center justify-between border-b border-slate-200 dark:border-[#23482f]">
                                                {/* Left Section: Responsive Wrapping */}
                                                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                                                    <div className="bg-primary/20 text-primary-dark dark:text-primary px-3 py-1 rounded text-lg font-bold font-mono">#{v.consecutivo}</div>
                                                    {getTipoBadge(v.tipo_pedido)}
                                                    <div className="flex flex-col"><span className="text-slate-900 dark:text-white font-bold text-sm">{new Date(v.fecha).toLocaleDateString()}</span><span className="text-xs text-slate-500 dark:text-gray-400">{new Date(v.fecha).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>
                                                    <div className="hidden md:block h-8 w-px bg-slate-300 dark:bg-[#23482f] mx-2"></div>
                                                    <div className="flex flex-col"><span className="text-slate-900 dark:text-white font-medium text-sm">Mesa {v.id_mesa}</span><span className="text-xs text-slate-500 dark:text-gray-400">Atendió: {dbService.obtenerNombreUsuario(v.id_usuario)}</span></div>
                                                    <div className="hidden md:block h-8 w-px bg-slate-300 dark:bg-[#23482f] mx-2"></div>
                                                    <div className="flex flex-col w-full md:w-auto mt-2 md:mt-0"><span className="text-slate-900 dark:text-white font-medium uppercase text-sm">{v.cliente.replace(/\s*\((DOMICILIO|LLEVAR)\)$/, '')}</span><span className="text-xs text-slate-500 dark:text-gray-400">Cliente</span></div>
                                                </div>

                                                {/* Right Section: Totals & Actions */}
                                                <div className="flex items-center justify-between w-full md:w-auto gap-4 md:gap-6 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200 dark:border-[#23482f]">
                                                    <div className="text-right flex-1 md:flex-none"><div className="flex items-center gap-2 justify-end"><span className="text-xs text-slate-500 dark:text-gray-400">TOTAL:</span><span className="text-xl font-bold text-slate-900 dark:text-white">${v.total.toFixed(2)}</span></div><div className="text-xs text-slate-500 dark:text-gray-500">Efec: ${(v.monto_recibido || v.total).toFixed(2)} | Cambio: ${(v.monto_cambio || 0).toFixed(2)}</div></div>
                                                    <button onClick={() => prepararReimpresion(v)} className="bg-slate-200 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 text-slate-700 dark:text-white p-2 rounded-lg transition-colors border border-slate-300 dark:border-white/10" title="Reimprimir Ticket"><span className="material-symbols-outlined">print</span></button>
                                                </div>
                                            </div>
                                            <div className="p-4 bg-white dark:bg-[#162b1e]/50 overflow-x-auto">
                                                <table className="w-full text-left text-sm min-w-[500px]">
                                                    <thead><tr className="text-xs text-slate-500 dark:text-[#92c9a4] border-b border-slate-200 dark:border-[#23482f]"><th className="pb-2 font-medium">Cód</th><th className="pb-2 font-medium">Producto</th><th className="pb-2 font-medium">Notas</th><th className="pb-2 font-medium text-center">Cant</th><th className="pb-2 font-medium text-right">Subtotal</th></tr></thead>
                                                    <tbody className="text-slate-700 dark:text-gray-300">{v.detalles.map((d, idx) => (<tr key={idx} className="border-b border-slate-100 dark:border-[#23482f]/50 last:border-0"><td className="py-2 font-mono text-xs opacity-70">{d.codigo_producto}</td><td className="py-2 font-medium">{d.nombre_producto}</td><td className="py-2 italic text-xs text-slate-500 dark:text-gray-500">{d.notas || '-'}</td><td className="py-2 text-center">{d.cantidad}</td><td className="py-2 text-right text-slate-900 dark:text-white">${d.subtotal.toFixed(2)}</td></tr>))}</tbody>
                                                </table>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="p-4 border-t border-slate-200 dark:border-[#1f3a2a] bg-white dark:bg-surface-dark z-10 shrink-0 shadow-[0_-5px_20px_rgba(0,0,0,0.2)]">
                                <div className="p-3 bg-slate-100 dark:bg-[#102216] border border-slate-300 dark:border-[#23482f] rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
                                    <div className="flex items-center gap-2 text-slate-600 dark:text-[#92c9a4]">
                                        <span>Mostrar</span>
                                        <select value={itemsPorPagina} onChange={(e) => { setItemsPorPagina(Number(e.target.value)); setPaginaActual(1); }} className="bg-white dark:bg-[#162b1e] border border-slate-300 dark:border-[#23482f] text-slate-900 dark:text-white rounded px-2 py-1 focus:outline-none focus:border-primary cursor-pointer">
                                            <option value={5}>5</option><option value={10}>10</option><option value={15}>15</option><option value={20}>20</option>
                                        </select>
                                        <span>por página</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="text-slate-600 dark:text-[#92c9a4]">{indicePrimerItem + 1}-{Math.min(indiceUltimoItem, ventasFiltradas.length)} de {ventasFiltradas.length}</span>
                                        <div className="flex gap-1">
                                            <button onClick={() => cambiarPagina(paginaActual - 1)} disabled={paginaActual === 1} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-white disabled:opacity-30 disabled:hover:bg-transparent"><span className="material-symbols-outlined">chevron_left</span></button>
                                            <button onClick={() => cambiarPagina(paginaActual + 1)} disabled={paginaActual === totalPaginas || totalPaginas === 0} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-white disabled:opacity-30 disabled:hover:bg-transparent"><span className="material-symbols-outlined">chevron_right</span></button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};