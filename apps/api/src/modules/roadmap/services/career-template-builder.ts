import {
  CareerCategory, CertificationRef, MilestoneCategory, MilestoneTemplate, PhaseTemplate, ProjectRef, ResourceRef,
} from '../roadmap.types';

/**
 * Compact per-career input. One CareerConfig (~20 short fields) expands
 * into a full 6-phase, ~12-14 milestone CareerTemplate via
 * buildCareerTemplate() below — the boilerplate wording (placement-prep
 * checklist, higher-studies bundle, phase labels) lives once in the
 * builder, so each of the 34 careers in career-templates.seed-data.ts
 * only has to supply what's actually different about it: which skills,
 * certifications, project ideas, exams, and resources apply.
 */
export interface CareerConfig {
  careerId: string;
  name: string;
  category: CareerCategory;
  description: string;
  tags: string[];

  /** What a pre-admission student should understand/prepare (entrance exams, course choice). */
  entryFocus: string;
  entranceExams: string[];

  foundationSkills: string[]; // Year 1
  coreSkills: string[]; // Year 2
  specializationSkills: string[]; // Year 3
  finalSkills: string[]; // Final year

  certifications: CertificationRef[];
  projects: { beginner: string; intermediate: string; advanced: string; capstone: string };
  resources: ResourceRef[];

  /** e.g. "Competitive Programming", "Case Study Practice", "Mock Government Exams", "Clinical Case Discussions" — null skips the milestone. */
  practiceTrack: { label: string; description: string; platforms: string[] } | null;

  /** What "gaining real-world exposure" looks like for this career — internship, clinical posting, apprenticeship, field work. */
  exposureLabel: string;
  exposureDescription: string;

  communityLabel: string; // e.g. "technical clubs", "research groups", "case competition teams"

