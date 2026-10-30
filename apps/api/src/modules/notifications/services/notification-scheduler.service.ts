import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationDispatchService } from './notification-dispatch.service';
import { NotificationPreferenceService } from './notification-preference.service';
import { ReminderService } from './reminder.service';
import { UserRepository } from '../../users/repositories/user.repository';
import { Exam, ExamDocument } from '../../cutoffs/models/exam.model';
import { Scholarship, ScholarshipDocument } from '../../scholarships/models/scholarship.model';
import { Roadmap, RoadmapDocument } from '../../roadmap/models/roadmap.model';
import { UserDocument } from '../../users/models/user.model';
import { NOTIFICATION_EVENTS, ExamRoundUpdatedEvent } from '../events/notification.events';

const REMINDER_CATEGORY: Record<string, string> = {
  counselling: 'account', scholarship_deadline: 'scholarships', roadmap_task: 'roadmap',
  exam: 'admissions', document_submission: 'admissions', loan_payment: 'financial', custom: 'system',
};

function isExactlyDaysAway(date: Date | undefined | null, days: number): boolean {
  if (!date) return false;
  const target = new Date();
  target.setDate(target.getDate() + days);
  return date.getFullYear() === target.getFullYear() && date.getMonth() === target.getMonth() && date.getDate() === target.getDate();
}

