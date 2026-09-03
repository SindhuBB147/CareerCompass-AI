'use client';

import React, { useEffect, useState } from 'react';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { ApiError } from '../../../lib/api-client';
import { adminCollegesApi } from '../../../lib/admin-api';
import { collegesApi, type College } from '../../../lib/colleges-api';
import { AdminModal } from '../../../components/admin/AdminModal';

const EXAM_OPTIONS = ['KCET', 'COMEDK', 'NEET', 'JEE'];

interface NewCourseForm {
  courseId: string; name: string; degreeType: string; intake: string;
  examsAccepted: string[]; feePerYear: string; discipline: string;
}

const EMPTY_NEW_COURSE: NewCourseForm = { courseId: '', name: '', degreeType: 'B.E.', intake: '', examsAccepted: ['KCET'], feePerYear: '', discipline: 'Engineering' };

export function CoursesManagerModal({ collegeId, onClose }: { collegeId: string; onClose: () => void }) {
  const { adminToken } = useAdminAuth();
  const [college, setCollege] = useState<College | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCourse, setNewCourse] = useState<NewCourseForm>(EMPTY_NEW_COURSE);
  const [feeEdits, setFeeEdits] = useState<Record<string, string>>({});

  const reload = () => {
    setIsLoading(true);
    collegesApi.getDetail(collegeId).then(setCollege).catch(() => setError('Failed to load courses.')).finally(() => setIsLoading(false));
  };

  useEffect(() => { reload(); }, [collegeId]);

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setError(null);
    try {
      await adminCollegesApi.addCourse(adminToken, collegeId, {
        courseId: newCourse.courseId.toUpperCase(), name: newCourse.name, degreeType: newCourse.degreeType,
        intake: Number(newCourse.intake), examsAccepted: newCourse.examsAccepted,
        feePerYear: newCourse.feePerYear ? Number(newCourse.feePerYear) : undefined,
        discipline: newCourse.discipline,
      });
      setNewCourse(EMPTY_NEW_COURSE);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add course.');
    }
  };

  const handleUpdateFee = async (courseId: string) => {
    if (!adminToken || !feeEdits[courseId]) return;
    try {
      await adminCollegesApi.updateCourseFee(adminToken, collegeId, courseId, Number(feeEdits[courseId]));
      setFeeEdits(prev => { const next = { ...prev }; delete next[courseId]; return next; });
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update fee.');
    }
  };

  const handleRemoveCourse = async (courseId: string) => {
    if (!adminToken || !confirm(`Remove course "${courseId}"?`)) return;
    try {
      await adminCollegesApi.removeCourse(adminToken, collegeId, courseId);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove course.');
    }
  };

  const toggleExam = (exam: string) => {
    setNewCourse(prev => ({
      ...prev,
      examsAccepted: prev.examsAccepted.includes(exam) ? prev.examsAccepted.filter(e => e !== exam) : [...prev.examsAccepted, exam],
    }));
  };

  return (
    <AdminModal title={`Manage Courses — ${college?.name ?? '…'}`} onClose={onClose} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxHeight: '65vh', overflowY: 'auto' }}>
        {error && <div className="admin-inline-message" data-tone="error">{error}</div>}

        {isLoading ? (
          <p className="admin-loading">Loading…</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Code</th><th>Name</th><th>Degree</th><th>Intake</th><th>Exams</th><th>Fee/yr</th><th></th>
                </tr>
              </thead>
              <tbody>
                {college?.courses.map(course => (
                  <tr key={course.courseId}>
                    <td>{course.courseId}</td>
                    <td>{course.name}</td>
                    <td>{course.degreeType}</td>
                    <td>{course.intake}</td>
                    <td>{course.examsAccepted.join(', ')}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          type="number"
                          className="input-editorial"
                          style={{ width: '90px', padding: '6px 8px', fontSize: '12px' }}
                          placeholder={String(course.feePerYear ?? '')}
                          value={feeEdits[course.courseId] ?? ''}
                          onChange={e => setFeeEdits(prev => ({ ...prev, [course.courseId]: e.target.value }))}
                        />
                        <button className="admin-table-action-btn" onClick={() => handleUpdateFee(course.courseId)}>Save</button>
                      </div>
                    </td>
                    <td><button className="admin-table-action-btn" data-danger="true" onClick={() => handleRemoveCourse(course.courseId)}>Remove</button></td>
                  </tr>
                ))}
                {college?.courses.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No courses yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <form onSubmit={handleAddCourse} className="admin-form-grid" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <div className="admin-form-group">
            <label className="admin-form-label">Course Code</label>
            <input className="input-editorial" required value={newCourse.courseId} onChange={e => setNewCourse({ ...newCourse, courseId: e.target.value })} placeholder="CSE" />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Course Name</label>
            <input className="input-editorial" required value={newCourse.name} onChange={e => setNewCourse({ ...newCourse, name: e.target.value })} placeholder="Computer Science & Engineering" />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Degree Type</label>
            <input className="input-editorial" required value={newCourse.degreeType} onChange={e => setNewCourse({ ...newCourse, degreeType: e.target.value })} />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Intake (Seats)</label>
            <input type="number" className="input-editorial" required value={newCourse.intake} onChange={e => setNewCourse({ ...newCourse, intake: e.target.value })} />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Fee / Year</label>
            <input type="number" className="input-editorial" value={newCourse.feePerYear} onChange={e => setNewCourse({ ...newCourse, feePerYear: e.target.value })} />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Discipline</label>
            <input className="input-editorial" value={newCourse.discipline} onChange={e => setNewCourse({ ...newCourse, discipline: e.target.value })} />
          </div>
          <div className="admin-form-group" data-span="2">
            <label className="admin-form-label">Exams Accepted</label>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              {EXAM_OPTIONS.map(exam => (
                <label key={exam} className="admin-checkbox-row">
                  <input type="checkbox" className="admin-checkbox" checked={newCourse.examsAccepted.includes(exam)} onChange={() => toggleExam(exam)} />
                  {exam}
                </label>
              ))}
            </div>
          </div>
          <div className="admin-form-group" data-span="2" style={{ alignItems: 'flex-end' }}>
            <button type="submit" className="btn-editorial-primary" style={{ padding: '10px 20px', fontSize: '13px' }}>+ Add Course</button>
          </div>
        </form>
      </div>
    </AdminModal>
  );
}
