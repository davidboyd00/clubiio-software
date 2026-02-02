import { Order, SessionSummary } from './api';
import { getSettings } from '../pages/SettingsPage';

// Generate CSV content
function generateCSV(headers: string[], rows: (string | number)[][]): string {
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => {
        const str = String(cell);
        // Escape quotes and wrap in quotes if contains comma or newline
        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    ),
  ].join('\n');

  return csvContent;
}

// Download helper
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Export orders to CSV
export function exportOrdersToCSV(orders: Order[], filename = 'pedidos.csv') {
  const headers = [
    'Número',
    'Fecha',
    'Hora',
    'Estado',
    'Subtotal',
    'Descuento',
    'Total',
    'Método de Pago',
    'Productos',
  ];

  const rows = orders.map((order) => [
    order.orderNumber,
    new Date(order.createdAt).toLocaleDateString('es-CL'),
    new Date(order.createdAt).toLocaleTimeString('es-CL'),
    order.status === 'COMPLETED' ? 'Completado' : order.status === 'VOIDED' ? 'Anulado' : 'Pendiente',
    order.subtotal,
    order.discount,
    order.total,
    order.payments?.map((p) => p.method).join('+') || '',
    order.items?.map((i) => `${i.quantity}x ${i.product?.name || 'Producto'}`).join('; ') || '',
  ]);

  const csv = generateCSV(headers, rows);
  downloadFile(csv, filename, 'text/csv;charset=utf-8');
}

// Export session summary to CSV
export function exportSessionSummaryToCSV(summary: SessionSummary, filename = 'resumen_sesion.csv') {
  const settings = getSettings();
  const session = summary.session;
  const summ = summary.summary;

  const content = [
    `${settings.businessName} - Resumen de Sesión`,
    '',
    'INFORMACIÓN DE SESIÓN',
    `Caja,${session.cashRegister?.name || 'N/A'}`,
    `Fecha Apertura,${new Date(session.openedAt).toLocaleString('es-CL')}`,
    `Fecha Cierre,${session.closedAt ? new Date(session.closedAt).toLocaleString('es-CL') : 'Abierta'}`,
    `Estado,${session.status === 'OPEN' ? 'Abierta' : 'Cerrada'}`,
    '',
    'RESUMEN DE VENTAS',
    `Total Pedidos,${summ.totalOrders}`,
    `Total Ventas,$${summ.totalSales.toLocaleString('es-CL')}`,
    `Ticket Promedio,$${summ.totalOrders > 0 ? Math.round(summ.totalSales / summ.totalOrders).toLocaleString('es-CL') : 0}`,
    '',
    'MÉTODOS DE PAGO',
    ...summ.paymentsByMethod.map(
      (p) => `${p.method === 'CASH' ? 'Efectivo' : p.method === 'CARD' ? 'Tarjeta' : 'Vale'},$${p.amount.toLocaleString('es-CL')},${p.count} transacciones`
    ),
    '',
    'MOVIMIENTOS DE CAJA',
    ...summ.movements.map(
      (m) => `${m.type === 'DEPOSIT' ? 'Depósitos' : m.type === 'WITHDRAWAL' ? 'Retiros' : m.type},$${m.amount.toLocaleString('es-CL')}`
    ),
    '',
    'BALANCE',
    `Monto Inicial,$${summ.initialAmount.toLocaleString('es-CL')}`,
    `Efectivo Esperado,$${summ.expectedCash.toLocaleString('es-CL')}`,
    `Monto Final,$${(summ.finalAmount || 0).toLocaleString('es-CL')}`,
    `Diferencia,$${(summ.difference || 0).toLocaleString('es-CL')}`,
  ].join('\n');

  downloadFile(content, filename, 'text/csv;charset=utf-8');
}

