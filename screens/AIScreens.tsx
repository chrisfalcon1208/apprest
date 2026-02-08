import React, { useState, useRef } from 'react';
import { SidebarLink, Button, Input } from '../components/Components';
import { sendChatMessage, generateRestaurantImage, analyzeUploadedImage, analyzeUploadedVideo } from '../services/geminiService';
import { dbService } from '../services/dbService';

export const ScreenAIHub = () => {
    const [activeTab, setActiveTab] = useState<'chat' | 'generate' | 'analyze'>('chat');
    const negocio = dbService.obtenerInfoNegocio();

    return (
        <div className="flex h-screen w-full overflow-hidden bg-background-light dark:bg-background-dark text-slate-900 dark:text-white">
            <aside className="hidden md:flex flex-col w-64 bg-surface-dark border-r border-[#23482f] h-full flex-shrink-0">
                <div className="flex flex-col h-full p-4">
                    <div className="flex items-center gap-3 px-2 py-4 mb-6">
                        <div className="bg-center bg-no-repeat bg-cover rounded-full size-10 border-2 border-primary" style={{backgroundImage: `url("${negocio.logo}")`}}></div>
                        <div className="flex flex-col"><h1 className="text-white text-lg font-bold leading-tight">{negocio.nombre}</h1><p className="text-[#92c9a4] text-xs font-mono">Hub IA</p></div>
                    </div>
                    <nav className="flex flex-col gap-2 flex-1">
                        <SidebarLink to="/" icon="arrow_back" label="Volver al TPV" />
                        <button onClick={() => setActiveTab('chat')} className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors cursor-pointer w-full text-left ${activeTab === 'chat' ? "bg-primary/10 border border-primary/20 text-white" : "text-[#92c9a4] hover:bg-[#1f3a2a]"}`}>
                            <span className="material-symbols-outlined text-primary">voice_chat</span> Asistente de Chat
                        </button>
                        <button onClick={() => setActiveTab('generate')} className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors cursor-pointer w-full text-left ${activeTab === 'generate' ? "bg-primary/10 border border-primary/20 text-white" : "text-[#92c9a4] hover:bg-[#1f3a2a]"}`}>
                            <span className="material-symbols-outlined text-primary">image</span> Estudio de Imagen
                        </button>
                        <button onClick={() => setActiveTab('analyze')} className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-colors cursor-pointer w-full text-left ${activeTab === 'analyze' ? "bg-primary/10 border border-primary/20 text-white" : "text-[#92c9a4] hover:bg-[#1f3a2a]"}`}>
                            <span className="material-symbols-outlined text-primary">document_scanner</span> Análisis Multimedia
                        </button>
                    </nav>
                </div>
            </aside>
            <main className="flex-1 flex flex-col h-full min-w-0 bg-background-dark overflow-hidden relative">
                 {/* Decorative background */}
                 <div className="absolute inset-0 opacity-5 pointer-events-none" style={{backgroundImage: 'radial-gradient(#13ec5b 1px, transparent 1px)', backgroundSize: '32px 32px'}}></div>
                 
                 <header className="flex items-center justify-between h-16 px-6 border-b border-[#23482f] bg-surface-dark shrink-0 z-10">
                    <div className="flex items-center gap-2"><span className="material-symbols-outlined text-primary">smart_toy</span><h2 className="text-white text-lg font-bold">
                        {activeTab === 'chat' && "Asistente de Chat IA"}
                        {activeTab === 'generate' && "Generador de Imágenes"}
                        {activeTab === 'analyze' && "Análisis Multimedia (Img/Video)"}
                    </h2></div>
                 </header>

                 <div className="flex-1 overflow-y-auto p-6 scroll-smooth z-10">
                    {activeTab === 'chat' && <ChatFeature />}
                    {activeTab === 'generate' && <ImageGenFeature />}
                    {activeTab === 'analyze' && <AnalysisFeature />}
                 </div>
            </main>
        </div>
    );
};

// --- Sub Features ---

const ChatFeature = () => {
    const [messages, setMessages] = useState<{ role: 'user' | 'model'; parts: { text: string }[] }[]>([
        { role: 'model', parts: [{ text: "¡Hola! Soy tu asistente de AppRest. ¿En qué puedo ayudarte hoy con el menú o el inventario?" }] }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const handleSend = async () => {
        if (!input.trim() || loading) return;
        const userMsg = input;
        setInput("");
        
        const newHistory = [...messages, { role: 'user' as const, parts: [{ text: userMsg }] }];
        setMessages(newHistory);
        setLoading(true);

        const responseText = await sendChatMessage(newHistory, userMsg);
        
        setMessages([...newHistory, { role: 'model', parts: [{ text: responseText }] }]);
        setLoading(false);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    return (
        <div className="flex flex-col h-full max-w-3xl mx-auto bg-surface-dark border border-[#23482f] rounded-xl overflow-hidden shadow-2xl">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${msg.role === 'user' ? 'bg-primary text-background-dark font-medium rounded-tr-none' : 'bg-[#1f3a2a] text-white rounded-tl-none'}`}>
                            {msg.parts[0].text}
                        </div>
                    </div>
                ))}
                {loading && <div className="text-[#92c9a4] text-xs animate-pulse ml-2">El asistente está pensando...</div>}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-4 bg-[#102216] border-t border-[#23482f] flex gap-3">
                <input 
                    className="flex-1 bg-[#162b1e] border border-[#23482f] rounded-lg px-4 text-white focus:outline-none focus:border-primary"
                    placeholder="Pregunta sobre recetas, inventario, etc..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />
                <Button onClick={handleSend} disabled={loading}><span className="material-symbols-outlined">send</span></Button>
            </div>
        </div>
    );
};

