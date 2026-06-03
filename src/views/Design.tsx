import React, { useState, useEffect } from 'react';
import { dbService, UserProfile } from '../services/firebaseService';
import { PO_STATES } from './Sales';
import { useLanguage } from '../context/LanguageContext';

interface DesignProps {
  pos: any[];
  currentUser: UserProfile;
  onRefresh: () => void;
}

export const Design: React.FC<DesignProps> = ({ pos, currentUser, onRefresh }) => {
  const { t } = useLanguage();
  const [designs, setDesigns] = useState<any[]>([]);
  const [selectedDesign, setSelectedDesign] = useState<any | null>(null);
  
  // New version form state
  const [showAddVersionModal, setShowAddVersionModal] = useState(false);
  const [newBase64Preview, setNewBase64Preview] = useState('');
  const [newAiLink, setNewAiLink] = useState('');
  const [newCorelLink, setNewCorelLink] = useState('');
  const [newComment, setNewComment] = useState('');

  // Edit version form state
  const [showEditVersionModal, setShowEditVersionModal] = useState(false);
  const [editAiLink, setEditAiLink] = useState('');
  const [editCorelLink, setEditCorelLink] = useState('');
  const [editComment, setEditComment] = useState('');
  const [editBase64Preview, setEditBase64Preview] = useState('');
  
  // Feedback state
  const [feedbackText, setFeedbackText] = useState('');

  // Fetch designs linked to POs
  useEffect(() => {
    const fetchDesigns = async () => {
      const designList = await dbService.getCollection('designs');
      setDesigns(designList);
    };
    fetchDesigns();
  }, [pos]);

  const handleOpenEditVersionModal = (ver: any) => {
    setEditAiLink(ver.aiLink || '');
    setEditCorelLink(ver.corelLink || '');
    setEditComment(ver.comment || '');
    setEditBase64Preview(ver.previewImage || '');
    setShowEditVersionModal(true);
  };

  const handleEditVersionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDesign) return;
    
    const activeVer = selectedDesign.selectedVer || (selectedDesign.versions && selectedDesign.versions[selectedDesign.versions.length - 1]);
    if (!activeVer) return;

    const updatedVersions = selectedDesign.versions.map((ver: any) => {
      if (ver.versionNumber === activeVer.versionNumber) {
        return {
          ...ver,
          aiLink: editAiLink,
          corelLink: editCorelLink,
          comment: editComment,
          previewImage: editBase64Preview,
          updatedBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
          updatedAt: new Date().toISOString()
        };
      }
      return ver;
    });

    await dbService.updateDocument('designs', selectedDesign.id, {
      versions: updatedVersions
    });

    setShowEditVersionModal(false);
    
    // Refresh
    const updatedList = await dbService.getCollection('designs');
    setDesigns(updatedList);
    setSelectedDesign(updatedList.find(d => d.id === selectedDesign.id));
    onRefresh();
  };

  const handleDeleteLastVersion = async () => {
    if (!selectedDesign || !selectedDesign.versions || selectedDesign.versions.length === 0) return;
    if (window.confirm(t('Bạn có chắc chắn muốn xóa phiên bản thiết kế này?'))) {
      const updatedVersions = [...selectedDesign.versions];
      updatedVersions.pop(); // Remove last version
      const nextVersionNumber = updatedVersions.length;
      
      await dbService.updateDocument('designs', selectedDesign.id, {
        versions: updatedVersions,
        currentVersion: nextVersionNumber,
        status: nextVersionNumber === 0 ? 'pending' : 'client_pending'
      });

      // Also revert PO status if needed
      const po = pos.find(p => p.id === selectedDesign.poId);
      if (po) {
        const updatedLogs = [
          ...po.historyLogs,
          {
            status: nextVersionNumber === 0 ? 'receive_po' : 'design_sent',
            updatedBy: currentUser.displayName,
            updatedAt: new Date().toISOString(),
            note: `Xóa phiên bản thiết kế v${selectedDesign.currentVersion} bởi ${currentUser.displayName}.`
          }
        ];
        await dbService.updateDocument('pos', po.id, {
          status: nextVersionNumber === 0 ? 'receive_po' : 'design_sent',
          historyLogs: updatedLogs
        });
      }

      // Refresh list
      const updatedList = await dbService.getCollection('designs');
      setDesigns(updatedList);
      setSelectedDesign(updatedList.find(d => d.id === selectedDesign.id));
      onRefresh();
    }
  };

  const handleEditPreviewFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const base64 = canvas.toDataURL('image/jpeg', 0.7);
        setEditBase64Preview(base64);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Design status colors mapping
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <span className="badge badge-success">{t('Đã Duyệt Màu')}</span>;
      case 'rejected': return <span className="badge badge-danger">{t('Yêu Cầu Sửa Lại')}</span>;
      case 'client_pending': return <span className="badge badge-warning">{t('Chờ Khách Duyệt')}</span>;
      case 'designing': return <span className="badge badge-info">{t('Đang thiết kế')}</span>;
      default: return <span className="badge badge-danger">{t('Đợi Thiết Kế')}</span>;
    }
  };

  // Resize and convert new version preview image to Base64
  const handlePreviewFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const base64 = canvas.toDataURL('image/jpeg', 0.7); // 70% jpeg compression
        setNewBase64Preview(base64);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Add new design version (Designer action)
  const handleAddVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDesign) return;

    const currentVersions = selectedDesign.versions || [];
    const nextVersionNumber = currentVersions.length + 1;

    const newVersion = {
      versionNumber: nextVersionNumber,
      previewImage: newBase64Preview,
      aiLink: newAiLink,
      corelLink: newCorelLink,
      comment: newComment,
      createdAt: new Date().toISOString(),
      createdBy: `${currentUser.displayName} (${currentUser.role.toUpperCase()})`,
      feedbackFromClient: '',
      feedbackAt: ''
    };

    const updatedVersions = [...currentVersions, newVersion];
    
    // Update design record
    await dbService.updateDocument('designs', selectedDesign.id, {
      versions: updatedVersions,
      status: 'client_pending', // Set status to waiting client approval
      currentVersion: nextVersionNumber
    });

    // Also update PO history logs and status
    const po = pos.find(p => p.id === selectedDesign.poId);
    if (po) {
      const updatedLogs = [
        ...po.historyLogs,
        {
          status: 'design_sent',
          updatedBy: currentUser.displayName,
          updatedAt: new Date().toISOString(),
          note: `Upload bản thiết kế v${nextVersionNumber} - Chờ duyệt màu.`
        }
      ];
      await dbService.updateDocument('pos', po.id, {
        status: 'design_sent',
        historyLogs: updatedLogs
      });
    }

    setShowAddVersionModal(false);
    setNewBase64Preview('');
    setNewAiLink('');
    setNewCorelLink('');
    setNewComment('');
    
    // Refresh local lists
    const updatedList = await dbService.getCollection('designs');
    setDesigns(updatedList);
    setSelectedDesign(updatedList.find(d => d.id === selectedDesign.id));
    onRefresh();
  };

  // Client layout approval action (Sale/Admin handles approval)
  const handleClientFeedback = async (approved: boolean) => {
    if (!selectedDesign) return;

    const currentVersions = [...(selectedDesign.versions || [])];
    if (currentVersions.length === 0) return;

    const lastVersionIndex = currentVersions.length - 1;
    currentVersions[lastVersionIndex] = {
      ...currentVersions[lastVersionIndex],
      feedbackFromClient: approved ? 'DUYỆT CHỐT LAYOUT & MÀU IN' : `TỪ CHỐI / YÊU CẦU SỬA: ${feedbackText}`,
      feedbackAt: new Date().toISOString()
    };

    const newStatus = approved ? 'approved' : 'rejected';
    
    await dbService.updateDocument('designs', selectedDesign.id, {
      versions: currentVersions,
      status: newStatus
    });

    // Update the PO status
    const po = pos.find(p => p.id === selectedDesign.poId);
    if (po) {
      const nextPOStatus = approved ? 'production_pending' : 'layout_pending';
      const updatedLogs = [
        ...po.historyLogs,
        {
          status: nextPOStatus,
          updatedBy: currentUser.displayName,
          updatedAt: new Date().toISOString(),
          note: approved 
            ? `Thiết kế v${selectedDesign.currentVersion} đã được khách hàng duyệt màu/chốt layout.`
            : `Khách hàng từ chối layout v${selectedDesign.currentVersion}. Yêu cầu: ${feedbackText}`
        }
      ];

      // In the item inside PO, update layout preview as well!
      const updatedItems = [...po.items];
      if (updatedItems[0] && approved) {
        updatedItems[0].previewImage = selectedDesign.versions[lastVersionIndex].previewImage;
      }

      await dbService.updateDocument('pos', po.id, {
        status: nextPOStatus,
        historyLogs: updatedLogs,
        items: updatedItems
      });
    }

    setFeedbackText('');
    
    // Refresh
    const updatedList = await dbService.getCollection('designs');
    setDesigns(updatedList);
    setSelectedDesign(updatedList.find(d => d.id === selectedDesign.id));
    onRefresh();
  };

  // Helper: check if a design record exists for a PO. If not, auto create one when designer opens it
  const getOrCreateDesign = async (po: any) => {
    let design = designs.find(d => d.poId === po.id);
    if (!design) {
      // Create empty design record
      const newDesign = {
        id: po.id,
        poId: po.id,
        designerId: currentUser.role === 'designer' ? currentUser.uid : 'u-designer',
        status: 'pending',
        versions: [],
        currentVersion: 0
      };
      design = await dbService.addDocument('designs', newDesign);
      
      const updatedList = await dbService.getCollection('designs');
      setDesigns(updatedList);
      design = updatedList.find(d => d.poId === po.id);
    }
    setSelectedDesign(design);
  };

  return (
    <div className="design-view" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('QUẢN LÝ THIẾT KẾ & DUYỆT MẪU')}</h1>
          <p className="page-subtitle">{t('Tải lên bản vẽ layout duyệt màu (Base64) và liên kết file thiết kế gốc (AI, Corel) trên Google Drive.')}</p>
        </div>
      </div>

      <div className="card">
        <span className="card-title">{t('Danh Sách Yêu Cầu Thiết Kế Từ Đơn Hàng')}</span>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>{t('Mã PO')}</th>
                <th>{t('Tên Công Ty')}</th>
                <th>{t('Sản Phẩm')}</th>
                <th>{t('Kích Thước Quy Cách *')}</th>
                <th>{t('Trạng Thái')}</th>
                <th>{t('Thao Tác')}</th>
              </tr>
            </thead>
            <tbody>
              {pos.map(po => {
                const design = designs.find(d => d.poId === po.id);
                const item = po.items[0] || {};
                return (
                  <tr key={po.id} style={{ cursor: 'pointer' }} onClick={() => getOrCreateDesign(po)}>
                    <td style={{ fontWeight: 600 }}>{po.poCode}</td>
                    <td>{po.customerName}</td>
                    <td style={{ fontWeight: 500 }}>{item.productName}</td>
                    <td>{item.size}</td>
                    <td>{getStatusBadge(design ? design.status : 'pending')}</td>
                    <td>
                      <button className="btn btn-sm btn-outline" onClick={() => getOrCreateDesign(po)}>
                        {t('Chi Tiết')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAILED DESIGN WORKSPACE */}
      {selectedDesign && (
        <div className="details-grid" style={{ gridTemplateColumns: '350px 1fr' }}>
          {/* Version logs */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">{t('Phiên bản')} v{selectedDesign.currentVersion}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setSelectedDesign(null)}>{t('Đóng')}</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '450px', overflowY: 'auto' }}>
              {selectedDesign.versions && selectedDesign.versions.map((ver: any) => (
                <div 
                  key={ver.versionNumber} 
                  style={{ 
                    padding: '12px', 
                    borderRadius: '4px', 
                    border: '1px solid var(--color-border-light)',
                    backgroundColor: selectedDesign.currentVersion === ver.versionNumber ? 'var(--color-primary-light)' : '#ffffff',
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedDesign((prev: any) => ({ ...prev, selectedVer: ver }))}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, fontSize: '13px' }}>
                    <span style={{ color: 'var(--color-primary)' }}>{t('Phiên bản')} v{ver.versionNumber}</span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      {new Date(ver.createdAt).toLocaleDateString(t('vi-VN'))}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', margin: '4px 0' }}>{ver.comment || t('Không có ghi chú')}</p>
                  {ver.feedbackFromClient && (
                    <div style={{ fontSize: '11px', marginTop: '6px', padding: '4px', backgroundColor: '#ffffff', borderLeft: '3px solid var(--color-success)', color: 'var(--color-text-main)' }}>
                      {ver.feedbackFromClient}
                    </div>
                  )}
                </div>
              ))}
              {(!selectedDesign.versions || selectedDesign.versions.length === 0) && (
                <span style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-muted)' }}>{t('Chưa có phiên bản thiết kế nào.')}</span>
              )}
            </div>

            {/* Designer button */}
            {(currentUser.role === 'admin' || currentUser.role === 'designer') && (
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '10px' }} 
                onClick={() => setShowAddVersionModal(true)}
              >
                {t('CẬP NHẬT PHIÊN BẢN THIẾT KẾ MỚI')}
              </button>
            )}
          </div>

          {/* Active version detail layout */}
          <div className="card">
            {(() => {
              const activeVer = selectedDesign.selectedVer || (selectedDesign.versions && selectedDesign.versions[selectedDesign.versions.length - 1]);
              
              if (!activeVer) {
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '60px 0' }}>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '15px' }}>{t('Chưa có tệp tin bản vẽ nào cho đơn hàng này.')}</p>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>{t('Bắt đầu bằng việc nhấn nút "Upload Phiên Bản Mới" phía cột trái.')}</p>
                  </div>
                );
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="card-header" style={{ paddingBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="card-title" style={{ fontSize: '16px', color: 'var(--color-primary)' }}>
                        {t('Phiên bản')} v{activeVer.versionNumber}
                      </span>
                      <span className="badge badge-info">
                        {t('Trạng Thái')}: {t(PO_STATES.find((s: any) => s.value === pos.find((p: any) => p.id === selectedDesign.poId)?.status)?.label || '')}
                      </span>
                    </div>
                    {(currentUser.role === 'admin' || currentUser.role === 'designer') && activeVer.versionNumber === selectedDesign.currentVersion && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-sm btn-primary" onClick={() => handleOpenEditVersionModal(activeVer)}>{t('Sửa')}</button>
                        <button className="btn btn-sm btn-danger" onClick={handleDeleteLastVersion}>{t('Xóa')}</button>
                      </div>
                    )}
                  </div>

                  <div className="details-grid">
                    {/* Render compressed Base64 image directly in <img> */}
                    <div style={{ textAlign: 'center', border: '1px solid var(--color-border-light)', padding: '10px', borderRadius: '4px' }}>
                      <h4 style={{ textAlign: 'left', marginBottom: '8px', fontSize: '13px' }}>{t('Bản Vẽ Thiết Kế Duyệt Màu')}</h4>
                      {activeVer.previewImage ? (
                        <img 
                          src={activeVer.previewImage} 
                          alt={`Mẫu duyệt v${activeVer.versionNumber}`} 
                          style={{ maxWidth: '100%', maxHeight: '350px', objectFit: 'contain', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                        />
                      ) : (
                        <div style={{ padding: '80px 0', backgroundColor: '#f8fafc', color: 'var(--color-text-muted)' }}>{t('Không có hình ảnh xem trước')}</div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '4px', border: '1px solid var(--color-border-light)' }}>
                        <h4 style={{ marginBottom: '8px', color: 'var(--color-primary)', fontSize: '13.5px' }}>{t('File Thiết Kế Gốc')}</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {activeVer.aiLink ? (
                            <a href={activeVer.aiLink} target="_blank" rel="noopener noreferrer" className="file-link-item" style={{ justifyContent: 'center' }}>
                              {t('Đường dẫn Thiết kế Gốc AI (Adobe Illustrator)')}
                            </a>
                          ) : (
                            <span style={{ fontSize: '12.5px', color: 'var(--color-text-muted)' }}>{t('Chưa tải lên file gốc')} (AI)</span>
                          )}

                          {activeVer.corelLink ? (
                            <a href={activeVer.corelLink} target="_blank" rel="noopener noreferrer" className="file-link-item" style={{ justifyContent: 'center' }}>
                              {t('Đường dẫn Thiết kế Corel Draw (.cdr)')}
                            </a>
                          ) : (
                            <span style={{ fontSize: '12.5px', color: 'var(--color-text-muted)' }}>{t('Chưa tải lên file gốc')} (Corel)</span>
                          )}
                        </div>
                      </div>

                      {/* CLIENT/SALE LAYOUT APPROVAL ACTION */}
                      {(currentUser.role === 'admin' || currentUser.role === 'sale') && selectedDesign.status === 'client_pending' && (
                        <div style={{ border: '1px solid var(--color-border)', padding: '16px', borderRadius: '4px', backgroundColor: 'var(--color-warning-bg)' }}>
                          <h4 style={{ color: 'var(--color-warning)', marginBottom: '8px', fontSize: '13.5px' }}>{t('ĐỒNG Ý PHÊ DUYỆT CHỐT LAYOUT MÀU SẮC')}</h4>
                          <p style={{ fontSize: '12.5px', marginBottom: '10px' }}>{t('Ý kiến phê duyệt hoặc yêu cầu chỉnh sửa của khách hàng:')}</p>
                          <textarea 
                            value={feedbackText} 
                            onChange={(e) => setFeedbackText(e.target.value)} 
                            placeholder={t('Nhập nội dung ý kiến tại đây...')}
                            style={{ marginBottom: '12px' }}
                          />
                          <div className="btn-group">
                            <button className="btn btn-success" onClick={() => handleClientFeedback(true)}>
                              {t('Phê Duyệt Chốt Layout')}
                            </button>
                            <button className="btn btn-danger" onClick={() => handleClientFeedback(false)} disabled={!feedbackText}>
                              {t('Yêu Cầu Sửa Lại')}
                            </button>
                          </div>
                        </div>
                      )}

                      <div style={{ padding: '12px', borderLeft: '4px solid var(--color-primary)', backgroundColor: '#f1f5f9', fontSize: '13px' }}>
                        <span style={{ fontWeight: 600, display: 'block', fontSize: '12.5px' }}>{t('Ý Kiến Thiết Kế / Ghi Chú')} (v{activeVer.versionNumber}):</span>
                        <p style={{ margin: '4px 0' }}>{activeVer.comment || t('Không có ghi chú')}</p>
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--color-border)', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          <div><strong>{t('Tạo bởi:')}</strong> {activeVer.createdBy || t('Không xác định')} {activeVer.createdAt && `(${new Date(activeVer.createdAt).toLocaleString(t('vi-VN'))})`}</div>
                          {activeVer.updatedBy && <div><strong>{t('Cập nhật bởi:')}</strong> {activeVer.updatedBy} {activeVer.updatedAt && `(${new Date(activeVer.updatedAt).toLocaleString(t('vi-VN'))})`}</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* UPLOAD VERSION MODAL */}
      {showAddVersionModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('CẬP NHẬT PHIÊN BẢN THIẾT KẾ MỚI')} (v{selectedDesign.versions.length + 1})</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAddVersionModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleAddVersion}>
              <div className="modal-body">
                <div className="form-group">
                  <label>{t('Bản Vẽ Layout Duyệt Màu (Ảnh)*')}</label>
                  <div className="image-upload-box">
                    <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{t('Ảnh mẫu sẽ được nén Base64 tự động để lưu trữ an toàn dưới 100KB.')}</span>
                    <input type="file" accept="image/*" onChange={handlePreviewFileChange} style={{ display: 'block', margin: '10px auto' }} required />
                    {newBase64Preview && (
                      <img src={newBase64Preview} alt="Preview" className="image-preview-thumbnail" />
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label>{t('Đường dẫn Thiết kế Gốc AI (Adobe Illustrator)')}</label>
                  <input type="url" value={newAiLink} onChange={e => setNewAiLink(e.target.value)} placeholder="https://drive.google.com/file/d/..." />
                </div>
                <div className="form-group">
                  <label>{t('Đường dẫn Thiết kế Corel Draw (.cdr)')}</label>
                  <input type="url" value={newCorelLink} onChange={e => setNewCorelLink(e.target.value)} placeholder="https://drive.google.com/file/d/..." />
                </div>
                <div className="form-group">
                  <label>{t('Ý Kiến Thiết Kế / Ghi Chú')} *</label>
                  <textarea value={newComment} onChange={e => setNewComment(e.target.value)} placeholder={t('Ví dụ: Chỉnh lại font chữ, sửa màu cyan đậm...')} required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowAddVersionModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Lưu Thiết Kế')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT VERSION MODAL */}
      {showEditVersionModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontSize: '16px' }}>{t('CHỈNH SỬA THÔNG TIN PHIÊN BẢN')}</span>
              <button className="btn btn-sm btn-outline" onClick={() => setShowEditVersionModal(false)}>{t('Đóng')}</button>
            </div>
            <form onSubmit={handleEditVersionSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>{t('Bản Vẽ Layout Duyệt Màu (Ảnh)')}</label>
                  <div className="image-upload-box">
                    <input type="file" accept="image/*" onChange={handleEditPreviewFileChange} style={{ display: 'block', margin: '10px auto' }} />
                    {editBase64Preview && (
                      <img src={editBase64Preview} alt="Preview" className="image-preview-thumbnail" />
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label>{t('Đường dẫn Thiết kế Gốc AI (Adobe Illustrator)')}</label>
                  <input type="url" value={editAiLink} onChange={e => setEditAiLink(e.target.value)} placeholder="https://drive.google.com/file/d/..." />
                </div>
                <div className="form-group">
                  <label>{t('Đường dẫn Thiết kế Corel Draw (.cdr)')}</label>
                  <input type="url" value={editCorelLink} onChange={e => setEditCorelLink(e.target.value)} placeholder="https://drive.google.com/file/d/..." />
                </div>
                <div className="form-group">
                  <label>{t('Ý Kiến Thiết Kế / Ghi Chú')} *</label>
                  <textarea value={editComment} onChange={e => setEditComment(e.target.value)} required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowEditVersionModal(false)}>{t('Hủy')}</button>
                <button type="submit" className="btn btn-primary">{t('Lưu Thay Đổi')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
