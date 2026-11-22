import { MotionConfig } from 'framer-motion';
import { Hero } from './sections/Hero';
import { Why } from './sections/Why';
import { Architecture } from './sections/Architecture';
import { Pipeline } from './sections/Pipeline';
import { Modes } from './sections/Modes';
import { Code } from './sections/Code';
import { Types } from './sections/Types';
import { Api } from './sections/Api';
import { Start } from './sections/Start';
import { BackToTop } from './components/layout/BackToTop';
import { BackgroundDecor } from './components/layout/BackgroundDecor';
import { Footer } from './components/layout/Footer';
import { Navbar } from './components/layout/Navbar';
import { LiveFallbackNotice } from './components/live/LiveFallbackNotice';
import { MigrationModeProvider } from './hooks/useMigrationMode';
import { LiveModeProvider } from './hooks/useLiveMode';

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <MigrationModeProvider>
        <LiveModeProvider>
          <div className="relative min-h-screen">
            <a className="skip-link" href="#main">
              Перейти к содержанию
            </a>
            <BackgroundDecor />
            <div className="relative z-10">
              <Navbar />
              <LiveFallbackNotice />
              <main id="main">
                <Hero />
                <Why />
                <Architecture />
                <Pipeline />
                <Modes />
                <Code />
                <Types />
                <Api />
                <Start />
              </main>
              <Footer />
              <BackToTop />
            </div>
          </div>
        </LiveModeProvider>
      </MigrationModeProvider>
    </MotionConfig>
  );
}