const ImageGenFeature = () => {
    const [prompt, setPrompt] = useState("");
    const [size, setSize] = useState<'1K' | '2K' | '4K'>('1K');
    const [image, setImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleGenerate = async () => {
        if (!prompt) return;
        setLoading(true);
        setImage(null);
        try {
            const result = await generateRestaurantImage(prompt, size);
            setImage(result);
        } catch (e) {
            alert("Falló la generación. Por favor intenta de nuevo.");
        }
        setLoading(false);
    };

    return (
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
            <div className="flex flex-col gap-6">
                <div className="bg-surface-dark border border-[#23482f] rounded-xl p-6">
                    <h3 className="text-white font-bold mb-4">Configuración de Imagen</h3>
                    <div className="flex flex-col gap-4">
                        <div>
                            <label className="text-xs text-[#92c9a4] uppercase font-bold mb-2 block">Prompt (Descripción)</label>
                            <textarea 
                                className="w-full h-32 bg-[#162b1e] border border-[#23482f] rounded-lg p-3 text-white focus:border-primary resize-none"
                                placeholder="Una hamburguesa gourmet en una mesa de madera con iluminación dramática..."
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-[#92c9a4] uppercase font-bold mb-2 block">Resolución</label>
                            <div className="flex gap-2">
                                {['1K', '2K', '4K'].map((s) => (
                                    <button 
                                        key={s}
                                        onClick={() => setSize(s as any)}
                                        className={`flex-1 py-2 rounded border font-medium transition-all ${size === s ? 'bg-primary border-primary text-background-dark' : 'bg-transparent border-[#23482f] text-white hover:border-primary/50'}`}
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <Button onClick={handleGenerate} disabled={loading} className="mt-2">
                            {loading ? "Generando..." : "Generar Imagen"}
                        </Button>
                    </div>
                </div>
                <div className="bg-[#1a3324]/50 border border-[#23482f] rounded-xl p-4">
                    <p className="text-[#92c9a4] text-xs"><span className="font-bold text-primary">Nota:</span> Genera activos de marketing usando el modelo Gemini 3 Pro Image.</p>
                </div>
            </div>
            <div className="bg-surface-dark border border-[#23482f] rounded-xl p-2 flex items-center justify-center relative min-h-[400px]">
                {loading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>}
                {image ? (
                    <img src={image} alt="Generada" className="max-w-full max-h-full rounded-lg shadow-2xl" />
                ) : (
                    <div className="text-center text-[#92c9a4] opacity-50">
                        <span className="material-symbols-outlined text-6xl mb-2">image</span>
                        <p>La vista previa aparecerá aquí</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const AnalysisFeature = () => {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [prompt, setPrompt] = useState("Describe este artículo y sugiere un precio de menú.");
    const [result, setResult] = useState("");
    const [loading, setLoading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const f = e.target.files[0];
            setFile(f);
            setPreview(URL.createObjectURL(f));
        }
    };

    const handleAnalyze = async () => {
        if (!file) return;
        setLoading(true);
        setResult("");

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const base64 = (reader.result as string).split(',')[1];
            let analysisText = "";
            
            if (file.type.startsWith('image/')) {
                analysisText = await analyzeUploadedImage(base64, file.type, prompt);
            } else if (file.type.startsWith('video/')) {
                analysisText = await analyzeUploadedVideo(base64, file.type, prompt);
            } else {
                analysisText = "Tipo de archivo no soportado.";
            }
            setResult(analysisText);
            setLoading(false);
        };
    };

    return (
        <div className="max-w-4xl mx-auto h-full flex flex-col gap-6">
             <div className="bg-surface-dark border border-[#23482f] rounded-xl p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="flex flex-col gap-4">
                        <div className="border-2 border-dashed border-[#23482f] hover:border-primary/50 rounded-xl p-8 text-center transition-colors cursor-pointer relative group bg-[#162b1e]">
                            <input type="file" onChange={handleFileChange} accept="image/*,video/*" className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                            <span className="material-symbols-outlined text-4xl text-[#92c9a4] group-hover:text-primary mb-2">cloud_upload</span>
                            <p className="text-white font-medium group-hover:text-primary">Clic para subir multimedia</p>
                            <p className="text-xs text-[#92c9a4]">Soporta JPG, PNG, MP4 (Clips cortos)</p>
                        </div>
                        {preview && (
                            <div className="h-48 bg-black/20 rounded-lg flex items-center justify-center overflow-hidden border border-[#23482f]">
                                {file?.type.startsWith('video/') ? (
                                    <video src={preview} controls className="max-h-full" />
                                ) : (
                                    <img src={preview} alt="Vista previa" className="max-h-full" />
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col gap-4">
                        <Input 
                            label="Pregunta de Análisis" 
                            value={prompt} 
                            onChange={(e:any) => setPrompt(e.target.value)}
                            placeholder="ej., ¿Qué ingredientes hay en este plato?" 
                        />
                        <Button onClick={handleAnalyze} disabled={!file || loading}>
                            {loading ? "Analizando..." : "Ejecutar Análisis"}
                        </Button>
                        <div className="flex-1 bg-[#162b1e] rounded-lg p-4 border border-[#23482f] overflow-y-auto min-h-[200px]">
                            {result ? (
                                <p className="text-white whitespace-pre-wrap">{result}</p>
                            ) : (
                                <p className="text-[#92c9a4] italic text-sm">Los resultados del análisis aparecerán aquí...</p>
                            )}
                        </div>
                    </div>
                </div>
             </div>
        </div>
    );
};