  finalPhaseFocus: 'placement' | 'higher_studies' | 'exam' | 'venture' | 'licensing';
  finalPhaseLabel: string; // label for phase 6, e.g. "Placement / Higher Studies"
  higherStudiesExams: string[]; // GATE/GRE/CAT/GMAT/TOEFL/IELTS/NEET-PG/etc — [] if not applicable
  outcomeTitle: string; // e.g. "Campus placement drive", "Admit to your target MS program"
  outcomeDescription: string;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function m(
  phaseKey: string,
  title: string,
  description: string,
  category: MilestoneCategory,
  opts: Partial<Pick<MilestoneTemplate, 'estimatedWeeks' | 'difficulty' | 'priority' | 'dependsOn' | 'skills' | 'resources' | 'certifications' | 'projects'>> = {},
): MilestoneTemplate {
  return {
    milestoneKey: `${phaseKey}.${slug(title)}`,
    title,
    description,
    category,
    estimatedWeeks: opts.estimatedWeeks ?? 4,
    difficulty: opts.difficulty ?? 'intermediate',
    priority: opts.priority ?? 'medium',
    dependsOn: opts.dependsOn ?? [],
    skills: opts.skills ?? [],
    resources: opts.resources ?? [],
    certifications: opts.certifications ?? [],
    projects: opts.projects ?? [],
  };
}

const dep = (phaseKey: string, title: string) => `${phaseKey}.${slug(title)}`;

export function buildCareerTemplate(c: CareerConfig): {
  careerId: string; name: string; category: CareerCategory; description: string; tags: string[]; phases: PhaseTemplate[]; isActive: boolean;
} {
  const phases: PhaseTemplate[] = [];

  // ── Phase 0: Before Admission ──────────────────────────────────────
  const p0 = 'before_admission';
  const entranceMilestones: MilestoneTemplate[] = [
    m(p0, `Understand the ${c.name} path`, c.entryFocus, 'academic', { estimatedWeeks: 2, difficulty: 'beginner', priority: 'high' }),
  ];
  if (c.entranceExams.length > 0) {
    entranceMilestones.push(m(
      p0, `Prepare for ${c.entranceExams.join('/')}`,
      `Build a study plan for ${c.entranceExams.join(', ')} and take timed mock tests to track readiness.`,
      'academic', { estimatedWeeks: 24, difficulty: 'intermediate', priority: 'high', skills: ['Time Management', 'Exam Strategy'] },
    ));
  }
  phases.push({ phaseKey: p0 as any, label: 'Before Admission', order: 0, milestones: entranceMilestones });

  // ── Phase 1: Year 1 — Foundations ──────────────────────────────────
  const p1 = 'year_1';
  phases.push({
    phaseKey: p1 as any, label: 'Year 1 — Foundations', order: 1,
    milestones: [
      m(p1, 'Build core fundamentals', `Focus on foundational coursework and start developing ${c.foundationSkills.slice(0, 2).join(' and ')}.`, 'academic', {
        estimatedWeeks: 16, difficulty: 'beginner', priority: 'high', skills: c.foundationSkills, resources: c.resources.slice(0, 2),
      }),
      m(p1, `Join ${c.communityLabel}`, `Get involved with ${c.communityLabel} on campus to build a peer network and start applying what you're learning outside the classroom.`, 'soft_skill', {
        estimatedWeeks: 2, difficulty: 'beginner', priority: 'medium', skills: ['Communication', 'Networking'],
      }),
      m(p1, 'First hands-on project', c.projects.beginner, 'project', {
        estimatedWeeks: 6, difficulty: 'beginner', priority: 'medium',
        dependsOn: [dep(p1, 'Build core fundamentals')],
        projects: [{ title: c.projects.beginner.split('.')[0], level: 'beginner', description: c.projects.beginner }],
      }),
    ],
  });

  // ── Phase 2: Year 2 — Core skills + first certification ───────────
  const p2 = 'year_2';
  const y2: MilestoneTemplate[] = [
    m(p2, 'Deepen core technical skills', `Master ${c.coreSkills.slice(0, 3).join(', ')}. Start applying these in real projects.`, 'skill', {
      estimatedWeeks: 20, difficulty: 'intermediate', priority: 'high', skills: c.coreSkills,
      dependsOn: [dep(p1, 'Build core fundamentals')], resources: c.resources.slice(2, 4),
    }),
    m(p2, `Earn ${c.certifications[0]?.name ?? 'your first certification'}`, `Target ${c.certifications[0]?.name ?? 'a foundational certification'} to validate your skills early and stand out to recruiters.`, 'certification', {
      estimatedWeeks: 6, difficulty: 'intermediate', priority: 'medium', certifications: c.certifications.slice(0, 1),
    }),
    m(p2, 'Intermediate project', c.projects.intermediate, 'project', {
      estimatedWeeks: 8, difficulty: 'intermediate', priority: 'medium',
      dependsOn: [dep(p2, 'Deepen core technical skills')],
      projects: [{ title: c.projects.intermediate.split('.')[0], level: 'intermediate', description: c.projects.intermediate }],
    }),
    m(p2, 'Start your placement-prep habit', 'Set up a GitHub/portfolio profile and begin a steady, weekly cadence of practice — this compounds far more than a last-minute sprint in your final year.', 'placement', {
      estimatedWeeks: 4, difficulty: 'beginner', priority: 'medium', skills: ['Portfolio Building'],
    }),
  ];
  if (c.practiceTrack) {
    y2.push(m(p2, c.practiceTrack.label, c.practiceTrack.description, 'competitive_programming', {
      estimatedWeeks: 30, difficulty: 'intermediate', priority: 'medium', skills: [c.practiceTrack.label],
      resources: c.practiceTrack.platforms.map(p => ({ title: p, provider: p, type: 'practice_platform' as const })),
    }));
  }
  phases.push({ phaseKey: p2 as any, label: 'Year 2 — Core Skills', order: 2, milestones: y2 });

  // ── Phase 3: Year 3 — Specialization + real-world exposure ────────
  const p3 = 'year_3';
  phases.push({
    phaseKey: p3 as any, label: 'Year 3 — Specialization', order: 3,
    milestones: [
      m(p3, 'Explore specialization topics', `Go deeper into ${c.specializationSkills.slice(0, 3).join(', ')} to differentiate yourself.`, 'skill', {
        estimatedWeeks: 18, difficulty: 'advanced', priority: 'high', skills: c.specializationSkills,
        dependsOn: [dep(p2, 'Deepen core technical skills')],
      }),
      m(p3, c.exposureLabel, c.exposureDescription, 'internship', {
        estimatedWeeks: 12, difficulty: 'advanced', priority: 'high',
        dependsOn: [dep(p2, `Earn ${c.certifications[0]?.name ?? 'your first certification'}`)],
      }),
      m(p3, `Earn ${c.certifications[1]?.name ?? 'an advanced certification'}`, `Target ${c.certifications[1]?.name ?? 'a specialization certification'} for a competitive edge.`, 'certification', {
        estimatedWeeks: 6, difficulty: 'advanced', priority: 'medium', certifications: c.certifications.slice(1, 2),
      }),
      m(p3, 'Advanced project', c.projects.advanced, 'project', {
        estimatedWeeks: 10, difficulty: 'advanced', priority: 'medium',
        dependsOn: [dep(p3, 'Explore specialization topics')],
        projects: [{ title: c.projects.advanced.split('.')[0], level: 'advanced', description: c.projects.advanced }],
      }),
      m(p3, 'Compete in a hackathon or case competition', 'Participate in at least one hackathon, case competition, or open-source sprint — team-based, deadline-driven work is exactly what interviewers probe for.', 'hackathon', {
        estimatedWeeks: 2, difficulty: 'intermediate', priority: 'low', skills: ['Teamwork', 'Rapid Prototyping'],
      }),
    ],
  });

  // ── Phase 4: Final Year — outcome-specific prep bundle ─────────────
  const p4 = 'final_year';
  const finalMilestones: MilestoneTemplate[] = [
    m(p4, 'Master final-year specialization', `Consolidate ${c.finalSkills.slice(0, 2).join(' and ')} — the skills that most directly map to your target role.`, 'skill', {
      estimatedWeeks: 12, difficulty: 'advanced', priority: 'high', skills: c.finalSkills,
      dependsOn: [dep(p3, 'Explore specialization topics')],
    }),
    m(p4, 'Capstone project', c.projects.capstone, 'project', {
      estimatedWeeks: 14, difficulty: 'advanced', priority: 'high',
      dependsOn: [dep(p4, 'Master final-year specialization')],
      projects: [{ title: c.projects.capstone.split('.')[0], level: 'portfolio', description: c.projects.capstone }],
    }),
  ];

  if (c.finalPhaseFocus === 'placement') {
    finalMilestones.push(
      m(p4, 'Polish resume, LinkedIn, and GitHub', 'Rewrite your resume around impact (not duties), align your LinkedIn headline/summary with your target role, and pin your best repositories with clear READMEs.', 'placement', { estimatedWeeks: 2, difficulty: 'beginner', priority: 'high' }),
      m(p4, 'Aptitude and coding practice', 'Run a structured daily practice block — aptitude/reasoning plus coding practice on your chosen platforms — building up to full-length timed mock tests.', 'placement', {
        estimatedWeeks: 10, difficulty: 'intermediate', priority: 'high',
        resources: [
          { title: 'LeetCode', provider: 'LeetCode', type: 'practice_platform' },
          { title: 'GeeksforGeeks', provider: 'GeeksforGeeks', type: 'practice_platform' },
        ],
      }),
      m(p4, 'System design / technical interview prep', 'Practice explaining trade-offs out loud, not just solving problems silently — this is what separates a pass from a borderline decision in most interview loops.', 'placement', { estimatedWeeks: 6, difficulty: 'advanced', priority: 'high' }),
      m(p4, 'Mock interviews and HR round prep', 'Run at least 3–5 mock interviews (peers, seniors, or platforms) covering both technical and HR/behavioral rounds before your first real interview.', 'placement', { estimatedWeeks: 3, difficulty: 'intermediate', priority: 'high' }),
    );
  } else if (c.finalPhaseFocus === 'higher_studies') {
    finalMilestones.push(
      m(p4, `Prepare for ${c.higherStudiesExams.join('/') || 'entrance exams'}`, `Build a dedicated study plan for ${c.higherStudiesExams.join(', ') || 'your target entrance exam'} well ahead of application deadlines.`, 'higher_studies', { estimatedWeeks: 20, difficulty: 'advanced', priority: 'high' }),
      m(p4, 'Shortlist programs and universities', 'Research programs by fit (faculty, funding, curriculum) rather than rankings alone; build a balanced list of reach/match/safe options.', 'higher_studies', { estimatedWeeks: 6, difficulty: 'intermediate', priority: 'high' }),
      m(p4, 'SOP, LORs, and applications', 'Draft your statement of purpose, request letters of recommendation early, and track every application deadline in one place.', 'higher_studies', { estimatedWeeks: 8, difficulty: 'intermediate', priority: 'high' }),
    );
  } else if (c.finalPhaseFocus === 'exam') {
    finalMilestones.push(
      m(p4, `Structured ${c.higherStudiesExams.join('/') || 'exam'} preparation`, `Follow a syllabus-mapped study plan for ${c.higherStudiesExams.join(', ') || 'your target exam'}, with weekly mock tests and error-log review.`, 'higher_studies', { estimatedWeeks: 30, difficulty: 'advanced', priority: 'high' }),
      m(p4, 'Current affairs and general awareness', 'Build a daily current-affairs habit — this compounds over months and is hard to cram at the last minute.', 'higher_studies', { estimatedWeeks: 30, difficulty: 'intermediate', priority: 'medium' }),
      m(p4, 'Interview and personality test prep', 'Practice structured answers for the interview/personality round, including mock panels where possible.', 'placement', { estimatedWeeks: 4, difficulty: 'advanced', priority: 'high' }),
    );
  } else if (c.finalPhaseFocus === 'venture') {
    finalMilestones.push(
      m(p4, 'Validate your idea with real users', 'Talk to at least 20–30 potential customers before writing production code — validate the problem, not just the solution.', 'academic', { estimatedWeeks: 4, difficulty: 'intermediate', priority: 'high' }),
      m(p4, 'Build and ship an MVP', 'Ship the smallest version of your product that lets real users get real value, then iterate from feedback.', 'project', { estimatedWeeks: 10, difficulty: 'advanced', priority: 'high' }),
      m(p4, 'Funding, incorporation, and early traction', 'Decide on bootstrapping vs. raising, handle basic incorporation/compliance, and set a concrete traction target for the next 6 months.', 'academic', { estimatedWeeks: 8, difficulty: 'advanced', priority: 'medium' }),
    );
  } else if (c.finalPhaseFocus === 'licensing') {
    finalMilestones.push(
      m(p4, 'Clinical/practical postings', 'Complete required clinical rotations or practical postings, keeping a structured case log for review and future applications.', 'internship', { estimatedWeeks: 26, difficulty: 'advanced', priority: 'high' }),
      m(p4, `Prepare for ${c.higherStudiesExams.join('/') || 'licensing exams'}`, `Build a study plan for ${c.higherStudiesExams.join(', ') || 'your licensing/entrance exam'} alongside your clinical workload.`, 'higher_studies', { estimatedWeeks: 20, difficulty: 'advanced', priority: 'high' }),
      m(p4, 'Registration and licensing', 'Complete the registration/licensing process required to practice, well before you need it for job or residency applications.', 'academic', { estimatedWeeks: 4, difficulty: 'intermediate', priority: 'high' }),
    );
  }

  phases.push({ phaseKey: p4 as any, label: 'Final Year', order: 4, milestones: finalMilestones });

  // ── Phase 5: Outcome ────────────────────────────────────────────────
  const p5 = 'placement_or_higher_studies';
  phases.push({
    phaseKey: p5 as any, label: c.finalPhaseLabel, order: 5,
    milestones: [
      m(p5, c.outcomeTitle, c.outcomeDescription, c.finalPhaseFocus === 'higher_studies' ? 'higher_studies' : 'placement', {
        estimatedWeeks: 10, difficulty: 'advanced', priority: 'high',
      }),
      m(p5, 'Grow your professional network', 'Keep your LinkedIn/alumni network active — most mid-career opportunities come through people who already know your work.', 'soft_skill', {
        estimatedWeeks: 2, difficulty: 'beginner', priority: 'low', skills: ['Networking', 'Personal Branding'],
      }),
    ],
  });

  return {
    careerId: c.careerId, name: c.name, category: c.category, description: c.description, tags: c.tags, phases, isActive: true,
  };
}
