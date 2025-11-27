
import React, { useState, useRef, useEffect } from 'react';
import { AgentMessage, Theme, NodeType, ModelId } from '../types';
import { Send, Bot, X, Paperclip, File, Trash2, Sparkles, Plus, ChevronDown } from 'lucide-react';
import { LABELS, NODE_ICONS, MODEL_OPTIONS } from '../constants';

interface AgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: AgentMessage[];
  onSendMessage: (text: string) => void;
  isProcessing: boolean;
  theme: Theme;
  availableNodes: { id: string; type: NodeType; content: string }[];
  selectedModel: ModelId;
  onModelChange: (model: ModelId) => void;
  onNewConversation: () => void;
}

export const AgentPanel: React.FC<AgentPanelProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  isProcessing,
  theme,
  availableNodes,
  selectedModel,
  onModelChange,
  onNewConversation
}) => {
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionQuery, setSuggestionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  // --- Handle Input Change & Mentions ---
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const pos = e.target.selectionStart || 0;
    setInput(value);
    setCursorPosition(pos);

    // Check for @ trigger
    const lastAtPos = value.lastIndexOf('@', pos - 1);
    if (lastAtPos !== -1) {
        const textAfterAt = value.slice(lastAtPos + 1, pos);
        if (!textAfterAt.includes(' ')) {
            setShowSuggestions(true);
            setSuggestionQuery(textAfterAt);
            return;
        }
    }
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
          if (!showSuggestions) {
            e.preventDefault();
            handleSubmit(e);
          }
      }
  };

  const handleSelectSuggestion = (node: { id: string, content: string, type: NodeType }) => {
      const lastAtPos = input.lastIndexOf('@', cursorPosition - 1);
      if (lastAtPos !== -1) {
          const before = input.slice(0, lastAtPos);
          const after = input.slice(cursorPosition);
          const tag = `@[${node.content}]`; 
          const newValue = before + tag + after;
          setInput(newValue);
          setShowSuggestions(false);
          setTimeout(() => {
              if (inputRef.current) {
                  inputRef.current.focus();
                  const newPos = lastAtPos + tag.length;
                  inputRef.current.setSelectionRange(newPos, newPos);
              }
          }, 0);
      }
  };

  const filteredSuggestions = availableNodes.filter(node => 
      node.content.toLowerCase().includes(suggestionQuery.toLowerCase())
  ).slice(0, 5);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setAttachment(e.target.files[0]);
      }
  };

  const handleRemoveAttachment = () => {
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent | React.KeyboardEvent) => {
    if ((input.trim() || attachment) && !isProcessing) {
      let finalMessage = input.trim();
      if (attachment) {
          finalMessage += `\n\n[Attachment: ${attachment.name}]`;
      }
      onSendMessage(finalMessage);
      setInput('');
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setShowSuggestions(false);
    }
  };

  if (!isOpen) return null;

  // Codex / Dark IDE Style Constants
  const bgClass = theme === 'dark' ? 'bg-[#1e1e1e]' : 'bg-neutral-50';
  const textClass = theme === 'dark' ? 'text-[#cccccc]' : 'text-neutral-800';
  const borderClass = theme === 'dark' ? 'border-[#333333]' : 'border-neutral-200';
  const footerBg = theme === 'dark' ? 'bg-[#1e1e1e]' : 'bg-white';
  const dropdownBg = theme === 'dark' ? 'bg-[#252526]' : 'bg-white';
  const dropdownHover = theme === 'dark' ? 'hover:bg-[#2a2d2e]' : 'hover:bg-neutral-100';
  
  // Bubbles - Removed chat style, using log style
  const userMsgClass = theme === 'dark' ? 'text-[#9cdcfe] bg-[#252526]' : 'text-blue-800 bg-blue-50';
  const botMsgClass = theme === 'dark' ? 'text-[#d4d4d4]' : 'text-neutral-900';

  const selectedModelInfo = MODEL_OPTIONS.find(m => m.id === selectedModel) || MODEL_OPTIONS[0];

  return (
    <div className={`h-full flex flex-col overflow-hidden font-mono text-xs ${bgClass} ${textClass}`} style={{ width: '100%' }}>

      {/* Header - With Model Selector and New Chat */}
      <div className={`h-10 flex items-center justify-between px-3 border-b flex-shrink-0 ${borderClass} bg-opacity-50`}>
        <div className="flex items-center gap-2">
          {/* Model Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] transition-colors ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
            >
              <Bot size={12} />
              <span className="font-medium">{selectedModelInfo.name}</span>
              <ChevronDown size={10} className={`transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showModelDropdown && (
              <div className={`absolute top-full left-0 mt-1 min-w-[180px] border shadow-lg z-50 ${dropdownBg} ${borderClass}`}>
                {MODEL_OPTIONS.map(model => (
                  <button
                    key={model.id}
                    onClick={() => {
                      onModelChange(model.id as ModelId);
                      setShowModelDropdown(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left ${dropdownHover} ${
                      model.id === selectedModel ? (theme === 'dark' ? 'bg-white/5' : 'bg-black/5') : ''
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{model.name}</span>
                      <span className="text-[9px] opacity-50">{model.provider}</span>
                    </div>
                    {model.id === selectedModel && (
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* New Conversation Button */}
          <button
            onClick={onNewConversation}
            className={`p-1.5 rounded transition-colors ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
            title="新建对话"
          >
            <Plus size={14} />
          </button>
          {/* Close Button */}
          <button onClick={onClose} className={`p-1.5 rounded transition-colors ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Messages Log */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && (
           <div className="mt-10 px-4 text-center opacity-40">
               <p className="leading-relaxed">{LABELS.agentWelcome}</p>
           </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col gap-1`}>
             <div className={`text-[10px] uppercase tracking-widest opacity-40 mb-0.5`}>
                {msg.role === 'user' ? 'USER' : 'ASSISTANT'}
             </div>
             
             <div className={`whitespace-pre-wrap leading-relaxed p-2 ${msg.role === 'user' ? `${userMsgClass} border border-transparent` : `${botMsgClass}`}`}>
               {msg.content}
             </div>
          </div>
        ))}

        {isProcessing && (
           <div className="flex items-center gap-2 opacity-50 mt-2">
               <div className="w-1.5 h-1.5 bg-current animate-pulse" />
               <span className="text-[10px] uppercase">Processing...</span>
           </div>
        )}
      </div>

      {/* Footer Input - IDE Style */}
      <div className={`flex-shrink-0 p-3 border-t ${borderClass} ${footerBg} relative`}>
        
        {/* Suggestions Popover */}
        {showSuggestions && filteredSuggestions.length > 0 && (
            <div className={`absolute bottom-full left-3 right-3 mb-1 max-h-40 overflow-y-auto border shadow-xl z-50 ${theme === 'dark' ? 'bg-[#252526] border-[#454545] text-[#cccccc]' : 'bg-white border-neutral-200'}`}>
                {filteredSuggestions.map(node => (
                    <div 
                        key={node.id}
                        onClick={() => handleSelectSuggestion(node)}
                        className={`flex items-center gap-2 p-2 cursor-pointer hover:bg-white/10 border-b border-white/5 last:border-0`}
                    >
                        <span className="opacity-50 text-[10px]">{node.type.substr(0,3)}</span>
                        <span className="truncate">{node.content}</span>
                    </div>
                ))}
            </div>
        )}

        {/* Attachment Chip */}
        {attachment && (
            <div className={`flex items-center gap-2 mb-2 px-2 py-1 w-fit text-[10px] border ${theme === 'dark' ? 'bg-[#2d2d2d] border-[#3e3e3e]' : 'bg-neutral-100 border-neutral-200'}`}>
                <File size={10} />
                <span className="max-w-[150px] truncate">{attachment.name}</span>
                <button onClick={handleRemoveAttachment} className="hover:text-red-400">
                    <X size={10} />
                </button>
            </div>
        )}

        {/* Input Row */}
        <div className="flex items-end gap-2">
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="pb-2 opacity-50 hover:opacity-100 transition-opacity"
                title="Attach File"
            >
                <Paperclip size={14} />
            </button>

            <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={LABELS.agentPlaceholder}
                className={`flex-1 bg-transparent outline-none resize-none leading-relaxed py-1 ${theme === 'dark' ? 'placeholder-white/20' : 'placeholder-black/30'}`}
                rows={1}
                disabled={isProcessing}
            />
            
            <button 
                onClick={handleSubmit}
                disabled={!input.trim() && !attachment}
                className={`pb-2 transition-opacity ${(!input.trim() && !attachment) ? 'opacity-20' : 'opacity-100 hover:text-blue-400'}`}
            >
                <Send size={14} />
            </button>
        </div>
      </div>
    </div>
  );
};