// Generate HTML report for printing
export function generateSessionReportHTML(summary: SessionSummary): string {
  const settings = getSettings();
  const session = summary.session;
  const summ = summary.summary;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const paymentRows = summ.paymentsByMethod
    .map(
      (p) => `
        <tr>
          <td>${p.method === 'CASH' ? 'Efectivo' : p.method === 'CARD' ? 'Tarjeta' : 'Vale'}</td>
          <td style="text-align: right;">${formatPrice(p.amount)}</td>
          <td style="text-align: right;">${p.count}</td>
        </tr>
      `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Reporte de Sesión</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: Arial, sans-serif;
          font-size: 12px;
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
        }
        h1 { font-size: 24px; margin-bottom: 5px; }
        h2 { font-size: 16px; margin: 20px 0 10px; padding-bottom: 5px; border-bottom: 2px solid #333; }
        .header { text-align: center; margin-bottom: 30px; }
        .header p { color: #666; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .info-item { padding: 10px; background: #f5f5f5; border-radius: 4px; }
        .info-item label { color: #666; display: block; margin-bottom: 3px; }
        .info-item span { font-weight: bold; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f5f5f5; }
        .summary-card { padding: 15px; background: #f0f0f0; border-radius: 8px; margin: 10px 0; }
        .summary-card .value { font-size: 24px; font-weight: bold; color: #2563eb; }
        .total-row { font-weight: bold; font-size: 14px; }
        .positive { color: #16a34a; }
        .negative { color: #dc2626; }
        @media print {
          body { padding: 0; }
          @page { margin: 1cm; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${settings.businessName}</h1>
        <p>Reporte de Cierre de Caja</p>
        <p>${new Date().toLocaleString('es-CL')}</p>
      </div>

      <h2>Información de Sesión</h2>
      <div class="info-grid">
        <div class="info-item">
          <label>Caja</label>
          <span>${session.cashRegister?.name || 'N/A'}</span>
        </div>
        <div class="info-item">
          <label>Estado</label>
          <span>${session.status === 'OPEN' ? 'Abierta' : 'Cerrada'}</span>
        </div>
        <div class="info-item">
          <label>Apertura</label>
          <span>${new Date(session.openedAt).toLocaleString('es-CL')}</span>
        </div>
        <div class="info-item">
          <label>Cierre</label>
          <span>${session.closedAt ? new Date(session.closedAt).toLocaleString('es-CL') : '-'}</span>
        </div>
      </div>

      <h2>Resumen de Ventas</h2>
      <div class="info-grid">
        <div class="summary-card">
          <label>Total Ventas</label>
          <div class="value">${formatPrice(summ.totalSales)}</div>
        </div>
        <div class="summary-card">
          <label>Pedidos</label>
          <div class="value">${summ.totalOrders}</div>
        </div>
      </div>

      <h2>Métodos de Pago</h2>
      <table>
        <thead>
          <tr>
            <th>Método</th>
            <th style="text-align: right;">Monto</th>
            <th style="text-align: right;">Transacciones</th>
          </tr>
        </thead>
        <tbody>
          ${paymentRows}
        </tbody>
      </table>

      <h2>Balance de Caja</h2>
      <table>
        <tbody>
          <tr>
            <td>Monto Inicial</td>
            <td style="text-align: right;">${formatPrice(summ.initialAmount)}</td>
          </tr>
          <tr>
            <td>+ Ventas en Efectivo</td>
            <td style="text-align: right;">${formatPrice(summ.paymentsByMethod.find(p => p.method === 'CASH')?.amount || 0)}</td>
          </tr>
          <tr>
            <td>+ Depósitos</td>
            <td style="text-align: right;">${formatPrice(summ.movements.find(m => m.type === 'DEPOSIT')?.amount || 0)}</td>
          </tr>
          <tr>
            <td>- Retiros</td>
            <td style="text-align: right;">${formatPrice(summ.movements.find(m => m.type === 'WITHDRAWAL')?.amount || 0)}</td>
          </tr>
          <tr class="total-row">
            <td>= Efectivo Esperado</td>
            <td style="text-align: right;">${formatPrice(summ.expectedCash)}</td>
          </tr>
          <tr class="total-row">
            <td>Monto Final Contado</td>
            <td style="text-align: right;">${formatPrice(summ.finalAmount || 0)}</td>
          </tr>
          <tr class="total-row">
            <td>Diferencia</td>
            <td style="text-align: right;" class="${(summ.difference || 0) >= 0 ? 'positive' : 'negative'}">
              ${formatPrice(summ.difference || 0)}
            </td>
          </tr>
        </tbody>
      </table>

      <div style="margin-top: 40px; text-align: center; color: #666;">
        <p>Reporte generado por ${settings.businessName}</p>
        <p>${new Date().toLocaleString('es-CL')}</p>
      </div>
    </body>
    </html>
  `;
}

// Print session report
export function printSessionReport(summary: SessionSummary) {
  const html = generateSessionReportHTML(summary);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.top = '-10000px';
  iframe.style.left = '-10000px';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    throw new Error('Could not create print document');
  }

  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 100);
}
