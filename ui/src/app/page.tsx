'use client';

import { useState, useEffect, useRef } from 'react';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  sources?: Array<{ text: string; source: string }>;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      isUser: true,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: input }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.answer,
        isUser: false,
        sources: data.sources,
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Unable to process your F1 query at the moment. Please check your connection and try again.',
        isUser: false,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-10">
        <div className="absolute inset-0 bg-gradient-to-br from-red-600/20 via-transparent to-red-900/20"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,24,1,0.1),transparent_50%)]"></div>
      </div>
      
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="backdrop-blur-xl bg-black/80 border-b border-red-600/20 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="relative">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-r from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-600/25">
                  <span className="text-white font-black text-sm sm:text-lg tracking-tighter">F1</span>
                </div>
                <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-red-600 rounded-xl blur opacity-25"></div>
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  Knowledge Assistant
                </h1>
                <p className="text-gray-400 text-xs sm:text-sm font-medium">AI-Powered Formula 1 Expert</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-xs sm:text-sm text-gray-400 font-medium">Live</span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-4 sm:px-6 py-4 sm:py-8">
          {/* Chat Container */}
          <div className="flex-1 backdrop-blur-xl bg-white/5 rounded-2xl sm:rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
            {/* Messages */}
            <div className="h-[calc(100vh-240px)] sm:h-[calc(100vh-280px)] overflow-y-auto p-4 sm:p-8 space-y-4 sm:space-y-6 chat-container">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-8">
                  <div className="relative">
                    <div className="w-24 h-24 bg-gradient-to-r from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-xl shadow-red-600/25">
                      <span className="text-white font-black text-3xl tracking-tighter">F1</span>
                    </div>
                    <div className="absolute -inset-2 bg-gradient-to-r from-red-500 to-red-600 rounded-2xl blur opacity-20 animate-pulse"></div>
                  </div>
                  <div className="space-y-4 max-w-lg">
                    <h2 className="text-3xl font-black bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                      Welcome to F1 AI
                    </h2>
                    <p className="text-gray-400 text-lg leading-relaxed">
                      Ask me anything about drivers, teams, races, or championships. I have comprehensive data from recent F1 seasons.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 pt-4">
                      {[
                        "Who won the 2024 championship?",
                        "Max Verstappen stats",
                        "Latest race results",
                        "Team standings"
                      ].map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => setInput(suggestion)}
                          className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 border border-white/10 hover:border-red-500/50 rounded-full transition-all duration-300 text-gray-300 hover:text-white"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-start space-x-3 max-w-2xl ${message.isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <div className="w-8 h-8 bg-gradient-to-r from-red-500 to-red-600 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-white font-bold text-sm">{message.isUser ? 'YOU' : 'AI'}</span>
                    </div>
                    <div
                      className={`relative px-6 py-4 rounded-2xl shadow-lg ${
                        message.isUser
                          ? 'bg-gradient-to-r from-red-500 to-red-600 text-white'
                          : 'bg-white/10 backdrop-blur-sm text-gray-100 border border-white/10'
                      }`}
                    >
                      <p className="text-sm leading-relaxed font-medium whitespace-pre-wrap">{message.text}</p>
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-white/20">
                          <p className="text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wide">Sources</p>
                          <div className="space-y-2">
                            {message.sources.map((source, index) => (
                              <div key={index} className="text-xs bg-black/20 rounded-lg px-3 py-2 border border-white/10">
                                <span className="font-semibold text-red-300">{source.source}:</span>
                                <span className="text-gray-300 ml-2">{source.text}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-red-500 to-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">AI</span>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm text-gray-100 border border-white/10 px-6 py-4 rounded-2xl shadow-lg">
                      <div className="flex items-center space-x-3">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-red-400 rounded-full animate-bounce loading-dot"></div>
                          <div className="w-2 h-2 bg-red-400 rounded-full animate-bounce loading-dot"></div>
                          <div className="w-2 h-2 bg-red-400 rounded-full animate-bounce loading-dot"></div>
                        </div>
                        <p className="text-sm font-medium text-gray-300">Analyzing F1 data...</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 sm:p-6 border-t border-white/10 backdrop-blur-sm">
              <form onSubmit={handleSubmit} className="flex items-center space-x-3 sm:space-x-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about drivers, teams, races..."
                    className="w-full bg-white/5 border border-white/20 rounded-xl sm:rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 backdrop-blur-sm transition-all duration-300 text-sm sm:text-base"
                    disabled={isLoading}
                  />
                  <div className="absolute inset-0 rounded-xl sm:rounded-2xl bg-gradient-to-r from-red-500/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                </div>
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="group relative px-4 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold rounded-xl sm:rounded-2xl transition-all duration-300 transform hover:scale-105 disabled:scale-100 disabled:opacity-50 shadow-lg shadow-red-600/25 hover:shadow-red-500/40 text-sm sm:text-base"
                >
                  <span className="relative z-10 flex items-center space-x-2">
                    <span>{isLoading ? 'Sending' : 'Send'}</span>
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </span>
                  <div className="absolute inset-0 rounded-xl sm:rounded-2xl bg-gradient-to-r from-red-400 to-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </button>
              </form>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="text-center py-6">
          <p className="text-gray-500 text-sm font-medium">
            Powered by <span className="text-red-400">AWS Bedrock</span> & <span className="text-red-400">OpenRouter</span> with comprehensive F1 data
          </p>
        </footer>
      </div>
    </div>
  );
}
