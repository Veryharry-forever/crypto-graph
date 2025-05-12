import CryptoGraph from './components/CryptoGraph'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'

const theme = createTheme({
  palette: {
    mode: 'light',
  },
})

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <CryptoGraph />
    </ThemeProvider>
  )
}

export default App 