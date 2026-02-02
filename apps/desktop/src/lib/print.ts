import { Order } from './api';

// ESC/POS Commands
const ESC = '\x1B';
const GS = '\x1D';

export const ESCPOS = {
  // Initialize printer
  INIT: ESC + '@',

  // Text formatting
  BOLD_ON: ESC + 'E' + '\x01',
  BOLD_OFF: ESC + 'E' + '\x00',
  UNDERLINE_ON: ESC + '-' + '\x01',
  UNDERLINE_OFF: ESC + '-' + '\x00',

  // Text size
  NORMAL_SIZE: GS + '!' + '\x00',
  DOUBLE_HEIGHT: GS + '!' + '\x01',
  DOUBLE_WIDTH: GS + '!' + '\x10',
  DOUBLE_SIZE: GS + '!' + '\x11',

  // Alignment
  ALIGN_LEFT: ESC + 'a' + '\x00',
  ALIGN_CENTER: ESC + 'a' + '\x01',
  ALIGN_RIGHT: ESC + 'a' + '\x02',

  // Paper
  CUT: GS + 'V' + '\x00',
  PARTIAL_CUT: GS + 'V' + '\x01',
  FEED_LINES: (n: number) => ESC + 'd' + String.fromCharCode(n),

  // Line
  LINE: '--------------------------------',
  DOUBLE_LINE: '================================',
};

interface PrintConfig {
  businessName: string;
  businessAddress?: string;
  businessPhone?: string;
  businessRut?: string;
  footerMessage?: string;
  printerWidth?: number; // characters per line (default 32 for 58mm, 48 for 80mm)
}

const defaultConfig: PrintConfig = {
  businessName: 'Clubio',
  businessAddress: '',
  businessPhone: '',
  businessRut: '',
  footerMessage: 'Gracias por su compra!',
  printerWidth: 32,
};

// Format price for Chile
function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(price);
}

// Pad string to width
function padLine(left: string, right: string, width: number): string {
  const spaces = width - left.length - right.length;
  if (spaces <= 0) return left + ' ' + right;
  return left + ' '.repeat(spaces) + right;
}

// Center text
function centerText(text: string, width: number): string {
  const padding = Math.max(0, Math.floor((width - text.length) / 2));
  return ' '.repeat(padding) + text;
}

// Generate receipt text (plain text version for preview and non-ESC/POS printers)
export function generateReceiptText(order: Order, config: Partial<PrintConfig> = {}): string {
  const cfg = { ...defaultConfig, ...config };
  const width = cfg.printerWidth || 32;
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push(centerText(cfg.businessName, width));
  if (cfg.businessAddress) {
    lines.push(centerText(cfg.businessAddress, width));
  }
  if (cfg.businessPhone) {
    lines.push(centerText(`Tel: ${cfg.businessPhone}`, width));
  }
  if (cfg.businessRut) {
    lines.push(centerText(`RUT: ${cfg.businessRut}`, width));
  }
  lines.push('');
  lines.push('='.repeat(width));

  // Order info
  lines.push('');
  lines.push(`Pedido #${order.orderNumber}`);
  lines.push(`Fecha: ${new Date(order.createdAt).toLocaleString('es-CL')}`);
  lines.push('');
  lines.push('-'.repeat(width));

  // Items
  lines.push('');
  order.items?.forEach((item) => {
    const name = item.product?.name || 'Producto';
    const qty = item.quantity;
    const price = formatPrice(item.total);

    // First line: quantity and name
    lines.push(`${qty}x ${name}`);
    // Second line: unit price and total (right aligned)
    const unitInfo = `   ${formatPrice(item.unitPrice)} c/u`;
    lines.push(padLine(unitInfo, price, width));
  });

  lines.push('');
  lines.push('-'.repeat(width));

  // Totals
  lines.push('');
  lines.push(padLine('Subtotal:', formatPrice(order.subtotal), width));

  if (order.discount > 0) {
    lines.push(padLine('Descuento:', `-${formatPrice(order.discount)}`, width));
  }

  lines.push('');
  lines.push(padLine('TOTAL:', formatPrice(order.total), width));
  lines.push('');
  lines.push('-'.repeat(width));

  // Payment methods
  lines.push('');
  lines.push('Pago:');
  order.payments?.forEach((payment) => {
    const method = payment.method === 'CASH' ? 'Efectivo' :
                   payment.method === 'CARD' ? 'Tarjeta' : 'Vale';
    lines.push(padLine(`  ${method}:`, formatPrice(payment.amount), width));
  });

  // Footer
  lines.push('');
  lines.push('='.repeat(width));
  lines.push('');
  if (cfg.footerMessage) {
    lines.push(centerText(cfg.footerMessage, width));
  }
  lines.push('');
  lines.push('');
  lines.push('');

  return lines.join('\n');
}

