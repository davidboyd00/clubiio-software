// Reports Data Storage and Analysis

export interface DailySales {
  date: string; // YYYY-MM-DD
  totalSales: number;
  totalOrders: number;
  avgTicket: number;
  cashSales: number;
  cardSales: number;
  voucherSales: number;
  productsSold: number;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  categorySales: Array<{ categoryId: string; categoryName: string; sales: number; count: number }>;
  hourlyData: Array<{ hour: number; sales: number; orders: number }>;
  sessionIds: string[];
}

export interface ReportsPeriod {
  startDate: string;
  endDate: string;
  days: DailySales[];
  summary: {
    totalSales: number;
    totalOrders: number;
    avgTicket: number;
    avgDailySales: number;
    bestDay: { date: string; sales: number } | null;
    worstDay: { date: string; sales: number } | null;
    growthPercent: number; // vs previous period
    paymentMethods: { cash: number; card: number; voucher: number };
    topCategories: Array<{ name: string; sales: number }>;
    topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  };
}

const REPORTS_KEY = 'clubio_daily_sales';

// Save daily sales data
export function saveDailySales(data: DailySales): void {
  const allData = loadAllDailySales();
  const existingIndex = allData.findIndex((d) => d.date === data.date);

  if (existingIndex >= 0) {
    // Merge with existing data for the same day
    const existing = allData[existingIndex];
    allData[existingIndex] = {
      ...data,
      totalSales: existing.totalSales + data.totalSales,
      totalOrders: existing.totalOrders + data.totalOrders,
      productsSold: existing.productsSold + data.productsSold,
      cashSales: existing.cashSales + data.cashSales,
      cardSales: existing.cardSales + data.cardSales,
      voucherSales: existing.voucherSales + data.voucherSales,
      avgTicket:
        (existing.totalSales + data.totalSales) /
        (existing.totalOrders + data.totalOrders || 1),
      sessionIds: [...existing.sessionIds, ...data.sessionIds],
      // Merge hourly data
      hourlyData: mergeHourlyData(existing.hourlyData, data.hourlyData),
      // Merge top products
      topProducts: mergeTopProducts(existing.topProducts, data.topProducts),
      // Merge category sales
      categorySales: mergeCategorySales(existing.categorySales, data.categorySales),
    };
  } else {
    allData.push(data);
  }

  localStorage.setItem(REPORTS_KEY, JSON.stringify(allData));
}

// Load all daily sales data
export function loadAllDailySales(): DailySales[] {
  const stored = localStorage.getItem(REPORTS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }
  return [];
}

