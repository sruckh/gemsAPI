import React, { useState, useRef, useEffect } from 'react';
import { Gem, ChatMessage, AppConfig } from '../types';
import { generateGemResponse } from '../services/geminiService';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface GemChatProps {
  gems: Gem[];
  config: AppConfig;
}

const GemChat: React.FC<GemChatProps> = ({ gems, config }) => {
  const [selectedGemId, setSelectedGemId] = useState<string>('');
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedGem = gems.find(g => g.id === selectedGemId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleGemChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedGemId(e.target.value);
    setMessages([]); // Clear chat when switching gems
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !selectedGem) return;

    const userMsg: ChatMessage = {
      role: 'user',
      text: prompt,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setPrompt('');
    setIsProcessing(true);

    try {
      const responseText = await generateGemResponse(
        config.geminiApiKey,
        'gemini-3-pro-preview',
        selectedGem.instructions,
        userMsg.text
      );

      const aiMsg: ChatMessage = {
        role: 'model',
        text: responseText,
        timestamp: Date.now()
      };
      
      setMessages(prev => [...prev, aiMsg]);
    } catch (error: any) {
      const errorMsg: ChatMessage = {
        role: 'model',
        text: `**Error:** ${error.message || 'Something went wrong.'}`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  if (gems.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
        <Sparkles size={48} className="mb-4 text-gray-300 dark:text-gray-600" />
        <p>No Gems available.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors duration-200">
      {/* Header / Selector */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-between z-10">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex flex-col flex-1 max-w-md">
            <label className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider mb-1">Active Gem</label>
            <select
              value={selectedGemId}
              onChange={handleGemChange}
              className="bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 border border-gray-300 dark:border-gray-600"
            >
              <option value="" disabled>-- Select a Gem --</option>
              {gems.map(gem => (
                <option key={gem.id} value={gem.id}>{gem.name}</option>
              ))}
            </select>
          </div>
          {selectedGem && (
            <div className="hidden md:block text-gray-500 dark:text-gray-400 text-sm border-l border-gray-200 dark:border-gray-700 pl-4 ml-2">
              {selectedGem.description}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-white dark:bg-gray-800">
        {!selectedGem && (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 opacity-60">
            <Bot size={64} className="mb-4 text-gray-300 dark:text-gray-600" />
            <p className="text-lg text-gray-500 dark:text-gray-400">Select a Gem to start chatting</p>
          </div>
        )}

        {selectedGem && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-500 opacity-80">
            <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
              <Sparkles className="text-blue-500 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-medium text-gray-800 dark:text-gray-200 mb-2">Hello!</h3>
            <p>I am ready to act as <strong>{selectedGem.name}</strong>.</p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'model' && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex-shrink-0 flex items-center justify-center mt-1">
                <Sparkles size={14} className="text-white" />
              </div>
            )}
            
            <div className={`max-w-[80%] rounded-2xl px-5 py-3 shadow-sm ${
              msg.role === 'user' 
                ? 'bg-[#1a73e8] text-white rounded-tr-sm' 
                : 'bg-[#f1f3f4] dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-tl-sm'
            }`}>
              {msg.role === 'model' ? (
                <div className="prose prose-sm max-w-none prose-p:text-gray-800 dark:prose-p:text-gray-100 prose-headings:text-gray-900 dark:prose-headings:text-white prose-strong:text-gray-900 dark:prose-strong:text-white prose-code:text-gray-900 dark:prose-code:text-white prose-a:text-blue-600 dark:prose-a:text-blue-400">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.text}</p>
              )}
            </div>
          </div>
        ))}
        
        {isProcessing && (
          <div className="flex gap-4 justify-start">
             <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex-shrink-0 flex items-center justify-center">
                <Sparkles size={14} className="text-white" />
              </div>
              <div className="bg-[#f1f3f4] dark:bg-gray-700 rounded-2xl rounded-tl-sm px-5 py-4 flex items-center">
                 <div className="flex space-x-2">
                    <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                 </div>
              </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <form onSubmit={handleSend} className="relative flex items-center max-w-4xl mx-auto bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-white dark:hover:bg-gray-600 hover:shadow-md border border-transparent hover:border-gray-200 dark:hover:border-gray-500 transition-all duration-200">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={selectedGem ? `Message ${selectedGem.name}...` : "Select a gem first..."}
            disabled={!selectedGem || isProcessing}
            className="flex-1 bg-transparent text-gray-800 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 py-3.5 pl-6 pr-14 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button 
            type="submit" 
            disabled={!selectedGem || !prompt.trim() || isProcessing}
            className="absolute right-2 p-2 text-[#1a73e8] dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full disabled:text-gray-400 dark:disabled:text-gray-500 disabled:hover:bg-transparent transition-colors"
          >
            <Send size={20} />
          </button>
        </form>
        <div className="text-center mt-2">
             <p className="text-[10px] text-gray-400 dark:text-gray-500">Gemini may display inaccurate info, including about people, so double-check its responses.</p>
        </div>
      </div>
    </div>
  );
};

export default GemChat;