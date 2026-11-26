export type Dietary = "veg" | "nonveg";

export interface MenuItem {
  id: string;
  name: string;
  category: "starters" | "mains" | "breads" | "beverages" | "desserts";
  description: string;
  price: number;
  dietary: Dietary;
  bestseller?: boolean;
  spiceLevel?: 1 | 2 | 3;
  station: "tandoor" | "curry" | "bar" | "pantry";
  inStock: boolean;
  stockCount?: number;
  image?: string;
}

export type TableStatus = "vacant" | "occupied" | "billed" | "reserved";

export interface Table {
  id: string;
  label: string;
  capacity: number;
  status: TableStatus;
  currentBill?: number;
  guestCount?: number;
  captainName?: string;
  assignedWaiterId?: string;
  openedAt?: string;
  qrToken?: string;
  currentOrderId?: string;
  section?: string;
}

export interface OrderItem {
  dishId: string;
  name: string;
  price: number;
  quantity: number;
  dietary: Dietary;
  station: "tandoor" | "curry" | "bar" | "pantry";
  notes?: string;
  status?: "queued" | "cooking" | "ready" | "served";
}

export interface KOT {
  id: string;
  kotNumber: number;
  tableId: string;
  items: OrderItem[];
  createdAt: string;
  elapsedSeconds: number;
  status: "cooking" | "ready" | "bumped";
  placedBy: "pos" | "qr" | "voice";
  captainNotes?: string;
  completedAt?: string;
}

export interface VoiceIntent {
  rawTranscript: string;
  action: "ADD_ITEMS" | "OUT_OF_STOCK" | "SETTLE_BILL" | "QUERY_SALES";
  tableId?: string;
  items?: { name: string; quantity: number }[];
  statusText: string;
  timestamp: string;
}

export type OrderMode = "dine-in" | "takeaway" | "delivery" | "zomato" | "swiggy" | "ubereats" | "doordash";

export interface LiveOrder {
  id: string;
  orderNumber: string;
  tokenNumber: string;
  time: string;
  customerName: string;
  customerPhone?: string;
  mode: OrderMode;
  tableId?: string;
  deliveryAddress?: string;
  aggregatorDetails?: {
    platform: "zomato" | "swiggy" | "ubereats" | "doordash" | "grubhub";
    orderId: string;
    riderName?: string;
    riderStatus?: string;
    otp?: string;
  };
  itemsSummary: string;
  totalAmount: number;
  status: "new" | "preparing" | "ready" | "out-for-delivery" | "completed";
}

export interface AggregatorChannel {
  id: string;
  platform: "zomato" | "swiggy" | "direct" | "ubereats" | "doordash" | "grubhub";
  displayName: string;
  isOpen: boolean;
  newCount: number;
  ongoingCount: number;
  doneCount: number;
}

export interface ChannelSalesSplit {
  channel: "store" | "aggregators" | "site";
  label: string;
  percentage: number;
  revenue: number;
  orderCount: number;
  averageOrderValue: number;
}

export interface DayTrafficSource {
  day: string;
  totalOrders: number;
  storeOrders: number;
  aggregatorOrders: number;
  siteOrders: number;
  topSource: string;
  revenue: number;
  isPeakDay?: boolean;
}

export interface PromotionImpact {
  id: string;
  code: string;
  name: string;
  channel: string;
  discountSpent: number;
  revenueGenerated: number;
  ordersCount: number;
  roiMultiplier: string;
  repeatGuestRate: string;
  marginHealth: "healthy" | "moderate" | "loss-leader";
  insightNote: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  totalOrders: number;
  totalSpend: number;
  loyaltyPoints: number;
  lastVisit: string;
  tags?: string[];
  favoriteDishes?: string[];
}

export interface Expense {
  id: string;
  title: string;
  category: "supplies" | "utilities" | "payroll" | "maintenance" | "marketing" | "other";
  amount: number;
  paymentMode: "cash" | "upi" | "bank_transfer" | "card";
  paidTo: string;
  recordedBy: string;
  date: string;
  receiptNumber?: string;
  notes?: string;
}

export interface StaffMember {
  id: string;
  name: string;
  username: string;
  role: "admin" | "manager" | "cashier" | "chef" | "waiter";
  phone: string;
  activeShift: boolean;
  shiftStartTime?: string;
  status: "active" | "on_break" | "off_duty";
}

export interface RestaurantSettings {
  restaurantName: string;
  tagline: string;
  phone: string;
  email: string;
  address: string;
  gstin: string;
  fssaiNumber: string;
  cgstPercent: number;
  sgstPercent: number;
  serviceChargePercent: number;
  serviceChargeEnabled: boolean;
  currency: string;
  upiVpa: string;
  autoPrintKOT: boolean;
}

export interface Coupon {
  id: string;
  code: string;
  description: string;
  discountType: "flat" | "percentage";
  discountValue: number;
  minOrderValue: number;
  maxDiscount?: number;
  usageLimit: number;
  usedCount: number;
  expiresAt: string;
  isActive: boolean;
}


