import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { WagmiConfig, createClient, configureChains, goerli} from 'wagmi'
import { publicProvider } from '@wagmi/core/providers/public'
import { mainnet, polygon, foundry } from '@wagmi/core/chains'
import { alchemyProvider } from 'wagmi/providers/alchemy'

import { ChakraProvider, color, extendTheme, StyleFunctionProps } from '@chakra-ui/react'
import {mode } from '@chakra-ui/theme-tools'
import { config } from 'chai'


const { chains, provider, webSocketProvider } = configureChains(
  [polygon],
  [publicProvider()],
);

const client = createClient({
  autoConnect: true,
  provider,
  webSocketProvider,
});

const theme = extendTheme({
  styles: {
    global: (props: StyleFunctionProps) => ({
      body: {
        bg: "purple.400",
        bgGradient: 'linear(to-b, purple.100, purple.500)',
        h: '100vh',
      }
    })
  },
})


export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
    <WagmiConfig client={client}>
      <ChakraProvider theme={theme}>
        <Component {...pageProps} />
      </ChakraProvider></WagmiConfig>
    </>
  )
}
