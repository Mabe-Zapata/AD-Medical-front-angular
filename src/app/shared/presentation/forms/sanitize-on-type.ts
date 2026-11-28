import { DestroyRef } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/**
 * Rewrites a text input's DOM value with its sanitized form. Needed when the model does not change
 * (e.g. an emoji typed into a search box whose model already held the clean text).
 */
export function sanitizeInputEvent(
  event: Event,
  sanitize: (text: string) => string,
): void {
  const input = event.target as HTMLInputElement | HTMLTextAreaElement;
  const clean = sanitize(input.value);
  if (clean !== input.value) input.value = clean;
}

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
