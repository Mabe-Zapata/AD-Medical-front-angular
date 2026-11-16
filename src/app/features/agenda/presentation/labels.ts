import { Tone } from '../../../shared/presentation/atoms/banner';
import { AppointmentStatus } from '../domain/entities/appointment';

export const APPOINTMENT_STATUS_LABELS: Readonly<Record<AppointmentStatus, string>> = {
  CONFIRMADA: 'Confirmada',
  PENDIENTE_PAGO: 'Pago pendiente',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
  NO_ASISTIO: 'No asistió',
  EXPIRADA: 'Expirada',
};

export const APPOINTMENT_STATUS_TONES: Readonly<Record<AppointmentStatus, Tone>> = {
  CONFIRMADA: 'success',
  PENDIENTE_PAGO: 'warning',
  COMPLETADA: 'info',
  CANCELADA: 'danger',
  NO_ASISTIO: 'danger',
  EXPIRADA: 'info',
};
