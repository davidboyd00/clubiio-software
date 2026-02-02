import { Order } from '../../lib/api';
import { generateReceiptText } from '../../lib/print';

interface ReceiptPreviewProps {
  order: Order;
  businessName?: string;
  businessAddress?: string;
  businessPhone?: string;
  businessRut?: string;
}

export function ReceiptPreview({
  order,
  businessName = 'Clubio',
  businessAddress,
  businessPhone,
  businessRut,
}: ReceiptPreviewProps) {
  const receiptText = generateReceiptText(order, {
    businessName,
    businessAddress,
    businessPhone,
    businessRut,
    printerWidth: 32,
  });

  return (
    <div className="bg-white text-black rounded-lg p-4 font-mono text-xs leading-relaxed overflow-auto max-h-96">
      <pre className="whitespace-pre-wrap">{receiptText}</pre>
    </div>
  );
}
