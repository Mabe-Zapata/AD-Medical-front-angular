import { DestroyRef } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/**
 * Keeps a control clean while the person types. `setValue` also rewrites the input's DOM value, which
 * a plain model update does not do when the model did not change (the emoji would stay on screen).
 */
export function sanitizeOnType(
  control: AbstractControl<string>,
  sanitize: (text: string) => string,
  destroyRef: DestroyRef,
): void {
  control.valueChanges.pipe(takeUntilDestroyed(destroyRef)).subscribe((value) => {
    const clean = sanitize(value);
    if (clean !== value) control.setValue(clean);
  });
}
