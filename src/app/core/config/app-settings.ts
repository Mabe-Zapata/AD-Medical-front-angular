import { InjectionToken } from '@angular/core';

export interface AppSettings {
  /** Base path of the REST API. In development the dev server proxies it to the backend. */
  readonly apiBaseUrl: string;
  /**
   * Prefilled source of new reference ranges. The backend has no endpoint to list sources, so the
   * development build offers the synthetic source created by the repository seed.
   */
  readonly defaultSourceId: string | null;
}

export const APP_SETTINGS = new InjectionToken<AppSettings>('APP_SETTINGS');
