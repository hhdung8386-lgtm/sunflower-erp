import React from 'react';
import { FileUp, Plus, Trash2 } from 'lucide-react';
import type { CustomerPendingOrderItem } from '../domain/crmModels';
import { calculatePOItemFinancials, type PODiscountType } from '../domain/poFinancials';
import { createCustomerOnboardingItem } from '../domain/customerOnboardingItem';

interface SupplierOption {
  id: string;
  supplierName?: string;
}

interface CustomerOnboardingItemsProps {
  items: CustomerPendingOrderItem[];
  customerPoCode: string;
  expectedDeliveryDate: string;
  notes: string;
  suppliers: SupplierOption[];
  defaultDiscountType: PODiscountType;
  defaultDiscountRate: number;
  defaultDiscountAmount: number;
  onItemsChange: (items: CustomerPendingOrderItem[]) => void;
  onCustomerPoCodeChange: (value: string) => void;
  onExpectedDeliveryDateChange: (value: string) => void;
  onNotesChange: (value: string) => void;
}

const PRODUCT_TYPES = [
  { value: 'tem_trang_cuon', label: 'Tem trắng cuộn' },
  { value: 'tem_mau_cuon', label: 'Tem màu cuộn' },
  { value: 'tem_mau_to', label: 'Tem màu tờ' },
  { value: 'muc_in', label: 'Ribbon / mực in' }
];

const WORK_TYPES = [
  { value: 'gia_cong', label: 'Thuê NCC gia công' },
  { value: 'mua_ban_thang', label: 'Mua thành phẩm bán lại' },
  { value: 'tu_san_xuat', label: 'Sunflower tự sản xuất' }
];

