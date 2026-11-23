import {
  Consultorio,
  DoctorHours,
  DoctorOption,
  GenerationResult,
  ProposedSlot,
  WorkBlock,
} from '../entities/work-hours';

/** Port to the work-hours API. Implementations throw `AppError`. */
export abstract class WorkHoursRepository {
  /** The signed-in doctor's hours: this week's and the ones from next week on. */
  abstract getMyHours(): Promise<DoctorHours>;
  /** Replaces the doctor's whole weekly schedule, from next week on. */
  abstract saveMyHours(blocks: readonly WorkBlock[]): Promise<DoctorHours>;
  abstract listDoctors(): Promise<DoctorOption[]>;
  /** What a doctor declared, for the administrator to plan from. */
  abstract getDoctorHours(doctorId: string): Promise<DoctorHours>;
  abstract listConsultorios(): Promise<Consultorio[]>;
  /** The slots a week would create. Writes nothing. */
  abstract proposeWeek(doctorId: string, weekStart: string): Promise<ProposedSlot[]>;
  abstract generateWeek(
    doctorId: string,
    consultorioId: string,
    weekStart: string,
  ): Promise<GenerationResult>;
}
