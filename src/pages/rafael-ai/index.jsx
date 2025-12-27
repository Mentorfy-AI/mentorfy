import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { UserProvider, useUser } from '../../context/rafael-ai/UserContext'
import { WelcomeScreen } from '../../components/rafael-ai/screens/WelcomeScreen'
import { LevelFlow } from '../../components/rafael-ai/screens/LevelFlow'
import { ChatHome } from '../../components/rafael-ai/screens/ChatHome'
import { ActiveChat } from '../../components/rafael-ai/screens/ActiveChat'

function RafaelAIContent() {
  const { state, dispatch } = useUser()
  const [pendingChatMessage, setPendingChatMessage] = useState(null)

  const currentScreen = state.progress.currentScreen

  const handleStartFromWelcome = () => {
    dispatch({ type: 'SET_SCREEN', payload: 'level' })
  }

  const handleLevelComplete = () => {
    // LevelFlow handles dispatching COMPLETE_LEVEL which sets screen to chat-home
  }

  const handleBackFromLevel = () => {
    dispatch({ type: 'SET_SCREEN', payload: 'welcome' })
  }

  const handleStartLevel = () => {
    dispatch({ type: 'START_LEVEL' })
  }

  const handleStartChat = (message) => {
    setPendingChatMessage(message)
    dispatch({ type: 'SET_SCREEN', payload: 'chat' })
  }

  const handleBackFromChat = () => {
    setPendingChatMessage(null)
    dispatch({ type: 'SET_SCREEN', payload: 'chat-home' })
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Geist', sans-serif" }}>
      <AnimatePresence mode="wait">
        {currentScreen === 'welcome' && (
          <WelcomeScreen
            key="welcome"
            onStart={handleStartFromWelcome}
          />
        )}

        {currentScreen === 'level' && (
          <LevelFlow
            key={`level-${state.progress.currentLevel}`}
            levelId={state.progress.currentLevel}
            onComplete={handleLevelComplete}
            onBack={handleBackFromLevel}
          />
        )}

        {currentScreen === 'chat-home' && (
          <ChatHome
            key="chat-home"
            onStartLevel={handleStartLevel}
            onStartChat={handleStartChat}
          />
        )}

        {currentScreen === 'chat' && (
          <ActiveChat
            key="chat"
            initialMessage={pendingChatMessage}
            onBack={handleBackFromChat}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default function RafaelAI() {
  return (
    <UserProvider>
      <RafaelAIContent />
    </UserProvider>
  )
}
