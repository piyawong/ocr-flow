'use client';

export default function Stage05Review() {
  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Gradient Header Background */}
      <div className="relative">
        <div className="absolute inset-0 h-64 bg-gradient-to-br from-accent/10 via-purple-500/5 to-transparent pointer-events-none" />

        <div className="relative p-6 md:p-8 max-w-[1400px] mx-auto">
          {/* Header */}
          <div className="flex items-start gap-5 mb-8">
            {/* Stage Badge */}
            <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center shadow-lg shadow-accent/25">
              <span className="text-white font-bold text-xl">05</span>
            </div>
            <div>
              <h1 className="m-0 mb-2 text-2xl font-bold text-text-primary">Stage 05: Review</h1>
              <p className="m-0 text-text-secondary text-sm">Review and validate extracted data before final upload</p>
            </div>
          </div>

          {/* Status Cards */}
          <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-border-color/50 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h2 className="m-0 text-lg font-semibold text-text-primary">Current Status</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-accent/10 to-accent/5 p-5 rounded-xl border border-accent/20">
                <span className="block text-accent text-sm font-medium mb-2">To Review</span>
                <span className="block text-4xl font-bold text-text-primary">0</span>
                <span className="block text-xs text-accent/70 mt-2">documents pending review</span>
              </div>
              <div className="bg-gradient-to-br from-warning/10 to-warning/5 p-5 rounded-xl border border-warning/20">
                <span className="block text-warning text-sm font-medium mb-2">Status</span>
                <div className="flex items-center gap-2.5 text-xl font-semibold my-2">
                  <span className="w-3 h-3 bg-warning rounded-full animate-pulse"></span>
                  <span className="text-text-primary">Pending</span>
                </div>
                <span className="block text-xs text-warning/70 mt-2">Complete Stage 04 first</span>
              </div>
            </div>
          </div>

          {/* Task Card */}
          <div className="bg-card-bg/80 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-border-color/50 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="m-0 text-lg font-semibold text-text-primary">Task 05: Manual Review</h2>
            </div>
            <p className="text-text-secondary text-sm mb-5 leading-relaxed">
              Review extracted data and make corrections before uploading to the final destination.
            </p>
            <button
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-gray-400 to-gray-500 text-white font-medium cursor-not-allowed opacity-60 shadow-lg"
              disabled
            >
              Coming Soon
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
