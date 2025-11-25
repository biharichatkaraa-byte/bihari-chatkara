
import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles, Loader2, ChevronDown } from 'lucide-react';
import { chatWithRestaurantData } from '../services/geminiService';

interface AiAssistantProps {
  contextData: any; // Flexible context object containing orders, inventory, etc.
}

interface Message {
  role: 'user' | 'ai';
  text: string;
}

const AiAssistant: React.FC<AiAssistantProps> = ({ contextData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: "Hello! I'm your Bihari Chatkara Co-Pilot. Ask me about sales, inventory, or for menu ideas!" }
  ]);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;

    const userMsg = inputText;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInputText('');
    setIsThinking(true);

    try {
      const response = await chatWithRestaurantData(contextData, userMsg);
      setMessages(prev => [...prev, { role: 'ai', text: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', text: "Sorry, I encountered an error processing your request." }]);
    } finally {
      setIsThinking(false);
    }
  };

  // Preset prompts for quick access
  const handlePresetClick = (text: string) => {
      setInputText(text);
      // Optional: Auto submit
      // handleSendMessage(); 
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 rounded-full shadow-2xl hover:scale-105 transition-transform flex items-center gap-2 group animate-in slide-in-from-bottom-5"
      >
        <Sparkles size={24} className="group-hover:animate-spin" />
        <span className="font-bold pr-2">Ask AI</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-full max-w-sm md:w-96 h-[500px] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 animate-in slide-in-from-bottom-10 fade-in duration-300">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 rounded-t-2xl flex justify-between items-center text-white">
        <div className="flex items-center gap-2">
            <div className="bg-white/20 p-1.5 rounded-lg">
                <Bot size={20} />
            </div>
            <div>
                <h3 className="font-bold text-sm">Bihari Chatkara AI</h3>
                <p className="text-[10px] text-indigo-100 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                    Connected to Live Data
                </p>
            </div>
        </div>
        <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/10 rounded">
          <ChevronDown size={20} />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                  : 'bg-white text-slate-700 border border-slate-200 shadow-sm rounded-tl-none'
              }`}
            >
              {msg.text.split('\n').map((line, i) => <p key={i} className="mb-1 last:mb-0">{line}</p>)}
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex justify-start">
            <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-indigo-600" />
                <span className="text-xs text-slate-500 font-medium">Analyzing data...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Presets */}
      {messages.length < 3 && (
        <div className="px-4 pb-2 bg-slate-50 flex gap-2 overflow-x-auto no-scrollbar">
            <button onClick={() => handlePresetClick("How much revenue today?")} className="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-full text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 whitespace-nowrap transition-colors">
                💰 Revenue Today?
            </button>
            <button onClick={() => handlePresetClick("Any low stock items?")} className="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-full text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 whitespace-nowrap transition-colors">
                ⚠️ Low Stock?
            </button>
            <button onClick={() => handlePresetClick("Suggest a special using Tomatoes")} className="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-full text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 whitespace-nowrap transition-colors">
                🍅 Recipe Idea
            </button>
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 bg-white rounded-b-2xl">
        <div className="relative flex items-center">
            <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask anything..."
            className="w-full pl-4 pr-12 py-3 bg-slate-100 border-transparent focus:bg-white border focus:border-indigo-500 rounded-xl text-sm transition-all outline-none"
            />
            <button 
                type="submit" 
                disabled={!inputText.trim() || isThinking}
                className="absolute right-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:bg-slate-400 transition-colors"
            >
                <Send size={16} />
            </button>
        </div>
      </form>
    </div>
  );
};

export default AiAssistant;
