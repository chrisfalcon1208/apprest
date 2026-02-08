import React, { useState, useEffect } from 'react';
import { SidebarLink, Button, ConfirmModal, Input, ThemeToggle } from '../components/Components';
import { reportService } from '../services/reportService';
import { dbService } from '../services/dbService';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js/auto';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Layout modificado para soportar variantes de menú lateral y actualización reactiva
export const AdminLayout = ({
    children,
    title,
    variant = 'admin'
}: {
    children?: React.ReactNode;
    title: string;
    variant?: 'admin' | 'inventory';
}) => {
    // Usar estado para permitir actualizaciones dinámicas sin recargar
    const [negocio, setNegocio] = useState(dbService.obtenerInfoNegocio());
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        // Escuchar evento personalizado para actualizar info
        const handleUpdate = () => {
            setNegocio({ ...dbService.obtenerInfoNegocio() });
        };
        window.addEventListener('apprest-config-updated', handleUpdate);
        return () => window.removeEventListener('apprest-config-updated', handleUpdate);
    }, []);

    return (
        <div className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-background-dark text-slate-900 dark:text-white relative">

            {/* Overlay para móvil */}
            {mobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 md:hidden backdrop-blur-sm"
                    onClick={() => setMobileMenuOpen(false)}
                ></div>
            )}

            {/* Sidebar (Responsive) */}
            <aside className={`fixed md:static inset-y-0 left-0 z-30 w-64 bg-slate-100 dark:bg-surface-dark border-r border-slate-200 dark:border-[#23482f] h-full flex-shrink-0 transition-transform duration-300 transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
                <div className="flex flex-col h-full p-4">
                    <div className="flex items-center gap-3 px-2 py-4 mb-6 relative">
                        <div className="bg-center bg-no-repeat bg-cover rounded-full size-10 border-2 border-primary transition-all duration-300" style={{ backgroundImage: `url("${negocio.logo}")` }}></div>
                        <div className="flex flex-col">
                            <h1 className="text-slate-900 dark:text-white text-lg font-bold leading-tight transition-all duration-300">{negocio.nombre}</h1>
                            <p className="text-primary-dark dark:text-[#92c9a4] text-xs font-mono">
                                {variant === 'admin' ? 'Administración' : 'Inventario'}
                            </p>
                        </div>
                        {/* Cerrar menú en móvil */}
                        <button
                            onClick={() => setMobileMenuOpen(false)}
                            className="absolute top-2 right-0 md:hidden text-slate-500 dark:text-white"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    <nav className="flex flex-col gap-2 flex-1 overflow-y-auto">
                        <SidebarLink to="/" icon="storefront" label="Volver al TPV" />

                        {/* Menú para Panel Admin */}
                        {variant === 'admin' && (
                            <>
                                <SidebarLink to="/admin" icon="dashboard" label="Panel General" />
                                <SidebarLink to="/admin/reports" icon="bar_chart" label="Análisis Ventas" />
                                <SidebarLink to="/admin/config" icon="settings" label="Negocio" />
                                <SidebarLink to="/admin/profile" icon="person" label="Mi Perfil" />
                            </>
                        )}

                        {/* Menú Independiente para Inventario - ORDEN CAMBIADO */}
                        {variant === 'inventory' && (
                            <>
                                <SidebarLink to="/admin/categories" icon="category" label="Categorías" />
                                <SidebarLink to="/admin/products" icon="inventory_2" label="Productos" />
                            </>
                        )}
                    </nav>
                </div>
            </aside>

            <main className="flex-1 flex flex-col h-full min-w-0 bg-slate-50 dark:bg-background-dark overflow-hidden">
                <header className="flex items-center justify-between h-16 px-4 md:px-6 border-b border-slate-200 dark:border-[#23482f] bg-white dark:bg-surface-dark shrink-0 z-10">
                    <div className="flex items-center gap-3">
                        <button
                            className="md:hidden p-2 -ml-2 text-slate-600 dark:text-white"
                            onClick={() => setMobileMenuOpen(true)}
                        >
                            <span className="material-symbols-outlined">menu</span>
                        </button>
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">
                                {variant === 'admin' ? 'admin_panel_settings' : 'inventory'}
                            </span>
                            <h2 className="text-slate-900 dark:text-white text-lg font-bold truncate max-w-[200px] sm:max-w-none">{title}</h2>
                        </div>
                    </div>
                    {/* Añadir Toggle a Admin también para consistencia */}
                    <ThemeToggle />
                </header>
                <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth">
                    {children}
                </div>
            </main>
        </div>
    );
};

export const ScreenAdminDashboard = () => {
    // Datos Reportes
    const ventasHoy = reportService.obtenerVentasHoy();
    const resumenMesas = reportService.obtenerResumenMesas();
    const totalProductos = reportService.obtenerTotalProductos();
    const ventaHistorica = reportService.obtenerVentaHistorica();

    // Obtener todos los items para paginarlos en el cliente
    const allTopInsumos = reportService.obtenerTopInsumos();

    // Estado de Paginación
    const [paginaActual, setPaginaActual] = useState(1);
    const [itemsPorPagina, setItemsPorPagina] = useState(5);

    // Lógica de Paginación
    const indiceUltimoItem = paginaActual * itemsPorPagina;
    const indicePrimerItem = indiceUltimoItem - itemsPorPagina;
    const topInsumosPaginados = allTopInsumos.slice(indicePrimerItem, indiceUltimoItem);
    const totalPaginas = Math.ceil(allTopInsumos.length / itemsPorPagina);

    const cambiarPagina = (numero: number) => setPaginaActual(numero);

    return (
        <AdminLayout title="Panel de Control" variant="admin">
            {/* Reportes de Inicio (KPIs) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">

                {/* 1. Ventas Hoy */}
                <div className="flex flex-col gap-1 rounded-xl p-5 bg-white dark:bg-surface-dark border border-slate-200 dark:border-[#23482f] shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="material-symbols-outlined text-4xl text-primary">receipt_long</span>
                    </div>
                    <p className="text-slate-500 dark:text-gray-400 text-sm font-medium">Ventas Hoy</p>
                    <p className="text-slate-900 dark:text-white text-2xl xl:text-3xl font-bold tracking-tight font-mono">${ventasHoy.total.toFixed(2)}</p>
                    <div className="flex items-center gap-1 mt-auto pt-2">
                        <span className="material-symbols-outlined text-primary-dark dark:text-primary text-xs">check_circle</span>
                        <p className="text-primary-dark dark:text-primary text-xs font-medium">{ventasHoy.conteo} transacciones</p>
                    </div>
                </div>

                {/* 2. Estado de Mesas */}
                <div className="flex flex-col gap-1 rounded-xl p-5 bg-white dark:bg-surface-dark border border-slate-200 dark:border-[#23482f] shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="material-symbols-outlined text-4xl text-orange-400">table_restaurant</span>
                    </div>
                    <p className="text-slate-500 dark:text-gray-400 text-sm font-medium">Ocupación Actual</p>
                    <div className="flex items-baseline gap-2">
                        <p className="text-slate-900 dark:text-white text-2xl xl:text-3xl font-bold tracking-tight font-mono">{resumenMesas.ocupadas}</p>
                        <p className="text-slate-400 dark:text-gray-500 text-sm font-medium">/ {resumenMesas.total} Mesas</p>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-[#102216] h-1.5 rounded-full mt-auto mb-1 overflow-hidden">
                        <div className="bg-orange-400 h-full rounded-full transition-all duration-1000" style={{ width: `${resumenMesas.porcentajeOcupacion}%` }}></div>
                    </div>
                    <p className="text-xs text-orange-500 dark:text-orange-400 font-medium mt-1">{resumenMesas.libres} Disponibles</p>
                </div>

                {/* 3. Total Productos */}
                <div className="flex flex-col gap-1 rounded-xl p-5 bg-white dark:bg-surface-dark border border-slate-200 dark:border-[#23482f] shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="material-symbols-outlined text-4xl text-blue-400">inventory_2</span>
                    </div>
                    <p className="text-slate-500 dark:text-gray-400 text-sm font-medium">Productos Activos</p>
                    <p className="text-slate-900 dark:text-white text-2xl xl:text-3xl font-bold tracking-tight font-mono">{totalProductos}</p>
                    <div className="flex items-center gap-1 mt-auto pt-2">
                        <span className="material-symbols-outlined text-blue-500 dark:text-blue-400 text-xs">category</span>
                        <p className="text-blue-500 dark:text-blue-400 text-xs font-medium">Catálogo registrado</p>
                    </div>
                </div>

                {/* 4. Venta Histórica */}
                <div className="flex flex-col gap-1 rounded-xl p-5 bg-white dark:bg-surface-dark border border-slate-200 dark:border-[#23482f] shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <span className="material-symbols-outlined text-4xl text-yellow-500">savings</span>
                    </div>
                    <p className="text-slate-500 dark:text-gray-400 text-sm font-medium">Venta Histórica</p>
                    <p className="text-slate-900 dark:text-white text-2xl xl:text-3xl font-bold tracking-tight font-mono text-ellipsis overflow-hidden whitespace-nowrap" title={`$${ventaHistorica.toFixed(2)}`}>
                        ${ventaHistorica.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <div className="flex items-center gap-1 mt-auto pt-2">
                        <span className="material-symbols-outlined text-yellow-600 dark:text-yellow-500 text-xs">monitoring</span>
                        <p className="text-yellow-600 dark:text-yellow-500 text-xs font-medium">Total acumulado</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Top Insumos con Paginación */}
                <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-[#23482f] overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-200 dark:border-[#23482f]"><h3 className="text-slate-900 dark:text-white text-lg font-bold">Top Productos (Ingresos)</h3></div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left text-sm text-slate-500 dark:text-gray-400 min-w-[500px]">
                            <thead className="bg-slate-100 dark:bg-[#102216] text-slate-700 dark:text-gray-200 uppercase font-bold text-xs">
                                <tr>
                                    <th className="px-6 py-3">Producto</th>
                                    <th className="px-6 py-3">Tipo</th>
                                    <th className="px-6 py-3 text-right">Cant. Vendida</th>
                                    <th className="px-6 py-3 text-right">Total ($)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-[#23482f]">
                                {topInsumosPaginados.length === 0 ? (
                                    <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-400 dark:text-gray-500 italic">No hay ventas registradas aún.</td></tr>
                                ) : (
                                    topInsumosPaginados.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">{item.nombre}</td>
                                            <td className="px-6 py-4">{item.tipo}</td>
                                            <td className="px-6 py-4 text-right font-mono text-slate-700 dark:text-white">{item.cantidad}</td>
                                            <td className="px-6 py-4 text-right font-mono text-primary-dark dark:text-primary font-bold">${item.total.toFixed(2)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Footer Paginación */}
                    <div className="p-3 bg-slate-100 dark:bg-[#102216] border-t border-slate-200 dark:border-[#23482f] flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
                        <div className="flex items-center gap-2 text-slate-600 dark:text-[#92c9a4]">
                            <span>Mostrar</span>
                            <select
                                value={itemsPorPagina}
                                onChange={(e) => { setItemsPorPagina(Number(e.target.value)); setPaginaActual(1); }}
                                className="bg-white dark:bg-[#162b1e] border border-slate-300 dark:border-[#23482f] text-slate-900 dark:text-white rounded px-2 py-1 focus:outline-none focus:border-primary cursor-pointer"
                            >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={15}>15</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-4">
                            <span className="text-slate-600 dark:text-[#92c9a4]">
                                {allTopInsumos.length > 0 ? indicePrimerItem + 1 : 0}-{Math.min(indiceUltimoItem, allTopInsumos.length)} de {allTopInsumos.length}
                            </span>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => cambiarPagina(paginaActual - 1)}
                                    disabled={paginaActual === 1}
                                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                                >
                                    <span className="material-symbols-outlined">chevron_left</span>
                                </button>
                                <button
                                    onClick={() => cambiarPagina(paginaActual + 1)}
                                    disabled={paginaActual === totalPaginas || totalPaginas === 0}
                                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                                >
                                    <span className="material-symbols-outlined">chevron_right</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </AdminLayout>
    );
};

export const ScreenReports = () => {
    // Helper para fechas string YYYY-MM-DD local
    const getTodayStr = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    };

    // Estado Filtros
    const [filterStartDate, setFilterStartDate] = useState(getTodayStr());
    const [filterEndDate, setFilterEndDate] = useState(getTodayStr());
    const [filterYear, setFilterYear] = useState(new Date().getFullYear());

    // Estados Datos
    const [salesByHour, setSalesByHour] = useState<Record<number, number>>({});
    const [salesByDay, setSalesByDay] = useState<Record<number, number>>({});
    const [salesByMonth, setSalesByMonth] = useState<Record<number, number>>({});

    // Arrays para etiquetas
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    // Efecto 1: Cargar datos de rango corto (Horario/Semanal)
    useEffect(() => {
        // Convertir strings a Date, asegurando inicio del día para Start y fin implícito en el servicio
        const start = new Date(filterStartDate + 'T00:00:00');
        const end = new Date(filterEndDate + 'T00:00:00');

        const hourly = reportService.obtenerVentasPorHora(start, end);
        setSalesByHour(hourly);

        const daily = reportService.obtenerVentasPorSemana(start, end);
        setSalesByDay(daily);
    }, [filterStartDate, filterEndDate]);

    // Efecto 2: Cargar datos anuales
    useEffect(() => {
        const monthly = reportService.obtenerVentasMensualesPorAno(filterYear);
        setSalesByMonth(monthly);
    }, [filterYear]);

    // Resetear fechas cortas
    const handleResetDates = () => {
        const today = getTodayStr();
        setFilterStartDate(today);
        setFilterEndDate(today);
    };

    // --- CÁLCULO DE ESTADÍSTICAS ---

    // 1. Hora
    const hourlyValues = Object.values(salesByHour) as number[];
    const hourlyTotal = hourlyValues.reduce((a, b) => a + b, 0);
    const peakHourIndex = Object.keys(salesByHour).reduce((a, b) => salesByHour[Number(a)] > salesByHour[Number(b)] ? a : b, "0");
    const peakHourVal = salesByHour[Number(peakHourIndex)] || 0;
    const peakHourDisplay = peakHourVal > 0 ? `${peakHourIndex}:00` : "N/A";

    // 2. Semana
    const weeklyValues = Object.values(salesByDay) as number[];
    const weeklyTotal = weeklyValues.reduce((a, b) => a + b, 0);
    const bestDayIndex = Object.keys(salesByDay).reduce((a, b) => salesByDay[Number(a)] > salesByDay[Number(b)] ? a : b, "0");
    const bestDayVal = salesByDay[Number(bestDayIndex)] || 0;
    const bestDayDisplay = bestDayVal > 0 ? days[Number(bestDayIndex)] : "N/A";

    // 3. Mes
    const monthlyValues = Object.values(salesByMonth) as number[];
    const monthlyTotal = monthlyValues.reduce((a, b) => a + b, 0);
    const bestMonthIndex = Object.keys(salesByMonth).reduce((a, b) => salesByMonth[Number(a)] > salesByMonth[Number(b)] ? a : b, "0");
    const bestMonthVal = salesByMonth[Number(bestMonthIndex)] || 0;
    const bestMonthDisplay = bestMonthVal > 0 ? months[Number(bestMonthIndex)] : "N/A";


    // Configuración común de gráficos
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top' as const,
                labels: { color: '#92c9a4', font: { family: 'monospace' } }
            },
            title: { display: false },
        },
        scales: {
            x: {
                ticks: { color: '#92c9a4', font: { family: 'monospace' } },
                grid: { color: '#23482f' }
            },
            y: {
                ticks: { color: '#92c9a4', font: { family: 'monospace' } },
                grid: { color: '#23482f' }
            }
        }
    };

    // Datos por Hora
    const hourlyData = {
        labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
        datasets: [{
            label: 'Ventas por Hora ($)',
            data: Array.from({ length: 24 }, (_, i) => salesByHour[i] || 0),
            backgroundColor: 'rgba(19, 236, 91, 0.5)',
            borderColor: '#13ec5b',
            borderWidth: 1,
        }]
    };

    // Datos por Día
    const weeklyData = {
        labels: days,
        datasets: [{
            label: 'Ventas por Día ($)',
            data: Array.from({ length: 7 }, (_, i) => salesByDay[i] || 0),
            backgroundColor: 'rgba(59, 130, 246, 0.5)',
            borderColor: '#3b82f6',
            borderWidth: 1,
        }]
    };

    // Datos por Mes
    const monthlyData = {
        labels: months,
        datasets: [{
            label: `Ventas ${filterYear} ($)`,
            data: Array.from({ length: 12 }, (_, i) => salesByMonth[i] || 0),
            backgroundColor: 'rgba(234, 179, 8, 0.5)',
            borderColor: '#eab308',
            borderWidth: 1,
        }]
    };

    return (
        <AdminLayout title="Análisis y Reportes" variant="admin">
            {/* Barra de Filtros para Gráficas de Corto Plazo */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-white dark:bg-surface-dark border border-slate-200 dark:border-[#23482f] p-4 rounded-xl mb-6 gap-4">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">filter_alt</span>
                    <span className="text-slate-900 dark:text-white font-bold text-sm">Filtro Período (Horario/Semanal)</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#162b1e] border border-slate-300 dark:border-[#23482f] rounded-lg p-1 w-full md:w-auto">
                        <div className="flex flex-col px-2 flex-1">
                            <label className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Desde</label>
                            <input
                                type="date"
                                value={filterStartDate}
                                onChange={(e) => setFilterStartDate(e.target.value)}
                                className="bg-transparent text-slate-900 dark:text-white text-sm focus:outline-none p-0 border-none w-full"
                            />
                        </div>
                        <div className="h-6 w-px bg-slate-300 dark:bg-[#23482f]"></div>
                        <div className="flex flex-col px-2 flex-1">
                            <label className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-wider">Hasta</label>
                            <input
                                type="date"
                                value={filterEndDate}
                                onChange={(e) => setFilterEndDate(e.target.value)}
                                className="bg-transparent text-slate-900 dark:text-white text-sm focus:outline-none p-0 border-none w-full"
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleResetDates}
                        className="h-[46px] w-[46px] flex items-center justify-center bg-slate-100 dark:bg-[#162b1e] border border-slate-300 dark:border-[#23482f] rounded-lg text-slate-500 dark:text-[#92c9a4] hover:text-slate-900 dark:hover:text-white hover:border-primary/50 hover:bg-slate-200 dark:hover:bg-[#1f3a2a] transition-all ml-auto md:ml-0"
                        title="Reiniciar a Hoy"
                    >
                        <span className="material-symbols-outlined">restart_alt</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Hourly Sales */}
                <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-[#23482f] rounded-xl p-6 h-80 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-slate-900 dark:text-white font-bold flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">schedule</span>
                            Distribución Horaria
                        </h3>
                        <div className="flex flex-col items-end gap-1">
                            <div className="flex items-baseline gap-2 text-xs">
                                <span className="text-gray-400">Total:</span>
                                <span className="text-slate-900 dark:text-white font-mono font-bold">${hourlyTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex items-baseline gap-2 text-xs">
                                <span className="text-gray-400">Hora Pico:</span>
                                <span className="text-primary-dark dark:text-primary font-mono font-bold">{peakHourDisplay}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0">
                        <Bar options={chartOptions} data={hourlyData} />
                    </div>
                </div>

                {/* Weekly Sales */}
                <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-[#23482f] rounded-xl p-6 h-80 flex flex-col">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-slate-900 dark:text-white font-bold flex items-center gap-2">
                            <span className="material-symbols-outlined text-blue-500 dark:text-blue-400">calendar_month</span>
                            Tendencia Semanal
                        </h3>
                        <div className="flex flex-col items-end gap-1">
                            <div className="flex items-baseline gap-2 text-xs">
                                <span className="text-gray-400">Total Venta:</span>
                                <span className="text-slate-900 dark:text-white font-mono font-bold">${weeklyTotal.toFixed(2)}</span>
                            </div>
                            <div className="flex items-baseline gap-2 text-xs">
                                <span className="text-gray-400">Mejor Día:</span>
                                <span className="text-blue-500 dark:text-blue-400 font-mono font-bold uppercase">{bestDayDisplay}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0">
                        <Bar options={chartOptions} data={weeklyData} />
                    </div>
                </div>

                {/* Monthly Sales (Con Filtro Exclusivo de Año) */}
                <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-[#23482f] rounded-xl p-6 lg:col-span-2 h-96 flex flex-col">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
                        <h3 className="text-slate-900 dark:text-white font-bold flex items-center gap-2">
                            <span className="material-symbols-outlined text-yellow-500">bar_chart</span>
                            Desempeño Mensual
                        </h3>

                        <div className="flex flex-wrap items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                            {/* Stats Anuales */}
                            <div className="flex items-center gap-4 border-r border-slate-200 dark:border-[#23482f] pr-6">
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold">Total Año</span>
                                    <span className="text-slate-900 dark:text-white font-mono font-bold">${monthlyTotal.toFixed(2)}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-bold">Mejor Mes</span>
                                    <span className="text-yellow-600 dark:text-yellow-500 font-mono font-bold uppercase">{bestMonthDisplay}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#162b1e] border border-slate-300 dark:border-[#23482f] rounded-lg px-2 py-1 relative">
                                <label className="text-xs text-gray-500 dark:text-gray-400 font-bold">Año:</label>
                                <select
                                    value={filterYear}
                                    onChange={(e) => setFilterYear(Number(e.target.value))}
                                    className="bg-transparent text-slate-900 dark:text-white text-sm font-mono focus:outline-none border-none p-0 pr-5 cursor-pointer appearance-none"
                                >
                                    {/* Generar rango de años: actual - 4 hasta actual + 1 */}
                                    {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 4 + i).map(year => (
                                        <option key={year} value={year} className="bg-white dark:bg-[#162b1e] text-slate-900 dark:text-white">{year}</option>
                                    ))}
                                </select>
                                <span className="material-symbols-outlined text-[18px] text-slate-400 dark:text-gray-400 absolute right-0 pointer-events-none">arrow_drop_down</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0">
                        <Bar options={chartOptions} data={monthlyData} />
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

export const ScreenConfig = () => {
    const [negocio, setNegocio] = useState(dbService.obtenerInfoNegocio());
    const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [subiendoLogo, setSubiendoLogo] = useState(false);

    const handleSave = async () => {
        if (!negocio.nombre || !negocio.telefono || negocio.numeroMesas < 1) {
            setNotification({ type: 'error', message: 'Por favor complete todos los campos obligatorios.' });
            return;
        }

        try {
            await dbService.actualizarInfoNegocio(negocio);
            setNotification({ type: 'success', message: 'Configuración actualizada correctamente.' });
            setTimeout(() => setNotification(null), 3000);
        } catch (error) {
            setNotification({ type: 'error', message: 'Hubo un error al guardar los cambios.' });
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSubiendoLogo(true);
            try {
                const url = await dbService.uploadImage(file);
                setNegocio({ ...negocio, logo: url });
            } catch (error) {
                setNotification({ type: 'error', message: 'Error al subir el logo.' });
            }
            setSubiendoLogo(false);
        }
    };

    return (
        <AdminLayout title="Configuración del Negocio" variant="admin">
            <div className="max-w-3xl mx-auto space-y-6">

                {/* Notificación */}
                {notification && (
                    <div className={`p-4 rounded-lg border flex items-center gap-3 animate-in slide-in-from-top-2 fade-in ${notification.type === 'success' ? 'bg-green-500/10 border-green-500/50 text-green-600 dark:text-green-400' : 'bg-red-500/10 border-red-500/50 text-red-600 dark:text-red-400'}`}>
                        <span className="material-symbols-outlined">{notification.type === 'success' ? 'check_circle' : 'error'}</span>
                        <p className="text-sm font-bold">{notification.message}</p>
                    </div>
                )}

                {/* Información General */}
                <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-[#23482f] rounded-xl p-8">
                    <div className="flex items-center gap-3 mb-6 border-b border-slate-200 dark:border-[#23482f] pb-4">
                        <span className="material-symbols-outlined text-primary">store</span>
                        <h3 className="text-slate-900 dark:text-white font-bold text-lg">Información General</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input
                            label="Nombre del Restaurante"
                            value={negocio.nombre}
                            onChange={(e: any) => setNegocio({ ...negocio, nombre: e.target.value })}
                            required
                        />
                        <Input
                            label="Teléfono de Contacto"
                            value={negocio.telefono}
                            onChange={(e: any) => setNegocio({ ...negocio, telefono: e.target.value })}
                            required
                        />
                        <Input
                            label="Número de Mesas"
                            type="number"
                            value={negocio.numeroMesas}
                            onChange={(e: any) => setNegocio({ ...negocio, numeroMesas: parseInt(e.target.value) || 0 })}
                            required
                        />
                    </div>
                </div>

                {/* Marca y Logo */}
                <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-[#23482f] rounded-xl p-8">
                    <div className="flex items-center gap-3 mb-6 border-b border-slate-200 dark:border-[#23482f] pb-4">
                        <span className="material-symbols-outlined text-yellow-500">branding_watermark</span>
                        <h3 className="text-slate-900 dark:text-white font-bold text-lg">Identidad Visual</h3>
                    </div>

                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        {/* Preview Logo */}
                        <div className="flex-shrink-0">
                            <p className="text-xs text-slate-500 dark:text-[#92c9a4] uppercase font-bold mb-2">Vista Previa</p>
                            <div className="w-32 h-32 rounded-full border-4 border-slate-200 dark:border-[#23482f] overflow-hidden bg-slate-100 dark:bg-black/20 flex items-center justify-center">
                                {negocio.logo ? (
                                    <img src={negocio.logo} alt="Logo" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="material-symbols-outlined text-4xl text-gray-400 dark:text-gray-600">image_not_supported</span>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 w-full space-y-4">
                            <Input
                                label="URL del Logo (Opcional)"
                                value={negocio.logo}
                                onChange={(e: any) => setNegocio({ ...negocio, logo: e.target.value })}
                                placeholder="https://ejemplo.com/logo.png"
                                readOnly={true} // Ahora forzamos subida o uso de URL externa
                            />

                            <div className="relative group">
                                <label className="text-xs text-slate-500 dark:text-[#92c9a4] uppercase font-bold mb-2 block">O subir archivo local</label>
                                <div className={`flex items-center justify-center w-full px-4 py-3 border border-dashed border-slate-300 dark:border-[#23482f] rounded-lg cursor-pointer bg-slate-50 dark:bg-[#162b1e] transition-colors ${subiendoLogo ? 'opacity-50' : 'hover:border-primary/50'}`}>
                                    {subiendoLogo ? (
                                        <span className="text-sm text-slate-600 dark:text-white">Subiendo...</span>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-slate-400 dark:text-[#92c9a4] mr-2">cloud_upload</span>
                                            <span className="text-sm text-slate-500 dark:text-[#92c9a4] group-hover:text-slate-900 dark:group-hover:text-white">Seleccionar imagen (JPG/PNG)</span>
                                        </>
                                    )}
                                </div>
                                <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 opacity-0 cursor-pointer mt-6" disabled={subiendoLogo} />
                            </div>
                            <p className="text-xs text-gray-500 italic">Recomendado: Imagen cuadrada, fondo transparente (PNG).</p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <Button onClick={handleSave} className="w-full md:w-auto min-w-[200px]">
                        <span className="material-symbols-outlined">save</span> Guardar Cambios
                    </Button>
                </div>
            </div>
        </AdminLayout>
    );
};

export const ScreenUserConfig = () => {
    // Cargar usuario actual (mock: siempre el primero de la lista)
    const [user, setUser] = useState(dbService.obtenerUsuarioActual());

    // Estado para datos personales
    const [nombre, setNombre] = useState(user.nombre);
    const [email, setEmail] = useState(user.email);

    // Estado para contraseñas
    const [passActual, setPassActual] = useState('');
    const [passNueva, setPassNueva] = useState('');
    const [passConfirm, setPassConfirm] = useState('');
    const [showPassActual, setShowPassActual] = useState(false);
    const [showPassNueva, setShowPassNueva] = useState(false);
    const [showPassConfirm, setShowPassConfirm] = useState(false);

    const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const showNotify = (type: 'success' | 'error', message: string) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 3000);
    };

    const handleUpdateProfile = async () => {
        if (!nombre.trim() || !email.trim()) {
            showNotify('error', 'Nombre y Email son obligatorios');
            return;
        }
        try {
            const updatedUser = await dbService.actualizarPerfilUsuario(user.id, nombre, email);
            setUser(updatedUser);
            showNotify('success', 'Datos actualizados correctamente');
        } catch (e: any) {
            showNotify('error', e.message || 'Error al actualizar perfil');
        }
    };

    const handleChangePassword = async () => {
        if (!passActual) {
            showNotify('error', 'Debes ingresar tu contraseña actual');
            return;
        }
        if (passNueva.length < 6) {
            showNotify('error', 'La nueva contraseña debe tener al menos 6 caracteres');
            return;
        }
        if (passNueva !== passConfirm) {
            showNotify('error', 'Las nuevas contraseñas no coinciden');
            return;
        }

        try {
            await dbService.cambiarPasswordUsuario(user.id, passActual, passNueva);
            showNotify('success', 'Contraseña cambiada exitosamente');
            // Limpiar campos
            setPassActual('');
            setPassNueva('');
            setPassConfirm('');
        } catch (e: any) {
            showNotify('error', e.message || 'Error al cambiar contraseña');
        }
    };

    return (
        <AdminLayout title="Configuración de Usuario" variant="admin">
            <div className="max-w-3xl mx-auto space-y-6">

                {/* Notificación */}
                {notification && (
                    <div className={`p-4 rounded-lg border flex items-center gap-3 animate-in slide-in-from-top-2 fade-in ${notification.type === 'success' ? 'bg-green-500/10 border-green-500/50 text-green-600 dark:text-green-400' : 'bg-red-500/10 border-red-500/50 text-red-600 dark:text-red-400'}`}>
                        <span className="material-symbols-outlined">{notification.type === 'success' ? 'check_circle' : 'error'}</span>
                        <p className="text-sm font-bold">{notification.message}</p>
                    </div>
                )}

                {/* Tarjeta Datos Personales */}
                <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-[#23482f] rounded-xl p-8">
                    <div className="flex items-center gap-3 mb-6 border-b border-slate-200 dark:border-[#23482f] pb-4">
                        <span className="material-symbols-outlined text-blue-400">person</span>
                        <h3 className="text-slate-900 dark:text-white font-bold text-lg">Datos Personales</h3>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        <Input
                            label="Nombre Completo"
                            value={nombre}
                            onChange={(e: any) => setNombre(e.target.value)}
                            required
                        />
                        <Input
                            label="Correo Electrónico"
                            type="email"
                            value={email}
                            onChange={(e: any) => setEmail(e.target.value)}
                            required
                        />
                        <div className="flex justify-end pt-2">
                            <Button onClick={handleUpdateProfile} className="min-w-[150px]">
                                Guardar Datos
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Tarjeta Seguridad */}
                <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-[#23482f] rounded-xl p-8">
                    <div className="flex items-center gap-3 mb-6 border-b border-slate-200 dark:border-[#23482f] pb-4">
                        <span className="material-symbols-outlined text-yellow-500">lock</span>
                        <h3 className="text-slate-900 dark:text-white font-bold text-lg">Seguridad</h3>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-slate-100 dark:bg-[#102216] border border-slate-200 dark:border-[#23482f] p-4 rounded-lg mb-4">
                            <p className="text-xs text-slate-500 dark:text-[#92c9a4] mb-1 font-bold uppercase">Cambiar Contraseña</p>
                            <p className="text-xs text-slate-600 dark:text-gray-500">Para mayor seguridad, te pediremos tu contraseña actual antes de registrar una nueva.</p>
                        </div>

                        <Input
                            label="Contraseña Actual"
                            type={showPassActual ? "text" : "password"}
                            value={passActual}
                            onChange={(e: any) => setPassActual(e.target.value)}
                            placeholder="Ingrese su contraseña actual"
                            rightElement={
                                <button type="button" onClick={() => setShowPassActual(!showPassActual)} className="hover:text-primary transition-colors focus:outline-none">
                                    <span className="material-symbols-outlined text-[18px] text-slate-500 dark:text-gray-400">{showPassActual ? 'visibility_off' : 'visibility'}</span>
                                </button>
                            }
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                                label="Nueva Contraseña"
                                type={showPassNueva ? "text" : "password"}
                                value={passNueva}
                                onChange={(e: any) => setPassNueva(e.target.value)}
                                placeholder="Mínimo 6 caracteres"
                                rightElement={
                                    <button type="button" onClick={() => setShowPassNueva(!showPassNueva)} className="hover:text-primary transition-colors focus:outline-none">
                                        <span className="material-symbols-outlined text-[18px] text-slate-500 dark:text-gray-400">{showPassNueva ? 'visibility_off' : 'visibility'}</span>
                                    </button>
                                }
                            />
                            <div className="relative">
                                <Input
                                    label="Confirmar Nueva Contraseña"
                                    type={showPassConfirm ? "text" : "password"}
                                    value={passConfirm}
                                    onChange={(e: any) => setPassConfirm(e.target.value)}
                                    placeholder="Repita la nueva contraseña"
                                    rightElement={
                                        <button type="button" onClick={() => setShowPassConfirm(!showPassConfirm)} className="hover:text-primary transition-colors focus:outline-none">
                                            <span className="material-symbols-outlined text-[18px] text-slate-500 dark:text-gray-400">{showPassConfirm ? 'visibility_off' : 'visibility'}</span>
                                        </button>
                                    }
                                />
                                {passNueva && passConfirm && (
                                    <div className="absolute right-0 top-0 mt-1 mr-1">
                                        {passNueva === passConfirm ? (
                                            <span className="text-[10px] text-green-500 flex items-center gap-1 font-bold bg-green-500/10 px-2 py-0.5 rounded"><span className="material-symbols-outlined text-[10px]">check</span> Coinciden</span>
                                        ) : (
                                            <span className="text-[10px] text-red-500 flex items-center gap-1 font-bold bg-red-500/10 px-2 py-0.5 rounded"><span className="material-symbols-outlined text-[10px]">close</span> No coinciden</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button
                                onClick={handleChangePassword}
                                variant="secondary"
                                className="min-w-[150px] hover:bg-yellow-100 hover:text-yellow-600 dark:hover:bg-yellow-600/20 dark:hover:text-yellow-500 border-transparent hover:border-yellow-500/50"
                                disabled={!passActual || !passNueva || passNueva !== passConfirm}
                            >
                                Actualizar Contraseña
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
};

export const ScreenInventory = () => <AdminLayout title="Inventario" variant="inventory"><div>Usar menú Productos</div></AdminLayout>;
export const ScreenUsers = () => <AdminLayout title="Usuarios" variant="admin"><div>Funcionalidad migrada a dbService</div></AdminLayout>;
export const ScreenDayClose = () => <AdminLayout title="Cierre" variant="admin"><div>Usar botón de cerrar cuenta en TPV</div></AdminLayout>;