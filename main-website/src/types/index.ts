export interface Locker {
  id: string;
  status: 'AVAILABLE' | 'ACTIVE' | 'OCCUPIED' | 'MAINTENANCE';
  doorStatus: 'OPEN' | 'CLOSED';
  occupancy: 'EMPTY' | 'OCCUPIED';
  currentPin: string;
  userName: string;
  startTime: number | null;
  duration: number;
  firestoreStatus?: boolean;
  lastUpdated?: number;
}

export interface Booking {
  id: string;
  lockerId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  amount: number;
  hours: number;
  startTime: number;
  endTime?: number;
  status: 'ACTIVE' | 'CONFIRMED' | 'COMPLETED' | 'EXPIRED';
  createdAt: any;
  pin?: string;
  duration?: number;
}

export interface Alert {
  id: string;
  type: 'TAMPER' | 'FORCE_OPEN' | 'TIMEOUT' | 'HARDWARE_FAULT' | 'OFFLINE';
  lockerId: string;
  message: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  timestamp: number;
  acknowledged: boolean;
}

export interface PricingTier {
  id: string;
  label: string;
  durationMinutes: number;
  price: number;
  active: boolean;
}

export interface SystemSettings {
  minDuration: number;
  maxDuration: number;
  autoLockDelay: number;
  vibrationSensitivity: number;
  systemName: string;
  supportEmail: string;
  baseHourlyRate: number;
}

export interface AdminLog {
  id: string;
  action: string;
  target: string;
  adminId: string;
  adminEmail: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface MaintenanceLog {
  id: string;
  lockerId: string;
  issue: string;
  resolvedAt?: number;
  createdAt: number;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  notes?: string;
}
