import { AppError } from '../../../../core/domain/app-error';
import {
  Consultorio,
  DoctorHours,
  DoctorOption,
  GenerationResult,
  ProposedSlot,
  WorkBlock,
} from '../entities/work-hours';
import { scheduleProblem, weekProblem } from '../policies/work-hours-policy';
import { WorkHoursRepository } from '../ports/work-hours.repository';

export class GetMyWorkHours {
  constructor(private readonly repository: WorkHoursRepository) {}

  execute(): Promise<DoctorHours> {
    return this.repository.getMyHours();
  }
}

export class SaveMyWorkHours {
  constructor(private readonly repository: WorkHoursRepository) {}

  execute(blocks: readonly WorkBlock[]): Promise<DoctorHours> {
    const problem = scheduleProblem(blocks);
    if (problem) throw new AppError('validation', problem);
    return this.repository.saveMyHours(blocks);
  }
}

export class ListDoctors {
  constructor(private readonly repository: WorkHoursRepository) {}

  execute(): Promise<DoctorOption[]> {
    return this.repository.listDoctors();
  }
}

export class GetDoctorWorkHours {
  constructor(private readonly repository: WorkHoursRepository) {}

  execute(doctorId: string): Promise<DoctorHours> {
    return this.repository.getDoctorHours(doctorId);
  }
}

export class ListConsultorios {
  constructor(private readonly repository: WorkHoursRepository) {}

  execute(): Promise<Consultorio[]> {
    return this.repository.listConsultorios();
  }
}

export class ProposeWeek {
  constructor(private readonly repository: WorkHoursRepository) {}

  execute(doctorId: string, weekStart: string): Promise<ProposedSlot[]> {
    const problem = weekProblem(weekStart);
    if (problem) throw new AppError('validation', problem);
    return this.repository.proposeWeek(doctorId, weekStart);
  }
}

export class GenerateWeek {
  constructor(private readonly repository: WorkHoursRepository) {}

  execute(doctorId: string, consultorioId: string, weekStart: string): Promise<GenerationResult> {
    const problem = weekProblem(weekStart);
    if (problem) throw new AppError('validation', problem);
    return this.repository.generateWeek(doctorId, consultorioId, weekStart);
  }
}
