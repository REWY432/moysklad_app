import React, { useState, useEffect, useRef } from 'react';
import { MSOrder, MSOrderPosition, PackedItem, CargoPlace } from '../types';
import { supabaseService } from '../services/supabaseService';
import { X, Printer, Package, Plus, ArrowRight, Trash2, Box, Undo2, Search, Settings, Check, Image as ImageIcon, Tag, MessageSquare, Truck, MoreHorizontal, Pencil, LayoutList, CheckCircle2, AlertCircle, ChevronDown, Cloud, CloudOff, RefreshCw, MessageCircle } from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';

interface PackingListModalProps {
  order: MSOrder;
  positions: MSOrderPosition[];
  onClose: () => void;
}

interface PrintSettings {
  layout: 'compact' | 'detailed';
  showLogo: boolean;
  logoUrl: string;
  showCode: boolean;
  showArticle: boolean;
  showUom: boolean;
  showSender: boolean;
  showRecipient: boolean;
  showComment: boolean;
}

export const PackingListModal: React.FC<PackingListModalProps> = ({ order, positions, onClose }) => {
  // State
  const [unpackedItems, setUnpackedItems] = useState<MSOrderPosition[]>([]);
  const [places, setPlaces] = useState<CargoPlace[]>([]);
  const [moveAmounts, setMoveAmounts] = useState<Record<string, number>>({});
  const [targetPlaceId, setTargetPlaceId] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [orderComment, setOrderComment] = useState('');
  
  // Persistence State
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const isInitialLoad = useRef(true);

  // Renaming State
  const [editingPlaceId, setEditingPlaceId] = useState<number | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  
  // Mobile Tabs State
  const [activeTab, setActiveTab] = useState<'items' | 'boxes'>('items');

  // Print Settings State
  const [printSettings, setPrintSettings] = useState<PrintSettings>({
    layout: 'detailed',
    showLogo: false,
    logoUrl: '',
    showCode: true,
    showArticle: true,
    showUom: true,
    showSender: true,
    showRecipient: true,
    showComment: true
  });

  const [showPrintSettings, setShowPrintSettings] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);

  // --- Initialization & Supabase ---
  useEffect(() => {
    const loadState = async () => {
        setIsSyncing(true);
        const savedState = await supabaseService.getPackingList(order.id);
        
        if (savedState) {
            setUnpackedItems(savedState.unpacked_items);
            setPlaces(savedState.places);
            setOrderComment(savedState.order_comment || order.description || '');
            if (savedState.updated_at) setLastSaved(new Date(savedState.updated_at));
            
            if (savedState.places.length > 0) {
                setTargetPlaceId(savedState.places[savedState.places.length - 1].id);
            }
        } else {
            setUnpackedItems(JSON.parse(JSON.stringify(positions)));
            setPlaces([{ id: 1, name: 'Место 1', items: [] }]);
            setOrderComment(order.description || '');
        }
        
        setIsSyncing(false);
        isInitialLoad.current = false;
    };
    
    loadState();

    const channel = supabaseService.subscribeToPackingList(order.id, (newState) => {
        if (!isInitialLoad.current) {
            setUnpackedItems(newState.unpacked_items);
            setPlaces(newState.places);
            if (newState.order_comment !== undefined) setOrderComment(newState.order_comment);
            if (newState.updated_at) setLastSaved(new Date(newState.updated_at));
        }
    });

    return () => {
        if (channel) channel.unsubscribe();
    };
  }, [order.id, positions]);

  // --- Auto-Save ---
  useEffect(() => {
      if (isInitialLoad.current) return;

      const timer = setTimeout(async () => {
          setIsSyncing(true);
          await supabaseService.savePackingList({
              order_id: order.id,
              order_name: order.name,
              places: places,
              unpacked_items: unpackedItems,
              order_comment: orderComment
          });
          setLastSaved(new Date());
          setIsSyncing(false);
      }, 1000);

      return () => clearTimeout(timer);
  }, [places, unpackedItems, order.id, order.name, orderComment]);

  // --- Handlers ---

  const handleAddPlace = () => {
    const newId = (places.length > 0 ? Math.max(...places.map(p => p.id)) : 0) + 1;
    setPlaces([...places, { id: newId, name: `Место ${newId}`, items: [] }]);
    setTargetPlaceId(newId);
    setActiveTab('boxes');
  };

  const handleRemovePlace = (id: number) => {
    const placeToRemove = places.find(p => p.id === id);
    if (!placeToRemove) return;

    // Return items to unpacked list
    const returnedItems = [...unpackedItems];
    placeToRemove.items.forEach(item => {
        const existing = returnedItems.find(i => i.id === item.originalId);
        if (existing) {
            existing.quantity += item.quantity;
        } else {
            returnedItems.push({
                id: item.originalId,
                quantity: item.quantity,
                price: 0, // Not needed for packing
                assortment: {
                    name: item.name,
                    code: item.code,
                    article: item.article,
                    uom: { name: item.uom },
                    meta: { href: '', type: '' }
                }
            });
        }
    });

    setUnpackedItems(returnedItems);
    setPlaces(places.filter(p => p.id !== id));
    if (targetPlaceId === id) {
        setTargetPlaceId(places[0]?.id || 1);
    }
  };

  const moveItemToPlace = (item: MSOrderPosition) => {
    const amount = moveAmounts[item.id] || 1;
    if (amount <= 0 || amount > item.quantity) return;

    const targetPlace = places.find(p => p.id === targetPlaceId);
    if (!targetPlace) return;

    // Remove from unpacked
    const newUnpacked = unpackedItems.map(i => {
        if (i.id === item.id) {
            return { ...i, quantity: i.quantity - amount };
        }
        return i;
    }).filter(i => i.quantity > 0);
    setUnpackedItems(newUnpacked);

    // Add to place
    const newPlaces = places.map(p => {
        if (p.id === targetPlaceId) {
            const existingItem = p.items.find(i => i.originalId === item.id);
            if (existingItem) {
                return {
                    ...p,
                    items: p.items.map(i => i.originalId === item.id ? { ...i, quantity: i.quantity + amount } : i)
                };
            } else {
                return {
                    ...p,
                    items: [...p.items, {
                        originalId: item.id,
                        name: item.assortment.name,
                        code: item.assortment.code || '',
                        article: item.assortment.article || '',
                        uom: item.assortment.uom?.name || 'шт',
                        quantity: amount
                    }]
                };
            }
        }
        return p;
    });
    setPlaces(newPlaces);
    
    // Reset amount
    setMoveAmounts({ ...moveAmounts, [item.id]: 1 });
  };

  const moveItemToUnpacked = (placeId: number, itemIndex: number) => {
    const place = places.find(p => p.id === placeId);
    if (!place) return;
    const item = place.items[itemIndex];

    // Remove from place
    const newPlaces = places.map(p => {
        if (p.id === placeId) {
            const newItems = [...p.items];
            if (newItems[itemIndex].quantity > 1) {
                newItems[itemIndex].quantity -= 1;
            } else {
                newItems.splice(itemIndex, 1);
            }
            return { ...p, items: newItems };
        }
        return p;
    });
    setPlaces(newPlaces);

    // Add to unpacked
    const existingUnpacked = unpackedItems.find(i => i.id === item.originalId);
    if (existingUnpacked) {
        setUnpackedItems(unpackedItems.map(i => i.id === item.originalId ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
        // Reconstruct basic info
        setUnpackedItems([...unpackedItems, {
            id: item.originalId,
            quantity: 1,
            price: 0,
            assortment: {
                name: item.name,
                code: item.code,
                article: item.article,
                uom: { name: item.uom },
                meta: { href: '', type: '' }
            }
        }]);
    }
  };

  // --- Modern Print Logic ---

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Упаковочный лист ${order.name}</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            @page { margin: 10mm; }
            body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; padding: 20px; max-width: 1000px; margin: 0 auto; -webkit-print-color-adjust: exact; }
            
            .header-row { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; border-bottom: 2px solid #f1f5f9; margin-bottom: 30px; }
            .order-title { font-size: 32px; font-weight: 800; color: #0f172a; line-height: 1; letter-spacing: -0.5px; }
            .order-meta { color: #64748b; font-size: 14px; font-weight: 500; margin-top: 8px; }
            
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 40px; }
            .info-card { background: #f8fafc; border-radius: 12px; padding: 20px; border: 1px solid #e2e8f0; }
            .info-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 700; margin-bottom: 8px; }
            .info-value { font-size: 16px; font-weight: 600; color: #334155; }
            .comment-section { grid-column: 1 / -1; background: #fffbeb; border-color: #fef3c7; color: #92400e; }
            
            .place-card { margin-bottom: 30px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; page-break-inside: avoid; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
            .place-header { background: #f1f5f9; padding: 12px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
            .place-title { font-weight: 700; font-size: 16px; color: #334155; }
            .place-badge { background: #ffffff; padding: 4px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; color: #64748b; border: 1px solid #e2e8f0; }
            
            table { width: 100%; border-collapse: collapse; }
            th { text-align: left; padding: 12px 20px; background: #ffffff; color: #94a3b8; font-size: 11px; font-weight: 700; text-transform: uppercase; border-bottom: 1px solid #f1f5f9; }
            td { padding: 12px 20px; border-bottom: 1px solid #f8fafc; font-size: 14px; vertical-align: top; }
            tr:last-child td { border-bottom: none; }
            .item-name { font-weight: 500; color: #0f172a; }
            .item-meta { font-size: 12px; color: #64748b; margin-top: 2px; }
            .col-qty { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
            
            .footer { margin-top: 50px; padding-top: 20px; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8; }
          </style>
        </head>
        <body>
          <div class="header-row">
            <div>
                <div class="order-title">Заказ № ${order.name}</div>
                <div class="order-meta">от ${new Date(order.moment).toLocaleDateString()}</div>
            </div>
            <div style="text-align: right">
                <div style="font-weight: bold; font-size: 14px;">Упаковочный лист</div>
                <div style="font-size: 12px; color: #94a3b8;">${new Date().toLocaleString()}</div>
            </div>
          </div>
          
          <div class="info-grid">
             ${printSettings.showRecipient ? `
             <div class="info-card">
                <div class="info-label">Получатель</div>
                <div class="info-value">${order.agent?.name || '—'}</div>
             </div>` : ''}
             
             ${printSettings.showSender ? `
             <div class="info-card">
                <div class="info-label">Отправитель</div>
                <div class="info-value">${order.organization?.name || '—'}</div>
             </div>` : ''}

             ${printSettings.showComment && orderComment ? `
             <div class="info-card comment-section">
                <div class="info-label" style="color: #b45309;">Комментарий</div>
                <div class="info-value" style="color: #78350f; font-weight: 500;">${orderComment}</div>
             </div>
             ` : ''}
          </div>
          
          ${places.map(place => {
             if (place.items.length === 0) return '';
             const totalInPlace = place.items.reduce((s, i) => s + i.quantity, 0);
             return `
              <div class="place-card">
                <div class="place-header">
                    <span class="place-title">${place.name}</span>
                    <span class="place-badge">${totalInPlace} ед.</span>
                </div>
                <table>
                  <thead>
                    <tr>
                        <th style="width: 40px;">#</th>
                        <th>Наименование</th>
                        <th style="text-align: right">Кол-во</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${place.items.map((item, idx) => {
                        const details = [];
                        if (printSettings.showArticle && item.article) details.push(`Арт: ${item.article}`);
                        if (printSettings.showCode && item.code) details.push(`Код: ${item.code}`);
                        const detailsStr = details.join(' • ');

                        return `
                          <tr>
                            <td style="color: #94a3b8;">${idx + 1}</td>
                            <td>
                              <div class="item-name">${item.name}</div>
                              ${detailsStr ? `<div class="item-meta">${detailsStr}</div>` : ''}
                            </td>
                            <td class="col-qty">${item.quantity} ${printSettings.showUom ? (item.uom || 'шт') : ''}</td>
                          </tr>
                        `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
             `;
          }).join('')}
          
          <div class="footer">
             <span>Всего мест: ${places.filter(p => p.items.length > 0).length}</span>
             <span>Всего позиций: ${places.reduce((acc, p) => acc + p.items.length, 0)}</span>
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
  };

  const handlePrintLabels = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const nonEmptyPlaces = places.filter(p => p.items.length > 0);
    const totalPlaces = nonEmptyPlaces.length;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Этикетки ${order.name}</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
          <style>
            @media print { 
                @page { margin: 0; }
                body { margin: 0; }
                .label-page { page-break-after: always; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; }
                .label-page:last-child { page-break-after: auto; }
            }
            body { font-family: 'Inter', sans-serif; background: #fff; }
            .label-border { 
                border: 4px solid #000; 
                padding: 40px; 
                width: 90%; 
                max-width: 800px; 
                height: 500px; 
                margin: 20px auto; 
                box-sizing: border-box; 
                display: flex; 
                flex-direction: column; 
                justify-content: space-between;
                position: relative;
            }
            .label-header { font-size: 28px; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 20px; display: flex; justify-content: space-between; }
            .label-main { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 20px 0; }
            .place-title { font-size: 160px; font-weight: 900; line-height: 0.8; margin: 0; letter-spacing: -5px; }
            .place-subtitle { font-size: 24px; color: #000; margin-top: 15px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; }
            .label-footer { border-top: 2px solid #000; padding-top: 20px; font-size: 16px; line-height: 1.4; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .info-block strong { display: block; font-size: 12px; text-transform: uppercase; color: #555; margin-bottom: 2px; font-weight: 700; }
            .comment-block { grid-column: 1 / -1; font-style: italic; border-top: 1px dashed #999; padding-top: 10px; margin-top: 5px; font-size: 14px; }
          </style>
        </head>
        <body>
          ${nonEmptyPlaces.map((place, i) => `
            <div class="label-page">
                <div class="label-border">
                    <div class="label-header">
                        <span>ЗАКАЗ № ${order.name}</span>
                        <span>${new Date(order.moment).toLocaleDateString()}</span>
                    </div>
                    
                    <div class="label-main">
                        <div class="place-title">${i + 1}</div>
                        <div class="place-subtitle">МЕСТО ИЗ ${totalPlaces}</div>
                    </div>
                    
                    <div class="label-footer">
                         ${printSettings.showRecipient ? `
                         <div class="info-block">
                            <strong>Получатель</strong>
                            ${order.agent?.name || 'Частное лицо'}
                         </div>` : '<div></div>'}
                         
                         ${printSettings.showSender && order.organization?.name ? `
                         <div class="info-block" style="text-align: right">
                            <strong>Отправитель</strong>
                            ${order.organization.name}
                         </div>` : '<div></div>'}

                         ${printSettings.showComment && orderComment ? `
                         <div class="comment-block">
                            ${orderComment}
                         </div>` : ''}
                    </div>
                </div>
            </div>
          `).join('')}
        </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
  };

  // --- Render ---
  
  // Calculate totals
  const totalItemsCount = positions.reduce((sum, p) => sum + p.quantity, 0);
  const packedItemsCount = places.reduce((acc, place) => acc + place.items.reduce((s, i) => s + i.quantity, 0), 0);
  const progressPercent = totalItemsCount > 0 ? Math.min(100, Math.round((packedItemsCount / totalItemsCount) * 100)) : 0;
  const isFullyPacked = progressPercent === 100;
  
  // Filter Unpacked
  const filteredUnpacked = unpackedItems.filter(item => {
    const searchLower = searchTerm.toLowerCase();
    return item.assortment.name.toLowerCase().includes(searchLower) ||
           item.assortment.code?.toLowerCase().includes(searchLower) ||
           item.assortment.article?.toLowerCase().includes(searchLower);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#f8fafc] w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">
        
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col gap-3 shrink-0 relative z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-xl ${isFullyPacked ? 'bg-emerald-100 text-emerald-600' : 'bg-primary-50 text-primary-600'}`}>
                {isFullyPacked ? <CheckCircle2 className="w-6 h-6" /> : <Package className="w-6 h-6" />}
                </div>
                <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    Упаковка заказа {order.name}
                    {isSyncing ? 
                        <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin" title="Синхронизация..." /> :
                        <Cloud className="w-3.5 h-3.5 text-emerald-500" title="Сохранено в облаке" />
                    }
                </h2>
                <div className="flex items-center gap-3 text-xs font-medium text-slate-500 mt-0.5">
                    <span className="flex items-center"><Box className="w-3 h-3 mr-1" /> {packedItemsCount} из {totalItemsCount} товаров</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span className="flex items-center"><Truck className="w-3 h-3 mr-1" /> {places.length} мест</span>
                </div>
                </div>
            </div>
            
            <div className="flex items-center gap-2">
                <div className="relative">
                    <button 
                        onClick={() => setShowPrintSettings(!showPrintSettings)}
                        className={`p-2 rounded-lg transition-colors ${showPrintSettings ? 'bg-primary-100 text-primary-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                        title="Настройки печати"
                    >
                        <Settings className="w-5 h-5" />
                    </button>

                    {showPrintSettings && (
                        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-4 z-50 animate-in fade-in slide-in-from-top-2">
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Настройки документов</div>
                            
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${printSettings.showCode ? 'bg-primary-600 border-primary-600' : 'border-slate-300 bg-white'}`}>
                                        {printSettings.showCode && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    <input type="checkbox" className="hidden" checked={printSettings.showCode} onChange={() => setPrintSettings(s => ({...s, showCode: !s.showCode}))} />
                                    <span className="text-sm text-slate-700 group-hover:text-primary-700">Код товара</span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${printSettings.showArticle ? 'bg-primary-600 border-primary-600' : 'border-slate-300 bg-white'}`}>
                                        {printSettings.showArticle && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    <input type="checkbox" className="hidden" checked={printSettings.showArticle} onChange={() => setPrintSettings(s => ({...s, showArticle: !s.showArticle}))} />
                                    <span className="text-sm text-slate-700 group-hover:text-primary-700">Артикул</span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${printSettings.showUom ? 'bg-primary-600 border-primary-600' : 'border-slate-300 bg-white'}`}>
                                        {printSettings.showUom && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    <input type="checkbox" className="hidden" checked={printSettings.showUom} onChange={() => setPrintSettings(s => ({...s, showUom: !s.showUom}))} />
                                    <span className="text-sm text-slate-700 group-hover:text-primary-700">Ед. измерения</span>
                                </label>
                                
                                <div className="h-px bg-slate-100 my-2"></div>

                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${printSettings.showRecipient ? 'bg-primary-600 border-primary-600' : 'border-slate-300 bg-white'}`}>
                                        {printSettings.showRecipient && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    <input type="checkbox" className="hidden" checked={printSettings.showRecipient} onChange={() => setPrintSettings(s => ({...s, showRecipient: !s.showRecipient}))} />
                                    <span className="text-sm text-slate-700 group-hover:text-primary-700">Получатель</span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${printSettings.showSender ? 'bg-primary-600 border-primary-600' : 'border-slate-300 bg-white'}`}>
                                        {printSettings.showSender && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    <input type="checkbox" className="hidden" checked={printSettings.showSender} onChange={() => setPrintSettings(s => ({...s, showSender: !s.showSender}))} />
                                    <span className="text-sm text-slate-700 group-hover:text-primary-700">Отправитель</span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${printSettings.showComment ? 'bg-primary-600 border-primary-600' : 'border-slate-300 bg-white'}`}>
                                        {printSettings.showComment && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    <input type="checkbox" className="hidden" checked={printSettings.showComment} onChange={() => setPrintSettings(s => ({...s, showComment: !s.showComment}))} />
                                    <span className="text-sm text-slate-700 group-hover:text-primary-700">Комментарий</span>
                                </label>
                            </div>
                        </div>
                    )}
                </div>

                <div className="w-px h-6 bg-slate-200 mx-1"></div>

                <button 
                    onClick={handlePrint}
                    className="hidden sm:flex items-center px-3 py-2 text-sm font-semibold text-slate-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors gap-2"
                    title="Печать листа"
                >
                    <Printer className="w-4 h-4" /> Лист
                </button>
                <button 
                    onClick={handlePrintLabels}
                    className="hidden sm:flex items-center px-3 py-2 text-sm font-semibold text-slate-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors gap-2"
                    title="Печать этикеток"
                >
                    <Tag className="w-4 h-4" /> Этикетки
                </button>
                <div className="w-px h-6 bg-slate-200 mx-1"></div>
                <button 
                    onClick={onClose}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>
          </div>
          
          {/* Comment Field Toggle */}
          <div className="w-full">
            {!showCommentInput && !orderComment ? (
                <button 
                    onClick={() => setShowCommentInput(true)} 
                    className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1"
                >
                    <MessageCircle className="w-3 h-3" /> Добавить комментарий к упаковке
                </button>
            ) : (
                <div className="relative group">
                    <textarea 
                        value={orderComment}
                        onChange={(e) => setOrderComment(e.target.value)}
                        placeholder="Комментарий к упаковке (будет напечатан на листе и этикетках)..."
                        className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none resize-y min-h-[60px] text-slate-700 placeholder:text-slate-400"
                    />
                    <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <span className="text-[10px] text-slate-400 bg-white/80 px-1 rounded">Автосохранение</span>
                    </div>
                </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-slate-100 w-full shrink-0">
            <div 
                className={`h-full transition-all duration-500 ${isFullyPacked ? 'bg-emerald-500' : 'bg-primary-500'}`} 
                style={{ width: `${progressPercent}%` }}
            ></div>
        </div>

        {/* Mobile Tabs */}
        <div className="md:hidden flex border-b border-slate-200 bg-white shrink-0">
            <button 
                onClick={() => setActiveTab('items')}
                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'items' ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500'}`}
            >
                Товары ({filteredUnpacked.length})
            </button>
            <button 
                onClick={() => setActiveTab('boxes')}
                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'boxes' ? 'border-primary-500 text-primary-600' : 'border-transparent text-slate-500'}`}
            >
                Коробки ({places.length})
            </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-[#f1f5f9]">
            
            {/* LEFT: Unpacked Items */}
            <div className={`flex-1 flex flex-col bg-white border-r border-slate-200 h-full ${activeTab === 'items' ? 'block' : 'hidden md:flex'}`}>
                {/* Toolbar */}
                <div className="p-3 border-b border-slate-100 flex items-center gap-2 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Поиск товара..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                        <span className="text-xs font-semibold text-slate-500 uppercase">В:</span>
                        <select 
                            value={targetPlaceId} 
                            onChange={(e) => setTargetPlaceId(Number(e.target.value))}
                            className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
                        >
                            {places.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {filteredUnpacked.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                {searchTerm ? <Search className="w-6 h-6" /> : <CheckCircle2 className="w-8 h-8 text-emerald-300" />}
                            </div>
                            <p className="font-medium">{searchTerm ? 'Ничего не найдено' : 'Все товары упакованы'}</p>
                        </div>
                    ) : (
                        filteredUnpacked.map(item => (
                            <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-3 hover:border-primary-300 hover:shadow-sm transition-all group flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between">
                                        <h4 className="font-semibold text-slate-700 text-sm leading-tight mb-1">{item.assortment.name}</h4>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 ml-2 whitespace-nowrap">
                                            {item.quantity} {item.assortment.uom?.name || 'шт'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                        {item.assortment.article && <span className="bg-slate-50 px-1.5 rounded border border-slate-100">Aрт: {item.assortment.article}</span>}
                                        {item.assortment.code && <span className="truncate">Код: {item.assortment.code}</span>}
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0 justify-end">
                                    <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 p-0.5">
                                        <button 
                                            onClick={() => setMoveAmounts({ ...moveAmounts, [item.id]: Math.max(1, (moveAmounts[item.id] || 1) - 1) })}
                                            className="w-7 h-7 flex items-center justify-center text-slate-500 hover:bg-white hover:shadow-sm rounded-md transition-all"
                                        >-</button>
                                        <input 
                                            type="number" 
                                            min="1" 
                                            max={item.quantity}
                                            value={moveAmounts[item.id] || 1}
                                            onChange={(e) => setMoveAmounts({ ...moveAmounts, [item.id]: Math.max(1, Math.min(item.quantity, parseInt(e.target.value) || 1)) })}
                                            className="w-10 text-center bg-transparent text-sm font-bold text-slate-700 outline-none"
                                        />
                                        <button 
                                            onClick={() => setMoveAmounts({ ...moveAmounts, [item.id]: Math.min(item.quantity, (moveAmounts[item.id] || 1) + 1) })}
                                            className="w-7 h-7 flex items-center justify-center text-slate-500 hover:bg-white hover:shadow-sm rounded-md transition-all"
                                        >+</button>
                                    </div>
                                    <button 
                                        onClick={() => moveItemToPlace(item)}
                                        className="bg-primary-600 text-white p-2 rounded-lg hover:bg-primary-700 shadow-lg shadow-primary-500/20 active:scale-95 transition-all"
                                        title="Добавить в коробку"
                                    >
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* RIGHT: Cargo Places */}
            <div className={`flex-1 flex flex-col bg-slate-50/50 h-full ${activeTab === 'boxes' ? 'block' : 'hidden md:flex'}`}>
                {/* Toolbar */}
                <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">Грузовые места</span>
                    <button 
                        onClick={handleAddPlace}
                        className="flex items-center px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-sm font-bold rounded-lg hover:border-primary-500 hover:text-primary-600 shadow-sm transition-all"
                    >
                        <Plus className="w-4 h-4 mr-1.5" /> Добавить место
                    </button>
                </div>

                {/* Places List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {places.map(place => (
                        <div 
                            key={place.id} 
                            onClick={() => setTargetPlaceId(place.id)}
                            className={`bg-white rounded-xl border transition-all duration-200 ${
                                targetPlaceId === place.id 
                                ? 'border-primary-500 shadow-md ring-1 ring-primary-500/20' 
                                : 'border-slate-200 shadow-sm hover:border-primary-300'
                            }`}
                        >
                            {/* Header */}
                            <div className={`px-4 py-3 flex items-center justify-between border-b ${targetPlaceId === place.id ? 'border-primary-100 bg-primary-50/30' : 'border-slate-100'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${targetPlaceId === place.id ? 'bg-primary-100 text-primary-600' : 'bg-slate-100 text-slate-500'}`}>
                                        <Box className="w-4 h-4" />
                                    </div>
                                    
                                    {editingPlaceId === place.id ? (
                                        <input 
                                            autoFocus
                                            type="text"
                                            value={editNameValue}
                                            onChange={(e) => setEditNameValue(e.target.value)}
                                            onBlur={() => {
                                                if (editNameValue.trim()) {
                                                    setPlaces(places.map(p => p.id === place.id ? { ...p, name: editNameValue } : p));
                                                }
                                                setEditingPlaceId(null);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    if (editNameValue.trim()) {
                                                        setPlaces(places.map(p => p.id === place.id ? { ...p, name: editNameValue } : p));
                                                    }
                                                    setEditingPlaceId(null);
                                                }
                                            }}
                                            className="text-sm font-bold text-slate-800 bg-white border border-primary-300 rounded px-2 py-1 outline-none w-40"
                                        />
                                    ) : (
                                        <div className="group/name flex items-center gap-2 cursor-pointer" onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingPlaceId(place.id);
                                            setEditNameValue(place.name);
                                        }}>
                                            <span className="font-bold text-slate-700 text-sm">{place.name}</span>
                                            <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover/name:opacity-100 transition-opacity" />
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-slate-400">{place.items.reduce((acc, i) => acc + i.quantity, 0)} ед.</span>
                                    {places.length > 1 && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleRemovePlace(place.id); }}
                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Удалить место (вернуть товары)"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Items in Place */}
                            <div className="p-2 space-y-1">
                                {place.items.length === 0 ? (
                                    <div className="py-6 text-center text-xs text-slate-400 border-2 border-dashed border-slate-100 rounded-lg">
                                        Коробка пуста
                                    </div>
                                ) : (
                                    place.items.map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg group text-sm">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <span className="text-slate-400 text-xs w-4 text-center">{idx + 1}</span>
                                                <div className="truncate">
                                                    <div className="text-slate-700 font-medium truncate" title={item.name}>{item.name}</div>
                                                    <div className="text-xs text-slate-400 flex gap-2">
                                                        {item.article && <span>{item.article}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 pl-2">
                                                <span className="font-bold text-slate-600 text-xs bg-slate-100 px-2 py-1 rounded">
                                                    {item.quantity} {item.uom}
                                                </span>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); moveItemToUnpacked(place.id, idx); }}
                                                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-all"
                                                    title="Вернуть 1 шт"
                                                >
                                                    <Undo2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ))}
                    
                    <button 
                        onClick={handleAddPlace}
                        className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-400 font-bold text-sm hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-all flex items-center justify-center gap-2"
                    >
                        <Plus className="w-5 h-5" /> Добавить новое место
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
