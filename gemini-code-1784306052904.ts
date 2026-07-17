export type Role = 'ADMIN' | 'USER';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface SubTask {
  id: string;
  name: string;
  sheetFolderId?: string; // لربط فولدر درايف بالتاسك
}

export interface Department {
  id: string;
  name: string;
  icon: string;
  subTasks: SubTask[]; // إضافة التاسكات الفرعية
}

// ... (باقي الأنواع زي ما هي)