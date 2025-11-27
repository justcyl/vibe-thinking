
import React, { useState, useRef, useEffect } from 'react';
import { AgentMessage, Theme, NodeType, ModelId, Conversation } from '../types';
import { Send, Bot, X, Paperclip, File, Plus, ChevronDown, History, Layout, Trash2, MessageSquare } from 'lucide-react';
import { LABELS, MODEL_OPTIONS } from '../constants';

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
  // 对话管理
  currentConversation: Conversation | null;
  conversations: Conversation[];
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  showHistory: boolean;
  onShowHistoryChange: (show: boolean) => void;
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
  currentConversation,
  conversations,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  showHistory,
  onShowHistoryChange
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

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const pos = e.target.selectionStart || 0;
    setInput(value);
    setCursorPosition(pos);

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

  // Style Constants
  const bgClass = theme === 'dark' ? 'bg-[#1e1e1e]' : 'bg-neutral-50';
  const textClass = theme === 'dark' ? 'text-[#cccccc]' : 'text-neutral-800';
  const borderClass = theme === 'dark' ? 'border-[#333333]' : 'border-neutral-200';
  const footerBg = theme === 'dark' ? 'bg-[#1e1e1e]' : 'bg-white';
  const dropdownBg = theme === 'dark' ? 'bg-[#252526]' : 'bg-white';
  const dropdownHover = theme === 'dark' ? 'hover:bg-[#2a2d2e]' : 'hover:bg-neutral-100';
  const userMsgClass = theme === 'dark' ? 'text-[#9cdcfe] bg-[#252526]' : 'text-blue-800 bg-blue-50';
  const botMsgClass = theme === 'dark' ? 'text-[#d4d4d4]' : 'text-neutral-900';

  const selectedModelInfo = MODEL_OPTIONS.find(m => m.id === selectedModel) || MODEL_OPTIONS[0];

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`h-full flex flex-col overflow-hidden font-mono text-xs ${bgClass} ${textClass}`} style={{ width: '100%' }}>

      {/* Header */}
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
          {/* History Button */}
          <button
            onClick={() => onShowHistoryChange(!showHistory)}
            className={`p-1.5 rounded transition-colors ${showHistory ? 'bg-white/20' : ''} ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
            title="对话历史"
          >
            <History size={14} />
          </button>
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

      {/* History Panel */}
      {showHistory ? (
        <div className="flex-1 overflow-y-auto">
          <div className={`px-3 py-2 border-b ${borderClass} ${theme === 'dark' ? 'bg-[#252526]' : 'bg-neutral-100'}`}>
            <span className="text-[10px] font-bold uppercase opacity-70">对话历史</span>
          </div>
          {conversations.length === 0 ? (
            <div className="p-4 text-center opacity-40">
              <p>暂无对话历史</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {conversations.map(conv => (
                <div
                  key={conv.id}
                  className={`p-3 cursor-pointer transition-colors ${dropdownHover} ${
                    conv.id === currentConversation?.id ? (theme === 'dark' ? 'bg-white/10' : 'bg-black/5') : ''
                  }`}
                  onClick={() => onSelectConversation(conv.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <MessageSquare size={10} className="opacity-50 flex-shrink-0" />
                        <span className="font-medium truncate">{conv.title}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[9px] opacity-50">
                        <Layout size={8} />
                        <span className="truncate">{conv.canvasName}</span>
                        <span>·</span>
                        <span>{formatTime(conv.updatedAt)}</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(conv.id);
                      }}
                      className="p-1 opacity-30 hover:opacity-100 hover:text-red-400 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Canvas Context Indicator - 只有当对话有消息时才显示 */}
          {currentConversation && currentConversation.messages.length > 0 && (
            <div className={`px-3 py-2 border-b flex items-center gap-2 ${borderClass} ${theme === 'dark' ? 'bg-[#252526]' : 'bg-neutral-100'}`}>
              <Layout size={12} className="opacity-50 flex-shrink-0" />
              <span className="text-[10px] truncate">
                已将画布 <span className="font-medium text-green-500">{currentConversation.canvasName}</span> 加入到上下文
              </span>
            </div>
          )}

          {/* Messages Log */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6">
            {messages.length === 0 && (
               <div className="mt-10 px-4 text-center opacity-40">
                   <p className="leading-relaxed">{LABELS.agentWelcome}</p>
                   <p className="text-[10px] mt-2">发送消息开始新对话，将自动绑定当前画布</p>
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

          {/* Footer Input */}
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
        </>
      )}
    </div>
  );
};
