import React, { useEffect, useState } from 'react';
import { MSProduct, MSOrder, MSOrderPosition, PackingListState } from '../types';
import { moysklad } from '../services/moyskladService';
import { supabaseService } from '../services/supabaseService';
import { PackingListModal } from './PackingListModal';
import { 
  ShoppingCart, 
  Search, Loader2, FileText, LayoutDashboard, LogOut, Package, Box, User, Briefcase, Calendar, ChevronRight, History, Clock, Trash2, Menu, X
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [currentView, setCurrentView] = useState<'orders' | 'history'>('orders');
  
  const [products, setProducts] = useState<MSProduct[]>([]);
  const [orders, setOrders] = useState<MSOrder[]>([]);
  const [historyItems, setHistoryItems] = useState<PackingListState[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Mobile Nav State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Delete Confirmation State
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Packing List State
  const [selectedOrder, setSelectedOrder] = useState<MSOrder | null>(null);
  const [orderPositions, setOrderPositions] = useState<MSOrderPosition[]>([]);
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Fetch History when view changes to 'history'
  useEffect(() => {
    if (currentView === 'history') {
        fetchHistory();
    }
  }, [currentView]);

  const fetchInitialData = async () => {
    try {
      const [fetchedProducts, fetchedOrders] = await Promise.all([
        moysklad.getProducts(50),
        moysklad.getOrders(20)
      ]);
      setProducts(fetchedProducts);
      setOrders(fetchedOrders);
    } catch (err) {
      console.error("Не удалось загрузить данные", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
      setHistoryLoading(true);
      const items = await supabaseService.getPackingHistory();
      setHistoryItems(items);
      setHistoryLoading(false);
  };

  const handleSearch = async () => {
    if (currentView === 'history') return; 
    
    setLoading(true);
    try {
      const fetchedOrders = await moysklad.getOrders(50, searchTerm);
      setOrders(fetchedOrders);
    } catch (err) {
      console.error("Ошибка поиска", err);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleGeneratePackingList = async (order: MSOrder) => {
    setIsLoadingPositions(true);
    setSelectedOrder(order);
    try {
        const positions = await moysklad.getOrderPositions(order.id);
        setOrderPositions(positions);
    } catch (e) {
        console.error("Ошибка загрузки позиций", e);
    } finally {
        setIsLoadingPositions(false);
    }
  };

  const handleOpenHistoryItem = async (item: PackingListState) => {
      setIsLoadingPositions(true);
      try {
          const order = await moysklad.getOrder(item.order_id);
          if (!order) {
              alert("Заказ не найден в МойСклад (возможно удален)");
              setIsLoadingPositions(false);
              return;
          }
          setSelectedOrder(order);
          const positions = await moysklad.getOrderPositions(item.order_id);
          setOrderPositions(positions);
      } catch (e) {
          console.error("Error opening history item", e);
      } finally {
          setIsLoadingPositions(false);
      }
  };

  const handleDeleteClick = (e: React.MouseEvent, orderId: string) => {
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      setItemToDelete(orderId);
  };

  const confirmDelete = async () => {
      if (!itemToDelete) return;
      
      const success = await supabaseService.deletePackingList(itemToDelete);
      if (success) {
          setHistoryItems(prev => prev.filter(item => item.order_id !== itemToDelete));
      } else {
          console.error('Ошибка при удалении. Проверьте права доступа или консоль.');
      }
      setItemToDelete(null);
  };

  // Shared Navigation Content
  const SidebarContent = () => (
    <>
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="bg-gradient-to-br from-primary-500 to-primary-600 text-white p-2 rounded-xl shadow-lg shadow-primary-500/30">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div>
             <h2 className="text-lg font-bold tracking-tight leading-none text-white">МойСклад</h2>
             <span className="text-xs text-slate-400 font-medium">Коннектор v2.0</span>
          </div>
        </div>
        
        {moysklad.isDemoMode && (
           <div className="mx-6 mt-6 bg-amber-500/10 text-amber-500 text-xs px-4 py-3 rounded-xl flex items-center font-bold border border-amber-500/20">
              <div className="w-2 h-2 rounded-full bg-amber-500 mr-2 animate-pulse"></div>
              РЕЖИМ ДЕМО
           </div>
        )}

        <nav className="flex-1 px-4 py-8 space-y-2">
          <div className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Основное</div>
          
          <button 
            onClick={() => { setCurrentView('orders'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center px-4 py-3.5 rounded-xl font-medium transition-all group relative overflow-hidden ${currentView === 'orders' ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            {currentView === 'orders' && <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/10 opacity-100"></div>}
            <ShoppingCart className="w-5 h-5 mr-3" /> 
            Заказы покупателей
            {currentView === 'orders' && <ChevronRight className="w-4 h-4 ml-auto opacity-50" />}
          </button>

          <button 
            onClick={() => { setCurrentView('history'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center px-4 py-3.5 rounded-xl font-medium transition-all group relative overflow-hidden ${currentView === 'history' ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            {currentView === 'history' && <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/10 opacity-100"></div>}
            <History className="w-5 h-5 mr-3" /> 
            История упаковки
            {currentView === 'history' && <ChevronRight className="w-4 h-4 ml-auto opacity-50" />}
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
           <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 flex items-center justify-center text-slate-900 font-bold text-xs">
                  AD
              </div>
              <div className="overflow-hidden">
                  <div className="text-sm font-bold text-white truncate">Admin User</div>
                  <div className="text-xs text-slate-500 truncate">admin@company.ru</div>
              </div>
           </div>
           <button 
             onClick={() => window.location.reload()}
             className="flex items-center justify-center text-xs font-bold text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors w-full px-4 py-2 rounded-lg border border-slate-700 hover:border-red-400/30"
           >
             <LogOut className="w-3 h-3 mr-2" /> ВЫЙТИ
           </button>
        </div>
    </>
  );

  if (loading && !orders.length && !products.length) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <div className="relative">
            <div className="w-16 h-16 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin"></div>
            <Package className="w-6 h-6 text-primary-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
        </div>
        <span className="text-sm text-slate-500 font-semibold mt-4 tracking-wide">ЗАГРУЗКА ДАННЫХ...</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f1f5f9] font-sans text-slate-800 overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="w-72 bg-[#0f172a] hidden md:flex flex-col shadow-2xl z-20">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex">
           <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
           <div className="relative w-72 bg-[#0f172a] h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
               <button 
                 onClick={() => setIsMobileMenuOpen(false)}
                 className="absolute top-4 right-4 text-slate-400 hover:text-white"
               >
                   <X className="w-6 h-6" />
               </button>
               <SidebarContent />
           </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative bg-[#f1f5f9]">
        
        {/* Top Bar */}
        <header className="sticky top-0 z-10 bg-[#f1f5f9]/90 backdrop-blur-md px-4 md:px-8 py-4 md:py-5 flex justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-200 rounded-lg"
            >
                <Menu className="w-6 h-6" />
            </button>
            <div>
                <h1 className="text-xl md:text-2xl font-bold text-slate-800">
                    {currentView === 'orders' ? 'Заказы' : 'История упаковки'}
                </h1>
                <p className="text-xs md:text-sm text-slate-500 font-medium mt-0.5 hidden sm:block">
                    {currentView === 'orders' ? 'Управление отгрузками и упаковкой' : 'Список сохраненных упаковочных листов'}
                </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {currentView === 'orders' && (
            <div className="relative group">
              <Search 
                onClick={handleSearch}
                className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-primary-500 transition-colors cursor-pointer" 
              />
              <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Поиск..." 
                className="pl-9 pr-4 py-2 border-none bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/50 w-full md:w-80 text-sm shadow-sm font-medium placeholder:text-slate-400 transition-all"
              />
            </div>
            )}
          </div>
        </header>

        <div className="px-4 md:px-8 pb-12">
            {/* ORDERS VIEW */}
            {currentView === 'orders' && (
                <div className="flex flex-col gap-3 md:gap-4">
                    <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                        <div className="col-span-3">№ Заказа</div>
                        <div className="col-span-5">Контрагент</div>
                        <div className="col-span-3">Организация</div>
                        <div className="col-span-1 text-center"></div>
                    </div>

                    {loading && (
                        <div className="py-12 flex justify-center">
                            <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                        </div>
                    )}

                    {!loading && orders.length === 0 && (
                        <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Search className="w-8 h-8 text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700">Заказы не найдены</h3>
                            <p className="text-slate-400">Попробуйте изменить параметры поиска</p>
                        </div>
                    )}

                    {orders.map((order) => (
                    <div key={order.id} className="group relative bg-white rounded-2xl p-4 shadow-sm hover:shadow-lg hover:shadow-primary-500/5 border border-transparent hover:border-primary-100 transition-all duration-300 flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4 items-start md:items-center">
                        <div className="w-full md:col-span-3 min-w-0">
                            <div className="flex items-center gap-3">
                                <div className="bg-primary-50 text-primary-600 p-2 rounded-lg shrink-0">
                                    <Box className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="font-bold text-slate-800 text-sm truncate">{order.name}</div>
                                    <div className="flex items-center text-xs text-slate-400 mt-0.5 truncate">
                                        <Calendar className="w-3 h-3 mr-1 shrink-0" />
                                        {new Date(order.moment).toLocaleDateString('ru-RU')}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="w-full md:col-span-5 min-w-0">
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-slate-300 shrink-0" />
                                <span className="text-sm font-semibold text-slate-700 truncate">{order.agent?.name || 'Частное лицо'}</span>
                            </div>
                        </div>

                        <div className="w-full md:col-span-3 flex items-center gap-2 text-xs text-slate-500 min-w-0">
                            <Briefcase className="w-3 h-3 shrink-0" />
                            <span className="truncate">{order.organization?.name || '—'}</span>
                        </div>

                        <div className="absolute top-4 right-4 md:static md:col-span-1 flex justify-center">
                            <button 
                                onClick={() => handleGeneratePackingList(order)}
                                className="bg-slate-50 text-slate-400 hover:bg-primary-600 hover:text-white hover:shadow-lg hover:shadow-primary-600/30 p-2.5 rounded-xl transition-all active:scale-95"
                                title="Упаковать"
                            >
                                <Package className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                    ))}
                </div>
            )}

            {/* HISTORY VIEW */}
            {currentView === 'history' && (
                 <div className="flex flex-col gap-3 md:gap-4">
                    <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                        <div className="col-span-4">Заказ / ID</div>
                        <div className="col-span-4">Статус</div>
                        <div className="col-span-3">Обновлено</div>
                        <div className="col-span-1 text-center"></div>
                    </div>

                    {historyLoading && (
                        <div className="py-12 flex justify-center">
                            <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                        </div>
                    )}

                    {!historyLoading && historyItems.length === 0 && (
                        <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <History className="w-8 h-8 text-slate-300" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700">История пуста</h3>
                            <p className="text-slate-400">Здесь появятся заказы, которые вы упаковали</p>
                        </div>
                    )}

                    {historyItems.map((item) => {
                         const totalPacked = item.places.reduce((acc, p) => acc + p.items.reduce((sum, i) => sum + i.quantity, 0), 0);
                         return (
                            <div key={item.order_id} 
                                onClick={() => handleOpenHistoryItem(item)}
                                className="group relative bg-white rounded-2xl p-4 shadow-sm hover:shadow-lg hover:shadow-emerald-500/5 border border-transparent hover:border-emerald-100 transition-all duration-300 flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4 items-start md:items-center cursor-pointer"
                            >
                                <div className="w-full md:col-span-4 min-w-0">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-emerald-50 text-emerald-600 p-2 rounded-lg shrink-0">
                                            <Package className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-bold text-slate-800 text-sm truncate">Заказ {item.order_name}</div>
                                            <div className="text-xs text-slate-400 font-mono mt-0.5 truncate opacity-70">
                                                ID: {item.order_id.split('-')[0]}...
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="w-full md:col-span-4 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-slate-700 truncate">
                                            {item.places.length} мест / {totalPacked} товаров
                                        </span>
                                    </div>
                                </div>

                                <div className="w-full md:col-span-3 flex items-center gap-2 text-xs text-slate-500 min-w-0">
                                    <Clock className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{item.updated_at ? new Date(item.updated_at).toLocaleString('ru-RU') : '—'}</span>
                                </div>

                                <div 
                                    className="absolute top-4 right-4 md:static md:col-span-1 flex justify-center items-center gap-2 z-20"
                                    onClick={(e) => e.stopPropagation()} 
                                >
                                    <button 
                                        onClick={(e) => handleDeleteClick(e, item.order_id)}
                                        className="bg-slate-50 text-slate-400 hover:bg-red-500 hover:text-white p-2.5 rounded-xl transition-all active:scale-95 shadow-sm border border-slate-100 hover:border-red-500"
                                        title="Удалить"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                    <div className="bg-slate-50 text-slate-400 group-hover:bg-emerald-600 group-hover:text-white p-2.5 rounded-xl transition-all shadow-sm border border-slate-100 group-hover:border-emerald-600 pointer-events-none">
                                        <ChevronRight className="w-5 h-5" />
                                    </div>
                                </div>
                            </div>
                         );
                    })}
                 </div>
            )}
        </div>
      </main>
      
      {/* Packing List Modal */}
      {selectedOrder && !isLoadingPositions && (
        <PackingListModal 
            order={selectedOrder} 
            positions={orderPositions} 
            onClose={() => setSelectedOrder(null)} 
        />
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200 border border-white/20">
                <div className="flex flex-col items-center text-center">
                    <div className="w-14 h-14 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4 border-4 border-red-50">
                        <Trash2 className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Удалить запись?</h3>
                    <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                        Вы собираетесь безвозвратно удалить историю упаковки для этого заказа. Данные о коробках будут потеряны.
                    </p>
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={() => setItemToDelete(null)}
                            className="flex-1 py-3 px-4 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                        >
                            Отмена
                        </button>
                        <button 
                            onClick={confirmDelete}
                            className="flex-1 py-3 px-4 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 shadow-lg shadow-red-500/30 transition-colors"
                        >
                            Удалить
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {isLoadingPositions && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
              <div className="bg-white px-8 py-6 rounded-2xl flex flex-col items-center shadow-2xl animate-in zoom-in-95 duration-200">
                  <div className="relative mb-4">
                      <div className="w-12 h-12 border-4 border-slate-100 border-t-primary-500 rounded-full animate-spin"></div>
                      <FileText className="w-5 h-5 text-slate-300 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                  </div>
                  <span className="font-bold text-slate-800 text-lg">Загрузка состава...</span>
                  <span className="text-sm text-slate-400">Пожалуйста, подождите</span>
              </div>
          </div>
      )}
    </div>
  );
};