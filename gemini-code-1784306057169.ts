import React, { useState } from 'react';
import { Plus, ChevronDown, ChevronRight } from 'lucide-react';
import { Department, User } from '../types';

interface SidebarProps {
  departments: Department[];
  activeDepartment: string;
  activeSubTask: string | null;
  onSelectDepartment: (id: string, subTaskId?: string) => void;
  onAddDepartment: () => void;
  currentUser: User;
}

export const Sidebar: React.FC<SidebarProps> = ({
  departments,
  activeDepartment,
  activeSubTask,
  onSelectDepartment,
  onAddDepartment,
  currentUser
}) => {
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({});

  const toggleDept = (id: string) => {
    setExpandedDepts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col h-screen">
      <div className="p-4 border-b border-border flex items-center gap-3">
        {/* اللوجو الجديد هنا */}
        <img src="/images.png" alt="Breadfast Logo" className="w-8 h-8 rounded" />
        <span className="font-bold text-lg text-primary">Breadfast Team</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Departments
        </h2>
        <div className="space-y-1">
          {departments.map((dept) => (
            <div key={dept.id}>
              <button
                onClick={() => {
                  toggleDept(dept.id);
                  onSelectDepartment(dept.id);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors ${
                  activeDepartment === dept.id && !activeSubTask
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium">{dept.name}</span>
                </div>
                {dept.subTasks.length > 0 && (
                  expandedDepts[dept.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} />
                )}
              </button>
              
              {/* التاسكات الفرعية */}
              {expandedDepts[dept.id] && dept.subTasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => onSelectDepartment(dept.id, task.id)}
                  className={`w-full flex items-center pl-8 pr-3 py-1.5 mt-1 rounded-md text-sm transition-colors ${
                    activeSubTask === task.id
                      ? 'bg-primary/20 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  {task.name}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* إخفاء زرار الإضافة عن المستخدم العادي */}
        {currentUser.role === 'ADMIN' && (
          <button
            onClick={onAddDepartment}
            className="w-full mt-4 flex items-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          >
            <Plus size={18} />
            <span>Add department</span>
          </button>
        )}
      </div>
    </div>
  );
};