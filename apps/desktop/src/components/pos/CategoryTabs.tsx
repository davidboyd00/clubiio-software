import { Category } from '../../lib/api';
import {
  Beer,
  Wine,
  Coffee,
  Martini,
  Cookie,
  Sparkles,
  CircleDot,
} from 'lucide-react';

interface CategoryTabsProps {
  categories: Category[];
  selectedId: string | null;
  onSelect: (categoryId: string) => void;
  isLoading?: boolean;
}

// Map icon names to components
const iconMap: Record<string, React.ElementType> = {
  beer: Beer,
  wine: Wine,
  coffee: Coffee,
  martini: Martini,
  cocktail: Martini,
  cookie: Cookie,
  snack: Cookie,
  sparkles: Sparkles,
};

function getCategoryIcon(iconName: string | null): React.ElementType {
  if (!iconName) return CircleDot;
  return iconMap[iconName.toLowerCase()] || CircleDot;
}

export function CategoryTabs({
  categories,
  selectedId,
  onSelect,
  isLoading,
}: CategoryTabsProps) {
  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-14 w-32 bg-slate-700 rounded-xl animate-pulse flex-shrink-0"
          />
        ))}
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="text-slate-500 text-center py-4">
        No hay categorías disponibles
      </div>
    );
  }

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
      {categories.map((category) => {
        const Icon = getCategoryIcon(category.icon);
        const isSelected = selectedId === category.id;
        const bgColor = category.color || '#6366f1';

        return (
          <button
            key={category.id}
            onClick={() => onSelect(category.id)}
            className={`
              relative flex items-center gap-2.5 px-5 py-3.5 rounded-xl font-semibold
              transition-all duration-100 flex-shrink-0 min-w-[130px] min-h-[52px]
              touch-manipulation active:scale-[0.97]
              ${isSelected
                ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 shadow-lg'
                : 'hover:shadow-md opacity-75 hover:opacity-100'
              }
            `}
            style={{
              backgroundColor: bgColor,
              boxShadow: isSelected ? `0 4px 20px ${bgColor}50` : undefined,
            }}
          >
            <Icon className="w-5 h-5 text-white" />
            <span className="text-white text-base whitespace-nowrap">
              {category.name}
            </span>
            {isSelected && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
