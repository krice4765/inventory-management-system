import React, { useState } from 'react';
import { User, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOrderManagers, useCreateOrderManager } from '../hooks/useOrderManagers';

interface OrderManagerSelectProps {
  value?: string;
  onChange: (managerId: string) => void;
  required?: boolean;
  className?: string;
}

export function OrderManagerSelect({ 
  value, 
  onChange, 
  required = false, 
  className = '' 
}: OrderManagerSelectProps) {
  const { data: managers = [], isLoading } = useOrderManagers();
  const createManager = useCreateOrderManager();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newManager, setNewManager] = useState({
    name: '',
    department: '',
    email: ''
  });

  const handleAddManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newManager.name.trim()) return;

    try {
      const created = await createManager.mutateAsync({
        name: newManager.name.trim(),
        department: newManager.department.trim() || undefined,
        email: newManager.email.trim() || undefined,
        is_active: true
      });
      
      onChange(created.id);
      setNewManager({ name: '', department: '', email: '' });
      setShowAddForm(false);
    } catch (error) {
      console.error('Failed to create manager:', error);
    }
  };

  if (isLoading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
        <div className="p-1 rounded bg-blue-50 dark:bg-blue-900/20">
          <User className="w-3 h-3 text-blue-600 dark:text-blue-400" />
        </div>
        発注担当者
        {required && <span className="text-red-500">*</span>}
      </label>
      
      <div className="flex gap-2">
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          required={required}
        >
          <option value="">担当者を選択してください</option>
          {managers.map((manager) => (
            <option key={manager.id} value={manager.id}>
              {manager.name} {manager.department && `(${manager.department})`}
            </option>
          ))}
        </select>
        
        <motion.button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
          title="担当者を追加"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </motion.button>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border rounded-lg p-4 bg-gray-50 dark:bg-gray-800"
          >
            <form onSubmit={handleAddManager} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  担当者名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newManager.name}
                  onChange={(e) => setNewManager({ ...newManager, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="例: 田中太郎"
                  required
                />
              </div>
              
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">部署</label>
                <input
                  type="text"
                  value={newManager.department}
                  onChange={(e) => setNewManager({ ...newManager, department: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="例: 資材部"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">メールアドレス</label>
                <input
                  type="email"
                  value={newManager.email}
                  onChange={(e) => setNewManager({ ...newManager, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="例: tanaka@company.com"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={!newManager.name.trim() || createManager.isPending}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {createManager.isPending ? '追加中...' : '追加'}
                </button>
                
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}