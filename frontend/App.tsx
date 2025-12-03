// v3.4.0 - 添加修改密码页面
// v3.3.0 - 仪表板数据从数据库获取
// v3.2.0 - EntryForm 欢迎页传递菜单回调
// v3.1.0 - 添加登录页面路由
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { EntryForm } from './components/EntryForm';
import { LoginPage } from './components/LoginPage';
import { ChangePasswordPage } from './components/ChangePasswordPage';
import { DailyLog, AppView } from './types';
import { Icons } from './constants';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { getPurchaseLogs } from './services/dashboardService';

// 主应用内容（需要在 AuthProvider 内部使用）
const AppContent: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // 从数据库加载采购记录
  useEffect(() => {
    async function loadLogs() {
      if (!isAuthenticated) return;

      setLogsLoading(true);
      try {
        const data = await getPurchaseLogs(user?.store_id || undefined, 30);
        setLogs(data);
        console.log(`[Dashboard] 加载了 ${data.length} 条采购记录`);
      } catch (err) {
        console.error('[Dashboard] 加载采购记录失败:', err);
      } finally {
        setLogsLoading(false);
      }
    }

    loadLogs();
  }, [isAuthenticated, user?.store_id]);

  // 从认证上下文获取用户名
  const CURRENT_USER_NAME = user?.name || "用户";

  // 加载中显示
  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="text-white text-xl">加载中...</div>
      </div>
    );
  }

  // 未登录显示登录页面
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // 刷新采购记录
  const refreshLogs = async () => {
    setLogsLoading(true);
    try {
      const data = await getPurchaseLogs(user?.store_id || undefined, 30);
      setLogs(data);
    } catch (err) {
      console.error('[Dashboard] 刷新采购记录失败:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleSaveEntry = async (logData: Omit<DailyLog, 'id'>) => {
    // 数据已通过 EntryForm -> inventoryService 提交到数据库
    // 这里刷新数据并返回仪表板
    await refreshLogs();
    setCurrentView(AppView.DASHBOARD);
  };

  const getCategoryLabel = (id: string) => {
     switch(id) {
       case 'Meat': return '肉类';
       case 'Vegetables': return '蔬果';
       case 'Dry Goods': return '干杂';
       case 'Alcohol': return '酒水';
       case 'Consumables': return '低耗';
       default: return '其他';
     }
  };

  const HistoryView = () => (
    <div className="space-y-4 animate-slide-in pb-20">
      <h1 className="text-3xl font-bold text-primary mb-6">历史记录</h1>
      {[...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((log, idx) => (
        <div key={log.id} className="glass-card p-4 flex justify-between items-center active:opacity-90 transition-colors cursor-pointer">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${log.category === 'Meat' ? 'bg-stamp-red' : log.category === 'Vegetables' ? 'bg-faded-steel' : 'bg-harbor-blue'}`}>
               <span className="text-xs font-bold">{getCategoryLabel(log.category).substring(0,2)}</span>
            </div>
            <div>
              <h3 className="text-primary font-medium">{log.supplier}</h3>
              <p className="text-sm text-secondary">{new Date(log.date).toLocaleDateString('zh-CN')}</p>
            </div>
          </div>
          <div className="text-right">
              <p className="text-harbor-blue font-bold">¥{log.totalCost.toFixed(2)}</p>
              <p className="text-xs text-muted">{log.items.length} 物品</p>
          </div>
        </div>
      ))}
    </div>
  );

  // 已登录显示主应用
  return (
    <div className="fixed inset-0 flex text-primary font-sans overflow-hidden">
      <Sidebar
        currentView={currentView}
        onChangeView={setCurrentView}
        isOpen={sidebarOpen}
        toggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onChangePassword={() => setCurrentView(AppView.CHANGE_PASSWORD)}
      />

      <div className="flex-1 flex flex-col h-full relative w-full">
        {/* Mobile Header Button - Storm Glass */}
        {currentView !== AppView.NEW_ENTRY && currentView !== AppView.CHANGE_PASSWORD && (
          <div className="md:hidden pt-6 px-4 pb-2 flex items-center justify-between">
             <span className="text-xl font-bold text-white">门店管家</span>
             <button onClick={() => setSidebarOpen(true)} className="p-2 text-white/70 hover:text-white">
               <Icons.Menu className="w-6 h-6" />
             </button>
          </div>
        )}

        <main className={`flex-1 ${currentView === AppView.DASHBOARD ? 'overflow-hidden' : 'overflow-y-auto'} ${currentView === AppView.NEW_ENTRY || currentView === AppView.CHANGE_PASSWORD ? 'p-0' : 'p-4 md:p-8'} max-w-5xl mx-auto w-full`}>
            {currentView === AppView.DASHBOARD && (
              logsLoading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-white/70">加载数据中...</div>
                </div>
              ) : (
                <Dashboard logs={logs} />
              )
            )}
            {currentView === AppView.NEW_ENTRY && <EntryForm onSave={handleSaveEntry} userName={CURRENT_USER_NAME} onOpenMenu={() => setSidebarOpen(true)} />}
            {currentView === AppView.HISTORY && <HistoryView />}
            {currentView === AppView.CHANGE_PASSWORD && <ChangePasswordPage onBack={() => setCurrentView(AppView.DASHBOARD)} />}
        </main>
      </div>
    </div>
  );
};

// 根组件：提供 AuthProvider
const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
