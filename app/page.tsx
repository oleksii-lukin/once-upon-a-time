import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900">
      {/* Header */}
      <header className="fixed top-0 w-full bg-black/20 backdrop-blur-sm border-b border-white/10 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Once Upon a Time</h1>
          <div>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full border border-white/20 transition-all">
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 pt-32 pb-16">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-6xl font-bold text-white mb-6 leading-tight">
            Tell Your Story
          </h2>
          <p className="text-xl text-purple-200 mb-12 max-w-2xl mx-auto">
            An online storytelling card game where creativity meets competition.
            Weave tales, interrupt narratives, and race to your happily ever after.
          </p>

          <div className="flex gap-4 justify-center">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="px-8 py-4 bg-white text-purple-900 rounded-full font-semibold text-lg hover:bg-purple-50 transition-all shadow-lg">
                  Get Started
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <a
                href="/lobby"
                className="px-8 py-4 bg-white text-purple-900 rounded-full font-semibold text-lg hover:bg-purple-50 transition-all shadow-lg"
              >
                Enter Lobby
              </a>
            </SignedIn>
            <button className="px-8 py-4 bg-white/10 text-white rounded-full font-semibold text-lg hover:bg-white/20 transition-all border border-white/20">
              Learn More
            </button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-24 max-w-5xl mx-auto">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
            <div className="text-4xl mb-4">🎭</div>
            <h3 className="text-xl font-semibold text-white mb-3">Real-time Gameplay</h3>
            <p className="text-purple-200">
              Play with friends in real-time with video chat and seamless card interactions.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
            <div className="text-4xl mb-4">📖</div>
            <h3 className="text-xl font-semibold text-white mb-3">Classic Storytelling</h3>
            <p className="text-purple-200">
              Experience the beloved card game in a digital format with all original mechanics.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
            <div className="text-4xl mb-4">🎮</div>
            <h3 className="text-xl font-semibold text-white mb-3">Easy to Learn</h3>
            <p className="text-purple-200">
              Jump right in with intuitive controls and helpful tutorials for new players.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
