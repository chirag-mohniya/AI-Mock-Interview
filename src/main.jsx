import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { QuestionBank } from './App.jsx'
// import MockInterviewApp from './components/QuestionBank.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QuestionBank />
  </StrictMode>
)
