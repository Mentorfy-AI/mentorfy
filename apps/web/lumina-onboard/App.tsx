
import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { ONBOARDING_QUESTIONS } from './constants';
import { Answers, AnswerValue } from './types';
import { Typewriter } from './components/Typewriter';
import { 
  ShortTextInput, 
  LongTextInput, 
  MultipleChoiceInput, 
  LikertScaleInput, 
  NumberInput, 
  EmailInput 
} from './components/InputComponents';
import { analyzeProfile } from './services/geminiService';

export default function App() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [direction, setDirection] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{title: string, summary: string, tags: string[]} | null>(null);

  const currentQuestion = ONBOARDING_QUESTIONS[currentIndex];
  const isLastQuestion = currentIndex === ONBOARDING_QUESTIONS.length - 1;
  
  const progress = ((currentIndex + 1) / ONBOARDING_QUESTIONS.length) * 100;

  const handleAnswer = (val: AnswerValue) => {
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: val }));
  };

  const validateCurrentQuestion = () => {
    const answer = answers[currentQuestion.id];

    if (currentQuestion.required) {
        if (answer === null || answer === undefined || answer === '') return false;
        if (Array.isArray(answer) && answer.length === 0) return false;
    }

    // Specific type validation
    if (currentQuestion.type === 'long_text' && currentQuestion.minLength && typeof answer === 'string') {
        if (answer.length < currentQuestion.minLength) return false;
    }

    if (currentQuestion.type === 'multiple_choice' && currentQuestion.minSelections && Array.isArray(answer)) {
        if (answer.length < currentQuestion.minSelections) return false;
    }

    return true;
  };

  const nextStep = async () => {
    if (!validateCurrentQuestion()) return;

    if (isLastQuestion) {
      setIsAnalyzing(true);
      const result = await analyzeProfile(answers, ONBOARDING_QUESTIONS);
      setAnalysisResult(result);
      setIsAnalyzing(false);
    } else {
      setDirection(1);
      setCurrentIndex(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(prev => prev - 1);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !isAnalyzing && !analysisResult) {
        // Skip implicit submit for long text (needs shift+enter) or multi-select (needs explicit confirm)
        const skipImplicit = currentQuestion.type === 'long_text' || (currentQuestion.type === 'multiple_choice' && (currentQuestion.maxSelections || 1) > 1);
        
        if (!skipImplicit) {
           // We need to be careful calling nextStep from event listener due to stale state closures
           // Ideally we use a ref or rely on the button click. 
           // For this demo, we'll let the specific inputs handle onEnter props which call nextStep
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentQuestion, isAnalyzing, analysisResult]);

  const renderInput = () => {
    const commonProps = {
      value: answers[currentQuestion.id],
      onChange: handleAnswer,
      onEnter: nextStep
    };

    // Type casting to satisfy TS discriminators based on the switch
    switch (currentQuestion.type) {
      case 'short_text': return <ShortTextInput question={currentQuestion} {...commonProps} />;
      case 'email': return <EmailInput question={currentQuestion} {...commonProps} />;
      case 'long_text': return <LongTextInput question={currentQuestion} {...commonProps} />;
      case 'number_input': return <NumberInput question={currentQuestion} {...commonProps} />;
      case 'multiple_choice': return <MultipleChoiceInput question={currentQuestion} {...commonProps} />;
      case 'likert_scale': return <LikertScaleInput question={currentQuestion} {...commonProps} />;
      default: return null;
    }
  };

  const isValid = validateCurrentQuestion();

  if (analysisResult) {
    return (
      <div className="min-h-[100dvh] w-full bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-400/20 rounded-full blur-[100px] animate-blob" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-400/20 rounded-full blur-[100px] animate-blob animation-delay-2000" />

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }} 
          animate={{ opacity: 1, scale: 1 }} 
          className="max-w-xl w-full bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 p-8 md:p-12 text-center relative z-10"
        >
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-brand-400 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg text-white">
              <Sparkles size={32} />
            </div>
          </div>
          
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-3xl md:text-4xl font-bold text-slate-900 mb-2 font-display"
          >
            {analysisResult.title}
          </motion.h1>
          
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-base md:text-lg text-slate-600 mb-8 leading-relaxed"
          >
            {analysisResult.summary}
          </motion.p>

          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex flex-wrap justify-center gap-3"
          >
            {analysisResult.tags.map((tag, i) => (
              <span key={i} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-full text-sm font-medium uppercase tracking-wide border border-slate-200">
                {tag}
              </span>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-12 pt-8 border-t border-slate-100"
          >
             <button className="w-full md:w-auto bg-slate-900 text-white px-8 py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors shadow-lg hover:shadow-xl hover:-translate-y-0.5 transform">
                Enter Dashboard
             </button>
          </motion.div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="relative min-h-[100dvh] w-full bg-slate-50 text-slate-900 overflow-hidden font-sans selection:bg-brand-100 selection:text-brand-900">
      
      {/* Ambient Background Orbs */}
      <div className="fixed top-[-20%] right-[-5%] w-[600px] h-[600px] bg-blue-400/20 rounded-full blur-[120px] animate-blob mix-blend-multiply pointer-events-none" />
      <div className="fixed bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-300/20 rounded-full blur-[100px] animate-blob animation-delay-4000 mix-blend-multiply pointer-events-none" />

      {/* Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-1 bg-slate-100 z-50">
        <motion.div 
          className="h-full bg-brand-500" 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />
      </div>

      {/* Main Content Area */}
      <main className="relative z-10 flex flex-col min-h-[100dvh] max-w-xl mx-auto px-6 md:px-8">
        
        {/* Navigation Header */}
        <header className="flex justify-between items-center py-6 md:py-8 shrink-0">
          <div className="flex items-center gap-2">
             <div className="w-3 h-3 rounded-full bg-brand-500" />
             <span className="font-display font-bold text-xl tracking-tight text-slate-900">Lumina</span>
          </div>
          <div className="text-xs md:text-sm font-medium text-slate-400 bg-white/50 px-3 py-1 rounded-full backdrop-blur-md border border-white/60">
            Step {currentIndex + 1} of {ONBOARDING_QUESTIONS.length}
          </div>
        </header>

        {/* Question Container */}
        <div className="flex-1 flex flex-col justify-center py-4 md:py-8">
            {isAnalyzing ? (
                 <div className="flex flex-col items-center justify-center space-y-6">
                    <Loader2 className="w-12 h-12 text-brand-500 animate-spin" />
                    <Typewriter text="Analyzing your profile with Gemini AI..." className="text-xl text-slate-500 font-light text-center justify-center" delay={0.2} />
                 </div>
            ) : (
                <AnimatePresence mode="wait" initial={false} custom={direction}>
                    <motion.div
                    key={currentIndex}
                    custom={direction}
                    initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="w-full"
                    >
                        {/* Question Text */}
                        <div className="mb-8 md:mb-10">
                            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-medium leading-tight text-slate-900 mb-4">
                                <Typewriter text={currentQuestion.text} />
                            </h2>
                            {currentQuestion.subtext && (
                            <motion.p 
                                initial={{ opacity: 0 }} 
                                animate={{ opacity: 1 }} 
                                transition={{ delay: 1, duration: 0.8 }}
                                className="text-lg text-slate-500 font-light mt-4"
                            >
                                {currentQuestion.subtext}
                            </motion.p>
                            )}
                        </div>

                        {/* Input Area */}
                        <div className="w-full">
                            {renderInput()}
                        </div>

                    </motion.div>
                </AnimatePresence>
            )}
        </div>

        {/* Footer Navigation */}
        <footer className="py-6 md:py-10 flex justify-between items-center shrink-0">
            <button 
                onClick={prevStep}
                disabled={currentIndex === 0 || isAnalyzing}
                className={`
                    flex items-center gap-2 text-slate-500 font-medium transition-all p-2 -ml-2
                    ${currentIndex === 0 ? 'opacity-0 pointer-events-none' : 'hover:text-slate-800 hover:-translate-x-1'}
                `}
            >
                <ArrowLeft size={20} />
                <span className="hidden md:inline">Back</span>
            </button>

            {!isAnalyzing && (
                <button 
                    onClick={nextStep}
                    disabled={!isValid}
                    className={`
                        group flex items-center gap-3 px-6 md:px-8 py-3 md:py-4 rounded-full font-medium transition-all duration-300
                        ${!isValid
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-slate-900 text-white shadow-xl shadow-slate-900/20 hover:shadow-2xl hover:scale-105 hover:bg-black'
                        }
                    `}
                >
                    <span>{isLastQuestion ? 'Complete' : 'Continue'}</span>
                    <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
                </button>
            )}
        </footer>

      </main>
    </div>
  );
}
