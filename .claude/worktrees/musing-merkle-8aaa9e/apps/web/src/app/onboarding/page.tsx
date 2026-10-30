'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { apiClient, ApiError } from '../../lib/api-client';
import { Step1Personal } from './steps/Step1Personal';
import { Step2Academic } from './steps/Step2Academic';
import { Step3Exams } from './steps/Step3Exams';
import { Step4Category } from './steps/Step4Category';
import { Step5Preferences } from './steps/Step5Preferences';
import { Step6AI } from './steps/Step6AI';
import type { Step1Data, Step2Data, Step3Data, Step4Data, Step5Data, Step6Data } from './types';

const STEP_LABELS = ['Personal', 'Academic', 'Exams', 'Category', 'Preferences', 'AI Profile'];

const defaultStep1: Step1Data = { photoUrl: '', fullName: '', gender: '', dob: '', phone: '', state: '', district: '', city: '', pinCode: '', preferredLanguage: 'English' };
const defaultStep2: Step2Data = { currentQualification: '', tenthPercentage: '', twelfthPercentage: '', diploma: '', pucBoard: '', yearOfPassing: '', gapYears: '0' };
const defaultStep3: Step3Data = { exams: [] };
const defaultStep4: Step4Data = { reservationCategory: '', horizontalReservations: [] };
const defaultStep5: Step5Data = { preferredExam: '', preferredDiscipline: '', preferredCourses: [], preferredColleges: [], preferredCities: [], collegeType: 'any', hostelRequired: false, budgetMax: '', loanRequired: false, postGraduationPlan: '' };
const defaultStep6: Step6Data = { careerGoal: '', dreamCompanies: [], interestAreas: [], skills: [], programmingLanguages: [], learningStyle: '', communicationLanguage: 'English', receiveAiSuggestions: true, receiveNotifications: true };

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedStep = Number(searchParams.get('step'));
  const { user, accessToken, isAuthenticated, isLoading: authLoading, refreshUser } = useUserAuth();

  const [hydrated, setHydrated] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [step1, setStep1] = useState(defaultStep1);
  const [step2, setStep2] = useState(defaultStep2);
  const [step3, setStep3] = useState(defaultStep3);
  const [step4, setStep4] = useState(defaultStep4);
  const [step5, setStep5] = useState(defaultStep5);
  const [step6, setStep6] = useState(defaultStep6);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push('/login/student'); return; }

    (async () => {
      try {
        const data = await apiClient.get<any>('/users/me/onboarding', accessToken);
        const completed: number[] = data.onboarding?.completedSteps ?? [];
        setCompletedSteps(completed);
        if (requestedStep >= 1 && requestedStep <= 6 && (completed.includes(requestedStep) || data.onboarding?.completed)) {
          setCurrentStep(requestedStep);
        } else {
          setCurrentStep(Math.min(data.onboarding?.currentStep ?? 1, 6));
        }

        if (data.personal) {
          setStep1(s => ({
            ...s,
            photoUrl: data.personal.photoUrl ?? '',
            fullName: data.personal.fullName ?? '',
            gender: data.personal.gender ?? '',
            dob: data.personal.dob ? String(data.personal.dob).slice(0, 10) : '',
            phone: data.personal.phone ?? '',
            state: data.personal.state ?? '',
            district: data.personal.district ?? '',
            city: data.personal.city ?? '',
            pinCode: data.personal.pinCode ?? '',
            preferredLanguage: data.personal.preferredLanguage ?? 'English',
          }));
        }
        if (data.academic) {
          setStep2(s => ({
            ...s,
            currentQualification: data.academic.currentQualification ?? '',
            tenthPercentage: data.academic.tenthPercentage != null ? String(data.academic.tenthPercentage) : '',
            twelfthPercentage: data.academic.twelfthPercentage != null ? String(data.academic.twelfthPercentage) : '',
            diploma: data.academic.diploma ?? '',
            pucBoard: data.academic.pucBoard ?? '',
            yearOfPassing: data.academic.yearOfPassing != null ? String(data.academic.yearOfPassing) : '',
            gapYears: data.academic.gapYears != null ? String(data.academic.gapYears) : '0',
          }));
        }
        if (data.exams?.length) {
          setStep3({
            exams: data.exams.map((e: any) => ({
              examCode: e.examCode, rank: e.rank ? String(e.rank) : '', categoryRank: e.categoryRank != null ? String(e.categoryRank) : '',
              percentile: e.percentile != null ? String(e.percentile) : '', attemptYear: String(e.year ?? new Date().getFullYear()),
            })),
          });
        }
        if (data.categoryReservation) {
          setStep4({
            reservationCategory: data.categoryReservation.reservationCategory ?? '',
            horizontalReservations: data.categoryReservation.horizontalReservations ?? [],
          });
        }
        if (data.preferences) {
          setStep5(s => ({
            ...s,
            preferredExam: data.preferences.preferredExam ?? '',
            preferredDiscipline: data.preferences.preferredDiscipline ?? '',
            preferredCourses: data.preferences.preferredCourses ?? [],
            preferredColleges: data.preferences.preferredColleges ?? [],
            preferredCities: data.preferences.preferredCities ?? [],
            collegeType: data.preferences.collegeType ?? 'any',
            hostelRequired: !!data.preferences.hostelRequired,
            budgetMax: data.preferences.budgetMax != null ? String(data.preferences.budgetMax) : '',
            loanRequired: !!data.preferences.loanRequired,
            postGraduationPlan: data.preferences.postGraduationPlan ?? '',
          }));
        }
        if (data.aiPersonalization) {
          setStep6(s => ({
            ...s,
            careerGoal: data.aiPersonalization.careerGoal ?? '',
            dreamCompanies: data.aiPersonalization.dreamCompanies ?? [],
            interestAreas: data.aiPersonalization.interestAreas ?? [],
            skills: data.aiPersonalization.skills ?? [],
            programmingLanguages: data.aiPersonalization.programmingLanguages ?? [],
            learningStyle: data.aiPersonalization.learningStyle ?? '',
            communicationLanguage: data.aiPersonalization.communicationLanguage ?? 'English',
            receiveAiSuggestions: data.aiPersonalization.receiveAiSuggestions ?? true,
            receiveNotifications: data.aiPersonalization.receiveNotifications ?? true,
          }));
        }
      } catch {
        // Fresh account with no saved onboarding data yet — defaults are fine.
      } finally {
        setHydrated(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated]);

  const saveCurrentStep = async (): Promise<boolean> => {
    setSaving(true);
    setError(null);
    try {
      if (currentStep === 1) {
        await apiClient.patch('/users/me/onboarding/step-1', {
          ...step1,
          dob: step1.dob || undefined,
        }, accessToken);
      } else if (currentStep === 2) {
        await apiClient.patch('/users/me/onboarding/step-2', {
          currentQualification: step2.currentQualification || undefined,
          tenthPercentage: step2.tenthPercentage ? Number(step2.tenthPercentage) : undefined,
          twelfthPercentage: step2.twelfthPercentage ? Number(step2.twelfthPercentage) : undefined,
          diploma: step2.diploma || undefined,
          pucBoard: step2.pucBoard || undefined,
          yearOfPassing: step2.yearOfPassing ? Number(step2.yearOfPassing) : undefined,
          gapYears: step2.gapYears ? Number(step2.gapYears) : undefined,
        }, accessToken);
      } else if (currentStep === 3) {
        await apiClient.patch('/users/me/onboarding/step-3', {
          exams: step3.exams.map(e => ({
            examCode: e.examCode,
            rank: e.rank ? Number(e.rank) : undefined,
            categoryRank: e.categoryRank ? Number(e.categoryRank) : undefined,
            percentile: e.percentile ? Number(e.percentile) : undefined,
            attemptYear: Number(e.attemptYear) || new Date().getFullYear(),
          })),
        }, accessToken);
      } else if (currentStep === 4) {
        await apiClient.patch('/users/me/onboarding/step-4', step4, accessToken);
      } else if (currentStep === 5) {
        await apiClient.patch('/users/me/onboarding/step-5', {
          ...step5,
          budgetMax: step5.budgetMax ? Number(step5.budgetMax) : undefined,
          postGraduationPlan: step5.postGraduationPlan || undefined,
        }, accessToken);
      } else if (currentStep === 6) {
        await apiClient.patch('/users/me/onboarding/step-6', step6, accessToken);
      }
      setCompletedSteps(prev => Array.from(new Set([...prev, currentStep])));
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save this step. Please try again.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    const ok = await saveCurrentStep();
    if (!ok) return;

    if (currentStep < 6) {
      setCurrentStep(currentStep + 1);
    } else {
      try {
        await apiClient.post('/users/me/onboarding/complete', {}, accessToken);
        await refreshUser();
        router.push('/profile');
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Could not complete onboarding.');
      }
    }
  };

  const handleSaveAndExit = async () => {
    await saveCurrentStep();
    router.push('/profile');
  };

  const jumpToStep = (step: number) => {
    if (step === currentStep) return;
    if (completedSteps.includes(step) || step === Math.max(...completedSteps, 0) + 1) setCurrentStep(step);
  };

  if (authLoading || !hydrated) {
    return <div className="wizard-page"><div className="wizard-shell"><p className="wizard-hint" style={{ textAlign: 'center' }}>Loading your onboarding progress…</p></div></div>;
  }

  const progressPct = Math.round((completedSteps.length / 6) * 100);

  return (
    <div className="wizard-page">
      <div className="container-editorial wizard-shell">
        <div className="wizard-header">
          <span className="auth-eyebrow">Welcome, {user?.name?.split(' ')[0] ?? 'Student'}</span>
          <h1 className="text-section-title font-serif wizard-title">Let's Build Your Profile</h1>
          <p className="wizard-subtitle">Six quick steps power every prediction, recommendation, and roadmap CareerCompass AI gives you.</p>
        </div>

        <div className="wizard-progress-wrap">
          <div className="wizard-progress-track">
            <div className="wizard-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="wizard-steps-row">
            {STEP_LABELS.map((label, idx) => {
              const step = idx + 1;
              const state = completedSteps.includes(step) ? 'done' : step === currentStep ? 'active' : 'pending';
              return (
                <button
                  key={step} type="button" className="wizard-step" data-state={state}
                  disabled={!(completedSteps.includes(step) || step === Math.max(...completedSteps, 0) + 1)}
                  onClick={() => jumpToStep(step)}
                >
                  <span className="wizard-step-dot">{state === 'done' ? '✓' : step}</span>
                  <span className="wizard-step-label">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card-editorial wizard-card">
          {error && <div className="auth-banner" data-tone="error">{error}</div>}

          {currentStep === 1 && <Step1Personal data={step1} onChange={p => setStep1(s => ({ ...s, ...p }))} />}
          {currentStep === 2 && <Step2Academic data={step2} onChange={p => setStep2(s => ({ ...s, ...p }))} />}
          {currentStep === 3 && <Step3Exams data={step3} onChange={p => setStep3(s => ({ ...s, ...p }))} />}
          {currentStep === 4 && <Step4Category data={step4} onChange={p => setStep4(s => ({ ...s, ...p }))} />}
          {currentStep === 5 && <Step5Preferences data={step5} onChange={p => setStep5(s => ({ ...s, ...p }))} />}
          {currentStep === 6 && <Step6AI data={step6} onChange={p => setStep6(s => ({ ...s, ...p }))} />}

          <div className="wizard-nav">
            <div>
              {currentStep > 1 && (
                <button type="button" className="btn-editorial-secondary" onClick={() => setCurrentStep(currentStep - 1)} disabled={saving}>
                  Back
                </button>
              )}
            </div>
            <div className="wizard-nav-right">
              <button type="button" className="auth-link" onClick={handleSaveAndExit} disabled={saving}>Save &amp; exit</button>
              <button type="button" className="btn-editorial-primary" onClick={handleNext} disabled={saving}>
                {saving ? 'Saving…' : currentStep === 6 ? 'Complete Setup' : 'Save & Continue'}
              </button>
            </div>
          </div>
        </div>

        <p className="wizard-save-hint" style={{ textAlign: 'center' }}>
          Your progress is saved automatically after each step. <Link href="/profile" className="auth-link">Go to profile</Link>
        </p>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="wizard-page"><div className="wizard-shell"><p className="wizard-hint" style={{ textAlign: 'center' }}>Loading…</p></div></div>}>
      <OnboardingContent />
    </Suspense>
  );
}
