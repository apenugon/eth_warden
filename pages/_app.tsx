import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { WagmiConfig, createClient, configureChains, goerli} from 'wagmi'
import { publicProvider } from '@wagmi/core/providers/public'
import { mainnet, polygon, foundry } from '@wagmi/core/chains'
import { alchemyProvider } from 'wagmi/providers/alchemy'

import { ChakraProvider } from '@chakra-ui/react'


const { chains, provider, webSocketProvider } = configureChains(
  [polygon],
  [publicProvider()],
);

const client = createClient({
  autoConnect: true,
  provider,
  webSocketProvider,
});


export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
    <WagmiConfig client={client}>
      <ChakraProvider>
        <Component {...pageProps} />
      </ChakraProvider></WagmiConfig>
    </>
  )
}
