import { useState, useEffect, useCallback } from 'react';
import {
  Staff,
  StaffRole,
  Shift,
  staffApi,
  shiftsApi,
} from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

type TabType = 'staff' | 'shifts' | 'schedule';

const ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  bartender: 'Bartender',
  cashier: 'Cajero',
  warehouse: 'Bodega',
};

const ROLE_COLORS: Record<StaffRole, string> = {
  admin: 'bg-purple-100 text-purple-800',
  manager: 'bg-blue-100 text-blue-800',
  bartender: 'bg-green-100 text-green-800',
  cashier: 'bg-yellow-100 text-yellow-800',
  warehouse: 'bg-gray-100 text-gray-800',
};

interface StaffFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  pin: string;
  role: StaffRole;
  hourlyRate: string;
  notes: string;
}

const initialFormData: StaffFormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  pin: '',
  role: 'cashier',
  hourlyRate: '',
  notes: '',
};

interface ShiftFormData {
  staffId: string;
  scheduledStart: string;
  scheduledEnd: string;
  notes: string;
}

const initialShiftFormData: ShiftFormData = {
  staffId: '',
  scheduledStart: '',
  scheduledEnd: '',
  notes: '',
};

export default function StaffManagementPage() {
  const { venueId } = useAuth();
  const { isOnline } = useOnlineStatus();
  const [activeTab, setActiveTab] = useState<TabType>('staff');
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Staff form state
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [staffForm, setStaffForm] = useState<StaffFormData>(initialFormData);
  const [saving, setSaving] = useState(false);

  // Shift form state
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftForm, setShiftForm] = useState<ShiftFormData>(initialShiftFormData);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // PIN modal state
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinStaffId, setPinStaffId] = useState<string | null>(null);
  const [newPin, setNewPin] = useState('');

  const loadStaff = useCallback(async () => {
    if (!venueId || !isOnline) return;

    try {
      setLoading(true);
      const response = await staffApi.getAll(venueId!);
      if (response.data.success && response.data.data) {
        setStaffList(response.data.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando personal');
    } finally {
      setLoading(false);
    }
  }, [venueId, isOnline]);

  const loadShifts = useCallback(async () => {
    if (!venueId || !isOnline) return;

    try {
      const response = await shiftsApi.getByVenue(venueId!, selectedDate);
      if (response.data.success && response.data.data) {
        setShifts(response.data.data);
      }
    } catch (err) {
      console.error('Error loading shifts:', err);
    }
  }, [venueId, isOnline, selectedDate]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  useEffect(() => {
    if (activeTab === 'shifts' || activeTab === 'schedule') {
      loadShifts();
    }
  }, [activeTab, loadShifts]);

  const handleOpenStaffModal = (staff?: Staff) => {
    if (staff) {
      setEditingStaff(staff);
      setStaffForm({
        firstName: staff.firstName,
        lastName: staff.lastName,
        email: staff.email || '',
        phone: staff.phone || '',
        pin: '',
        role: staff.role,
        hourlyRate: staff.hourlyRate?.toString() || '',
        notes: staff.notes || '',
      });
    } else {
      setEditingStaff(null);
      setStaffForm(initialFormData);
    }
    setShowStaffModal(true);
  };

  const handleSaveStaff = async () => {
    if (!venueId) return;

    setSaving(true);
    setError(null);

    try {
      const data = {
        venueId: venueId!,
        firstName: staffForm.firstName.trim(),
        lastName: staffForm.lastName.trim(),
        email: staffForm.email.trim() || undefined,
        phone: staffForm.phone.trim() || undefined,
        pin: staffForm.pin.trim() || undefined,
        role: staffForm.role,
        hourlyRate: staffForm.hourlyRate ? parseFloat(staffForm.hourlyRate) : undefined,
        notes: staffForm.notes.trim() || undefined,
      };

      if (editingStaff) {
        const { venueId, ...updateData } = data;
        await staffApi.update(editingStaff.id, updateData);
      } else {
        await staffApi.create(data);
      }

      setShowStaffModal(false);
      loadStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error guardando');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (staff: Staff) => {
    try {
      if (staff.isActive) {
        await staffApi.deactivate(staff.id);
      } else {
        await staffApi.activate(staff.id);
      }
      loadStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error actualizando estado');
    }
  };

  const handleDeleteStaff = async (staff: Staff) => {
    if (!confirm(`¿Eliminar a ${staff.firstName} ${staff.lastName}?`)) return;

    try {
      await staffApi.delete(staff.id);
      loadStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error eliminando');
    }
  };

  const handleOpenPinModal = (staffId: string) => {
    setPinStaffId(staffId);
    setNewPin('');
    setShowPinModal(true);
  };

  const handleUpdatePin = async () => {
    if (!pinStaffId || newPin.length !== 4) return;

    try {
      await staffApi.updatePin(pinStaffId, newPin);
      setShowPinModal(false);
      setPinStaffId(null);
      setNewPin('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error actualizando PIN');
    }
  };

  const handleOpenShiftModal = () => {
    setShiftForm({
      ...initialShiftFormData,
      scheduledStart: `${selectedDate}T09:00`,
      scheduledEnd: `${selectedDate}T17:00`,
    });
    setShowShiftModal(true);
  };

  const handleSaveShift = async () => {
    if (!venueId || !shiftForm.staffId) return;

    setSaving(true);
    setError(null);

    try {
      await shiftsApi.create({
        staffId: shiftForm.staffId,
        venueId: venueId!,
        scheduledStart: new Date(shiftForm.scheduledStart).toISOString(),
        scheduledEnd: new Date(shiftForm.scheduledEnd).toISOString(),
        notes: shiftForm.notes.trim() || undefined,
      });

      setShowShiftModal(false);
      loadShifts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creando turno');
    } finally {
      setSaving(false);
    }
  };

  const handleClockIn = async (shiftId: string) => {
    try {
      await shiftsApi.clockIn(shiftId);
      loadShifts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error registrando entrada');
    }
  };

  const handleClockOut = async (shiftId: string) => {
    try {
      await shiftsApi.clockOut(shiftId);
      loadShifts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error registrando salida');
    }
  };

  const handleCancelShift = async (shiftId: string) => {
    if (!confirm('¿Cancelar este turno?')) return;

    try {
      await shiftsApi.cancel(shiftId);
      loadShifts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cancelando turno');
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('es-CL', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getShiftStatusLabel = (status: Shift['status']) => {
    const labels: Record<Shift['status'], string> = {
      scheduled: 'Programado',
      active: 'Activo',
      completed: 'Completado',
      missed: 'No asistió',
      cancelled: 'Cancelado',
    };
    return labels[status];
  };

  const getShiftStatusColor = (status: Shift['status']) => {
    const colors: Record<Shift['status'], string> = {
      scheduled: 'bg-blue-100 text-blue-800',
      active: 'bg-green-100 text-green-800',
      completed: 'bg-gray-100 text-gray-800',
      missed: 'bg-red-100 text-red-800',
      cancelled: 'bg-yellow-100 text-yellow-800',
    };
    return colors[status];
  };

  if (!isOnline) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <p className="text-yellow-800">
            Gestión de personal no disponible sin conexión
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gestión de Personal</h1>
        {activeTab === 'staff' && (
          <button
            onClick={() => handleOpenStaffModal()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Agregar Personal
          </button>
        )}
        {(activeTab === 'shifts' || activeTab === 'schedule') && (
          <button
            onClick={handleOpenShiftModal}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Agregar Turno
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('staff')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'staff'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Personal
          </button>
          <button
            onClick={() => setActiveTab('shifts')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'shifts'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Turnos del Día
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'schedule'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Programación
          </button>
        </nav>
      </div>

      {/* Staff List Tab */}
      {activeTab === 'staff' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Cargando...</div>
          ) : staffList.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No hay personal registrado
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nombre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rol
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contacto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {staffList.map((staff) => (
                  <tr key={staff.id} className={!staff.isActive ? 'bg-gray-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-gray-600 font-medium">
                            {staff.firstName[0]}{staff.lastName[0]}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {staff.firstName} {staff.lastName}
                          </div>
                          {staff.pin && (
                            <div className="text-xs text-gray-500">PIN: ****</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${ROLE_COLORS[staff.role]}`}>
                        {ROLE_LABELS[staff.role]}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>{staff.email || '-'}</div>
                      <div>{staff.phone || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        staff.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {staff.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleOpenPinModal(staff.id)}
                        className="text-gray-600 hover:text-gray-900"
                        title="Cambiar PIN"
                      >
                        PIN
                      </button>
                      <button
                        onClick={() => handleOpenStaffModal(staff)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleToggleActive(staff)}
                        className={staff.isActive ? 'text-yellow-600 hover:text-yellow-900' : 'text-green-600 hover:text-green-900'}
                      >
                        {staff.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        onClick={() => handleDeleteStaff(staff)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Shifts Tab */}
      {activeTab === 'shifts' && (
        <div>
          <div className="mb-4">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            {shifts.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No hay turnos programados para esta fecha
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Personal
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Horario Programado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Horario Real
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {shifts.map((shift) => (
                    <tr key={shift.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {shift.staff ? `${shift.staff.firstName} ${shift.staff.lastName}` : 'N/A'}
                        </div>
                        {shift.staff && (
                          <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${ROLE_COLORS[shift.staff.role]}`}>
                            {ROLE_LABELS[shift.staff.role]}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatTime(shift.scheduledStart)} - {formatTime(shift.scheduledEnd)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {shift.startTime ? formatTime(shift.startTime) : '-'}
                        {' - '}
                        {shift.endTime ? formatTime(shift.endTime) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getShiftStatusColor(shift.status)}`}>
                          {getShiftStatusLabel(shift.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        {shift.status === 'scheduled' && (
                          <>
                            <button
                              onClick={() => handleClockIn(shift.id)}
                              className="text-green-600 hover:text-green-900"
                            >
                              Entrada
                            </button>
                            <button
                              onClick={() => handleCancelShift(shift.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                        {shift.status === 'active' && (
                          <button
                            onClick={() => handleClockOut(shift.id)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Salida
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Schedule Tab - Weekly View */}
      {activeTab === 'schedule' && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-4 flex items-center gap-4">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-500">
              Mostrando semana del {new Date(selectedDate).toLocaleDateString('es-CL')}
            </span>
          </div>

          <div className="text-center text-gray-500 py-8">
            Vista de calendario semanal - En desarrollo
          </div>
        </div>
      )}

      {/* Staff Modal */}
      {showStaffModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">
              {editingStaff ? 'Editar Personal' : 'Agregar Personal'}
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={staffForm.firstName}
                    onChange={(e) => setStaffForm({ ...staffForm, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Apellido *
                  </label>
                  <input
                    type="text"
                    value={staffForm.lastName}
                    onChange={(e) => setStaffForm({ ...staffForm, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rol *
                </label>
                <select
                  value={staffForm.role}
                  onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value as StaffRole })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={staffForm.email}
                  onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={staffForm.phone}
                  onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {!editingStaff && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    PIN (4 dígitos)
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    value={staffForm.pin}
                    onChange={(e) => setStaffForm({ ...staffForm, pin: e.target.value.replace(/\D/g, '') })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="****"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tarifa por hora
                </label>
                <input
                  type="number"
                  value={staffForm.hourlyRate}
                  onChange={(e) => setStaffForm({ ...staffForm, hourlyRate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas
                </label>
                <textarea
                  value={staffForm.notes}
                  onChange={(e) => setStaffForm({ ...staffForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowStaffModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveStaff}
                disabled={saving || !staffForm.firstName || !staffForm.lastName}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Cambiar PIN</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nuevo PIN (4 dígitos)
              </label>
              <input
                type="password"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest"
                placeholder="****"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowPinModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdatePin}
                disabled={newPin.length !== 4}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Modal */}
      {showShiftModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Agregar Turno</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Personal *
                </label>
                <select
                  value={shiftForm.staffId}
                  onChange={(e) => setShiftForm({ ...shiftForm, staffId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar personal</option>
                  {staffList.filter(s => s.isActive).map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.firstName} {staff.lastName} ({ROLE_LABELS[staff.role]})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Inicio *
                  </label>
                  <input
                    type="datetime-local"
                    value={shiftForm.scheduledStart}
                    onChange={(e) => setShiftForm({ ...shiftForm, scheduledStart: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fin *
                  </label>
                  <input
                    type="datetime-local"
                    value={shiftForm.scheduledEnd}
                    onChange={(e) => setShiftForm({ ...shiftForm, scheduledEnd: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notas
                </label>
                <textarea
                  value={shiftForm.notes}
                  onChange={(e) => setShiftForm({ ...shiftForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowShiftModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveShift}
                disabled={saving || !shiftForm.staffId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
