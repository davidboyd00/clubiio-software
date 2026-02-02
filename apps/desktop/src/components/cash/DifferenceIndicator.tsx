import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface DifferenceIndicatorProps {
  expected: number;
  actual: number;
  size?: 'sm' | 'md' | 'lg';
}

export function DifferenceIndicator({
  expected,
  actual,
  size = 'md',
}: DifferenceIndicatorProps) {
  const difference = actual - expected;
  const isPositive = difference > 0;
  const isNegative = difference < 0;
  const isZero = difference === 0;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0,
    }).format(Math.abs(price));
  };

  const sizeClasses = {
    sm: {
      container: 'p-3',
      icon: 'w-8 h-8',
      iconInner: 'w-4 h-4',
      label: 'text-xs',
      value: 'text-lg',
    },
    md: {
      container: 'p-4',
      icon: 'w-12 h-12',
      iconInner: 'w-6 h-6',
      label: 'text-sm',
      value: 'text-2xl',
    },
    lg: {
      container: 'p-6',
      icon: 'w-16 h-16',
      iconInner: 'w-8 h-8',
      label: 'text-base',
      value: 'text-3xl',
    },
  };

  const classes = sizeClasses[size];

  const getStatusConfig = () => {
    if (isZero) {
      return {
        bg: 'bg-green-600/20',
        border: 'border-green-600/30',
        iconBg: 'bg-green-600/30',
        textColor: 'text-green-400',
        Icon: Minus,
        label: 'Cuadre perfecto',
      };
    }
    if (isPositive) {
      return {
        bg: 'bg-blue-600/20',
        border: 'border-blue-600/30',
        iconBg: 'bg-blue-600/30',
        textColor: 'text-blue-400',
        Icon: TrendingUp,
        label: 'Sobrante',
      };
    }
    return {
      bg: 'bg-red-600/20',
      border: 'border-red-600/30',
      iconBg: 'bg-red-600/30',
      textColor: 'text-red-400',
      Icon: TrendingDown,
      label: 'Faltante',
    };
  };

  const config = getStatusConfig();

  return (
    <div
      className={`
        ${config.bg} ${config.border} border rounded-xl ${classes.container}
        flex items-center gap-4
      `}
    >
      <div
        className={`
          ${classes.icon} ${config.iconBg} rounded-xl
          flex items-center justify-center flex-shrink-0
        `}
      >
        <config.Icon className={`${classes.iconInner} ${config.textColor}`} />
      </div>

      <div className="flex-1">
        <p className={`${classes.label} ${config.textColor} mb-1`}>
          {config.label}
        </p>
        <p className={`${classes.value} font-bold ${config.textColor}`}>
          {isPositive && '+'}
          {isNegative && '-'}
          {formatPrice(difference)}
        </p>
      </div>

      <div className="text-right">
        <p className={`${classes.label} text-slate-400`}>Esperado</p>
        <p className="font-semibold text-slate-300">{formatPrice(expected)}</p>
      </div>
    </div>
  );
}
