import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Input, Button, ThemeToggle } from '../components/Components';
import { dbService } from '../services/dbService';

export const LoginScreen = ({ onLogin }: { onLogin: () => void }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Estados para gestión de BD Backend
    const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'missing' | 'error'>('checking');
    const [initLoading, setInitLoading] = useState(false);

    useEffect(() => {
        const checkDB = async () => {
            const status = await dbService.verificarConexionBackend();
            setDbStatus(status as any);
        };
        checkDB();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (email && password) {
            // Login es ahora una promesa async
            const success = await dbService.login(email, password);
            if (success) {
                onLogin();
                navigate('/');
            } else {
                setError('Credenciales inválidas. Verifica tu correo y contraseña.');
            }
        }
        setLoading(false);
    };

    const handleInitDB = async () => {
        setInitLoading(true);
        const success = await dbService.inicializarBaseDeDatos();
        if (success) {
            setDbStatus('connected');
            alert("Base de datos creada exitosamente. Usuario por defecto: admin@apprest.com / admin123");
        } else {
            alert("Error al crear la base de datos. Verifica tu servidor MySQL.");
        }
        setInitLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-background-dark p-6 relative overflow-hidden transition-colors duration-300">
            <div className="absolute top-4 right-4 z-50">
                <ThemeToggle />
            </div>

            <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#13ec5b 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>

            {/* Botón de Inicialización (Visible solo si DB no existe) */}
            {dbStatus === 'missing' && (
                <div className="absolute top-6 right-16 z-50">
                    <button
                        onClick={handleInitDB}
                        disabled={initLoading}
                        className="bg-primary hover:bg-white text-background-dark font-bold py-3 px-6 rounded-lg shadow-lg shadow-primary/20 flex items-center gap-2 transition-all hover:scale-105 animate-bounce"
                    >
                        {initLoading ? (
                            <span className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
                        ) : (
                            <span className="material-symbols-outlined">database</span>
                        )}
                        INICIAR SISTEMA (CREAR DB)
                    </button>
                    <p className="text-slate-600 dark:text-white text-xs mt-2 text-right bg-white/80 dark:bg-black/50 p-2 rounded backdrop-blur-sm">
                        Detectamos que es la primera vez.<br />Haz clic para configurar la base de datos MySQL.
                    </p>
                </div>
            )}

            {/* Formulario de Login (Solo visible si DB está conectada o hay error de conexión fallback) */}
            {dbStatus !== 'missing' && (
                <div className="w-full max-w-md bg-white dark:bg-surface-dark border border-slate-200 dark:border-[#23482f] rounded-2xl p-8 shadow-2xl relative z-10 animate-in fade-in zoom-in duration-300 transition-colors">
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-[#23482f] rounded-full flex items-center justify-center border-2 border-primary mb-4">
                            <span className="material-symbols-outlined text-primary-dark dark:text-primary text-3xl">restaurant</span>
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Bienvenido de nuevo</h1>
                        <p className="text-slate-500 dark:text-[#92c9a4]">Inicia sesión para acceder a tu terminal TPV</p>
                    </div>

                    {dbStatus === 'error' && (
                        <div className="mb-4 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-600 dark:text-yellow-500 text-xs text-center">
                            Error Conexión: Verifica WampServer.
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        {error && <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 dark:text-red-400 text-xs rounded font-bold text-center animate-pulse">{error}</div>}
                        <Input
                            label="Correo Electrónico"
                            type="email"
                            value={email}
                            onChange={(e: any) => setEmail(e.target.value)}
                            placeholder="usuario@apprest.com"
                            required
                        />
                        <div className="flex flex-col gap-1.5">
                            <Input
                                label="Contraseña"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e: any) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                rightElement={
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="hover:text-primary transition-colors focus:outline-none">
                                        <span className="material-symbols-outlined text-[18px] text-slate-500 dark:text-gray-400">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                    </button>
                                }
                            />
                        </div>

                        <Button type="submit" className="mt-2" disabled={loading}>
                            {loading ? "Verificando..." : "Iniciar Sesión"}
                        </Button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-slate-500 dark:text-[#92c9a4] text-sm">¿No tienes una cuenta? <Link to="/register" className="text-primary-dark dark:text-primary font-bold hover:underline">Crear Cuenta</Link></p>
                    </div>
                </div>
            )}

            {/* Loader mientras chequea estado */}
            {dbStatus === 'checking' && (
                <div className="absolute inset-0 bg-slate-100 dark:bg-background-dark flex items-center justify-center z-50">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-slate-900 dark:text-white font-mono animate-pulse">Verificando conexión a base de datos...</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export const RegisterScreen = () => {
    const [nombre, setNombre] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Visibilidad de contraseñas
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres.');
            return;
        }

        setLoading(true);

        try {
            // El backend fuerza el rol a 'admin', pero lo pasamos aquí por compatibilidad con el servicio
            await dbService.registrarUsuario(nombre, email, password, 'admin');
            alert("Cuenta creada exitosamente. Por favor inicia sesión.");
            navigate('/login');
        } catch (err: any) {
            setError(err.message || 'Error al registrar.');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-background-dark p-6 relative overflow-hidden transition-colors duration-300">
            <div className="absolute top-4 right-4 z-50">
                <ThemeToggle />
            </div>
            <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#13ec5b 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>

            <div className="w-full max-w-md bg-white dark:bg-surface-dark border border-slate-200 dark:border-[#23482f] rounded-2xl p-8 shadow-2xl relative z-10 animate-in fade-in zoom-in duration-300 transition-colors">
                <div className="flex flex-col items-center mb-6">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Crear Cuenta</h1>
                    <p className="text-slate-500 dark:text-[#92c9a4]">Únete al sistema de gestión</p>
                </div>

                <form onSubmit={handleRegister} className="flex flex-col gap-4">
                    {error && <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 dark:text-red-400 text-xs rounded font-bold text-center">{error}</div>}

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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Contraseña"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e: any) => setPassword(e.target.value)}
                            required
                            rightElement={
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="hover:text-primary transition-colors focus:outline-none">
                                    <span className="material-symbols-outlined text-[18px] text-slate-500 dark:text-gray-400">{showPassword ? 'visibility_off' : 'visibility'}</span>
                                </button>
                            }
                        />
                        <div className="relative">
                            <Input
                                label="Confirmar Contraseña"
                                type={showConfirmPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e: any) => setConfirmPassword(e.target.value)}
                                required
                                rightElement={
                                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="hover:text-primary transition-colors focus:outline-none">
                                        <span className="material-symbols-outlined text-[18px] text-slate-500 dark:text-gray-400">{showConfirmPassword ? 'visibility_off' : 'visibility'}</span>
                                    </button>
                                }
                            />
                            {/* Validación en tiempo real */}
                            {password && confirmPassword && (
                                <div className="absolute right-0 top-0 mt-1 mr-1">
                                    {password === confirmPassword ? (
                                        <span className="text-[10px] text-green-500 flex items-center gap-1 font-bold bg-green-500/10 px-2 py-0.5 rounded">
                                            <span className="material-symbols-outlined text-[10px]">check</span> Coinciden
                                        </span>
                                    ) : (
                                        <span className="text-[10px] text-red-500 flex items-center gap-1 font-bold bg-red-500/10 px-2 py-0.5 rounded">
                                            <span className="material-symbols-outlined text-[10px]">close</span> No coinciden
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <Button type="submit" className="mt-2" disabled={loading}>
                        {loading ? "Registrando..." : "Registrarse"}
                    </Button>
                </form>

                <div className="mt-6 text-center">
                    <p className="text-slate-500 dark:text-[#92c9a4] text-sm">¿Ya tienes cuenta? <Link to="/login" className="text-primary-dark dark:text-primary font-bold hover:underline">Iniciar Sesión</Link></p>
                </div>
            </div>
        </div>
    );
};

export const ForgotPasswordScreen = () => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-background-dark p-6 transition-colors">
            <div className="text-center">
                <h1 className="text-slate-900 dark:text-white font-bold text-xl mb-4">Recuperación de Contraseña</h1>
                <p className="text-slate-500 dark:text-gray-400 mb-4">Contacte al administrador del sistema para restablecer su contraseña.</p>
                <Link to="/login" className="text-primary-dark dark:text-primary hover:underline">Volver al Login</Link>
            </div>
        </div>
    );
};