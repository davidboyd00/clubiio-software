import { useState } from 'react';
import { Calendar, Download, Filter } from 'lucide-react';

export default function SalesPage() {
  const [dateRange, setDateRange] = useState('today');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ventas</h1>
          <p className="text-gray-500">Análisis detallado de ventas</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="input w-auto"
          >
            <option value="today">Hoy</option>
            <option value="week">Esta semana</option>
            <option value="month">Este mes</option>
            <option value="custom">Personalizado</option>
          </select>
          <button className="btn btn-secondary flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filtros
          </button>
          <button className="btn btn-primary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      <div className="card">
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Reporte de Ventas</h3>
          <p className="text-gray-500 mt-2">
            Los datos de ventas detallados se mostrarán aquí
          </p>
        </div>
      </div>
    </div>
  );
}
