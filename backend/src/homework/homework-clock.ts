import { Injectable } from '@nestjs/common';

/** The time homework rules use (publish, due, reminders); tests replace `now`. */
@Injectable()
export class HomeworkClock {
  now(): Date {
    return new Date();
  }
}
