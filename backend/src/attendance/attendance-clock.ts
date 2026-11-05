import { Injectable } from '@nestjs/common';

/**
 * The server's clock for attendance (ATT-04: the time comes from the server, not the device). One
 * place to read it, so tests can stand at a window's edge.
 */
@Injectable()
export class AttendanceClock {
  now(): Date {
    return new Date();
  }
}
