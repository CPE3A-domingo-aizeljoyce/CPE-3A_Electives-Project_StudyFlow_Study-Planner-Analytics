import { useNavigate } from 'react-router';
import { Brain, ArrowLeft, GraduationCap, Github, Linkedin, Mail } from 'lucide-react';


const TEAM_MEMBERS = [
  { name: 'Aizel',    role: 'mamamia',  color: '#ec4899', gradient: 'linear-gradient(135deg, #ec4899, #f43f5e)' },
  { name: 'Coleen',           role: 'opo',          color: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6, #c084fc)' },
  { name: 'Allysa',           role: 'aaaaaa',             color: '#06b6d4', gradient: 'linear-gradient(135deg, #06b6d4, #38bdf8)' },
  { name: 'Jerry',            role: 'nya',        color: '#f97316', gradient: 'linear-gradient(135deg, #f97316, #fbbf24)' },
  { name: 'Randel', role: 'omz',           color: '#22c55e', gradient: 'linear-gradient(135deg, #22c55e, #4ade80)' }
];

export function AboutUs() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ background: '#0d1117', fontFamily: "'Inter', sans-serif", color: '#e2e8f0' }}>

      {/* Nav */}
      <nav 
        className="fixed top-0 left-0 right-0 z-50 flex items-center px-4 py-3 sm:px-6 sm:py-5"
        style={{ background: 'rgba(13,17,23,0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(26,37,64,0.6)' }}
      >
        <button onClick={() => navigate('/')} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mr-6">
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium"></span>
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 0 20px rgba(99,102,241,0.45)' }}>
            <Brain className="w-4 h-4 text-white" />
          </div>
          <span className="text-white text-base" style={{ fontWeight: 700, letterSpacing: '-0.3px' }}>AcadFlu</span>
        </div>
      </nav>

      {/* Header */}
      <section className="pt-32 pb-16 px-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs mb-6"
          style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', fontWeight: 600 }}>
          <GraduationCap className="w-3.5 h-3.5" />
          BS Computer Engineering
        </div>
        <h1 className="text-4xl md:text-5xl text-white mb-4" style={{ fontWeight: 800, letterSpacing: '-1px' }}>
          Meet the Creators
        </h1>
        <p className="max-w-2xl mx-auto text-slate-400 text-lg" style={{ lineHeight: 1.7 }}>
          We are a team of passionate Computer Engineering students from Bulacan State University. AcadFlu is our solution to the ultimate student dilemma: staying focused in a world full of distractions.
        </p>
      </section>

      {/* Team Grid */}
      <section className="px-6 md:px-12 pb-32">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {TEAM_MEMBERS.map((member, i) => (
            <div key={i} className="p-6 rounded-3xl flex flex-col items-center text-center group transition-all duration-300 hover:-translate-y-1" 
              style={{ background: '#131929', border: '1px solid #1a2540', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
              
              {/* IMAGE PLACEHOLDER */}
              <div className="w-24 h-24 rounded-full mb-4 flex items-center justify-center text-3xl font-bold text-white relative overflow-hidden"
                style={{ background: member.gradient }}>
                {member.name.charAt(0)}
                {/* TODO: Kapag may pictures na kayo, palitan lang ito ng:
                  <img src="/path-to-pic.jpg" alt={member.name} className="w-full h-full object-cover" />
                */}
              </div>
              
              <h3 className="text-lg text-white mb-1" style={{ fontWeight: 700 }}>{member.name}</h3>
              <p className="text-sm mb-4" style={{ color: member.color, fontWeight: 500 }}>{member.role}</p>
              
              <p className="text-xs text-slate-500 mb-6 px-2">
                Computer Engineering student dedicated to building efficient and user-friendly systems.
              </p>

              {/* Social Links Placeholder */}
              <div className="flex items-center gap-3 mt-auto">
                <button className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors">
                  <Github className="w-4 h-4" />
                </button>
                <button className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors">
                  <Linkedin className="w-4 h-4" />
                </button>
                <button className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white transition-colors">
                  <Mail className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8" style={{ borderTop: '1px solid #1a2540' }}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5" style={{ color: '#8b5cf6' }} />
            <span className="text-slate-400 text-sm" style={{ fontWeight: 600 }}>AcadFlu Team</span>
          </div>
          <div className="text-slate-600 text-xs text-center sm:text-right">
            © 2026 Bulacan State University<br />
            BSCpE Main Campus
          </div>
        </div>
      </footer>
    </div>
  );
}