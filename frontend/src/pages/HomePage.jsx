import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <div className="mx-auto min-h-screen max-w-4xl px-4 py-12">
      <div className="card">
        <h1 className="text-3xl font-bold text-slate-900">Exam Management System</h1>
        <p className="mt-3 text-slate-600">
          Admin can create candidates, build section-wise exams, assign schedules, and review scores.
          Candidates can join with invite links, complete exam, and submit feedback.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/admin/login" className="btn-primary">
            Admin Portal
          </Link>
          <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
            Candidate link comes by email after admin assignment.
          </span>
        </div>
      </div>
    </div>
  );
}