// Generate ESC/POS commands for thermal printer
export function generateReceiptESCPOS(order: Order, config: Partial<PrintConfig> = {}): string {
  const cfg = { ...defaultConfig, ...config };
  const width = cfg.printerWidth || 32;
  let commands = '';

  // Initialize
  commands += ESCPOS.INIT;

  // Header - centered, double size
  commands += ESCPOS.ALIGN_CENTER;
  commands += ESCPOS.DOUBLE_SIZE;
  commands += cfg.businessName + '\n';
  commands += ESCPOS.NORMAL_SIZE;

  if (cfg.businessAddress) {
    commands += cfg.businessAddress + '\n';
  }
  if (cfg.businessPhone) {
    commands += `Tel: ${cfg.businessPhone}\n`;
  }
  if (cfg.businessRut) {
    commands += `RUT: ${cfg.businessRut}\n`;
  }

  commands += '\n';
  commands += ESCPOS.DOUBLE_LINE + '\n';
  commands += ESCPOS.ALIGN_LEFT;

  // Order info
  commands += ESCPOS.BOLD_ON;
  commands += `Pedido #${order.orderNumber}\n`;
  commands += ESCPOS.BOLD_OFF;
  commands += `Fecha: ${new Date(order.createdAt).toLocaleString('es-CL')}\n`;
  commands += '\n';
  commands += ESCPOS.LINE + '\n';

  // Items
  commands += '\n';
  order.items?.forEach((item) => {
    const name = item.product?.name || 'Producto';
    commands += ESCPOS.BOLD_ON;
    commands += `${item.quantity}x ${name}\n`;
    commands += ESCPOS.BOLD_OFF;
    commands += padLine(`   ${formatPrice(item.unitPrice)} c/u`, formatPrice(item.total), width) + '\n';
  });

  commands += '\n';
  commands += ESCPOS.LINE + '\n';

  // Totals
  commands += '\n';
  commands += padLine('Subtotal:', formatPrice(order.subtotal), width) + '\n';

  if (order.discount > 0) {
    commands += padLine('Descuento:', `-${formatPrice(order.discount)}`, width) + '\n';
  }

  commands += '\n';
  commands += ESCPOS.DOUBLE_SIZE;
  commands += padLine('TOTAL:', formatPrice(order.total), width) + '\n';
  commands += ESCPOS.NORMAL_SIZE;
  commands += '\n';
  commands += ESCPOS.LINE + '\n';

  // Payment methods
  commands += '\n';
  commands += 'Pago:\n';
  order.payments?.forEach((payment) => {
    const method = payment.method === 'CASH' ? 'Efectivo' :
                   payment.method === 'CARD' ? 'Tarjeta' : 'Vale';
    commands += padLine(`  ${method}:`, formatPrice(payment.amount), width) + '\n';
  });

  // Footer
  commands += '\n';
  commands += ESCPOS.DOUBLE_LINE + '\n';
  commands += ESCPOS.ALIGN_CENTER;
  commands += '\n';
  if (cfg.footerMessage) {
    commands += cfg.footerMessage + '\n';
  }

  // Feed and cut
  commands += ESCPOS.FEED_LINES(4);
  commands += ESCPOS.PARTIAL_CUT;

  return commands;
}

