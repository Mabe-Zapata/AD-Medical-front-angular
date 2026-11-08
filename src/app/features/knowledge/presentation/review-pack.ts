// Reviewer's copy of the reference drafts that wait for a doctor's decision. The API never lists
// drafts, so a doctor cannot otherwise see what they are about to publish.
// Source: MedicalBooking-AD-Backend, knowledge/review-nhanes-reference-drafts.md (branch
// feature/knowledge-importers, commit db220e2). It is a copy: the database is the source of truth.

export interface PendingReference {
  readonly id: string;
  readonly analyte: string;
  readonly sex: 'Ambos' | 'Hombres' | 'Mujeres';
  /** Human readable age band. */
  readonly age: string;
  readonly minAgeDays: number;
  readonly maxAgeDays: number | null;
  readonly sample: string;
  readonly context: string | null;
  readonly min: number;
  readonly max: number;
  readonly unit: string;
}

export interface ReviewPack {
  readonly title: string;
  readonly source: string;
  readonly method: string;
  readonly limits: readonly string[];
  readonly decisions: readonly string[];
  readonly references: readonly PendingReference[];
}

const ADULT_DAYS = 6570;

export const NHANES_PACK: ReviewPack = {
  title: 'Rangos NHANES 2021–2023: glucosa y hemoglobina',
  source: 'NHANES (CDC/NCHS, Estados Unidos), ciclo 08/2021–08/2023',
  method:
    'Percentiles 2,5 y 97,5 ponderados. Glucosa: adultos en ayunas sin diabetes diagnosticada ni HbA1c ≥ 6,5 %. Hemoglobina: sin exclusiones.',
  limits: [
    'Son percentiles de una muestra de Estados Unidos, no umbrales diagnósticos.',
    'Cada laboratorio debe contrastarlos con su propio método analítico.',
    'Una vez publicado, un rango no se edita: se crea una versión nueva.',
  ],
  decisions: [
    'Glucosa: el límite superior de 123 mg/dL queda cerca del umbral de prediabetes. ¿Se mantiene, se baja o se usa otra población de referencia?',
    'Hemoglobina: los límites inferiores salen de percentiles sin excluir anemia (por ejemplo, 10,3 g/dL en mujeres adultas). Contrástalos con los puntos de corte de anemia del laboratorio antes de publicar.',
    'Hemoglobina pediátrica: un niño de 6 años con 11,0 g/dL queda por debajo de 11,2 y se marca bajo. ¿Se afinan las bandas de edad o se usa una sola?',
    'Confirma la definición de ayuno del subconjunto NHANES, la edad de inicio del rango adulto (18 años) y el trato de embarazo y adultos mayores.',
    'Menores de 1 año y pacientes sin sexo o edad registrados no tienen rango: el sistema responderá «No evaluable».',
  ],
  references: [
    {
      id: 'c1000000-0000-4000-8000-000000000001',
      analyte: 'Glucosa en plasma en ayunas',
      sex: 'Ambos',
      age: '18 años o más',
      minAgeDays: ADULT_DAYS,
      maxAgeDays: null,
      sample: 'Plasma',
      context: 'Ayuno',
      min: 82.0,
      max: 123.0,
      unit: 'mg/dL',
    },
    {
      id: 'c1000000-0000-4000-8000-000000000004',
      analyte: 'Hemoglobina en sangre total',
      sex: 'Ambos',
      age: '1 a 5 años',
      minAgeDays: 365,
      maxAgeDays: 2189,
      sample: 'Sangre total',
      context: null,
      min: 10.6,
      max: 14.1,
      unit: 'g/dL',
    },
    {
      id: 'c1000000-0000-4000-8000-000000000005',
      analyte: 'Hemoglobina en sangre total',
      sex: 'Ambos',
      age: '6 a 11 años',
      minAgeDays: 2190,
      maxAgeDays: 4379,
      sample: 'Sangre total',
      context: null,
      min: 11.2,
      max: 14.7,
      unit: 'g/dL',
    },
    {
      id: 'c1000000-0000-4000-8000-000000000006',
      analyte: 'Hemoglobina en sangre total',
      sex: 'Hombres',
      age: '12 a 17 años',
      minAgeDays: 4380,
      maxAgeDays: 6569,
      sample: 'Sangre total',
      context: null,
      min: 12.2,
      max: 16.6,
      unit: 'g/dL',
    },
    {
      id: 'c1000000-0000-4000-8000-000000000007',
      analyte: 'Hemoglobina en sangre total',
      sex: 'Mujeres',
      age: '12 a 17 años',
      minAgeDays: 4380,
      maxAgeDays: 6569,
      sample: 'Sangre total',
      context: null,
      min: 9.7,
      max: 14.7,
      unit: 'g/dL',
    },
    {
      id: 'c1000000-0000-4000-8000-000000000002',
      analyte: 'Hemoglobina en sangre total',
      sex: 'Hombres',
      age: '18 años o más',
      minAgeDays: ADULT_DAYS,
      maxAgeDays: null,
      sample: 'Sangre total',
      context: null,
      min: 12.0,
      max: 17.0,
      unit: 'g/dL',
    },
    {
      id: 'c1000000-0000-4000-8000-000000000003',
      analyte: 'Hemoglobina en sangre total',
      sex: 'Mujeres',
      age: '18 años o más',
      minAgeDays: ADULT_DAYS,
      maxAgeDays: null,
      sample: 'Sangre total',
      context: null,
      min: 10.3,
      max: 15.2,
      unit: 'g/dL',
    },
  ],
};
