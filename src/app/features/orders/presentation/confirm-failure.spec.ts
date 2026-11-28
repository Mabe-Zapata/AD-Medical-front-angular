import { HttpErrorResponse } from '@angular/common/http';

import { toAppError } from '../../../core/http/api-error';
import { confirmFailureMessage } from './confirm-failure';

function conflict(code?: string) {
  return toAppError(
    new HttpErrorResponse({
      status: 409,
      error: { detail: 'English detail from the backend', code },
    }),
  );
}

describe('confirmFailureMessage', () => {
  it('asks for the laboratory interpretation when the lab review is pending', () => {
    expect(confirmFailureMessage(conflict('LAB_REVIEW_PENDING'))).toContain('interpretación');
  });

  it('asks for the physician review when the physician has not decided yet', () => {
    const message = confirmFailureMessage(conflict('MEDICAL_REVIEW_PENDING'));

    expect(message).toContain('médico');
    expect(message).not.toContain('English');
  });

  it('never shows the backend detail for an unknown conflict', () => {
    const message = confirmFailureMessage(conflict());

    expect(message).not.toContain('English detail');
    expect(message).toContain('ya está confirmada');
  });
});