export const CustomerOnboardingItems: React.FC<CustomerOnboardingItemsProps> = ({
  items,
  customerPoCode,
  expectedDeliveryDate,
  notes,
  suppliers,
  defaultDiscountType,
  defaultDiscountRate,
  defaultDiscountAmount,
  onItemsChange,
  onCustomerPoCodeChange,
  onExpectedDeliveryDateChange,
  onNotesChange
}) => {
  const addItem = () => {
    onItemsChange([
      ...items,
      createCustomerOnboardingItem(
        items.length,
        expectedDeliveryDate,
        defaultDiscountType,
        defaultDiscountRate,
        defaultDiscountAmount
      )
    ]);
  };

  const updateItem = <K extends keyof CustomerPendingOrderItem>(
    itemId: string,
    field: K,
    value: CustomerPendingOrderItem[K]
  ) => {
    onItemsChange(items.map(item => item.itemId === itemId ? { ...item, [field]: value } : item));
  };

  const updateSupplier = (itemId: string, supplierId: string) => {
    const supplier = suppliers.find(option => option.id === supplierId);
    onItemsChange(items.map(item => item.itemId === itemId ? {
      ...item,
      supplierId,
      supplierName: supplier?.supplierName || ''
    } : item));
  };

  const removeItem = (itemId: string) => {
    const remainingItems = items.filter(item => item.itemId !== itemId);
    onItemsChange(remainingItems.length > 0 ? remainingItems : [
      createCustomerOnboardingItem(
        0,
        expectedDeliveryDate,
        defaultDiscountType,
        defaultDiscountRate,
        defaultDiscountAmount
      )
    ]);
  };

  const handleFilesChange = async (itemId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    const files = await Promise.all(selectedFiles.map(file => new Promise<Record<string, unknown>>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, data: String(reader.result || ''), url: '' });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    })));
    const currentItem = items.find(item => item.itemId === itemId);
    if (!currentItem) return;
    updateItem(itemId, 'files', [...currentItem.files, ...files]);
  };

  return (
    <section className="customer-data-section customer-onboarding-items">
      <div className="customer-data-section__heading customer-onboarding-items__heading">
        <div>
          <span>Danh sách mã hàng & đơn đầu tiên</span>
          <small>Nhập ngay tại hồ sơ khách hàng; Sale PO sẽ nhận sẵn toàn bộ dữ liệu này.</small>
        </div>
        <button type="button" className="btn btn-primary" onClick={addItem}>
          <Plus size={14} /> Thêm mã hàng
        </button>
      </div>

      <div className="customer-onboarding-order-meta">
        <label>Mã PO khách hàng<input value={customerPoCode} onChange={event => onCustomerPoCodeChange(event.target.value)} placeholder="Ví dụ: VFT26-553..." /></label>
        <label>Ngày giao dự kiến<input type="date" value={expectedDeliveryDate} onChange={event => onExpectedDeliveryDateChange(event.target.value)} /></label>
        <label>Ghi chú đơn hàng<input value={notes} onChange={event => onNotesChange(event.target.value)} placeholder="Yêu cầu giao hàng hoặc lưu ý riêng..." /></label>
      </div>

      <div className="customer-onboarding-items__table-wrap">
        <table className="customer-onboarding-items__table">
          <thead>
            <tr>
              <th>STT</th>
              <th>Mã hàng *</th>
              <th>Tên hàng *</th>
              <th>Quy cách / Chất liệu</th>
              <th>ĐVT</th>
              <th>Số lượng</th>
              <th>Đơn giá</th>
              <th>VAT</th>
              <th>Chiết khấu</th>
              <th>Thành tiền</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const financials = calculatePOItemFinancials(item);
              return (
                <React.Fragment key={item.itemId}>
                  <tr>
                    <td className="customer-onboarding-items__index">{index + 1}</td>
                    <td><input value={item.productCode} onChange={event => updateItem(item.itemId, 'productCode', event.target.value)} placeholder="Mã hàng" required /></td>
                    <td><input value={item.productName} onChange={event => updateItem(item.itemId, 'productName', event.target.value)} placeholder="Tên sản phẩm" required /></td>
                    <td>
                      <div className="customer-onboarding-items__stack">
                        <input value={item.size} onChange={event => updateItem(item.itemId, 'size', event.target.value)} placeholder="Quy cách / kích thước" />
                        <input value={item.material} onChange={event => updateItem(item.itemId, 'material', event.target.value)} placeholder="Chất liệu" />
                      </div>
                    </td>
                    <td><input value={item.unit} onChange={event => updateItem(item.itemId, 'unit', event.target.value)} /></td>
                    <td><input type="number" min="0" value={item.quantity} onChange={event => updateItem(item.itemId, 'quantity', Number(event.target.value))} required /></td>
                    <td><input type="number" min="0" value={item.price} onChange={event => updateItem(item.itemId, 'price', Number(event.target.value))} /></td>
                    <td><input type="number" min="0" max="100" value={item.vatRate} onChange={event => updateItem(item.itemId, 'vatRate', Number(event.target.value))} /></td>
                    <td>
                      <div className="customer-onboarding-items__discount">
                        <select value={item.discountType} onChange={event => updateItem(item.itemId, 'discountType', event.target.value === 'amount' ? 'amount' : 'percent')}>
                          <option value="percent">%</option>
                          <option value="amount">VNĐ</option>
                        </select>
                        <input
                          type="number"
                          min="0"
                          value={item.discountType === 'amount' ? item.discountAmount : item.discountRate}
                          onChange={event => updateItem(
                            item.itemId,
                            item.discountType === 'amount' ? 'discountAmount' : 'discountRate',
                            Number(event.target.value)
                          )}
                        />
                      </div>
                    </td>
                    <td><strong>{Math.round(financials.amountWithVat).toLocaleString('vi-VN')} đ</strong></td>
                    <td><button type="button" className="btn btn-sm btn-danger btn-symbol-sm" onClick={() => removeItem(item.itemId)} title="Làm trống dòng mã hàng"><Trash2 size={13} /></button></td>
                  </tr>
                  <tr className="customer-onboarding-items__details">
                    <td />
                    <td colSpan={10}>
                      <div className="customer-onboarding-item-details">
                        <label>Loại sản phẩm<select value={item.productType} onChange={event => updateItem(item.itemId, 'productType', event.target.value)}>{PRODUCT_TYPES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                        <label>Phương án cung ứng<select value={item.workType} onChange={event => updateItem(item.itemId, 'workType', event.target.value)}>{WORK_TYPES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                        <label>Nhà cung cấp<select value={item.supplierId} onChange={event => updateSupplier(item.itemId, event.target.value)}><option value="">Chưa chọn</option>{suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.supplierName || supplier.id}</option>)}</select></label>
                        <label>Giá mua<input type="number" min="0" value={item.purchasePrice} onChange={event => updateItem(item.itemId, 'purchasePrice', Number(event.target.value))} /></label>
                        <label>Lead time (ngày)<input type="number" min="0" value={item.leadTimeDays} onChange={event => updateItem(item.itemId, 'leadTimeDays', Number(event.target.value))} /></label>
                        <label>Ngày giao dòng hàng<input type="date" value={item.deliveryDate || expectedDeliveryDate} onChange={event => updateItem(item.itemId, 'deliveryDate', event.target.value)} /></label>
                        <label className="customer-onboarding-item-files"><FileUp size={13} /> Tệp mã hàng<input type="file" multiple onChange={event => handleFilesChange(item.itemId, event)} /><small>{item.files.length > 0 ? `${item.files.length} tệp đã chọn` : 'Chưa có tệp'}</small></label>
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
