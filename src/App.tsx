import CryptoGraph from './components/CryptoGraph'
import { CssBaseline, ThemeProvider, createTheme, useMediaQuery, Box, IconButton } from '@mui/material'
import { useState, useMemo } from 'react'
import Brightness4Icon from '@mui/icons-material/Brightness4'
import Brightness7Icon from '@mui/icons-material/Brightness7'

function App() {
  // Use system preference as the default theme mode
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)')
  const [mode, setMode] = useState<'light' | 'dark'>(prefersDarkMode ? 'dark' : 'light')

  // Create a theme with the current mode
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          // You can customize other theme colors here
        },
      }),
    [mode]
  )

  // Toggle between light and dark mode
  const toggleColorMode = () => {
    setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'))
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ position: 'absolute', right: 16, top: 16 }}>
        <IconButton onClick={toggleColorMode} color="inherit">
          {theme.palette.mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
        </IconButton>
      </Box>
      <CryptoGraph />
    </ThemeProvider>
  )
}

export default App 