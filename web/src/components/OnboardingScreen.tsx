'use client';

import React from 'react';

interface OnboardingScreenProps {
  onSelectFolder: () => void;
  isLoading: boolean;
}

export function OnboardingScreen({ onSelectFolder, isLoading }: OnboardingScreenProps) {
  const steps = [
    {
      number: 1,
      title: 'Select Your Portfolio Folder',
      description: 'Choose the folder containing your portfolio entries and projects.',
      icon: '📁'
    },
    {
      number: 2,
      title: 'Organize by Projects & Goals',
      description: 'Your entries are automatically organized into projects and goals.',
      icon: '📊'
    },
    {
      number: 3,
      title: 'Explore & Track Progress',
      description: 'View your work, filter by goals, and track your portfolio entries.',
      icon: '🚀'
    }
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-3">Builder's Diary</h1>
          <p className="text-xl text-slate-600">Your portfolio visualization system</p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {steps.map((step) => (
            <div key={step.number} className="bg-white rounded-lg shadow-sm p-6 border border-slate-200 hover:shadow-md transition-shadow">
              <div className="text-4xl mb-4">{step.icon}</div>
              <div className="inline-block bg-emerald-100 text-emerald-700 font-bold px-3 py-1 rounded-full mb-3 text-sm">
                Step {step.number}
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">{step.title}</h3>
              <p className="text-slate-600 text-sm">{step.description}</p>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <div className="text-center">
          <button
            onClick={onSelectFolder}
            disabled={isLoading}
            className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-slate-400 disabled:to-slate-400 text-white font-semibold py-4 px-12 rounded-lg shadow-lg hover:shadow-xl transition-all text-lg"
          >
            {isLoading ? 'Loading...' : 'Select Your Portfolio Folder'}
          </button>
          <p className="text-slate-600 text-sm mt-4">
            Use your browser's folder picker to select your portfolio directory
          </p>
        </div>

        {/* Footer Info */}
        <div className="mt-16 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">💡 Tip:</span> Your portfolio folder should contain markdown files with YAML frontmatter or organized by project/goal structure.
          </p>
        </div>
      </div>
    </div>
  );
}