// Get data for a specific date range
export function getReportsForPeriod(startDate: string, endDate: string): ReportsPeriod {
  const allData = loadAllDailySales();
  const filteredDays = allData
    .filter((d) => d.date >= startDate && d.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Calculate summary
  const totalSales = filteredDays.reduce((sum, d) => sum + d.totalSales, 0);
  const totalOrders = filteredDays.reduce((sum, d) => sum + d.totalOrders, 0);
  const avgTicket = totalOrders > 0 ? totalSales / totalOrders : 0;
  const avgDailySales = filteredDays.length > 0 ? totalSales / filteredDays.length : 0;

  // Best and worst days
  let bestDay: { date: string; sales: number } | null = null;
  let worstDay: { date: string; sales: number } | null = null;

  if (filteredDays.length > 0) {
    const sorted = [...filteredDays].sort((a, b) => b.totalSales - a.totalSales);
    bestDay = { date: sorted[0].date, sales: sorted[0].totalSales };
    worstDay = { date: sorted[sorted.length - 1].date, sales: sorted[sorted.length - 1].totalSales };
  }

  // Payment methods totals
  const paymentMethods = {
    cash: filteredDays.reduce((sum, d) => sum + d.cashSales, 0),
    card: filteredDays.reduce((sum, d) => sum + d.cardSales, 0),
    voucher: filteredDays.reduce((sum, d) => sum + d.voucherSales, 0),
  };

  // Top categories
  const categoryMap = new Map<string, { name: string; sales: number }>();
  filteredDays.forEach((day) => {
    day.categorySales.forEach((cat) => {
      const existing = categoryMap.get(cat.categoryId) || { name: cat.categoryName, sales: 0 };
      existing.sales += cat.sales;
      categoryMap.set(cat.categoryId, existing);
    });
  });
  const topCategories = Array.from(categoryMap.values())
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 5);

  // Top products
  const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();
  filteredDays.forEach((day) => {
    day.topProducts.forEach((prod) => {
      const existing = productMap.get(prod.name) || { name: prod.name, quantity: 0, revenue: 0 };
      existing.quantity += prod.quantity;
      existing.revenue += prod.revenue;
      productMap.set(prod.name, existing);
    });
  });
  const topProducts = Array.from(productMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Growth calculation (vs previous period of same duration)
  const periodDays = Math.ceil(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;
  const previousStartDate = new Date(startDate);
  previousStartDate.setDate(previousStartDate.getDate() - periodDays);
  const previousEndDate = new Date(startDate);
  previousEndDate.setDate(previousEndDate.getDate() - 1);

  const previousPeriodData = allData.filter(
    (d) =>
      d.date >= previousStartDate.toISOString().split('T')[0] &&
      d.date <= previousEndDate.toISOString().split('T')[0]
  );
  const previousSales = previousPeriodData.reduce((sum, d) => sum + d.totalSales, 0);
  const growthPercent =
    previousSales > 0 ? ((totalSales - previousSales) / previousSales) * 100 : 0;

  return {
    startDate,
    endDate,
    days: filteredDays,
    summary: {
      totalSales,
      totalOrders,
      avgTicket,
      avgDailySales,
      bestDay,
      worstDay,
      growthPercent,
      paymentMethods,
      topCategories,
      topProducts,
    },
  };
}

// Get data for the last N days
export function getReportsForLastDays(days: number): ReportsPeriod {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);

  return getReportsForPeriod(
    startDate.toISOString().split('T')[0],
    endDate.toISOString().split('T')[0]
  );
}

// Helper functions
function mergeHourlyData(
  a: Array<{ hour: number; sales: number; orders: number }>,
  b: Array<{ hour: number; sales: number; orders: number }>
): Array<{ hour: number; sales: number; orders: number }> {
  const map = new Map<number, { hour: number; sales: number; orders: number }>();

  [...a, ...b].forEach((item) => {
    const existing = map.get(item.hour) || { hour: item.hour, sales: 0, orders: 0 };
    existing.sales += item.sales;
    existing.orders += item.orders;
    map.set(item.hour, existing);
  });

  return Array.from(map.values()).sort((a, b) => a.hour - b.hour);
}

function mergeTopProducts(
  a: Array<{ name: string; quantity: number; revenue: number }>,
  b: Array<{ name: string; quantity: number; revenue: number }>
): Array<{ name: string; quantity: number; revenue: number }> {
  const map = new Map<string, { name: string; quantity: number; revenue: number }>();

  [...a, ...b].forEach((item) => {
    const existing = map.get(item.name) || { name: item.name, quantity: 0, revenue: 0 };
    existing.quantity += item.quantity;
    existing.revenue += item.revenue;
    map.set(item.name, existing);
  });

  return Array.from(map.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}

function mergeCategorySales(
  a: Array<{ categoryId: string; categoryName: string; sales: number; count: number }>,
  b: Array<{ categoryId: string; categoryName: string; sales: number; count: number }>
): Array<{ categoryId: string; categoryName: string; sales: number; count: number }> {
  const map = new Map<
    string,
    { categoryId: string; categoryName: string; sales: number; count: number }
  >();

  [...a, ...b].forEach((item) => {
    const existing = map.get(item.categoryId) || {
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      sales: 0,
      count: 0,
    };
    existing.sales += item.sales;
    existing.count += item.count;
    map.set(item.categoryId, existing);
  });

  return Array.from(map.values()).sort((a, b) => b.sales - a.sales);
}

// Format date for display
export function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('es-CL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

// Generate sample data for demo
export function generateSampleData(): void {
  const today = new Date();
  const sampleData: DailySales[] = [];

  for (let i = 30; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    // Weekend has more sales
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    const baseSales = isWeekend ? 800000 : 450000;
    const variation = Math.random() * 0.4 - 0.2; // ±20%

    const totalSales = Math.round(baseSales * (1 + variation));
    const totalOrders = Math.round(totalSales / 12000); // Avg ticket ~12000
    const cashPercent = 0.4 + Math.random() * 0.2;
    const cardPercent = 1 - cashPercent - 0.05;

    sampleData.push({
      date: dateStr,
      totalSales,
      totalOrders,
      avgTicket: Math.round(totalSales / totalOrders),
      cashSales: Math.round(totalSales * cashPercent),
      cardSales: Math.round(totalSales * cardPercent),
      voucherSales: Math.round(totalSales * 0.05),
      productsSold: Math.round(totalOrders * 2.5),
      topProducts: [
        { name: 'Cerveza', quantity: Math.round(totalOrders * 0.8), revenue: Math.round(totalSales * 0.25) },
        { name: 'Pisco Sour', quantity: Math.round(totalOrders * 0.4), revenue: Math.round(totalSales * 0.2) },
        { name: 'Ron Cola', quantity: Math.round(totalOrders * 0.3), revenue: Math.round(totalSales * 0.15) },
        { name: 'Vodka Tonic', quantity: Math.round(totalOrders * 0.25), revenue: Math.round(totalSales * 0.12) },
        { name: 'Agua Mineral', quantity: Math.round(totalOrders * 0.5), revenue: Math.round(totalSales * 0.08) },
      ],
      categorySales: [
        { categoryId: 'bebidas', categoryName: 'Bebidas', sales: Math.round(totalSales * 0.65), count: Math.round(totalOrders * 1.5) },
        { categoryId: 'cocteles', categoryName: 'Cócteles', sales: Math.round(totalSales * 0.25), count: Math.round(totalOrders * 0.7) },
        { categoryId: 'snacks', categoryName: 'Snacks', sales: Math.round(totalSales * 0.1), count: Math.round(totalOrders * 0.3) },
      ],
      hourlyData: Array.from({ length: 10 }, (_, j) => ({
        hour: 18 + j, // 18:00 - 03:00 (wrapping)
        sales: Math.round((totalSales / 10) * (0.5 + Math.random())),
        orders: Math.round((totalOrders / 10) * (0.5 + Math.random())),
      })),
      sessionIds: [`session-${dateStr}`],
    });
  }

  localStorage.setItem(REPORTS_KEY, JSON.stringify(sampleData));
}

// Check if sample data exists
export function hasSampleData(): boolean {
  const data = loadAllDailySales();
  return data.length > 0;
}
