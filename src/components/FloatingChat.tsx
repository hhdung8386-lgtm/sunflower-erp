import React, { useState, useEffect, useRef } from 'react';
import { dbService, UserProfile } from '../services/firebaseService';
import { useLanguage } from '../context/LanguageContext';

interface FloatingChatProps {
  currentUser: UserProfile;
  type: 'po' | 'lsx';
  targetId: string;
  targetCode: string;
  messages: any[];
  users: UserProfile[];
}

export const FloatingChat: React.FC<FloatingChatProps> = ({
  currentUser,
  type,
  targetId,
  targetCode,
  messages,
  users
}) => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [allPos, setAllPos] = useState<any[]>([]);
  const [allLsx, setAllLsx] = useState<any[]>([]);

  // Suggestion states
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionType, setSuggestionType] = useState<'member' | 'task'>('member');
  const [suggestionQuery, setSuggestionQuery] = useState('');
  const [suggestionTriggerIndex, setSuggestionTriggerIndex] = useState(-1);

  // Load POs and LSX when panel opens
  useEffect(() => {
    if (isOpen) {
      dbService.getCollection('pos').then(setAllPos);
      dbService.getCollection('production_commands').then(setAllLsx);
    }
  }, [isOpen]);

  // Monitor text typing for @ and # triggers
  useEffect(() => {
    const triggerMatch = messageText.match(/([@#])([a-zA-Z0-9-]*)$/);
    if (triggerMatch) {
      const char = triggerMatch[1];
      const queryStr = triggerMatch[2];
      const index = triggerMatch.index ?? -1;
      
      setSuggestionType(char === '@' ? 'member' : 'task');
      setSuggestionQuery(queryStr);
      setSuggestionTriggerIndex(index);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  }, [messageText]);

  // Filter items
  const getFilteredSuggestions = () => {
    if (suggestionType === 'member') {
      return (users || []).filter(u => 
        u.displayName.toLowerCase().includes(suggestionQuery.toLowerCase()) ||
        u.role.toLowerCase().includes(suggestionQuery.toLowerCase())
      );
    } else {
      const matchedPos = (allPos || [])
        .filter(p => p.poCode.toLowerCase().includes(suggestionQuery.toLowerCase()))
        .map(p => ({ id: p.id, code: p.poCode, type: 'PO', label: `${p.poCode} (${p.customerName})` }));
        
      const matchedLsx = (allLsx || [])
        .filter(l => l.lsxCode?.toLowerCase().includes(suggestionQuery.toLowerCase()))
        .map(l => ({ id: l.id, code: l.lsxCode, type: 'LSX', label: `${l.lsxCode} (${l.productName})` }));
        
      return [...matchedPos, ...matchedLsx];
    }
  };

  const filteredSuggestions = getFilteredSuggestions();

  const handleSelectSuggestion = (item: any) => {
    const beforeTrigger = messageText.substring(0, suggestionTriggerIndex);
    const replacement = suggestionType === 'member' 
      ? `@${item.displayName} ` 
      : `${item.code} `;
    
    setMessageText(beforeTrigger + replacement);
    setShowSuggestions(false);
  };

  // Filter messages for this specific target
  const chatMessages = messages.filter(
    msg => msg.type === type && msg.targetId === targetId
  );

  // Scroll to bottom when chat opens or new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      localStorage.setItem(`erp_last_read_floating_${targetId}`, new Date().toISOString());
      scrollToBottom();
    }
  }, [isOpen, chatMessages.length]);

  // Compute unread count
  const getUnreadCount = () => {
    if (isOpen) return 0;
    const lastReadStr = localStorage.getItem(`erp_last_read_floating_${targetId}`);
    if (!lastReadStr) return chatMessages.length; // If never read, all are unread
    
    const lastReadTime = new Date(lastReadStr).getTime();
    return chatMessages.filter(
      msg => msg.senderId !== currentUser.uid && new Date(msg.createdAt).getTime() > lastReadTime
    ).length;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    const newMessage = {
      type,
      targetId,
      senderId: currentUser.uid,
      senderName: currentUser.displayName,
      senderRole: currentUser.role,
      messageText: messageText.trim(),
      createdAt: new Date().toISOString()
    };

    await dbService.addDocument('messages', newMessage);
    setMessageText('');
    localStorage.setItem(`erp_last_read_floating_${targetId}`, new Date().toISOString());
    setTimeout(scrollToBottom, 50);
  };

  const unreadCount = getUnreadCount();

  if (!isOpen) {
    return (
      <div className="floating-chat-container">
        <button className="floating-chat-bubble" onClick={() => setIsOpen(true)}>
          <span>💬 Chat {targetCode}</span>
          {unreadCount > 0 && <span className="floating-chat-badge">{unreadCount}</span>}
        </button>
      </div>
    );
  }

  return (
    <div className="floating-chat-container">
      <div className="floating-chat-panel">
        <div className="floating-chat-header">
          <span>💬 Chat: {targetCode}</span>
          <button onClick={() => setIsOpen(false)}>✕</button>
        </div>
        
        <div className="floating-chat-body">
          {chatMessages.map(msg => {
            const isMe = msg.senderId === currentUser.uid;
            return (
              <div 
                key={msg.id} 
                className={`chat-message-row ${isMe ? 'me' : 'other'}`}
                style={{ maxWidth: '85%' }}
              >
                <div className="chat-message-meta" style={{ fontSize: '10px' }}>
                  <span style={{ fontWeight: 600 }}>{msg.senderName}</span>
                  <span>•</span>
                  <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div 
                  className="chat-message-bubble"
                  style={{ 
                    padding: '8px 12px', 
                    fontSize: '12.5px',
                    backgroundColor: isMe ? 'var(--color-primary)' : '#ffffff',
                    color: isMe ? '#ffffff' : 'var(--color-text-main)',
                    border: isMe ? 'none' : '1px solid var(--color-border-light)'
                  }}
                >
                  {msg.messageText}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
          {chatMessages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '12px' }}>
              {t('Chưa có tin nhắn nào.')}
            </div>
          )}
        </div>

        <div style={{ position: 'relative' }}>
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="chat-suggestions-popup" style={{ width: '260px', left: '5px' }}>
              <div className="chat-suggestion-header">
                {suggestionType === 'member' ? t('Gợi ý tag nhân viên') : t('Gợi ý mã liên kết')}
              </div>
              {filteredSuggestions.map((item: any) => (
                <div 
                  key={item.id} 
                  className="chat-suggestion-item"
                  onClick={() => handleSelectSuggestion(item)}
                >
                  <span className="chat-suggestion-item-main">
                    {suggestionType === 'member' ? `@${item.displayName}` : item.code}
                  </span>
                  <span className="chat-suggestion-item-sub">
                    {suggestionType === 'member' ? t(item.role.toUpperCase()) : item.label}
                  </span>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={handleSendMessage} className="floating-chat-input-area">
            <input
              type="text"
              placeholder={t('Nhập tin nhắn... (Gõ @ hoặc #)')}
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary btn-sm">
              {t('Gửi')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
