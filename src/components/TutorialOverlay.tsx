"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface TutorialStep {
  id: number;
  title: string;
  description: string;
  panel: string; // which panel/area to look at
  tryItLabel: string;
}

/* ------------------------------------------------------------------ */
/*  Tutorial steps data                                                 */
/* ------------------------------------------------------------------ */

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 1,
    title: "Welcome to Mission Control",
    description:
      "This is your personal AI operating system. Everything you need — agents, tools, and life management — lives here in one place.",
    panel: "The main sidebar on the left",
    tryItLabel: "Got it, let's go!",
  },
  {
    id: 2,
    title: "Chat with Hermes",
    description:
      "Hermes is your primary AI assistant. Ask it anything — it can write code, answer questions, manage tasks, and coordinate your other agents.",
    panel: "🤖 AGENTS → Hermes in the sidebar",
    tryItLabel: "Open Hermes",
  },
  {
    id: 3,
    title: "Ruflo Swarm Orchestration",
    description:
      "Need multiple AI agents working in parallel? Ruflo Swarm lets you spin up a coordinated team of agents for complex, multi-step tasks.",
    panel: "🤖 AGENTS → Ruflo Swarm",
    tryItLabel: "Explore Swarm",
  },
  {
    id: 4,
    title: "Kanban — Track Your Work",
    description:
      "The Kanban board helps you manage tasks visually. Drag cards between columns: Backlog, In Progress, Review, and Done.",
    panel: "🛠️ TOOLS → Kanban",
    tryItLabel: "Open Kanban",
  },
  {
    id: 5,
    title: "Notebook — Capture Ideas",
    description:
      "Notebook is your AI-powered scratchpad. Jot notes, let Hermes expand them, or link them to tasks and goals automatically.",
    panel: "🛠️ TOOLS → Notebook",
    tryItLabel: "Open Notebook",
  },
  {
    id: 6,
    title: "Life Dashboard",
    description:
      "The Life section keeps your personal world organized — Calendar, Travel plans, Family events, Goals tracking, and your daily Journal.",
    panel: "🌱 LIFE → Dashboard",
    tryItLabel: "View My Life",
  },
  {
    id: 7,
    title: "Secrets Vault",
    description:
      "Store API keys, passwords, and sensitive credentials securely. Your secrets are encrypted and only accessible through Mission Control.",
    panel: "⚙️ SYSTEM → Secrets Vault",
    tryItLabel: "Open Vault",
  },
  {
    id: 8,
    title: "You're all set! 🎉",
    description:
      "You've completed the Mission Control tour. Explore at your own pace — click any section in the sidebar to get started. You can always access this guide from Help.",
    panel: "⚙️ SYSTEM → Help",
    tryItLabel: "Finish Tutorial",
  },
];

const STORAGE_KEY = "tutorial_complete";

/* ------------------------------------------------------------------ */
/*  Checkmark animation component                                       */
/* ------------------------------------------------------------------ */

function AnimatedCheckmark({ visible }: { visible: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-5 h-5 rounded-full text-xs transition-all duration-500",
        visible
          ? "bg-emerald-500 text-white scale-100 opacity-100"
          : "bg-white/10 text-transparent scale-75 opacity-0"
      )}
    >
      ✓
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Main TutorialOverlay component                                      */
/* ------------------------------------------------------------------ */

interface TutorialOverlayProps {
  /** Optional: force show (e.g., from Help page) */
  forceShow?: boolean;
  onClose?: () => void;
}

export function TutorialOverlay({ forceShow = false, onClose }: TutorialOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [showCheck, setShowCheck] = useState(false);

  const totalSteps = TUTORIAL_STEPS.length;
  const step = TUTORIAL_STEPS[currentStep];
  const isLastStep = currentStep === totalSteps - 1;

  /* Show on first load if tutorial not complete, or if forced */
  useEffect(() => {
    if (forceShow) {
      setVisible(true);
      return;
    }
    const done = localStorage.getItem(STORAGE_KEY);
    if (!done) {
      setVisible(true);
    }
  }, [forceShow]);

  const markStepComplete = () => {
    setCompletedSteps((prev) => new Set([...prev, currentStep]));
    setShowCheck(true);
    setTimeout(() => setShowCheck(false), 1000);
  };

  const handleNext = () => {
    markStepComplete();
    setTimeout(() => {
      if (isLastStep) {
        handleFinish();
      } else {
        setCurrentStep((prev) => prev + 1);
      }
    }, 600);
  };

  const handleTryIt = () => {
    markStepComplete();
    if (isLastStep) {
      setTimeout(handleFinish, 600);
    }
  };

  const handleFinish = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
    onClose?.();
  };

  const handleSkip = () => {
    handleFinish();
  };

  if (!visible) return null;

  return (
    /* Dark overlay */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => {
        // Close if clicking outside the card
        if (e.target === e.currentTarget) handleSkip();
      }}
    >
      {/* White card */}
      <div className="relative w-full max-w-md rounded-2xl bg-white text-gray-900 shadow-2xl overflow-hidden">

        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-cyan-500 transition-all duration-500"
            style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
          />
        </div>

        {/* Card body */}
        <div className="px-6 py-6">

          {/* Header row */}
          <div className="flex items-center justify-between mb-5">
            {/* Step counter */}
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              {currentStep + 1} of {totalSteps}
            </span>

            {/* Animated checkmark */}
            <AnimatedCheckmark visible={showCheck} />

            {/* Skip button */}
            <button
              onClick={handleSkip}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2"
            >
              Skip tutorial
            </button>
          </div>

          {/* Step progress dots */}
          <div className="flex gap-1.5 mb-5">
            {TUTORIAL_STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === currentStep
                    ? "w-6 bg-cyan-500"
                    : completedSteps.has(i)
                    ? "w-1.5 bg-emerald-400"
                    : "w-1.5 bg-gray-200"
                )}
              />
            ))}
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-gray-900 mb-2 leading-tight">
            {step.title}
          </h2>

          {/* Description */}
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            {step.description}
          </p>

          {/* Panel hint */}
          <div className="flex items-start gap-2 rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 mb-6">
            <span className="text-base mt-0.5">👀</span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-0.5">
                Look at
              </p>
              <p className="text-xs text-gray-700 font-medium">{step.panel}</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            {/* Try it button */}
            <button
              onClick={handleTryIt}
              className="flex-1 rounded-xl bg-gray-100 hover:bg-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors"
            >
              {step.tryItLabel}
            </button>

            {/* Next / Finish button */}
            <button
              onClick={handleNext}
              className={cn(
                "flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors",
                isLastStep
                  ? "bg-emerald-500 hover:bg-emerald-600"
                  : "bg-cyan-500 hover:bg-cyan-600"
              )}
            >
              {isLastStep ? "🎉 Finish Tutorial" : "Next →"}
            </button>
          </div>

          {/* Back link */}
          {currentStep > 0 && (
            <button
              onClick={() => setCurrentStep((prev) => prev - 1)}
              className="mt-3 w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              ← Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default TutorialOverlay;
