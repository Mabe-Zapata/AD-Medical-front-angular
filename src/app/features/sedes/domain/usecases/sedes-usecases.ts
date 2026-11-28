import { AppError } from '../../../../core/domain/app-error';
import { NewSede, OfficeChanges, Sede, SedeChanges } from '../entities/sedes';
import {
  OFFICE_NAME_MAX,
  SEDE_NAME_MAX,
  addressProblem,
  cleanText,
  hasProblems,
  nameProblem,
  sedeDraftProblems,
} from '../policies/sede-policies';
import { SedesRepository } from '../ports/sedes.repository';

export class ListSedes {
  constructor(private readonly repository: SedesRepository) {}

  execute(): Promise<Sede[]> {
    return this.repository.listSedes();
  }
}

/** What a create attempt produced. A sede can exist while some of its offices failed. */
export interface CreateSedeResult {
  readonly sedeId: string;
  /** Names of the consultorios that were not created; empty when everything was saved. */
  readonly failedOffices: readonly string[];
}

export class CreateSedeWithOffices {
  constructor(private readonly repository: SedesRepository) {}

  /**
   * Creates the sede first, then each consultorio. If the sede itself fails nothing is created.
   * If one consultorio fails, the sede stays and the failed names come back so the screen can
   * offer to retry only those.
   */
  async execute(draft: { name: string; address: string; offices: readonly string[] }): Promise<CreateSedeResult> {
    const problems = sedeDraftProblems(draft);
    if (hasProblems(problems)) {
      const fields = [problems.name ? 'nombre' : null, problems.address ? 'direccion' : null].filter(Boolean);
      throw new AppError('validation', `Invalid fields: ${fields.join(', ')}`);
    }
    const newSede: NewSede = {
      name: cleanText(draft.name),
      address: cleanText(draft.address) || null,
    };
    const sedeId = await this.repository.createSede(newSede);
    const failedOffices: string[] = [];
    for (const office of uniqueOfficeNames(draft.offices)) {
      try {
        await this.repository.createOffice(sedeId, office);
      } catch {
        failedOffices.push(office);
      }
    }
    return { sedeId, failedOffices };
  }
}

export class UpdateSede {
  constructor(private readonly repository: SedesRepository) {}

  async execute(sedeId: string, changes: SedeChanges): Promise<void> {
    const cleaned: SedeChanges = {
      ...(changes.name !== undefined ? { name: cleanText(changes.name) } : {}),
      ...(changes.address !== undefined ? { address: cleanText(changes.address ?? '') || null } : {}),
      ...(changes.active !== undefined ? { active: changes.active } : {}),
    };
    const problems = [
      cleaned.name !== undefined ? nameProblem(cleaned.name, SEDE_NAME_MAX) : null,
      cleaned.address !== undefined ? addressProblem(cleaned.address ?? '') : null,
    ];
    if (problems.some((p) => p !== null)) {
      throw new AppError('validation', 'Invalid fields: nombre');
    }
    return this.repository.updateSede(sedeId, cleaned);
  }
}

export class AddOffice {
  constructor(private readonly repository: SedesRepository) {}

  async execute(sedeId: string, name: string): Promise<string> {
    const problem = nameProblem(name, OFFICE_NAME_MAX);
    if (problem) throw new AppError('validation', 'Invalid fields: nombre');
    return this.repository.createOffice(sedeId, cleanText(name));
  }
}

export class UpdateOffice {
  constructor(private readonly repository: SedesRepository) {}

  async execute(officeId: string, changes: OfficeChanges): Promise<void> {
    if (changes.name !== undefined && nameProblem(changes.name, OFFICE_NAME_MAX)) {
      throw new AppError('validation', 'Invalid fields: nombre');
    }
    return this.repository.updateOffice(officeId, {
      ...(changes.name !== undefined ? { name: cleanText(changes.name) } : {}),
      ...(changes.active !== undefined ? { active: changes.active } : {}),
    });
  }
}

/** Office names are compared as the person sees them: trimmed, and a repeated name is sent once. */
function uniqueOfficeNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of names) {
    const name = cleanText(raw);
    if (name.length === 0 || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    result.push(name);
  }
  return result;
}
