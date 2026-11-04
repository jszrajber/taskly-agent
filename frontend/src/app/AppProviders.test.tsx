import { QueryClient, useQueryClient } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { useTheme } from 'styled-components'
import { expect, it, vi } from 'vitest'
import { GlobalStyles, theme } from '../design-system'
import { queryClient } from '../lib/queryClient'
import { AppProviders } from './AppProviders'

vi.mock('../design-system', () => import('../design-system/mocks'))

function Probe() {
  const client = useQueryClient()
  const currentTheme = useTheme()
  return (
    <p>
      {client === queryClient ? 'default client' : 'custom client'}
      {currentTheme === theme ? ' with theme' : ' without theme'}
    </p>
  )
}

it('renders children with the default query client, theme and global styles', () => {
  render(
    <AppProviders>
      <Probe />
    </AppProviders>,
  )

  expect(screen.getByText('default client with theme')).toBeInTheDocument()
  expect(GlobalStyles).toHaveBeenCalled()
})

it('uses a query client passed in by the caller', () => {
  render(
    <AppProviders client={new QueryClient()}>
      <Probe />
    </AppProviders>,
  )

  expect(screen.getByText('custom client with theme')).toBeInTheDocument()
})
