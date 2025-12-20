import React, { useState, useEffect, useRef } from 'react';
import { MSOrder, MSOrderPosition, PackedItem, CargoPlace, PackingListState } from '../types';
import { supabaseService } from '../services/supabaseService';
import { X, Printer, Package, Plus, ArrowRight, Trash2, Box, Undo2, Search, Settings, Check, Image as ImageIcon, Tag, MessageSquare, Truck, MoreHorizontal, Pencil, LayoutList, CheckCircle2, AlertCircle, ChevronDown, Cloud, CloudOff, RefreshCw } from 'lucide-react';
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
}

export const PackingListModal: React.FC<PackingListModalProps> = ({ order, positions, onClose }) => {
  // State for unpacked (remaining) items
  const [unpackedItems, setUnpackedItems] = useState<MSOrderPosition[]>([]);
  // State for cargo places (boxes)
  const [places, setPlaces] = useState<CargoPlace[]>([]);
  // Input state for moving items
  const [moveAmounts, setMoveAmounts] = useState<Record<string, number>>({});
  const [targetPlaceId, setTargetPlaceId] = useState<number>(1);
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  
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
    showRecipient: true
  });

  // --- Initialization & Supabase Loading & Realtime ---
  useEffect(() => {
    const loadState = async () => {
        setIsSyncing(true);
        const savedState = await supabaseService.getPackingList(order.id);
        
        if (savedState) {
            setUnpackedItems(savedState.unpacked_items);
            setPlaces(savedState.places);
            if (savedState.updated_at) setLastSaved(new Date(savedState.updated_at));
            
            // Set target place to last one
            if (savedState.places.length > 0) {
                setTargetPlaceId(savedState.places[savedState.places.length - 1].id);
            }
        } else {
            // New Session
            setUnpackedItems(JSON.parse(JSON.stringify(positions)));
            setPlaces([{ id: 1, name: 'Место 1', items: [] }]);
        }
        
        setIsSyncing(false);
        isInitialLoad.current = false;
    };
    
    loadState();

    // Subscribe to Realtime Updates
    const channel = supabaseService.subscribeToPackingList(order.id, (newState) => {
        // Prevent overwriting if local state is currently syncing (basic optimistic locking)
        if (!isInitialLoad.current) {
            console.log("Received remote update via Realtime");
            setUnpackedItems(newState.unpacked_items);
            setPlaces(newState.places);
            if (newState.updated_at) setLastSaved(new Date(newState.updated_at));
        }
    });

    return () => {
        if (channel) channel.unsubscribe();
    };

  }, [order.id, positions]);

  // --- Auto-Save Effect ---
  useEffect(() => {
      if (isInitialLoad.current) return;

      const timer = setTimeout(async () => {
          setIsSyncing(true);
          await supabaseService.savePackingList({
              order_id: order.id,
              order_name: order.name,
              places: places,
              unpacked_items: unpackedItems
          });
          setLastSaved(new Date());
          setIsSyncing(false);
      }, 1000); // Debounce 1s

      return () => clearTimeout(timer);
  }, [places, unpackedItems, order.id, order.name]);


  // --- Calculations for Progress ---
  const totalItemsCount = positions.reduce((sum, p) => sum + p.quantity, 0);
  const packedItemsCount = places.reduce((acc, place) => acc + place.items.reduce((s, i) => s + i.quantity, 0), 0);
  const progressPercent = totalItemsCount > 0 ? Math.min(100, Math.round((packedItemsCount / totalItemsCount) * 100)) : 0;
  const isFullyPacked = progressPercent === 100;

  // --- Handlers ---

  const handleAddPlace = () => {
    const newId = (places.length > 0 ? Math.max(...places.map(p => p.id)) : 0) + 1;
    setPlaces([...places, { id: newId, name: `Место ${newId}`, items: [] }]);
    setTargetPlaceId(newId);
    setActiveTab('boxes');
  };

  const handleRemovePlace = (id: number) => {
    const place = places.find(p => p.id === id);
    if (!place) return;

    const newUnpacked = [...unpackedItems];
    place.items.forEach(packedItem => {
      const existing = newUnpacked.find(u => u.id === packedItem.originalId);
      if (existing) {
        existing.quantity += packedItem.quantity;
      } else {
        const originalRef = positions.find(p => p.id === packedItem.originalId);
        if (originalRef) {
           newUnpacked.push({ ...originalRef, quantity: packedItem.quantity });
        }
      }
    });

    const remainingPlaces = places.filter(p => p.id !== id);
    setUnpackedItems(newUnpacked);
    setPlaces(remainingPlaces);

    if (targetPlaceId === id && remainingPlaces.length > 0) {
        setTargetPlaceId(remainingPlaces[remainingPlaces.length - 1].id);
    }
  };

  const handleMoveToPlace = (itemId: string, forceQuantity?: number) => {
    const sourceItemIndex = unpackedItems.findIndex(i => i.id === itemId);
    if (sourceItemIndex === -1) return;
    const sourceItem = unpackedItems[sourceItemIndex];

    const amountToMove = forceQuantity !== undefined 
        ? forceQuantity 
        : (moveAmounts[itemId] || sourceItem.quantity);

    if (amountToMove <= 0 || amountToMove > sourceItem.quantity) return;

    const targetPlaceIndex = places.findIndex(p => p.id === targetPlaceId);
    if (targetPlaceIndex === -1) {
        handleAddPlace();
        return; 
    }

    const newPlaces = [...places];
    const place = newPlaces[targetPlaceIndex];
    const existingPackedItem = place.items.find(i => i.originalId === itemId);

    if (existingPackedItem) {
      existingPackedItem.quantity += amountToMove;
    } else {
      place.items.push({
        originalId: sourceItem.id,
        name: sourceItem.assortment.name,
        code: sourceItem.assortment.code || '',
        article: sourceItem.assortment.article || '',
        uom: sourceItem.assortment.uom?.name || 'шт',
        quantity: amountToMove
      });
    }

    const newUnpacked = [...unpackedItems];
    newUnpacked[sourceItemIndex].quantity -= amountToMove;
    if (newUnpacked[sourceItemIndex].quantity <= 0.0001) {
       newUnpacked[sourceItemIndex].quantity = 0;
    }

    setPlaces(newPlaces);
    setUnpackedItems(newUnpacked);
    
    if (forceQuantity === undefined) {
        setMoveAmounts(prev => {
            const next = { ...prev };
            delete next[itemId];
            return next;
        });
    }
  };

  const handleReturnToUnpacked = (placeId: number, originalId: string) => {
    const placeIndex = places.findIndex(p => p.id === placeId);
    if (placeIndex === -1) return;

    const newPlaces = [...places];
    const itemIndex = newPlaces[placeIndex].items.findIndex(i => i.originalId === originalId);
    if (itemIndex === -1) return;

    const packedItem = newPlaces[placeIndex].items[itemIndex];
    const qtyToReturn = packedItem.quantity;

    newPlaces[placeIndex].items.splice(itemIndex, 1);

    const newUnpacked = [...unpackedItems];
    const existingUnpacked = newUnpacked.find(u => u.id === originalId);
    if (existingUnpacked) {
        existingUnpacked.quantity += qtyToReturn;
    } else {
        const originalRef = positions.find(p => p.id === originalId);
        if (originalRef) {
            newUnpacked.push({ ...originalRef, quantity: qtyToReturn });
        }
    }

    setPlaces(newPlaces);
    setUnpackedItems(newUnpacked);
  };

  const handleInputChange = (id: string, val: string) => {
    const num = parseFloat(val);
    setMoveAmounts(prev => ({ ...prev, [id]: isNaN(num) ? 0 : num }));
  };

  const startEditing = (place: CargoPlace) => {
    setEditingPlaceId(place.id);
    setEditNameValue(place.name);
  };

  const saveName = () => {
    if (editingPlaceId !== null) {
      setPlaces(places.map(p => 
        p.id === editingPlaceId ? { ...p, name: editNameValue.trim() || p.name } : p
      ));
      setEditingPlaceId(null);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveName();
    }
  };

  const filteredUnpackedItems = unpackedItems
    .filter(item => {
        const lowerTerm = searchTerm.toLowerCase();
        return (
            item.assortment.name.toLowerCase().includes(lowerTerm) ||
            (item.assortment.code && item.assortment.code.toLowerCase().includes(lowerTerm)) ||
            (item.assortment.article && item.assortment.article.toLowerCase().includes(lowerTerm))
        );
    })
    .sort((a, b) => {
        if (a.quantity > 0 && b.quantity === 0) return -1;
        if (a.quantity === 0 && b.quantity > 0) return 1;
        return 0;
    });

  const handlePrint = () => {
       const printWindow = window.open('', '', 'height=900,width=850');
    if (!printWindow) return;
    const nonEmptyPlaces = places.filter(p => p.items.length > 0);
     const customCss = `body { padding: 20px; font-family: sans-serif; } table { width: 100%; border-collapse: collapse; } td, th { border: 1px solid #ddd; padding: 8px; }`;
     const placesHtml = nonEmptyPlaces.map((place, index) => {
        const rows = place.items.map((item, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td>${item.name} (${item.code || ''})</td>
                <td>${item.quantity} ${item.uom}</td>
            </tr>
        `).join('');
        return `<h3>${place.name}</h3><table>${rows}</table>`;
     }).join('');
     const html = `<html><head><style>${customCss}</style></head><body><h1>Упаковочный лист ${order.name}</h1>${placesHtml}<script>window.print()</script></body></html>`;
     printWindow.document.write(html);
     printWindow.document.close();
  };

  const handlePrintLabels = () => {
      const printWindow = window.open('', '', 'height=600,width=800');
      if (!printWindow) return;
      const nonEmptyPlaces = places.filter(p => p.items.length > 0);
      const labelsHtml = nonEmptyPlaces.map((place, i) => `
        <div style="border: 1px solid black; padding: 10px; margin: 10px; height: 300px; page-break-after: always;">
            <h1>Заказ ${order.name}</h1>
            <h2>${place.name} (${i+1}/${nonEmptyPlaces.length})</h2>
            <p>${place.items.length} позиций</p>
        </div>
      `).join('');
       const html = `<html><body style="margin:0">${labelsHtml}<script>window.print()</script></body></html>`;
       printWindow.document.write(html);
       printWindow.document.close();
  };

  // Item Renderer for Virtuoso
  const ItemRow = ({ item }: { item: MSOrderPosition }) => {
     const isDone = item.quantity === 0;
     return (
        <div className={`group relative border rounded-xl p-3 md:p-4 transition-all duration-200 mb-2 mr-2 ${isDone ? 'bg-slate-50 border-slate-100 opacity-60' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="flex justify-between items-start gap-3">
            <div className="flex-1 min-w-0">
                <div className={`font-bold text-sm leading-tight mb-1 ${isDone ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                    {item.assortment.name}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {item.assortment.article && <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200 truncate max-w-[100px]">{item.assortment.article}</span>}
                    <span className="text-xs text-slate-400">{item.assortment.uom?.name}</span>
                </div>
            </div>
            
            <div className="shrink-0 text-right">
                {isDone ? (
                    <div className="flex items-center text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-1 rounded-full">
                        <Check className="w-3 h-3 mr-1" />
                        Готово
                    </div>
                ) : (
                    <div className="text-sm font-bold text-slate-400">
                        Ост: <span className="text-primary-600 text-base">{item.quantity}</span>
                    </div>
                )}
            </div>
        </div>
        
        {!isDone && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button 
                onClick={() => handleMoveToPlace(item.id, 1)}
                className="flex-1 py-2 bg-primary-50 text-primary-700 font-bold text-sm rounded-lg border border-primary-100 hover:bg-primary-100 active:scale-95 transition-all flex items-center justify-center"
                >
                <Plus className="w-3 h-3 mr-1" /> 1
                </button>

                <div className="w-px h-8 bg-slate-200 mx-1"></div>

                <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-0.5 border border-slate-200">
                <input 
                    type="number" 
                    min="0"
                    max={item.quantity}
                    placeholder="0"
                    value={moveAmounts[item.id] !== undefined ? moveAmounts[item.id] : ''}
                    onChange={(e) => handleInputChange(item.id, e.target.value)}
                    className="w-12 py-1.5 text-center bg-transparent text-sm font-bold focus:outline-none"
                />
                <button 
                    onClick={() => handleMoveToPlace(item.id)}
                    disabled={places.length === 0}
                    className="bg-slate-800 text-white p-1.5 rounded-md hover:bg-slate-700 active:scale-95 disabled:opacity-50"
                >
                    <ArrowRight className="w-4 h-4" />
                </button>
                </div>
        </div>
        )}
        </div>
     );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col md:items-center md:justify-center bg-white md:bg-slate-900/60 md:backdrop-blur-sm md:p-4 animate-in fade-in duration-200 h-[100dvh]">
      
      <div className="bg-slate-50 md:bg-white md:rounded-2xl shadow-none md:shadow-2xl w-full max-w-6xl h-full md:h-[90vh] flex flex-col overflow-hidden relative">
        
        {/* Header */}
        <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-200 bg-white z-20 shrink-0">
            <div className="flex justify-between items-center gap-2">
                
                <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                    <div className="bg-primary-50 p-2 rounded-xl text-primary-600 hidden md:block">
                        <Truck className="w-6 h-6" />
                    </div>
                    <button onClick={onClose} className="md:hidden p-1 -ml-1 text-slate-400">
                         <X className="w-6 h-6" />
                    </button>
                    <div className="overflow-hidden">
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg md:text-xl font-bold text-slate-800 flex items-center truncate">
                            <span className="truncate">Заказ #{order.name}</span>
                            </h3>
                            {/* Cloud Status Indicator */}
                            {supabaseService.isConfigured && (
                                <div className="hidden md:flex items-center" title={isSyncing ? "Сохранение..." : "Сохранено"}>
                                    {isSyncing ? (
                                        <Cloud className="w-4 h-4 text-slate-400 animate-pulse" />
                                    ) : (
                                        <div className="flex items-center text-xs text-slate-300">
                                            <Cloud className="w-4 h-4 mr-1 text-emerald-400" />
                                            {lastSaved && <span>{lastSaved.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <p className="text-sm text-slate-500 font-medium hidden md:block">Распределите товары по коробкам</p>
                        <p className="text-xs text-slate-500 font-bold md:hidden">
                            {packedItemsCount} / {totalItemsCount} ед. ({progressPercent}%)
                        </p>
                    </div>
                </div>

                <div className="flex space-x-2 items-center">
                    <div className="hidden md:flex gap-2">
                         <button onClick={handlePrintLabels} className="btn-secondary text-sm px-3 py-2 border rounded-lg hover:bg-slate-50 font-bold text-slate-600">Этикетки</button>
                        <button onClick={handlePrint} className="btn-primary text-sm px-3 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 font-bold shadow-lg shadow-slate-200">Печать</button>
                    </div>
                    
                    {isFullyPacked && (
                        <button onClick={handlePrint} className="md:hidden p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                            <Printer className="w-5 h-5" />
                        </button>
                    )}

                    <button
                        onClick={onClose}
                        className="hidden md:block p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
            </div>

            <div className="mt-3 w-full">
                <div className="h-1.5 md:h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-500 ease-out rounded-full ${isFullyPacked ? 'bg-emerald-500' : 'bg-primary-500'}`}
                        style={{ width: `${progressPercent}%` }}
                    ></div>
                </div>
            </div>

            <div className="flex md:hidden bg-slate-100 p-1 rounded-lg mt-3">
                <button 
                    onClick={() => setActiveTab('items')}
                    className={`flex-1 flex items-center justify-center py-2 text-xs font-bold rounded-md transition-all ${activeTab === 'items' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                >
                    Товары ({unpackedItems.filter(i => i.quantity > 0).length})
                </button>
                <button 
                    onClick={() => setActiveTab('boxes')}
                    className={`flex-1 flex items-center justify-center py-2 text-xs font-bold rounded-md transition-all ${activeTab === 'boxes' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}
                >
                    Коробки ({places.length})
                </button>
            </div>
        </div>

        <div className="flex-1 overflow-hidden flex bg-slate-50 relative">
          
          {/* LEFT COLUMN: ITEMS with Virtualization */}
          <div className={`${activeTab === 'items' ? 'flex' : 'hidden'} md:flex md:w-5/12 w-full flex-col border-r border-slate-200 bg-white h-full`}>
            
            {/* Search Bar */}
            <div className="p-3 md:p-5 bg-white border-b border-slate-100 shrink-0">
                <div className="relative group">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    <input 
                        type="text" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Поиск товара..."
                        className="w-full pl-9 pr-4 py-2 text-sm bg-slate-100 border-none rounded-lg focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                    />
                </div>
            </div>
            
            {/* Virtuoso Scrollable List */}
            <div className="flex-1 p-2 md:p-4 pb-24 md:pb-4 bg-slate-50/50">
              {filteredUnpackedItems.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-40 text-slate-400 text-sm">
                    {unpackedItems.length === 0 ? "Загрузка..." : "Ничего не найдено"}
                 </div>
              ) : (
                <Virtuoso 
                    style={{ height: '100%' }}
                    data={filteredUnpackedItems}
                    itemContent={(index, item) => <ItemRow item={item} />}
                />
              )}
            </div>

             <div className="md:hidden absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-30">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 bg-slate-100 rounded-lg px-3 py-2 flex items-center justify-between">
                         <span className="text-xs font-bold text-slate-500 uppercase">Куда:</span>
                         <select 
                            value={targetPlaceId}
                            onChange={(e) => setTargetPlaceId(Number(e.target.value))}
                            className="bg-transparent font-bold text-slate-800 text-sm focus:outline-none text-right w-full"
                          >
                              {places.map(p => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                          </select>
                    </div>
                    <button onClick={handleAddPlace} className="bg-emerald-500 text-white p-2.5 rounded-lg shadow-lg shadow-emerald-500/30">
                         <Plus className="w-5 h-5" />
                    </button>
                </div>
             </div>
          </div>

          {/* RIGHT COLUMN: BOXES */}
          <div className={`${activeTab === 'boxes' ? 'flex' : 'hidden'} md:flex md:w-7/12 w-full flex-col bg-slate-100 md:bg-slate-50 h-full relative`}>
             <div className="hidden md:flex p-5 border-b border-slate-200 bg-white justify-between items-center shadow-sm z-10 sticky top-0">
                <div className="flex items-center space-x-4">
                  <h4 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Грузовые места</h4>
                  <div className="flex items-center space-x-2 bg-slate-100 rounded-lg p-1">
                      <span className="text-xs text-slate-500 font-bold px-2">В коробку:</span>
                      <select 
                        value={targetPlaceId}
                        onChange={(e) => setTargetPlaceId(Number(e.target.value))}
                        className="bg-white border-none text-sm font-bold text-slate-800 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                      >
                          {places.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                      </select>
                  </div>
                </div>
                <button 
                    onClick={handleAddPlace}
                    className="flex items-center px-4 py-2 bg-emerald-500 text-white text-sm font-bold rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Новое место
                </button>
             </div>
            
             <button 
                onClick={handleAddPlace}
                className="md:hidden absolute bottom-6 right-6 z-40 bg-emerald-500 text-white w-14 h-14 rounded-full shadow-xl shadow-emerald-500/40 flex items-center justify-center active:scale-90 transition-transform"
             >
                 <Plus className="w-7 h-7" />
             </button>

             <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4 md:space-y-6 pb-20 md:pb-6">
                {places.map((place) => (
                    <div 
                        key={place.id} 
                        className={`bg-white rounded-xl md:rounded-2xl border transition-all duration-300 relative overflow-hidden ${targetPlaceId === place.id ? 'border-primary-500 shadow-md ring-1 ring-primary-500' : 'border-slate-200 shadow-sm'}`}
                        onClick={() => setTargetPlaceId(place.id)}
                    >
                        {targetPlaceId === place.id && (
                            <div className="absolute top-0 right-0 bg-primary-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                                АКТИВНО
                            </div>
                        )}

                        <div className="px-4 py-3 border-b border-slate-50 flex justify-between items-center bg-white">
                            <div className="flex items-center flex-1 mr-2">
                                <div className={`w-8 h-8 rounded-lg mr-3 flex items-center justify-center ${targetPlaceId === place.id ? 'bg-primary-100 text-primary-600' : 'bg-slate-100 text-slate-400'}`}>
                                    <Box className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    {editingPlaceId === place.id ? (
                                        <input
                                            autoFocus
                                            type="text"
                                            value={editNameValue}
                                            onChange={(e) => setEditNameValue(e.target.value)}
                                            onBlur={saveName}
                                            onKeyDown={handleNameKeyDown}
                                            onClick={(e) => e.stopPropagation()} 
                                            className="w-full font-bold text-slate-800 border-b-2 border-primary-500 bg-transparent py-0.5 focus:outline-none"
                                        />
                                    ) : (
                                        <div className="flex items-center" onClick={(e) => { e.stopPropagation(); startEditing(place); }}>
                                            <h5 className="font-bold text-slate-800 truncate text-sm md:text-base">{place.name}</h5>
                                            <Pencil className="w-3 h-3 text-slate-300 ml-2" />
                                        </div>
                                    )}
                                    <div className="text-xs text-slate-400 font-medium">{place.items.reduce((acc, i) => acc + i.quantity, 0)} шт.</div>
                                </div>
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleRemovePlace(place.id); }}
                                className="text-slate-300 hover:text-red-500 p-2"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                        
                        <div className="p-0">
                            {place.items.length === 0 ? (
                                <div className="py-6 text-center">
                                    <p className="text-xs text-slate-400">Пусто</p>
                                </div>
                            ) : (
                                <table className="w-full text-sm">
                                    <tbody className="divide-y divide-slate-50">
                                        {place.items.map((item, idx) => (
                                            <tr key={`${place.id}-${item.originalId}-${idx}`} className="group/row active:bg-slate-50">
                                                <td className="py-2 px-4 text-slate-700 font-medium text-xs md:text-sm">
                                                    {item.name}
                                                </td>
                                                <td className="py-2 px-2 text-right w-16">
                                                    <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold text-xs whitespace-nowrap">
                                                        {item.quantity} {item.uom}
                                                    </span>
                                                </td>
                                                <td className="py-2 px-2 w-8 text-right">
                                                     <button 
                                                        onClick={(e) => { e.stopPropagation(); handleReturnToUnpacked(place.id, item.originalId); }}
                                                        className="text-slate-300 hover:text-orange-500 p-1"
                                                     >
                                                         <Undo2 className="w-4 h-4" />
                                                     </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                ))}
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};