function isToday(date: Date | undefined | null): boolean {
  if (!date) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

/**
 * All cron-driven notification work lives here. NotificationsModule
 * registers Exam/Scholarship/Roadmap schemas directly (same pattern the
 * codebase already uses for User, shared across AuthModule/UsersModule) so
 * this can read that data for scheduled scans WITHOUT importing
 * CutoffsModule/ScholarshipsModule/RoadmapModule — those modules already
 * import NotificationsModule (for the legacy NotificationService), so
 * importing them back here would create a circular module graph.
 */
@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger('NotificationSchedulerService');

  constructor(
    private readonly dispatch: NotificationDispatchService,
    private readonly preferenceService: NotificationPreferenceService,
    private readonly reminderService: ReminderService,
    private readonly userRepo: UserRepository,
    private readonly events: EventEmitter2,
    @InjectModel(Exam.name) private readonly examModel: Model<ExamDocument>,
    @InjectModel(Scholarship.name) private readonly scholarshipModel: Model<ScholarshipDocument>,
    @InjectModel(Roadmap.name) private readonly roadmapModel: Model<RoadmapDocument>,
  ) {}

  // ── Scheduled / deferred notifications ──────────────────────────────────

  @Cron(CronExpression.EVERY_10_MINUTES)
  async deliverDueNotifications(): Promise<void> {
    const count = await this.dispatch.deliverDueNotifications();
    if (count > 0) this.logger.log(`Delivered ${count} scheduled notification(s).`);
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async deliverDueReminders(): Promise<void> {
    const due = await this.reminderService.findDue();
    for (const reminder of due) {
      await this.dispatch.dispatch({
        userId: reminder.userId,
        type: 'reminder',
        subtype: reminder.type,
        category: REMINDER_CATEGORY[reminder.type] ?? 'system',
        priority: 'medium',
        title: reminder.title,
        message: reminder.note || `Reminder: ${reminder.title}`,
      });
      await this.reminderService.markFired(reminder.id);
    }
    if (due.length > 0) this.logger.log(`Fired ${due.length} reminder(s).`);
  }

  // ── Daily: admission round deadlines (KCET/COMEDK/NEET/…) ───────────────

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async scanAdmissionDeadlines(): Promise<void> {
    const exams = await this.examModel.find({ isActive: true }).exec();
    let fired = 0;
    for (const exam of exams) {
      for (const round of exam.rounds) {
        const checks: Array<[Date | undefined, ExamRoundUpdatedEvent['subtype'], boolean]> = [
          [round.choiceFillingStart, 'choice_filling_open', isToday(round.choiceFillingStart)],
          [round.choiceFillingEnd, 'choice_filling_close', isExactlyDaysAway(round.choiceFillingEnd, 3)],
          [round.cutoffReleaseDate, 'round_result', isToday(round.cutoffReleaseDate)],
          [round.reportingDeadline, 'reporting_deadline', isExactlyDaysAway(round.reportingDeadline, 3)],
        ];
        for (const [date, subtype, matches] of checks) {
          if (!date || !matches) continue;
          this.events.emit(NOTIFICATION_EVENTS.EXAM_ROUND_UPDATED, {
            examCode: exam.code, examYear: exam.year, roundNumber: round.roundNumber, roundName: round.name,
            subtype, eventDate: date,
          } satisfies ExamRoundUpdatedEvent);
          fired++;
        }
      }
    }
    if (fired > 0) this.logger.log(`Scanned admission deadlines — ${fired} round-event(s) fired.`);
  }

  // ── Daily: scholarship deadlines ─────────────────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async scanScholarshipDeadlines(): Promise<void> {
    const target = new Date();
    target.setDate(target.getDate() + 3);
    const start = new Date(target.getFullYear(), target.getMonth(), target.getDate());
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const scholarships = await this.scholarshipModel.find({
      isActive: true, applicationDeadline: { $gte: start, $lt: end },
    }).exec();

    let notified = 0;
    for (const scholarship of scholarships) {
      const exams = scholarship.eligibility.exams?.length ? scholarship.eligibility.exams : ['KCET', 'COMEDK', 'NEET'];
      const byExam = await Promise.all(exams.map(exam => this.userRepo.findByExamCode(exam)));
      const seen = new Map<string, UserDocument>();
      for (const list of byExam) for (const u of list) seen.set(u.id, u);

      for (const student of seen.values()) {
        await this.dispatch.dispatch({
          userId: student.id,
          type: 'scholarship_deadline',
          subtype: 'deadline_reminder',
          category: 'scholarships',
          priority: 'high',
          title: `Deadline approaching: ${scholarship.name}`,
          message: `The application deadline for "${scholarship.name}" is ${scholarship.applicationDeadline.toDateString()}. Don't miss it.`,
          actionUrl: `/scholarships/${scholarship.id}`,
          relatedScholarshipId: scholarship.id,
          emailTemplateKey: 'scholarship_reminder',
          emailVariables: {
            name: student.fullName,
            scholarshipName: scholarship.name,
            message: `the application deadline is ${scholarship.applicationDeadline.toDateString()} — don't miss it.`,
            ctaUrl: `/scholarships/${scholarship.id}`,
          },
        });
        notified++;
      }
    }
    if (notified > 0) this.logger.log(`Scholarship deadline scan — notified ${notified} student(s).`);
  }

  // ── Weekly: roadmap digest + progress summary email ──────────────────────

  @Cron('0 9 * * 1') // Monday at 9am
  async sendWeeklyRoadmapDigest(): Promise<void> {
    const roadmaps = await this.roadmapModel.find({ isActive: true }).exec();
    let sent = 0;
    for (const roadmap of roadmaps) {
      const pref = await this.preferenceService.getOrCreate(roadmap.userId);
      if (!pref.weeklySummary) continue;

      const dueSoon = roadmap.phases.flatMap(p => p.milestones)
        .filter(m => m.status === 'in_progress' || m.status === 'not_started')
        .slice(0, 3);
      if (dueSoon.length === 0 && roadmap.analytics.completionPercent >= 100) continue;

      const user = await this.userRepo.findById(roadmap.userId);
      if (!user) continue;

      const summaryHtml = `<ul>${dueSoon.map(m => `<li>${m.title} — ${m.status.replace('_', ' ')}</li>`).join('')}</ul>`;
      await this.dispatch.dispatch({
        userId: roadmap.userId,
        type: 'roadmap_digest',
        category: 'roadmap',
        priority: 'low',
        title: 'Your weekly roadmap digest',
        message: `You're ${roadmap.analytics.completionPercent}% through your roadmap. ${dueSoon.length} milestone(s) need attention this week.`,
        actionUrl: '/roadmap',
        emailTemplateKey: 'weekly_progress',
        emailVariables: { name: user.fullName, summaryHtml, ctaUrl: '/roadmap' },
      });
      sent++;
    }
    if (sent > 0) this.logger.log(`Weekly roadmap digest sent to ${sent} student(s).`);
  }
}
