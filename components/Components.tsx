import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

// Theme Toggle Component
export const ThemeToggle = () => {
    const [isDark, setIsDark] = useState(true);

    useEffect(() => {
        // Verificar preferencia inicial o sistema
        const isDarkMode = document.documentElement.classList.contains('dark');
        setIsDark(isDarkMode);
    }, []);

    const toggleTheme = () => {
        const html = document.documentElement;
        if (html.classList.contains('dark')) {
            html.classList.remove('dark');
            localStorage.setItem('theme', 'light');
            setIsDark(false);
        } else {
            html.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            setIsDark(true);
        }
    };

    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-full bg-slate-200 dark:bg-[#162b1e] text-slate-600 dark:text-[#92c9a4] hover:bg-slate-300 dark:hover:bg-[#1f3a2a] transition-colors border border-slate-300 dark:border-[#23482f]"
            title={isDark ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
        >
            <span className="material-symbols-outlined text-[20px]">
                {isDark ? 'light_mode' : 'dark_mode'}
            </span>
        </button>
    );
};

// Sidebar Link Component
export const SidebarLink = ({ to, icon, label }: { to: string; icon: string; label: string }) => {
    const location = useLocation();
    const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));

    const baseClass = "flex items-center gap-3 px-3 py-3 rounded-lg transition-colors cursor-pointer group";
    // Light: bg-primary/10 text-primary-dark | Dark: bg-primary/10 text-white
    const activeClass = "bg-primary/10 border border-primary/20 text-primary-dark dark:text-white";
    // Light: text-slate-500 hover:bg-slate-200 | Dark: text-[#92c9a4] hover:bg-[#1f3a2a]
    const inactiveClass = "text-slate-500 dark:text-[#92c9a4] hover:bg-slate-200 dark:hover:bg-[#1f3a2a] hover:text-slate-900 dark:hover:text-white";

    const iconClass = isActive ? "text-primary-dark dark:text-primary" : "group-hover:text-slate-900 dark:group-hover:text-white";

    return (
        <Link to={to} className={`${baseClass} ${isActive ? activeClass : inactiveClass}`}>
            <span className="material-symbols-outlined">{icon}</span>
            <p className={`text-sm font-medium leading-normal ${iconClass}`}>{label}</p>
        </Link>
    );
};

// Status Badge Component
export const StatusBadge = ({ online = true }: { online?: boolean }) => (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-[#162b1e] border border-slate-200 dark:border-[#1f3a2a]">
        <div className={`w-2 h-2 rounded-full ${online ? 'bg-primary animate-pulse' : 'bg-red-500'}`}></div>
        <div className="flex flex-col">
            <p className="text-slate-500 dark:text-[#92c9a4] text-xs font-medium">{online ? 'Sistema en Línea' : 'Desconectado'}</p>
        </div>
    </div>
);

// Input Component (Actualizado para soportar rightElement y Light Mode)
export const Input = ({ label, type = "text", value, onChange, placeholder, required = false, rightElement = null }: any) => (
    <div className="flex flex-col gap-1.5 w-full">
        {label && <label className="text-xs font-medium text-slate-500 dark:text-[#92c9a4] uppercase tracking-wider">{label}</label>}
        <div className="relative">
            <input
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                required={required}
                className={`w-full bg-white dark:bg-[#162b1e] border border-slate-300 dark:border-[#23482f] rounded-lg px-4 py-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/20 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all ${rightElement ? 'pr-12' : ''}`}
            />
            {rightElement && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 z-10">
                    {rightElement}
                </div>
            )}
        </div>
    </div>
);

// Button Component
export const Button = ({ children, onClick, variant = 'primary', className = "", disabled = false, type = "button" }: any) => {
    const baseClass = "flex items-center justify-center gap-2 font-bold rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed";
    const variants = {
        primary: "bg-primary hover:bg-primary-dark text-white dark:text-background-dark py-3 px-6 shadow-lg shadow-primary/10",
        secondary: "bg-slate-200 dark:bg-[#23482f] hover:bg-slate-300 dark:hover:bg-[#2c583a] text-slate-800 dark:text-white border border-slate-300 dark:border-[#23482f] py-3 px-6",
        outline: "bg-transparent border border-primary text-primary hover:bg-primary/10 py-3 px-6",
        ghost: "bg-transparent hover:bg-slate-200 dark:hover:bg-white/5 text-slate-500 dark:text-[#92c9a4] hover:text-slate-900 dark:hover:text-white py-2 px-4",
        danger: "bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/50 py-3 px-6"
    };

    return (
        <button
            // @ts-ignore
            type={type}
            disabled={disabled}
            onClick={onClick}
            className={`${baseClass} ${variants[variant as keyof typeof variants] || variants.primary} ${className}`}
        >
            {children}
        </button>
    );
};

// Confirm Modal Component
export const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-surface-dark border border-slate-200 dark:border-[#23482f] rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex items-center gap-3 mb-3 text-red-500 dark:text-red-400">
                    <span className="material-symbols-outlined text-3xl">warning</span>
                    <h3 className="text-slate-900 dark:text-white text-lg font-bold">{title}</h3>
                </div>
                <p className="text-slate-600 dark:text-gray-300 mb-6 leading-relaxed">{message}</p>
                <div className="flex gap-3 justify-end">
                    <Button variant="secondary" onClick={onClose} className="py-2 px-4 text-sm">Cancelar</Button>
                    <button onClick={() => { onConfirm(); onClose(); }} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold shadow-lg shadow-red-500/20 transition-colors text-sm">Confirmar Eliminación</button>
                </div>
            </div>
        </div>
    );
};