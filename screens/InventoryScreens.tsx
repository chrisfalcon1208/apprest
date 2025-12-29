import React, { useState, useEffect } from 'react';
import { dbService } from '../services/dbService';
import { Insumo, Categoria } from '../types';
import { Button, Input, ConfirmModal } from '../components/Components';
import { AdminLayout } from './AdminScreens';
import { Link } from 'react-router-dom';

export const ScreenProductManager = () => {
    const [insumos, setInsumos] = useState<Insumo[]>([]);
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [modoEdicion, setModoEdicion] = useState(false);
    const [cargando, setCargando] = useState(true);
    const [subiendoImg, setSubiendoImg] = useState(false);

    // Modal State
    const [itemToDelete, setItemToDelete] = useState<{ id: string, name: string } | null>(null);

    // Search & Filter State
    const [busqueda, setBusqueda] = useState('');
    const [filtroTipoGeneral, setFiltroTipoGeneral] = useState<'TODOS' | 'PLATILLO' | 'BEBIDA'>('TODOS');
    const [filtroCategoria, setFiltroCategoria] = useState('');

    // Pagination State
    const [paginaActual, setPaginaActual] = useState(1);
    const [itemsPorPagina, setItemsPorPagina] = useState(10);

    // Form State
    const [id, setId] = useState('');
    const [nombre, setNombre] = useState('');
    const [codigo, setCodigo] = useState('');
    const [precio, setPrecio] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [tipo, setTipo] = useState<'PLATILLO' | 'BEBIDA'>('PLATILLO');
    const [categoriaId, setCategoriaId] = useState('');
    const [imagen, setImagen] = useState('');

    // Validation State
    const [errorCodigo, setErrorCodigo] = useState('');

    useEffect(() => {
        cargarDatos();
        // Escuchar cambios en la BD (ej. carga inicial retrasada)
        window.addEventListener('apprest-config-updated', cargarDatos);
        return () => window.removeEventListener('apprest-config-updated', cargarDatos);
    }, []);

    // Resetear a pagina 1 cuando cambian los filtros
    useEffect(() => {
        setPaginaActual(1);
    }, [busqueda, filtroTipoGeneral, filtroCategoria]);

    // Resetear categoria seleccionada si cambia el tipo general
    useEffect(() => {
        setFiltroCategoria('');
    }, [filtroTipoGeneral]);

    const cargarDatos = () => {
        setInsumos(dbService.obtenerInsumos());
        setCategorias(dbService.obtenerCategorias());
        setCargando(false);
    };

    const resetForm = () => {
        setId(''); setNombre(''); setCodigo(''); setPrecio(''); setDescripcion('');
        setTipo('PLATILLO'); setCategoriaId(''); setImagen('');
        setModoEdicion(false);
        setErrorCodigo('');
    };

    const handleEditar = (i: Insumo) => {
        setId(i.id);
        setNombre(i.nombre);
        setCodigo(i.codigo);
        setPrecio(i.precio.toString());
        setDescripcion(i.descripcion);
        setTipo(i.tipo);
        setCategoriaId(i.categoria_id);
        setImagen(i.imagen || '');
        setModoEdicion(true);
        setErrorCodigo('');
    };

    const handleCodigoChange = (e: any) => {
        const val = e.target.value.toUpperCase();
        setCodigo(val);
        const existe = insumos.some(i => i.codigo === val && i.id !== id);
        if (existe) setErrorCodigo('¡Este código ya está registrado!');
        else setErrorCodigo('');
    };

    const handleGuardar = async (e: React.FormEvent) => {
        e.preventDefault();

        if (errorCodigo) return;

        if (!categoriaId) {
            alert("Debes seleccionar una categoría. Si no hay, créala primero.");
            return;
        }

        const insumo: Insumo = {
            id: id || '',
            codigo,
            nombre,
            descripcion,
            precio: parseFloat(precio),
            tipo,
            categoria_id: categoriaId,
            imagen
        };

        // Guardado asíncrono
        await dbService.guardarInsumo(insumo);
        resetForm();
        cargarDatos();
    };

    const confirmarEliminar = async () => {
        if (itemToDelete) {
            await dbService.eliminarInsumo(itemToDelete.id);
            cargarDatos();
            setItemToDelete(null);
        }
    };

    // --- NUEVO: Manejo de carga de imagen al servidor ---
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSubiendoImg(true);
            try {
                const url = await dbService.uploadImage(file);
                setImagen(url);
            } catch (error) {
                alert("Error al subir imagen");
            }
            setSubiendoImg(false);
        }
    };

    const categoriasForm = categorias.filter(c => c.tipo === tipo);
    const categoriasFiltro = categorias.filter(c => filtroTipoGeneral === 'TODOS' || c.tipo === filtroTipoGeneral);

    const insumosFiltradosTabla = insumos.filter(i => {
        const matchBusqueda = i.nombre.toLowerCase().includes(busqueda.toLowerCase()) || i.codigo.toLowerCase().includes(busqueda.toLowerCase());
        const matchTipoGeneral = filtroTipoGeneral === 'TODOS' || i.tipo === filtroTipoGeneral;
        const matchCategoria = filtroCategoria === '' || i.categoria_id === filtroCategoria;
        return matchBusqueda && matchTipoGeneral && matchCategoria;
    });

    const indiceUltimoItem = paginaActual * itemsPorPagina;
    const indicePrimerItem = indiceUltimoItem - itemsPorPagina;
    const itemsActuales = insumosFiltradosTabla.slice(indicePrimerItem, indiceUltimoItem);
    const totalPaginas = Math.ceil(insumosFiltradosTabla.length / itemsPorPagina);
    const cambiarPagina = (numero: number) => setPaginaActual(numero);

    if (cargando) {
        return (
            <AdminLayout title="Gestión de Productos" variant="inventory">
                <div className="flex justify-center items-center h-full">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                </div>
            </AdminLayout>
        );
    }

    if (categorias.length === 0) {
        return (
            <AdminLayout title="Gestión de Productos" variant="inventory">
                <div className="p-8 text-center">
                    <div className="bg-yellow-500/10 border border-yellow-500 p-6 rounded-xl inline-block">
                        <span className="material-symbols-outlined text-4xl text-yellow-500 mb-2">warning</span>
                        <h2 className="text-white text-xl font-bold">¡Atención!</h2>
                        <p className="text-gray-400 mb-4">No puedes crear productos sin tener categorías.</p>
                        <Link to="/admin/categories" className="bg-primary text-black font-bold py-2 px-4 rounded inline-block">Ir a Crear Categorías</Link>
                    </div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title="Gestión de Productos" variant="inventory">
            <ConfirmModal
                isOpen={!!itemToDelete}
                onClose={() => setItemToDelete(null)}
                onConfirm={confirmarEliminar}
                title="Eliminar Producto"
                message={`¿Estás seguro que deseas eliminar "${itemToDelete?.name}"? Esta acción no se puede deshacer.`}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-[#23482f] rounded-xl p-6 sticky top-6 transition-colors shadow-sm">
                        <h3 className="text-slate-900 dark:text-white font-bold text-lg mb-4">{modoEdicion ? 'Editar Producto' : 'Nuevo Producto'}</h3>
                        <form onSubmit={handleGuardar} className="flex flex-col gap-4">
                            <div>
                                <Input label="Código" value={codigo} onChange={handleCodigoChange} required placeholder="Ej. CERV01" />
                                {errorCodigo && <p className="text-red-500 text-xs mt-1 font-bold animate-pulse">{errorCodigo}</p>}
                            </div>
                            <Input label="Nombre" value={nombre} onChange={(e: any) => setNombre(e.target.value)} required />
                            <div className="grid grid-cols-2 gap-2">
                                <Input label="Precio" type="number" value={precio} onChange={(e: any) => setPrecio(e.target.value)} required />
                                <div className="flex flex-col gap-1.5 w-full">
                                    <label className="text-xs font-medium text-slate-500 dark:text-[#92c9a4] uppercase tracking-wider">Tipo</label>
                                    <select
                                        value={tipo}
                                        onChange={(e: any) => { setTipo(e.target.value); setCategoriaId(''); }}
                                        className="w-full bg-white dark:bg-[#162b1e] border border-slate-300 dark:border-[#23482f] rounded-lg px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-primary"
                                    >
                                        <option value="PLATILLO">Platillo</option>
                                        <option value="BEBIDA">Bebida</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5 w-full">
                                <label className="text-xs font-medium text-slate-500 dark:text-[#92c9a4] uppercase tracking-wider">Categoría ({tipo})</label>
                                <select
                                    value={categoriaId}
                                    onChange={(e: any) => setCategoriaId(e.target.value)}
                                    className="w-full bg-white dark:bg-[#162b1e] border border-slate-300 dark:border-[#23482f] rounded-lg px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-primary"
                                    required
                                >
                                    <option value="">Selecciona...</option>
                                    {categoriasForm.length === 0 && <option disabled>No hay categorías para este tipo</option>}
                                    {categoriasForm.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                            </div>
                            <Input label="Descripción" value={descripcion} onChange={(e: any) => setDescripcion(e.target.value)} />

                            {/* Sección de Imagen ACTUALIZADA */}
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-slate-500 dark:text-[#92c9a4] uppercase tracking-wider">Imagen del Producto</label>
                                <input
                                    type="text"
                                    value={imagen}
                                    onChange={(e) => setImagen(e.target.value)}
                                    placeholder="https://..."
                                    className="w-full bg-white dark:bg-[#162b1e] border border-slate-300 dark:border-[#23482f] rounded-lg px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/20 focus:outline-none focus:border-primary text-xs truncate"
                                    readOnly // Ahora es readOnly para forzar subida o URL generada
                                />
                                <div className="text-center text-[10px] text-slate-400 dark:text-[#92c9a4]">- O -</div>
                                <div className="relative group">
                                    <div className={`flex items-center justify-center w-full px-4 py-2 border border-dashed border-slate-300 dark:border-[#23482f] rounded-lg cursor-pointer bg-white dark:bg-[#162b1e] transition-colors ${subiendoImg ? 'opacity-50' : 'hover:border-primary/50'}`}>
                                        {subiendoImg ? (
                                            <span className="text-xs text-slate-500 dark:text-white">Subiendo...</span>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined text-slate-400 dark:text-[#92c9a4] mr-2 text-sm">cloud_upload</span>
                                                <span className="text-xs text-slate-500 dark:text-[#92c9a4] group-hover:text-slate-900 dark:group-hover:text-white">Subir archivo (JPG/PNG)</span>
                                            </>
                                        )}
                                    </div>
                                    <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" disabled={subiendoImg} />
                                </div>
                                {imagen && (
                                    <div className="mt-2 relative w-20 h-20 mx-auto border border-slate-300 dark:border-[#23482f] rounded overflow-hidden bg-slate-100 dark:bg-black/20">
                                        <img src={imagen} alt="Preview" className="w-full h-full object-cover" />
                                        <button type="button" onClick={() => setImagen('')} className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl hover:bg-red-600">
                                            <span className="material-symbols-outlined text-[10px] block">close</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 mt-2">
                                {modoEdicion && <Button variant="secondary" onClick={resetForm} className="flex-1">Cancelar</Button>}
                                <Button type="submit" disabled={!!errorCodigo || subiendoImg} className={`flex-1 ${errorCodigo ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    {modoEdicion ? 'Actualizar' : 'Guardar'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Lista */}
                <div className="lg:col-span-2">
                    <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-[#23482f] rounded-xl overflow-hidden flex flex-col min-h-[500px] lg:h-full lg:max-h-[calc(100vh-140px)] shadow-sm">
                        <div className="p-4 bg-slate-100 dark:bg-[#102216] border-b border-slate-200 dark:border-[#23482f] flex flex-col gap-3 sticky top-0 z-10">
                            <div className="flex justify-between items-center">
                                <h3 className="text-slate-900 dark:text-white font-bold whitespace-nowrap">Catálogo de Productos</h3>
                            </div>

                            <div className="flex flex-col xl:flex-row gap-2 w-full">
                                <select
                                    value={filtroTipoGeneral}
                                    onChange={(e: any) => setFiltroTipoGeneral(e.target.value)}
                                    className="bg-white dark:bg-[#162b1e] border border-slate-300 dark:border-[#23482f] rounded-lg py-2 px-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary cursor-pointer min-w-[120px]"
                                >
                                    <option value="TODOS">Todos los Tipos</option>
                                    <option value="PLATILLO">Platillos</option>
                                    <option value="BEBIDA">Bebidas</option>
                                </select>

                                <select
                                    value={filtroCategoria}
                                    onChange={(e) => setFiltroCategoria(e.target.value)}
                                    className="bg-white dark:bg-[#162b1e] border border-slate-300 dark:border-[#23482f] rounded-lg py-2 px-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary cursor-pointer min-w-[180px]"
                                >
                                    <option value="">Todas las Categorías</option>
                                    {categoriasFiltro.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>

                                <div className="relative w-full">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 dark:text-gray-500 text-sm">search</span>
                                    <input
                                        type="text"
                                        placeholder="Buscar por nombre o código..."
                                        value={busqueda}
                                        onChange={(e) => setBusqueda(e.target.value)}
                                        className="w-full bg-white dark:bg-[#162b1e] border border-slate-300 dark:border-[#23482f] rounded-full py-2 pl-9 pr-4 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="overflow-auto flex-1">
                            <table className="w-full text-left text-sm text-slate-600 dark:text-gray-400">
                                <thead className="bg-slate-100 dark:bg-[#102216] uppercase font-bold text-xs text-slate-700 dark:text-white sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-3">Código</th>
                                        <th className="px-4 py-3">Nombre</th>
                                        <th className="px-4 py-3">Descripción</th>
                                        <th className="px-4 py-3">Precio</th>
                                        <th className="px-4 py-3">Categoría</th>
                                        <th className="px-4 py-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-[#23482f]">
                                    {insumosFiltradosTabla.length === 0 ? (
                                        <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-gray-500 italic">No se encontraron productos con los filtros actuales.</td></tr>
                                    ) : (
                                        itemsActuales.map(item => {
                                            const cat = categorias.find(c => c.id === item.categoria_id);
                                            return (
                                                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                                                    <td className="px-4 py-3 font-mono">{item.codigo}</td>
                                                    <td className="px-4 py-3 text-slate-900 dark:text-white font-medium">
                                                        <div className="flex items-center gap-2">
                                                            {item.imagen && <img src={item.imagen} className="w-8 h-8 rounded object-cover bg-slate-200 dark:bg-black/20" />}
                                                            {item.nombre}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-500 dark:text-gray-400 text-xs max-w-[150px] truncate" title={item.descripcion}>{item.descripcion}</td>
                                                    <td className="px-4 py-3 text-primary-dark dark:text-primary font-bold">${item.precio.toFixed(2)}</td>
                                                    <td className="px-4 py-3">{cat?.nombre || 'S/C'}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => handleEditar(item)} className="p-1 hover:text-blue-600 dark:hover:text-white text-blue-500 dark:text-blue-400"><span className="material-symbols-outlined">edit</span></button>
                                                            <button onClick={() => setItemToDelete({ id: item.id, name: item.nombre })} className="p-1 hover:text-red-600 dark:hover:text-white text-red-500 dark:text-red-400"><span className="material-symbols-outlined">delete</span></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
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
                                    <option value={20}>20</option>
                                </select>
                                <span>por página</span>
                            </div>

                            <div className="flex items-center gap-4">
                                <span className="text-slate-600 dark:text-[#92c9a4]">
                                    {indicePrimerItem + 1}-{Math.min(indiceUltimoItem, insumosFiltradosTabla.length)} de {insumosFiltradosTabla.length}
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
            </div>
        </AdminLayout>
    );
};

export const ScreenCategoryManager = () => {
    // Mantener ScreenCategoryManager como estaba, pero asegurando que use el nuevo dbService asíncrono
    const [categorias, setCategorias] = useState<Categoria[]>([]);
    const [itemToDelete, setItemToDelete] = useState<{ id: string, name: string } | null>(null);
    const [busqueda, setBusqueda] = useState('');
    const [filtroTipo, setFiltroTipo] = useState<'TODOS' | 'PLATILLO' | 'BEBIDA'>('TODOS');
    const [paginaActual, setPaginaActual] = useState(1);
    const [itemsPorPagina, setItemsPorPagina] = useState(5);
    const [nombre, setNombre] = useState('');
    const [tipo, setTipo] = useState<'PLATILLO' | 'BEBIDA'>('PLATILLO');
    const [descripcion, setDescripcion] = useState('');
    const [idEdicion, setIdEdicion] = useState<string | null>(null);
    const [errorNombre, setErrorNombre] = useState('');

    useEffect(() => {
        cargar();
        window.addEventListener('apprest-config-updated', cargar);
        return () => window.removeEventListener('apprest-config-updated', cargar);
    }, []);
    useEffect(() => { setPaginaActual(1); }, [busqueda, filtroTipo]);

    const cargar = () => setCategorias(dbService.obtenerCategorias());

    const resetForm = () => {
        setIdEdicion(null); setNombre(''); setTipo('PLATILLO'); setDescripcion(''); setErrorNombre('');
    };

    const handleNombreChange = (e: any) => {
        const val = e.target.value; setNombre(val);
        const existe = categorias.some(c => c.nombre.toLowerCase() === val.toLowerCase() && c.id !== idEdicion);
        if (existe) setErrorNombre('¡Esta categoría ya existe!'); else setErrorNombre('');
    };

    const handleGuardar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (errorNombre) return;
        await dbService.guardarCategoria({ id: idEdicion || '', nombre, tipo, descripcion });
        resetForm(); cargar();
    };

    const handleEditar = (c: Categoria) => {
        setNombre(c.nombre); setTipo(c.tipo); setDescripcion(c.descripcion || ''); setIdEdicion(c.id); setErrorNombre('');
    };

    const confirmarEliminar = async () => {
        if (!itemToDelete) return;
        try {
            await dbService.eliminarCategoria(itemToDelete.id);
            cargar();
        } catch (e: any) { alert(e.message); }
        setItemToDelete(null);
    };

    const categoriasFiltradas = categorias.filter(c => {
        const matchBusqueda = c.nombre.toLowerCase().includes(busqueda.toLowerCase());
        const matchTipo = filtroTipo === 'TODOS' || c.tipo === filtroTipo;
        return matchBusqueda && matchTipo;
    });

    const indiceUltimoItem = paginaActual * itemsPorPagina;
    const indicePrimerItem = indiceUltimoItem - itemsPorPagina;
    const itemsActuales = categoriasFiltradas.slice(indicePrimerItem, indiceUltimoItem);
    const totalPaginas = Math.ceil(categoriasFiltradas.length / itemsPorPagina);
    const cambiarPagina = (numero: number) => setPaginaActual(numero);

    return (
        <AdminLayout title="Gestión de Categorías" variant="inventory">
            <ConfirmModal
                isOpen={!!itemToDelete}
                onClose={() => setItemToDelete(null)}
                onConfirm={confirmarEliminar}
                title="Eliminar Categoría"
                message={`¿Estás seguro que deseas eliminar la categoría "${itemToDelete?.name}"?`}
            />

            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-[#23482f] rounded-xl p-6 h-fit transition-colors shadow-sm">
                    <h3 className="text-slate-900 dark:text-white font-bold text-lg mb-4">{idEdicion ? 'Editar Categoría' : 'Nueva Categoría'}</h3>
                    <form onSubmit={handleGuardar} className="flex flex-col gap-4">
                        <div>
                            <Input label="Nombre de Categoría" value={nombre} onChange={handleNombreChange} required />
                            {errorNombre && <p className="text-red-500 text-xs mt-1 font-bold animate-pulse">{errorNombre}</p>}
                        </div>
                        <div className="flex flex-col gap-1.5 w-full">
                            <label className="text-xs font-medium text-slate-500 dark:text-[#92c9a4] uppercase tracking-wider">Tipo General</label>
                            <select
                                value={tipo}
                                onChange={(e: any) => setTipo(e.target.value)}
                                className="w-full bg-white dark:bg-[#162b1e] border border-slate-300 dark:border-[#23482f] rounded-lg px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-primary"
                            >
                                <option value="PLATILLO">Platillo (Comida)</option>
                                <option value="BEBIDA">Bebida</option>
                            </select>
                        </div>
                        <Input label="Descripción" value={descripcion} onChange={(e: any) => setDescripcion(e.target.value)} />
                        <div className="flex gap-2">
                            {idEdicion && <Button variant="ghost" onClick={resetForm}>Cancelar</Button>}
                            <Button type="submit" disabled={!!errorNombre} className={`flex-1 ${errorNombre ? 'opacity-50 cursor-not-allowed' : ''}`}>Guardar</Button>
                        </div>
                    </form>
                </div>

                <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-[#23482f] rounded-xl overflow-hidden flex flex-col min-h-[500px] lg:h-full lg:max-h-[600px] shadow-sm">
                    <div className="p-4 bg-slate-100 dark:bg-[#102216] border-b border-slate-200 dark:border-[#23482f] flex flex-col gap-3 sticky top-0 z-10">
                        <div className="flex justify-between items-center"><h3 className="text-slate-900 dark:text-white font-bold whitespace-nowrap">Listado de Categorías</h3></div>
                        <div className="flex flex-col sm:flex-row gap-2 w-full">
                            <select
                                value={filtroTipo}
                                onChange={(e: any) => setFiltroTipo(e.target.value)}
                                className="bg-white dark:bg-[#162b1e] border border-slate-300 dark:border-[#23482f] rounded-lg py-1.5 px-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary cursor-pointer w-full sm:w-auto min-w-[120px]"
                            >
                                <option value="TODOS">Todos</option><option value="PLATILLO">Platillos</option><option value="BEBIDA">Bebidas</option>
                            </select>
                            <div className="relative w-full">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 dark:text-gray-500 text-sm">search</span>
                                <input
                                    type="text"
                                    placeholder="Buscar..."
                                    value={busqueda}
                                    onChange={(e) => setBusqueda(e.target.value)}
                                    className="w-full bg-white dark:bg-[#162b1e] border border-slate-300 dark:border-[#23482f] rounded-full py-1.5 pl-9 pr-4 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-primary"
                                />
                            </div>
                        </div>
                    </div>
                    <ul className="divide-y divide-slate-100 dark:divide-[#23482f] overflow-auto flex-1">
                        {categoriasFiltradas.length === 0 ? <li className="p-8 text-center text-slate-500 dark:text-gray-500 italic">No se encontraron categorías.</li> : itemsActuales.map(c => (
                            <li key={c.id} className="p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                <div className="flex flex-col">
                                    <span className="text-slate-900 dark:text-white font-medium">{c.nombre}</span>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${c.tipo === 'BEBIDA' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400'}`}>{c.tipo}</span>
                                        {c.descripcion && <span className="text-xs text-slate-500 dark:text-gray-500">{c.descripcion}</span>}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleEditar(c)} className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-white"><span className="material-symbols-outlined">edit</span></button>
                                    <button onClick={() => setItemToDelete({ id: c.id, name: c.nombre })} className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-white"><span className="material-symbols-outlined">delete</span></button>
                                </div>
                            </li>
                        ))}
                    </ul>
                    <div className="p-3 bg-slate-100 dark:bg-[#102216] border-t border-slate-200 dark:border-[#23482f] flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
                        <div className="flex items-center gap-2 text-slate-600 dark:text-[#92c9a4]">
                            <span>Mostrar</span>
                            <select
                                value={itemsPorPagina}
                                onChange={(e) => { setItemsPorPagina(Number(e.target.value)); setPaginaActual(1); }}
                                className="bg-white dark:bg-[#162b1e] border border-slate-300 dark:border-[#23482f] text-slate-900 dark:text-white rounded px-2 py-1 focus:outline-none focus:border-primary cursor-pointer"
                            >
                                <option value={5}>5</option><option value={10}>10</option><option value={15}>15</option><option value={20}>20</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-4">
                            <span className="text-slate-600 dark:text-[#92c9a4]">{indicePrimerItem + 1}-{Math.min(indiceUltimoItem, categoriasFiltradas.length)} de {categoriasFiltradas.length}</span>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => cambiarPagina(paginaActual - 1)}
                                    disabled={paginaActual === 1}
                                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-white disabled:opacity-30"
                                >
                                    <span className="material-symbols-outlined">chevron_left</span>
                                </button>
                                <button
                                    onClick={() => cambiarPagina(paginaActual + 1)}
                                    disabled={paginaActual === totalPaginas || totalPaginas === 0}
                                    className="p-1 rounded hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-white disabled:opacity-30"
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