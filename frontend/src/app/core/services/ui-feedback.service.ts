import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class UiFeedbackService {
  private readonly snackBar = inject(MatSnackBar);

  success(message: string) {
    this.snackBar.open(message, 'Cerrar', { duration: 3500 });
  }

  error(message: string) {
    this.snackBar.open(message, 'Cerrar', { duration: 6000 });
  }

  info(message: string) {
    this.snackBar.open(message, 'Cerrar', { duration: 4000 });
  }
}
