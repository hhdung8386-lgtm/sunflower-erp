import React, { useState, useEffect, useRef } from 'react';
import { dbService, UserProfile } from '../services/firebaseService';
import { useLanguage } from '../context/LanguageContext';
import { getPOQueueLabel } from '../domain/poWorkflow';
import { Plus } from 'lucide-react';

interface ChatPageProps {
  currentUser: UserProfile;
  messages: any[];
  pos: any[];
  productionCommands: any[];
  onNavigateToPO: (poId: string) => void;
  onNavigateToLSX: (lsxId: string) => void;
  users: UserProfile[];
  channels: any[];
}

export const ChatPage: React.FC<ChatPageProps> = ({
  currentUser,
  messages,
  pos,
  productionCommands,
  onNavigateToPO,
  onNavigateToLSX,
  users,
  channels
}) => {
  const { t } = useLanguage();
  const [activeChannelId, setActiveChannelId] = useState<string>('all');
  const [messageText, setMessageText] = useState('');
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [newChannelMembers, setNewChannelMembers] = useState<string[]>([]);
  
  const [editChannelName, setEditChannelName] = useState('');
  const [editChannelDesc, setEditChannelDesc] = useState('');
  const [editChannelMembers, setEditChannelMembers] = useState<string[]>([]);

  const handleCreateChannelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName.trim()) return;

    const newChannel = {
      name: newChannelName.trim(),
      desc: newChannelDesc.trim(),
      members: [...newChannelMembers, currentUser.uid], // Creator is always a member
      roles: [],
      createdBy: currentUser.uid,
      createdAt: new Date().toISOString()
    };

    const created = await dbService.addDocument('channels', newChannel);
    if (created) {
      setActiveChannelId(created.id);
    }
    setShowCreateModal(false);
  };

  const handleEditChannelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editChannelName.trim() || !activeChannelId) return;

    await dbService.updateDocument('channels', activeChannelId, {
      name: editChannelName.trim(),
      desc: editChannelDesc.trim(),
      members: editChannelMembers
    });

    setShowEditModal(false);
  };

  const handleToggleMember = (userId: string, isEdit: boolean) => {
    if (userId === currentUser.uid && isEdit) {
      // Creator/Admin cannot remove themselves from membership
      return;
    }
    if (isEdit) {
      setEditChannelMembers(prev => 
        prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
      );
    } else {
      setNewChannelMembers(prev => 
        prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
      );
    }
  };

  const handleRecallMessage = async (msgId: string) => {
    if (window.confirm(t('Bạn có chắc chắn muốn thu hồi tin nhắn này?'))) {
      await dbService.updateDocument('messages', msgId, { recalled: true });
    }
  };

  // Auto-complete suggestions states
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionType, setSuggestionType] = useState<'member' | 'task'>('member');
  const [suggestionQuery, setSuggestionQuery] = useState('');
  const [suggestionTriggerIndex, setSuggestionTriggerIndex] = useState(-1);

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
      const matchedPos = (pos || [])
        .filter(p => p.poCode.toLowerCase().includes(suggestionQuery.toLowerCase()))
        .map(p => ({ id: p.id, code: p.poCode, type: 'PO', label: `${p.poCode} (${p.customerName})` }));
        
      const matchedLsx = (productionCommands || [])
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

  // Filter channels based on current user role or explicit membership
  const availableChannels = (channels || []).filter(ch => {
    const hasRoleAccess = ch.roles ? ch.roles.includes(currentUser.role) : false;
    const hasMemberAccess = ch.members ? ch.members.includes(currentUser.uid) : false;
    const isCreator = ch.createdBy === currentUser.uid;
    const isAdmin = currentUser.role === 'admin';
    return hasRoleAccess || hasMemberAccess || isCreator || isAdmin;
  });

  // Mark active channel as read
  useEffect(() => {
    localStorage.setItem(`erp_last_read_ch_${currentUser.uid}_${activeChannelId}`, new Date().toISOString());
    scrollToBottom();
  }, [activeChannelId, currentUser.uid, messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    const newMessage = {
      type: 'channel',
      targetId: activeChannelId,
      senderId: currentUser.uid,
      senderName: currentUser.displayName,
      senderRole: currentUser.role,
      messageText: messageText.trim(),
      createdAt: new Date().toISOString(),
      ...(replyingTo ? {
        replyTo: {
          id: replyingTo.id,
          senderName: replyingTo.senderName,
          text: replyingTo.messageText
        }
      } : {})
    };

    await dbService.addDocument('messages', newMessage);
    setMessageText('');
    setReplyingTo(null);
    localStorage.setItem(`erp_last_read_ch_${currentUser.uid}_${activeChannelId}`, new Date().toISOString());
    setTimeout(scrollToBottom, 50);
  };

  // Helper to parse message text for PO or LSX codes and retrieve matching documents
  const renderMessageContent = (msgText: string) => {
    // Simple text split to render links if any
    const poRegex = /PO-\d{4}-\d{4}/g;
    const lsxRegex = /LSX-\d{4}-\d{4}/g;

    const poMatches = msgText.match(poRegex) || [];
    const lsxMatches = msgText.match(lsxRegex) || [];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span>{msgText}</span>
        
        {/* Render PO Link Cards */}
        {poMatches.map(poCode => {
          const po = pos.find(p => p.poCode === poCode);
          if (!po) return null;
          return (
            <div key={po.id} className="chat-task-card">
              <span className="chat-task-card-title">{t('Đơn Hàng')} {poCode}</span>
              <span className="chat-task-card-desc">{po.customerName} - {po.items?.[0]?.productName || t('Tem Nhãn')} ({t(getPOQueueLabel(po))})</span>
              <button 
                type="button" 
                className="chat-task-card-btn"
                onClick={() => onNavigateToPO(po.id)}
              >
                {t('Xem Chi Tiết Đơn Hàng')} →
              </button>
            </div>
          );
        })}

        {/* Render LSX Link Cards */}
        {lsxMatches.map(lsxCode => {
          const lsx = productionCommands.find(l => l.lsxCode === lsxCode);
          if (!lsx) return null;
          return (
            <div key={lsx.id} className="chat-task-card">
              <span className="chat-task-card-title">{t('Lệnh Sản Xuất')} {lsxCode}</span>
              <span className="chat-task-card-desc">{lsx.productName} - Qty: {lsx.qtyToProduce?.toLocaleString()} ({t(lsx.status)})</span>
              <button 
                type="button" 
                className="chat-task-card-btn"
                onClick={() => onNavigateToLSX(lsx.id)}
              >
                {t('Xem Lệnh Sản Xuất')} →
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  // Get unread count for a channel
  const getUnreadCount = (channelId: string) => {
    const lastReadStr = localStorage.getItem(`erp_last_read_ch_${currentUser.uid}_${channelId}`);
    if (!lastReadStr) {
      return messages.filter(message => (
        message.type === 'channel'
        && message.targetId === channelId
        && message.senderId !== currentUser.uid
      )).length;
    }
    const lastReadTime = new Date(lastReadStr).getTime();

    return messages.filter(
      msg => 
        msg.type === 'channel' && 
        msg.targetId === channelId && 
        msg.senderId !== currentUser.uid &&
        new Date(msg.createdAt).getTime() > lastReadTime
    ).length;
  };

  const activeChannel = availableChannels.find(ch => ch.id === activeChannelId) || availableChannels[0];
  const channelMessages = messages.filter(msg => msg.type === 'channel' && msg.targetId === activeChannelId);

  return (
    <div className="chat-page-view" style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
      <div>
        <h1 className="page-title">{t('KÊNH THẢO LUẬN NỘI BỘ')}</h1>
        <p className="page-subtitle">{t('Hệ thống trao đổi thông tin phòng ban, kết nối trực tiếp đến Đơn Hàng PO và Lệnh Sản Xuất.')}</p>
      </div>

      <div className="chat-page-container">
        {/* Sidebar Kênh */}
        <div className="chat-channels-list">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', margin: 0 }}>
              {t('Kênh thảo luận')}
            </span>
            <button 
              type="button" 
              className="btn btn-sm btn-outline btn-symbol" 
              style={{ width: '24px', height: '24px', minWidth: '24px', borderRadius: '4px' }}
              onClick={() => {
                setNewChannelName('');
                setNewChannelDesc('');
                setNewChannelMembers([]);
                setShowCreateModal(true);
              }}
              title={t('Tạo kênh mới')}
            >
              <Plus size={12} />
            </button>
          </div>
          {availableChannels.map(ch => {
            const count = getUnreadCount(ch.id);
            return (
              <button
                key={ch.id}
                className={`chat-channel-btn ${activeChannelId === ch.id ? 'active' : ''}`}
                onClick={() => setActiveChannelId(ch.id)}
              >
                <span># {ch.name}</span>
                {count > 0 && <span className="chat-channel-badge">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Khung Chat */}
        <div className="chat-box-panel">
          <div className="chat-box-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '15px' }}># {activeChannel?.name}</span>
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: 0 }}>{activeChannel?.desc}</p>
            </div>
            {(currentUser.role === 'admin' || activeChannel?.createdBy === currentUser.uid) && activeChannel?.id !== 'all' && (
              <button 
                type="button" 
                className="btn btn-sm btn-outline"
                style={{ fontSize: '12px', padding: '4px 10px' }}
                onClick={() => {
                  setEditChannelName(activeChannel.name);
                  setEditChannelDesc(activeChannel.desc || '');
                  setEditChannelMembers(activeChannel.members || []);
                  setShowEditModal(true);
                }}
              >
                {t('Sửa kênh')}
              </button>
            )}
          </div>

          <div className="chat-messages-area">
            {channelMessages.map(msg => {
              const isMe = msg.senderId === currentUser.uid;
              return (
                <div key={msg.id} className={`chat-message-row ${isMe ? 'me' : 'other'}`}>
                  <div className="chat-message-meta" style={{ display: 'flex', gap: '6px', justifyContent: isMe ? 'flex-end' : 'flex-start', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600 }}>{msg.senderName}</span>
                    <span style={{ fontSize: '10px', opacity: 0.8 }}>({msg.senderRole.toUpperCase()})</span>
                    <span>•</span>
                    <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {!msg.recalled && (
                      <>
                        <span>•</span>
                        <button 
                          onClick={() => setReplyingTo(msg)}
                          style={{ border: 'none', background: 'none', color: 'var(--color-primary)', cursor: 'pointer', padding: 0, fontSize: '10px' }}
                        >
                          {t('Trả lời')}
                        </button>
                        {(isMe || currentUser.role === 'admin') && (
                          <>
                            <span>•</span>
                            <button 
                              onClick={() => handleRecallMessage(msg.id)}
                              style={{ border: 'none', background: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: 0, fontSize: '10px' }}
                            >
                              {t('Thu hồi')}
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  <div className="chat-message-bubble">
                    {msg.recalled ? (
                      <span style={{ fontStyle: 'italic', color: '#94a3b8' }}>
                        {t('Tin nhắn đã bị thu hồi')}
                      </span>
                    ) : (
                      <>
                        {msg.replyTo && (
                          <div style={{
                            padding: '4px 8px',
                            backgroundColor: isMe ? 'rgba(255, 255, 255, 0.15)' : '#f1f5f9',
                            borderRadius: '4px',
                            fontSize: '11px',
                            marginBottom: '6px',
                            borderLeft: '3px solid var(--color-primary)',
                            color: isMe ? '#e2e8f0' : 'var(--color-text-muted)',
                            fontStyle: 'italic',
                            maxWidth: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            <strong>@{msg.replyTo.senderName}:</strong> "{msg.replyTo.text}"
                          </div>
                        )}
                        {renderMessageContent(msg.messageText)}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
            {channelMessages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                {t('Chưa có tin nhắn nào trong kênh này. Hãy bắt đầu cuộc hội thoại!')}
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="chat-suggestions-popup">
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
            {replyingTo && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 12px',
                backgroundColor: '#f1f5f9',
                borderTop: '1px solid var(--color-border-light)',
                fontSize: '12px',
                color: 'var(--color-text-muted)',
                borderRadius: '4px 4px 0 0',
                margin: '0 10px -1px 10px'
              }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                  <strong>{t('Trả lời')} {replyingTo.senderName}:</strong> "{replyingTo.messageText}"
                </div>
                <button 
                  type="button" 
                  onClick={() => setReplyingTo(null)}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    padding: '0 4px'
                  }}
                >
                  ×
                </button>
              </div>
            )}
            <form onSubmit={handleSendMessage} className="chat-input-bar">
              <input
                type="text"
                className="chat-input-field"
                placeholder={t('Nhập nội dung... (Gõ @ để tag nhân viên, # để gọi đơn hàng PO/LSX)')}
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px', fontWeight: 600 }}>
                {t('Gửi')}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* CREATE CHANNEL MODAL */}
      {showCreateModal && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '500px', width: '90%' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('TẠO KÊNH THẢO LUẬN MỚI')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowCreateModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleCreateChannelSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group">
                  <label>{t('Tên Kênh *')}</label>
                  <input 
                    type="text" 
                    value={newChannelName} 
                    onChange={e => setNewChannelName(e.target.value)} 
                    placeholder={t('Ví dụ: Thảo luận PO-Aqua...')}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>{t('Mô Tả Kênh')}</label>
                  <input 
                    type="text" 
                    value={newChannelDesc} 
                    onChange={e => setNewChannelDesc(e.target.value)} 
                    placeholder={t('Mô tả mục đích kênh chat...')}
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontWeight: 600 }}>{t('Thành Viên Tham Gia')}</label>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'white' }}>
                    {users.filter(u => u.uid !== currentUser.uid && u.active).map(u => (
                      <label key={u.uid} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                        <input 
                          type="checkbox" 
                          checked={newChannelMembers.includes(u.uid)} 
                          onChange={() => handleToggleMember(u.uid, false)}
                        />
                        <span style={{ fontSize: '13px' }}>{u.displayName} ({t(u.role.toUpperCase())})</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowCreateModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Tạo Kênh')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CHANNEL MODAL */}
      {showEditModal && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '500px', width: '90%' }}>
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('CHỈNH SỬA THÔNG TIN KÊNH')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowEditModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleEditChannelSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="form-group">
                  <label>{t('Tên Kênh *')}</label>
                  <input 
                    type="text" 
                    value={editChannelName} 
                    onChange={e => setEditChannelName(e.target.value)} 
                    required
                  />
                </div>
                <div className="form-group">
                  <label>{t('Mô Tả Kênh')}</label>
                  <input 
                    type="text" 
                    value={editChannelDesc} 
                    onChange={e => setEditChannelDesc(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontWeight: 600 }}>{t('Thành Viên Kênh')}</label>
                  <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'white' }}>
                    {users.filter(u => u.uid !== currentUser.uid && u.active).map(u => (
                      <label key={u.uid} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                        <input 
                          type="checkbox" 
                          checked={editChannelMembers.includes(u.uid)} 
                          onChange={() => handleToggleMember(u.uid, true)}
                        />
                        <span style={{ fontSize: '13px' }}>{u.displayName} ({t(u.role.toUpperCase())})</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowEditModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Lưu Thay Đổi')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
