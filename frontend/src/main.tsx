import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { UserProvider } from './context/UserContext'
import { ThemeProvider } from './context/ThemeContext'
import { bootstrapTheme } from './lib/theme'
import './index.css'

bootstrapTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <UserProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </UserProvider>
    </BrowserRouter>
  </StrictMode>,
)
