import { NewSede, OfficeChanges, Sede, SedeChanges } from '../entities/sedes';

/** Port to the sedes administration API. Implementations throw `AppError`. */
export abstract class SedesRepository {
  /** Every sede with its consultorios, active or not, ordered by name. */
  abstract listSedes(): Promise<Sede[]>;
  /** Returns the id of the new sede. */
  abstract createSede(sede: NewSede): Promise<string>;
  abstract updateSede(sedeId: string, changes: SedeChanges): Promise<void>;
  /** Returns the id of the new consultorio. */
  abstract createOffice(sedeId: string, name: string): Promise<string>;
  abstract updateOffice(officeId: string, changes: OfficeChanges): Promise<void>;
}
