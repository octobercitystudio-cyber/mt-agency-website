import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { FileText, Plus, Trash2, Printer, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

const ERPOfferGenerator = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [clientName, setClientName] = useState('');
  const [offerItems, setOfferItems] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  
  const [logoBase64, setLogoBase64] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: srvs } = await supabase.from('services').select('*');
    if (srvs) setServices(srvs);
    
    const { data: cfg } = await supabase.from('app_config').select('value').eq('key', 'system_logo').single();
    if (cfg && cfg.value) setLogoBase64(cfg.value);
    
    setLoading(false);
  };

  const handleAddItem = () => {
    if (!selectedServiceId) return;
    const srv = services.find(s => s.id.toString() === selectedServiceId);
    if (!srv) return;
    
    setOfferItems([...offerItems, {
      id: Date.now(),
      service_id: srv.id,
      name: srv.name,
      price: parseFloat(srv.price),
      quantity: 1
    }]);
    setSelectedServiceId('');
  };

  const handleRemoveItem = (id) => {
    setOfferItems(offerItems.filter(item => item.id !== id));
  };

  const updateQuantity = (id, q) => {
    setOfferItems(offerItems.map(item => item.id === id ? {...item, quantity: parseFloat(q) || 1} : item));
  };

  const updatePrice = (id, p) => {
    setOfferItems(offerItems.map(item => item.id === id ? {...item, price: parseFloat(p) || 0} : item));
  };

  const calculateTotal = () => {
    const subtotal = offerItems.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
    return Math.max(0, subtotal - parseFloat(discount || 0));
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="text-center py-5">جاري التحميل...</div>;

  return (
    <div className="container-fluid p-0 animate__animated animate__fadeIn pb-5" style={{ background: '#f8f9fc', minHeight: '100vh', padding: '20px', direction: 'rtl' }}>
      
      <div className="d-flex justify-content-between align-items-center mb-4 mt-3 px-3 no-print">
        <div>
          <h2 className="fw-bold" style={{ color: '#1e293b', margin: 0 }}>
            <FileText className="me-2 text-primary" size={28} />
            إنشاء عرض سعر
          </h2>
          <p className="text-muted mt-1 mb-0">قم بإعداد عروض الأسعار وطباعتها للعملاء بشكل احترافي</p>
        </div>
        <button onClick={handlePrint} className="btn btn-dark shadow-sm rounded-pill px-4 py-2 fw-bold d-flex align-items-center gap-2">
          <Printer size={20} /> طباعة أو حفظ PDF
        </button>
      </div>

      <div className="row px-3 g-4">
        {/* Print Area */}
        <div className="col-12 col-xl-8 print-w-100">
          <div className="card border-0 shadow-sm rounded-4 p-5 print-container" style={{ minHeight: '800px', background: 'white' }}>
            
            {/* Invoice Header */}
            <div className="d-flex justify-content-between align-items-start border-bottom pb-4 mb-4">
              <div>
                {logoBase64 ? (
                  <img src={logoBase64} alt="Logo" style={{ height: '80px', objectFit: 'contain' }} />
                ) : (
                  <h2 className="fw-bold text-primary">Multi Task Agency</h2>
                )}
              </div>
              <div className="text-start">
                <h3 className="fw-bold text-dark mb-1">عرض سعر</h3>
                <p className="text-muted mb-0">التاريخ: <span dir="ltr">{format(new Date(), 'dd/MM/yyyy')}</span></p>
                <p className="text-muted mb-0">صالح لمدة: 15 يوماً</p>
              </div>
            </div>

            {/* Client Info */}
            <div className="mb-4">
              <h5 className="fw-bold text-muted mb-2">مقدم إلى السيد/ة:</h5>
              <h4 className="fw-bold text-dark border-bottom border-primary border-2 d-inline-block pb-1 pe-4">
                {clientName || 'اسم العميل...'}
              </h4>
            </div>

            {/* Items Table */}
            <div className="table-responsive mb-4">
              <table className="table table-bordered border-light align-middle text-center">
                <thead className="bg-light text-muted">
                  <tr>
                    <th className="py-3">م</th>
                    <th className="py-3 text-start ps-3">الخدمة / البيان</th>
                    <th className="py-3">السعر</th>
                    <th className="py-3">الكمية</th>
                    <th className="py-3">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {offerItems.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-4 text-muted">لا توجد خدمات مضافة حتى الآن.</td>
                    </tr>
                  ) : (
                    offerItems.map((item, index) => (
                      <tr key={item.id}>
                        <td className="fw-bold text-muted">{index + 1}</td>
                        <td className="text-start ps-3 fw-bold">{item.name}</td>
                        <td>{item.price.toLocaleString()} ج.م</td>
                        <td>{item.quantity}</td>
                        <td className="fw-bold text-primary">{(item.price * item.quantity).toLocaleString()} ج.م</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="row justify-content-end mb-5">
              <div className="col-12 col-md-5">
                <div className="p-4 rounded-4" style={{ background: '#f8fafc' }}>
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-muted fw-bold">الإجمالي الفرعي:</span>
                    <span className="fw-bold">{offerItems.reduce((a, b) => a + (b.price * b.quantity), 0).toLocaleString()} ج.م</span>
                  </div>
                  {discount > 0 && (
                    <div className="d-flex justify-content-between mb-2 text-danger">
                      <span className="fw-bold">الخصم الإضافي:</span>
                      <span className="fw-bold">- {discount.toLocaleString()} ج.م</span>
                    </div>
                  )}
                  <hr className="my-2" />
                  <div className="d-flex justify-content-between mt-2">
                    <span className="fw-bold fs-5 text-dark">الإجمالي النهائي:</span>
                    <span className="fw-bold fs-5 text-primary">{calculateTotal().toLocaleString()} ج.م</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            {notes && (
              <div className="mb-4">
                <h6 className="fw-bold text-muted mb-2">ملاحظات وشروط التعاقد:</h6>
                <div className="p-3 bg-light rounded-4 text-dark" style={{ whiteSpace: 'pre-line' }}>
                  {notes}
                </div>
              </div>
            )}

            {/* Signature */}
            <div className="mt-auto border-top pt-4 text-center text-muted">
              <p className="mb-0 fw-bold">إدارة Multi Task Agency</p>
              <p className="small mb-0 mt-1">نشكركم على ثقتكم في خدماتنا. نتطلع للعمل معكم.</p>
            </div>

          </div>
        </div>

        {/* Controls Area (Hidden in Print) */}
        <div className="col-12 col-xl-4 no-print">
          <div className="card border-0 shadow-sm rounded-4 p-4 sticky-top" style={{ top: '20px' }}>
            <h5 className="fw-bold mb-4 border-bottom pb-2">لوحة التحكم السريعة</h5>
            
            <div className="mb-3">
              <label className="fw-bold text-muted small mb-1">اسم العميل</label>
              <input type="text" className="form-control bg-light border-0 py-2" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="اسم العميل أو الشركة" />
            </div>

            <div className="mb-4 p-3 border rounded-4 bg-light">
              <label className="fw-bold text-dark small mb-2 d-block">إضافة خدمة للعرض:</label>
              <div className="d-flex gap-2">
                <select className="form-select border-0 shadow-sm flex-grow-1" value={selectedServiceId} onChange={e => setSelectedServiceId(e.target.value)}>
                  <option value="">-- اختر الخدمة --</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>{s.name} - {s.price} ج</option>
                  ))}
                </select>
                <button className="btn btn-primary shadow-sm" onClick={handleAddItem}><Plus size={20} /></button>
              </div>
            </div>

            <h6 className="fw-bold text-muted mb-3">الخدمات المضافة ({offerItems.length}):</h6>
            <div className="list-group list-group-flush mb-4" style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {offerItems.map(item => (
                <div key={item.id} className="list-group-item bg-transparent px-0 py-3 border-bottom border-light">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="fw-bold text-primary" style={{ fontSize: '0.9rem' }}>{item.name}</span>
                    <button className="btn btn-link text-danger p-0" onClick={() => handleRemoveItem(item.id)}><Trash2 size={16}/></button>
                  </div>
                  <div className="row g-2">
                    <div className="col-6">
                      <div className="input-group input-group-sm">
                        <span className="input-group-text bg-light border-0">السعر</span>
                        <input type="number" className="form-control border-0 bg-white shadow-sm" value={item.price} onChange={e => updatePrice(item.id, e.target.value)} />
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="input-group input-group-sm">
                        <span className="input-group-text bg-light border-0">الكمية</span>
                        <input type="number" className="form-control border-0 bg-white shadow-sm" value={item.quantity} onChange={e => updateQuantity(item.id, e.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-3">
              <label className="fw-bold text-muted small mb-1">خصم إضافي (ج.م)</label>
              <input type="number" className="form-control bg-light border-0 py-2 text-danger fw-bold" value={discount} onChange={e => setDiscount(e.target.value)} placeholder="0" />
            </div>

            <div className="mb-3">
              <label className="fw-bold text-muted small mb-1">ملاحظات العرض (تظهر للعميل)</label>
              <textarea className="form-control bg-light border-0 py-2" rows="3" value={notes} onChange={e => setNotes(e.target.value)} placeholder="شروط الدفع، مدة التنفيذ..."></textarea>
            </div>

          </div>
        </div>

      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .no-print { display: none !important; }
          .print-container, .print-container * { visibility: visible; }
          .print-container { position: absolute; left: 0; top: 0; width: 100%; border: none !important; box-shadow: none !important; padding: 0 !important; }
          .print-w-100 { width: 100% !important; flex: 0 0 100% !important; max-width: 100% !important; }
          @page { size: A4; margin: 2cm; }
        }
      `}</style>

    </div>
  );
};

export default ERPOfferGenerator;
