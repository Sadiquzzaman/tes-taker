import Link from "next/link";
import TestTakerLogoMarkSVG from "@/component/svg/TestTakerLogoMarkSVG";
import LandingPricing from "@/component/Landing/LandingPricing";

const features = [
  {
    title: "Create exams in minutes",
    description: "Build graded, ungraded, and passage-based questions with a guided wizard.",
  },
  {
    title: "Manage classes effortlessly",
    description: "Invite students, track participation, and keep everything organized in one place.",
  },
  {
    title: "AI-powered proctoring",
    description: "Detect tab switches, face presence, copy-paste, and more — scaled to your plan.",
  },
  {
    title: "Instant grading & analytics",
    description: "Auto-grade objective questions and review subjective answers with rich insights.",
  },
];

const proctoringHighlights = [
  "Tab switch & fullscreen monitoring",
  "Face detection & multiple-face alerts",
  "Copy-paste & browser change detection",
  "Auto-disqualification on Pro plans",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "Instrument Sans, sans-serif" }}>
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-[#EFF0F3]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TestTakerLogoMarkSVG width={28} />
            <span className="text-xl font-bold text-[#49734F]" style={{ fontFamily: "Public Sans, sans-serif" }}>
              instructor<span className="text-[#232A25]">.academy</span>
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-[#747775]">
            <a href="#features" className="hover:text-[#232A25] transition-colors">
              Features
            </a>
            <a href="#proctoring" className="hover:text-[#232A25] transition-colors">
              Proctoring
            </a>
            <a href="#pricing" className="hover:text-[#232A25] transition-colors">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-[#747775] hover:text-[#232A25] transition-colors">
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-sm px-4 py-2 rounded-[8px] bg-[#49734F] text-white hover:bg-[#3d6242] transition-colors"
            >
              Sign up free
            </Link>
          </div>
        </div>
      </header>

      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-sm font-medium text-[#49734F] mb-4 uppercase tracking-wide">For educators</p>
            <h1
              className="text-4xl md:text-5xl lg:text-6xl text-[#232A25] leading-tight mb-6"
              style={{ fontFamily: "DM Serif Display, serif" }}
            >
              Run secure online exams with confidence
            </h1>
            <p className="text-lg text-[#747775] mb-8 max-w-lg">
              instructor.academy helps teachers create, proctor, and grade exams — from a free starter plan to
              enterprise-grade monitoring.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/signup"
                className="px-6 py-3 rounded-[8px] bg-[#49734F] text-white font-medium hover:bg-[#3d6242] transition-colors"
              >
                Start for free
              </Link>
              <a
                href="#pricing"
                className="px-6 py-3 rounded-[8px] border border-[#49734F] text-[#49734F] font-medium hover:bg-[#49734F]/5 transition-colors"
              >
                View plans
              </a>
            </div>
          </div>
          <div className="bg-[#EFF0F3] rounded-[16px] p-8 min-h-[320px] flex items-center justify-center">
            <div className="text-center">
              <TestTakerLogoMarkSVG width={64} />
              <p className="mt-4 text-[#747775] text-sm">Trusted by educators across Bangladesh</p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 px-6 bg-[#EFF0F3]/50">
        <div className="max-w-6xl mx-auto">
          <h2
            className="text-3xl md:text-4xl text-[#232A25] text-center mb-12"
            style={{ fontFamily: "DM Serif Display, serif" }}
          >
            Everything you need to teach online
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <div key={feature.title} className="bg-white rounded-[12px] p-6 border border-[#EFF0F3]">
                <h3 className="font-semibold text-[#232A25] mb-2" style={{ fontFamily: "Public Sans, sans-serif" }}>
                  {feature.title}
                </h3>
                <p className="text-sm text-[#747775]">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="proctoring" className="py-20 px-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2
              className="text-3xl md:text-4xl text-[#232A25] mb-4"
              style={{ fontFamily: "DM Serif Display, serif" }}
            >
              Smart proctoring, plan by plan
            </h2>
            <p className="text-[#747775] mb-6">
              From basic tab monitoring on Free to full AI video proctoring on Pro — unlock exactly what your exams
              need.
            </p>
            <ul className="space-y-3">
              {proctoringHighlights.map((item) => (
                <li key={item} className="flex items-center gap-3 text-[#232A25]">
                  <span className="w-5 h-5 rounded-full bg-[#49734F]/10 text-[#49734F] flex items-center justify-center text-xs">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-[#232A25] rounded-[16px] p-8 text-white">
            <p className="text-sm text-white/70 mb-2">Pro plan includes</p>
            <p className="text-2xl font-semibold mb-4" style={{ fontFamily: "Public Sans, sans-serif" }}>
              Real-time alerts & auto-disqualification
            </p>
            <p className="text-white/80 text-sm">
              Monitor phone usage, voice activity, and suspicious behavior — with student risk scoring and push
              notifications.
            </p>
          </div>
        </div>
      </section>

      <LandingPricing />

      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2
            className="text-3xl md:text-4xl text-[#232A25] mb-4"
            style={{ fontFamily: "DM Serif Display, serif" }}
          >
            Ready to transform your exams?
          </h2>
          <p className="text-[#747775] mb-8">
            Join instructor.academy today. Free plan includes 2 lifetime exams — no credit card required.
          </p>
          <Link
            href="/signup"
            className="inline-block px-8 py-3 rounded-[8px] bg-[#49734F] text-white font-medium hover:bg-[#3d6242] transition-colors"
          >
            Create your free account
          </Link>
        </div>
      </section>

      <footer className="border-t border-[#EFF0F3] py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <TestTakerLogoMarkSVG width={24} />
            <span className="text-sm font-semibold text-[#49734F]" style={{ fontFamily: "Public Sans, sans-serif" }}>
              instructor.academy
            </span>
          </div>
          <p className="text-sm text-[#747775]">© {new Date().getFullYear()} instructor.academy. All rights reserved.</p>
          <div className="flex gap-6 text-sm text-[#747775]">
            <Link href="/login" className="hover:text-[#232A25]">
              Log in
            </Link>
            <Link href="/signup" className="hover:text-[#232A25]">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