// Generate HTML receipt for browser printing
export function generateReceiptHTML(order: Order, config: Partial<PrintConfig> = {}): string {
  const cfg = { ...defaultConfig, ...config };

  const itemsHtml = order.items?.map(item => `
    <tr>
      <td style="text-align: left;">${item.quantity}x ${item.product?.name || 'Producto'}</td>
      <td style="text-align: right;">${formatPrice(item.total)}</td>
    </tr>
    <tr>
      <td style="text-align: left; color: #666; font-size: 12px; padding-left: 20px;">
        ${formatPrice(item.unitPrice)} c/u
      </td>
      <td></td>
    </tr>
  `).join('') || '';

  const paymentsHtml = order.payments?.map(payment => {
    const method = payment.method === 'CASH' ? 'Efectivo' :
                   payment.method === 'CARD' ? 'Tarjeta' : 'Vale';
    return `
      <tr>
        <td style="padding-left: 10px;">${method}</td>
        <td style="text-align: right;">${formatPrice(payment.amount)}</td>
      </tr>
    `;
  }).join('') || '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Ticket #${order.orderNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Courier New', monospace;
          font-size: 14px;
          width: 280px;
          padding: 10px;
          background: white;
          color: black;
        }
        .header { text-align: center; margin-bottom: 10px; }
        .header h1 { font-size: 20px; margin-bottom: 5px; }
        .header p { font-size: 12px; color: #666; }
        .divider { border-top: 1px dashed #000; margin: 10px 0; }
        .divider-double { border-top: 2px solid #000; margin: 10px 0; }
        .info { margin-bottom: 10px; }
        .info strong { font-size: 16px; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 3px 0; vertical-align: top; }
        .total-row td { padding-top: 10px; font-weight: bold; font-size: 18px; }
        .footer { text-align: center; margin-top: 15px; font-size: 12px; }
        @media print {
          body { width: 100%; }
          @page { margin: 0; size: 80mm auto; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${cfg.businessName}</h1>
        ${cfg.businessAddress ? `<p>${cfg.businessAddress}</p>` : ''}
        ${cfg.businessPhone ? `<p>Tel: ${cfg.businessPhone}</p>` : ''}
        ${cfg.businessRut ? `<p>RUT: ${cfg.businessRut}</p>` : ''}
      </div>

      <div class="divider-double"></div>

      <div class="info">
        <strong>Pedido #${order.orderNumber}</strong><br>
        <span style="font-size: 12px; color: #666;">
          ${new Date(order.createdAt).toLocaleString('es-CL')}
        </span>
      </div>

      <div class="divider"></div>

      <table>
        ${itemsHtml}
      </table>

      <div class="divider"></div>

      <table>
        <tr>
          <td>Subtotal</td>
          <td style="text-align: right;">${formatPrice(order.subtotal)}</td>
        </tr>
        ${order.discount > 0 ? `
          <tr style="color: #e67e22;">
            <td>Descuento</td>
            <td style="text-align: right;">-${formatPrice(order.discount)}</td>
          </tr>
        ` : ''}
        <tr class="total-row">
          <td>TOTAL</td>
          <td style="text-align: right;">${formatPrice(order.total)}</td>
        </tr>
      </table>

      <div class="divider"></div>

      <table>
        <tr><td colspan="2"><strong>Pago:</strong></td></tr>
        ${paymentsHtml}
      </table>

      <div class="divider-double"></div>

      <div class="footer">
        ${cfg.footerMessage || ''}
      </div>
    </body>
    </html>
  `;
}

// Print using Electron's print dialog
export async function printReceipt(order: Order, config: Partial<PrintConfig> = {}): Promise<void> {
  const html = generateReceiptHTML(order, config);

  // Create a hidden iframe for printing
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

  // Wait for content to load
  await new Promise(resolve => setTimeout(resolve, 100));

  // Print
  iframe.contentWindow?.print();

  // Cleanup after a delay
  setTimeout(() => {
    document.body.removeChild(iframe);
  }, 1000);
}

// Print silently to a specific printer (requires Electron IPC)
export async function printReceiptSilent(
  order: Order,
  _printerName: string,
  config: Partial<PrintConfig> = {}
): Promise<void> {
  // This would use Electron's webContents.print() with silent option
  // For now, we use the browser print dialog
  return printReceipt(order, config);
}
